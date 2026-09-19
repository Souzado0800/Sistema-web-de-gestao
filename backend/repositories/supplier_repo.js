/**
 * Repositório de Fornecedores.
 */
const db = require('../db');

async function findAll({ search = '', activeOnly = false } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (activeOnly) {
    conditions.push(`s.active = true`);
  }
  if (search && search.trim().length > 0) {
    conditions.push(`(s.name ILIKE $${idx} OR s.corporate_name ILIKE $${idx} OR s.cnpj ILIKE $${idx} OR s.contact_person ILIKE $${idx})`);
    params.push(`%${search.trim()}%`);
    idx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      s.*,
      COUNT(p.id) as supplied_products_count
    FROM suppliers s
    LEFT JOIN products p ON s.id = p.primary_supplier_id AND p.status = 'active'
    ${whereClause}
    GROUP BY s.id
    ORDER BY s.name ASC
  `;
  const res = await db.query(sql, params);
  return res.rows;
}

async function findById(id) {
  const res = await db.query(`SELECT * FROM suppliers WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function create(data) {
  const sql = `
    INSERT INTO suppliers (name, corporate_name, cnpj, phone, email, contact_person, address, notes, active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
  const values = [
    data.name.trim(),
    data.corporate_name ? data.corporate_name.trim() : null,
    data.cnpj ? data.cnpj.trim() : null,
    data.phone ? data.phone.trim() : null,
    data.email ? data.email.trim() : null,
    data.contact_person ? data.contact_person.trim() : null,
    data.address ? data.address.trim() : null,
    data.notes ? data.notes.trim() : null,
    data.active !== undefined ? data.active : true
  ];
  const res = await db.query(sql, values);
  return res.rows[0];
}

async function update(id, data) {
  const sql = `
    UPDATE suppliers SET
      name = $1,
      corporate_name = $2,
      cnpj = $3,
      phone = $4,
      email = $5,
      contact_person = $6,
      address = $7,
      notes = $8,
      active = $9
    WHERE id = $10
    RETURNING *
  `;
  const values = [
    data.name.trim(),
    data.corporate_name ? data.corporate_name.trim() : null,
    data.cnpj ? data.cnpj.trim() : null,
    data.phone ? data.phone.trim() : null,
    data.email ? data.email.trim() : null,
    data.contact_person ? data.contact_person.trim() : null,
    data.address ? data.address.trim() : null,
    data.notes ? data.notes.trim() : null,
    data.active !== undefined ? data.active : true,
    id
  ];
  const res = await db.query(sql, values);
  return res.rows[0] || null;
}

async function remove(id) {
  const check = await db.query(`SELECT COUNT(*) as total FROM products WHERE primary_supplier_id = $1`, [id]);
  const total = parseInt(check.rows[0].total, 10);
  if (total > 0) {
    // Desativa para manter histórico
    const res = await db.query(`UPDATE suppliers SET active = false WHERE id = $1 RETURNING *`, [id]);
    return res.rows[0];
  }
  const res = await db.query(`DELETE FROM suppliers WHERE id = $1 RETURNING *`, [id]);
  return res.rows[0] || null;
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove
};
