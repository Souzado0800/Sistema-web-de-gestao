/**
 * Repositório de Inventário Físico e Conferência de Estoque.
 */
const db = require('../db');

async function findAllSessions({ limit = 50, offset = 0 } = {}) {
  const countRes = await db.query(`SELECT COUNT(*) as total FROM inventory_sessions`);
  const total = parseInt(countRes.rows[0].total, 10);

  const sql = `
    SELECT 
      s.*,
      c.name as category_name,
      u.full_name as created_by_name
    FROM inventory_sessions s
    LEFT JOIN categories c ON s.category_id = c.id
    LEFT JOIN users u ON s.created_by = u.id
    ORDER BY s.created_at DESC
    LIMIT $1 OFFSET $2
  `;
  const res = await db.query(sql, [limit, offset]);

  if (res.rows.length === 0) {
    return { data: [], total, limit, offset };
  }

  const itemsAgg = await db.query(`
    SELECT 
      session_id, 
      COUNT(id) as total_items_counted, 
      COALESCE(SUM(ABS(difference)), 0) as total_divergence 
    FROM inventory_items 
    GROUP BY session_id
  `);
  const aggMap = {};
  itemsAgg.rows.forEach(r => {
    aggMap[r.session_id] = {
      total_items_counted: parseInt(r.total_items_counted, 10) || 0,
      total_divergence: parseFloat(r.total_divergence) || 0
    };
  });

  const data = res.rows.map(s => ({
    ...s,
    total_items_counted: aggMap[s.id] ? aggMap[s.id].total_items_counted : 0,
    total_divergence: aggMap[s.id] ? aggMap[s.id].total_divergence : 0
  }));

  return {
    data,
    total,
    limit,
    offset
  };
}

async function findSessionById(id) {
  const sql = `
    SELECT 
      s.*,
      c.name as category_name,
      u.full_name as created_by_name
    FROM inventory_sessions s
    LEFT JOIN categories c ON s.category_id = c.id
    LEFT JOIN users u ON s.created_by = u.id
    WHERE s.id = $1
  `;
  const res = await db.query(sql, [id]);
  if (!res.rows[0]) return null;

  const session = res.rows[0];

  const itemsSql = `
    SELECT 
      i.*,
      p.name as product_name,
      p.sku as product_sku,
      p.unit_measure
    FROM inventory_items i
    JOIN products p ON i.product_id = p.id
    WHERE i.session_id = $1
    ORDER BY p.name ASC
  `;
  const itemsRes = await db.query(itemsSql, [id]);
  session.items = itemsRes.rows;

  return session;
}

async function createSession({ code, title, category_id = null, notes = '', created_by = null }, client = null) {
  const sql = `
    INSERT INTO inventory_sessions (code, title, category_id, notes, created_by, status)
    VALUES ($1, $2, $3, $4, $5, 'open')
    RETURNING *
  `;
  const executor = client || db;
  const res = await executor.query(sql, [code, title, category_id || null, notes, created_by]);
  return res.rows[0];
}

async function addItem({ session_id, product_id, expected_stock, counted_stock, notes = '' }, client = null) {
  const diff = parseFloat(counted_stock) - parseFloat(expected_stock);
  const sql = `
    INSERT INTO inventory_items (session_id, product_id, expected_stock, counted_stock, difference, notes)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const executor = client || db;
  const res = await executor.query(sql, [
    session_id,
    product_id,
    parseFloat(expected_stock),
    parseFloat(counted_stock),
    diff,
    notes
  ]);
  return res.rows[0];
}

async function finalizeSession(id, client = null) {
  const sql = `
    UPDATE inventory_sessions SET
      status = 'completed',
      finalized_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
  const executor = client || db;
  const res = await executor.query(sql, [id]);
  return res.rows[0] || null;
}

module.exports = {
  findAllSessions,
  findSessionById,
  createSession,
  addItem,
  finalizeSession
};
