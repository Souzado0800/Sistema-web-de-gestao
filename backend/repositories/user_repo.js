/**
 * Repositório de Usuários.
 */
const db = require('../db');

async function findByUsername(username) {
  const res = await db.query(`SELECT * FROM users WHERE LOWER(username) = LOWER($1)`, [username.trim()]);
  return res.rows[0] || null;
}

async function findById(id) {
  const res = await db.query(`SELECT id, username, full_name, email, role, active, created_at FROM users WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function findAll() {
  const res = await db.query(`SELECT id, username, full_name, email, role, active, created_at FROM users ORDER BY full_name ASC`);
  return res.rows;
}

async function create(data) {
  const sql = `
    INSERT INTO users (username, full_name, email, password_hash, role, active)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, username, full_name, email, role, active, created_at
  `;
  const values = [
    data.username.trim().toLowerCase(),
    data.full_name.trim(),
    data.email.trim().toLowerCase(),
    data.password_hash,
    data.role || 'operator',
    data.active !== undefined ? data.active : true
  ];
  const res = await db.query(sql, values);
  return res.rows[0];
}

async function update(id, data) {
  let sql = `
    UPDATE users SET
      full_name = $1,
      email = $2,
      role = $3,
      active = $4,
      updated_at = CURRENT_TIMESTAMP
  `;
  const values = [data.full_name.trim(), data.email.trim().toLowerCase(), data.role, data.active];
  let idx = 5;

  if (data.password_hash) {
    sql += `, password_hash = $${idx++}`;
    values.push(data.password_hash);
  }

  sql += ` WHERE id = $${idx} RETURNING id, username, full_name, email, role, active, created_at`;
  values.push(id);

  const res = await db.query(sql, values);
  return res.rows[0] || null;
}

async function count() {
  const res = await db.query(`SELECT COUNT(*) as total FROM users`);
  return parseInt(res.rows[0].total, 10);
}

module.exports = {
  findByUsername,
  findById,
  findAll,
  create,
  update,
  count
};
