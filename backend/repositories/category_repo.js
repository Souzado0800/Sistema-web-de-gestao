/**
 * Repositório de Categorias.
 */
const db = require('../db');

async function findAll() {
  const sql = `
    SELECT 
      c.*,
      COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
    GROUP BY c.id
    ORDER BY c.name ASC
  `;
  const res = await db.query(sql);
  return res.rows;
}

async function findById(id) {
  const res = await db.query(`SELECT * FROM categories WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function create(data) {
  const sql = `
    INSERT INTO categories (name, description, color)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const res = await db.query(sql, [data.name.trim(), data.description || '', data.color || '#2563eb']);
  return res.rows[0];
}

async function update(id, data) {
  const sql = `
    UPDATE categories SET
      name = $1,
      description = $2,
      color = $3
    WHERE id = $4
    RETURNING *
  `;
  const res = await db.query(sql, [data.name.trim(), data.description || '', data.color || '#2563eb', id]);
  return res.rows[0] || null;
}

async function remove(id) {
  // Verifica se há produtos vinculados
  const check = await db.query(`SELECT COUNT(*) as total FROM products WHERE category_id = $1`, [id]);
  const total = parseInt(check.rows[0].total, 10);
  if (total > 0) {
    const err = new Error(`Não é possível excluir esta categoria pois existem ${total} produto(s) vinculado(s) a ela.`);
    err.status = 400;
    throw err;
  }
  const res = await db.query(`DELETE FROM categories WHERE id = $1 RETURNING *`, [id]);
  return res.rows[0] || null;
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove
};
