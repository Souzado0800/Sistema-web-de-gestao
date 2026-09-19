/**
 * Repositório de Movimentações de Estoque (Entrada, Saída, Ajuste, Inventário).
 */
const db = require('../db');

async function findAll({
  product_id = null,
  category_id = null,
  movement_type = null,
  department_id = null,
  user_id = null,
  start_date = null,
  end_date = null,
  search = '',
  limit = 50,
  offset = 0
} = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (product_id) {
    conditions.push(`m.product_id = $${idx++}`);
    params.push(parseInt(product_id, 10));
  }
  if (category_id) {
    conditions.push(`p.category_id = $${idx++}`);
    params.push(parseInt(category_id, 10));
  }
  if (movement_type && movement_type !== 'all') {
    conditions.push(`m.movement_type = $${idx++}`);
    params.push(movement_type.toUpperCase());
  }
  if (department_id) {
    conditions.push(`m.department_id = $${idx++}`);
    params.push(parseInt(department_id, 10));
  }
  if (user_id) {
    conditions.push(`m.user_id = $${idx++}`);
    params.push(parseInt(user_id, 10));
  }
  if (start_date) {
    conditions.push(`m.created_at >= $${idx++}`);
    params.push(new Date(start_date));
  }
  if (end_date) {
    conditions.push(`m.created_at <= $${idx++}`);
    params.push(new Date(end_date));
  }
  if (search && search.trim().length > 0) {
    conditions.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx} OR m.responsible_person ILIKE $${idx} OR m.invoice_number ILIKE $${idx})`);
    params.push(`%${search.trim()}%`);
    idx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) as total
    FROM stock_movements m
    JOIN products p ON m.product_id = p.id
    ${whereClause}
  `;
  const countRes = await db.query(countSql, params);
  const total = parseInt(countRes.rows[0].total, 10);

  const dataParams = [...params, limit, offset];
  const dataSql = `
    SELECT 
      m.*,
      p.name as product_name,
      p.sku as product_sku,
      p.unit_measure,
      c.name as category_name,
      d.name as department_name,
      u.full_name as user_name,
      s.name as supplier_name
    FROM stock_movements m
    JOIN products p ON m.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN departments d ON m.department_id = d.id
    LEFT JOIN users u ON m.user_id = u.id
    LEFT JOIN suppliers s ON m.supplier_id = s.id
    ${whereClause}
    ORDER BY m.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `;
  const dataRes = await db.query(dataSql, dataParams);

  return {
    data: dataRes.rows,
    total,
    limit,
    offset
  };
}

async function findByProductId(productId, limit = 20) {
  const sql = `
    SELECT 
      m.*,
      d.name as department_name,
      u.full_name as user_name,
      s.name as supplier_name
    FROM stock_movements m
    LEFT JOIN departments d ON m.department_id = d.id
    LEFT JOIN users u ON m.user_id = u.id
    LEFT JOIN suppliers s ON m.supplier_id = s.id
    WHERE m.product_id = $1
    ORDER BY m.created_at DESC
    LIMIT $2
  `;
  const res = await db.query(sql, [productId, limit]);
  return res.rows;
}

async function create(movementData, client = null) {
  const sql = `
    INSERT INTO stock_movements (
      product_id, movement_type, quantity, previous_stock, resulting_stock,
      reason, department_id, responsible_person, user_id, supplier_id,
      invoice_number, unit_price, total_price, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *
  `;
  const values = [
    movementData.product_id,
    movementData.movement_type,
    parseFloat(movementData.quantity),
    parseFloat(movementData.previous_stock),
    parseFloat(movementData.resulting_stock),
    movementData.reason,
    movementData.department_id || null,
    movementData.responsible_person || null,
    movementData.user_id || null,
    movementData.supplier_id || null,
    movementData.invoice_number || null,
    parseFloat(movementData.unit_price) || 0,
    parseFloat(movementData.total_price) || 0,
    movementData.notes || null
  ];

  const executor = client || db;
  const res = await executor.query(sql, values);
  return res.rows[0];
}

async function getSummaryByPeriod(days = 30) {
  const sql = `
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM-DD') as day,
      COALESCE(SUM(CASE WHEN movement_type = 'ENTRADA' THEN quantity ELSE 0 END), 0) as total_in,
      COALESCE(SUM(CASE WHEN movement_type = 'SAIDA' THEN quantity ELSE 0 END), 0) as total_out
    FROM stock_movements
    WHERE created_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
    ORDER BY day ASC
  `;
  const res = await db.query(sql);
  return res.rows;
}

async function getTopConsumedProducts(limit = 5, days = 30) {
  const sql = `
    SELECT 
      p.id,
      p.name,
      p.sku,
      p.unit_measure,
      c.name as category_name,
      SUM(m.quantity) as total_consumed
    FROM stock_movements m
    JOIN products p ON m.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE m.movement_type = 'SAIDA'
      AND m.created_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'
    GROUP BY p.id, p.name, p.sku, p.unit_measure, c.name
    ORDER BY total_consumed DESC
    LIMIT $1
  `;
  const res = await db.query(sql, [limit]);
  return res.rows;
}

module.exports = {
  findAll,
  findByProductId,
  create,
  getSummaryByPeriod,
  getTopConsumedProducts
};
