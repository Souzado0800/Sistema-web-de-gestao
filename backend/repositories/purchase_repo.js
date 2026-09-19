/**
 * Repositório de Reposição e Ordens de Compra.
 */
const db = require('../db');

/**
 * Retorna produtos com necessidade de reposição (current_stock <= min_stock).
 */
async function findReplenishmentNeeds() {
  const sql = `
    SELECT 
      p.id,
      p.sku,
      p.name,
      p.unit_measure,
      p.current_stock,
      p.min_stock,
      p.ideal_stock,
      p.reference_price,
      p.location,
      c.name as category_name,
      s.id as supplier_id,
      s.name as supplier_name,
      CASE 
        WHEN p.current_stock <= 0 THEN 'zero'
        WHEN p.current_stock <= (p.min_stock * 0.5) THEN 'critical'
        ELSE 'low'
      END as urgency,
      GREATEST(p.ideal_stock - p.current_stock, 1) as suggested_quantity,
      (GREATEST(p.ideal_stock - p.current_stock, 1) * p.reference_price) as estimated_cost
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.primary_supplier_id = s.id
    WHERE p.status = 'active' AND p.current_stock <= p.min_stock
    ORDER BY p.current_stock ASC, (p.min_stock - p.current_stock) DESC
  `;
  const res = await db.query(sql);
  return res.rows;
}

async function findAllOrders({ status = null, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (status && status !== 'all') {
    conditions.push(`po.status = $${idx++}`);
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await db.query(`SELECT COUNT(*) as total FROM purchase_orders po ${whereClause}`, params);
  const total = parseInt(countRes.rows[0].total, 10);

  const dataParams = [...params, limit, offset];
  const sql = `
    SELECT 
      po.*,
      s.name as supplier_name,
      u.full_name as created_by_name,
      COUNT(poi.id) as total_items,
      SUM(poi.quantity_ordered) as total_units_ordered,
      SUM(poi.quantity_received) as total_units_received
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN users u ON po.created_by = u.id
    LEFT JOIN purchase_order_items poi ON po.id = poi.order_id
    ${whereClause}
    GROUP BY po.id, s.name, u.full_name
    ORDER BY po.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `;
  const res = await db.query(sql, dataParams);
  return {
    data: res.rows,
    total,
    limit,
    offset
  };
}

async function findOrderById(id) {
  const sql = `
    SELECT 
      po.*,
      s.name as supplier_name,
      s.cnpj as supplier_cnpj,
      s.phone as supplier_phone,
      s.email as supplier_email,
      u.full_name as created_by_name
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN users u ON po.created_by = u.id
    WHERE po.id = $1
  `;
  const res = await db.query(sql, [id]);
  if (!res.rows[0]) return null;

  const order = res.rows[0];

  const itemsSql = `
    SELECT 
      poi.*,
      p.name as product_name,
      p.sku as product_sku,
      p.unit_measure,
      p.current_stock
    FROM purchase_order_items poi
    JOIN products p ON poi.product_id = p.id
    WHERE poi.order_id = $1
    ORDER BY p.name ASC
  `;
  const itemsRes = await db.query(itemsSql, [id]);
  order.items = itemsRes.rows;

  return order;
}

async function createOrder({ code, supplier_id = null, notes = '', created_by = null, items = [] }, client = null) {
  const executor = client || db;

  let totalEstimated = 0;
  for (const item of items) {
    const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
    totalEstimated += itemTotal;
  }

  const orderSql = `
    INSERT INTO purchase_orders (code, supplier_id, notes, created_by, status, total_estimated)
    VALUES ($1, $2, $3, $4, 'planejado', $5)
    RETURNING *
  `;
  const orderRes = await executor.query(orderSql, [code, supplier_id || null, notes, created_by, totalEstimated]);
  const order = orderRes.rows[0];

  for (const item of items) {
    const itemSql = `
      INSERT INTO purchase_order_items (order_id, product_id, quantity_ordered, unit_price, total_price, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
    await executor.query(itemSql, [
      order.id,
      item.product_id,
      parseFloat(item.quantity),
      parseFloat(item.unit_price) || 0,
      itemTotal,
      item.notes || ''
    ]);
  }

  return findOrderById(order.id);
}

async function updateStatus(id, status, client = null) {
  const executor = client || db;
  const res = await executor.query(
    `UPDATE purchase_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return res.rows[0] || null;
}

module.exports = {
  findReplenishmentNeeds,
  findAllOrders,
  findOrderById,
  createOrder,
  updateStatus
};
