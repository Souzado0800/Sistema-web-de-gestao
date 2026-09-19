/**
 * Repositório de Departamentos / Centros de Custo.
 */
const db = require('../db');

async function findAll({ activeOnly = false } = {}) {
  const where = activeOnly ? 'WHERE active = true' : '';
  const res = await db.query(`SELECT * FROM departments ${where} ORDER BY name ASC`);

  const countsRes = await db.query(`
    SELECT department_id, COUNT(*) as count
    FROM stock_movements
    WHERE department_id IS NOT NULL
    GROUP BY department_id
  `);

  const countMap = {};
  countsRes.rows.forEach(r => {
    countMap[r.department_id] = parseInt(r.count, 10);
  });

  return res.rows.map(d => ({
    ...d,
    movement_count: countMap[d.id] || 0
  }));
}

async function findById(id) {
  const res = await db.query(`SELECT * FROM departments WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function create(data) {
  const sql = `
    INSERT INTO departments (name, description, cost_center, active)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const res = await db.query(sql, [
    data.name.trim(),
    data.description || '',
    data.cost_center ? data.cost_center.trim() : null,
    data.active !== undefined ? data.active : true
  ]);
  return res.rows[0];
}

async function update(id, data) {
  const sql = `
    UPDATE departments SET
      name = $1,
      description = $2,
      cost_center = $3,
      active = $4
    WHERE id = $5
    RETURNING *
  `;
  const res = await db.query(sql, [
    data.name.trim(),
    data.description || '',
    data.cost_center ? data.cost_center.trim() : null,
    data.active !== undefined ? data.active : true,
    id
  ]);
  return res.rows[0] || null;
}

async function remove(id) {
  const check = await db.query(`SELECT COUNT(*) as total FROM stock_movements WHERE department_id = $1`, [id]);
  const total = parseInt(check.rows[0].total, 10);
  if (total > 0) {
    // Soft delete / desativação para não quebrar integridade referencial histórica
    const res = await db.query(`UPDATE departments SET active = false WHERE id = $1 RETURNING *`, [id]);
    return res.rows[0];
  }
  const res = await db.query(`DELETE FROM departments WHERE id = $1 RETURNING *`, [id]);
  return res.rows[0] || null;
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove
};
