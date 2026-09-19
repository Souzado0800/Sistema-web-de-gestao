/**
 * Repositório de Produtos e Materiais.
 */
const db = require('../db');

async function findAll({ search = '', category_id = null, status = 'active', stock_status = '', limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (status && status !== 'all') {
    conditions.push(`p.status = $${paramIdx++}`);
    params.push(status);
  }

  if (category_id) {
    conditions.push(`p.category_id = $${paramIdx++}`);
    params.push(parseInt(category_id, 10));
  }

  if (search && search.trim().length > 0) {
    conditions.push(`(p.name ILIKE $${paramIdx} OR p.sku ILIKE $${paramIdx} OR p.location ILIKE $${paramIdx} OR s.name ILIKE $${paramIdx})`);
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }

  if (stock_status === 'zero') {
    conditions.push(`p.current_stock <= 0`);
  } else if (stock_status === 'low') {
    conditions.push(`p.current_stock > 0 AND p.current_stock <= p.min_stock`);
  } else if (stock_status === 'normal') {
    conditions.push(`p.current_stock > p.min_stock`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Conta total
  const countSql = `
    SELECT COUNT(*) as total 
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.primary_supplier_id = s.id
    ${whereClause}
  `;
  const countRes = await db.query(countSql, params);
  const total = parseInt(countRes.rows[0].total, 10);

  // Busca dados paginados
  const dataParams = [...params, limit, offset];
  const dataSql = `
    SELECT 
      p.*,
      c.name as category_name,
      c.color as category_color,
      s.name as supplier_name,
      CASE 
        WHEN p.current_stock <= 0 THEN 'zero'
        WHEN p.current_stock <= (p.min_stock * 0.5) THEN 'critical'
        WHEN p.current_stock <= p.min_stock THEN 'low'
        ELSE 'normal'
      END as stock_alert_level
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.primary_supplier_id = s.id
    ${whereClause}
    ORDER BY p.name ASC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;
  const dataRes = await db.query(dataSql, dataParams);

  return {
    data: dataRes.rows,
    total,
    limit,
    offset
  };
}

async function findById(id) {
  const sql = `
    SELECT 
      p.*,
      c.name as category_name,
      c.color as category_color,
      s.name as supplier_name,
      CASE 
        WHEN p.current_stock <= 0 THEN 'zero'
        WHEN p.current_stock <= (p.min_stock * 0.5) THEN 'critical'
        WHEN p.current_stock <= p.min_stock THEN 'low'
        ELSE 'normal'
      END as stock_alert_level
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.primary_supplier_id = s.id
    WHERE p.id = $1
  `;
  const res = await db.query(sql, [id]);
  return res.rows[0] || null;
}

async function findBySku(sku) {
  const res = await db.query(`SELECT * FROM products WHERE UPPER(sku) = UPPER($1)`, [sku]);
  return res.rows[0] || null;
}

async function create(data) {
  const sql = `
    INSERT INTO products (
      sku, name, category_id, unit_measure, description,
      current_stock, min_stock, ideal_stock, location,
      primary_supplier_id, reference_price, notes, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
  `;
  const values = [
    data.sku.trim().toUpperCase(),
    data.name.trim(),
    data.category_id || null,
    data.unit_measure || 'Unidade',
    data.description || '',
    parseFloat(data.current_stock) || 0,
    parseFloat(data.min_stock) || 0,
    parseFloat(data.ideal_stock) || 0,
    data.location || '',
    data.primary_supplier_id || null,
    parseFloat(data.reference_price) || 0,
    data.notes || '',
    data.status || 'active'
  ];
  const res = await db.query(sql, values);
  return res.rows[0];
}

async function update(id, data) {
  const sql = `
    UPDATE products SET
      sku = $1,
      name = $2,
      category_id = $3,
      unit_measure = $4,
      description = $5,
      min_stock = $6,
      ideal_stock = $7,
      location = $8,
      primary_supplier_id = $9,
      reference_price = $10,
      notes = $11,
      status = $12,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $13
    RETURNING *
  `;
  const values = [
    data.sku.trim().toUpperCase(),
    data.name.trim(),
    data.category_id || null,
    data.unit_measure || 'Unidade',
    data.description || '',
    parseFloat(data.min_stock) || 0,
    parseFloat(data.ideal_stock) || 0,
    data.location || '',
    data.primary_supplier_id || null,
    parseFloat(data.reference_price) || 0,
    data.notes || '',
    data.status || 'active',
    id
  ];
  const res = await db.query(sql, values);
  return res.rows[0] || null;
}

async function archive(id) {
  const res = await db.query(`UPDATE products SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id]);
  return res.rows[0] || null;
}

async function getStockMetrics() {
  const sql = `
    SELECT 
      COUNT(*) FILTER (WHERE status = 'active') as total_active_products,
      COALESCE(SUM(current_stock * reference_price) FILTER (WHERE status = 'active'), 0) as total_stock_value,
      COUNT(*) FILTER (WHERE status = 'active' AND current_stock <= 0) as zero_stock_count,
      COUNT(*) FILTER (WHERE status = 'active' AND current_stock > 0 AND current_stock <= (min_stock * 0.5)) as critical_stock_count,
      COUNT(*) FILTER (WHERE status = 'active' AND current_stock > 0 AND current_stock <= min_stock) as low_stock_count,
      COUNT(*) FILTER (WHERE status = 'active' AND current_stock > min_stock) as normal_stock_count
    FROM products
  `;
  const res = await db.query(sql);
  return res.rows[0];
}

module.exports = {
  findAll,
  findById,
  findBySku,
  create,
  update,
  archive,
  getStockMetrics
};
