/**
 * Repositório de Trilha de Auditoria (Logs Imutáveis).
 */
const db = require('../db');

async function logAction({ user_id = null, username = null, action, entity_type, entity_id = null, details = {}, ip_address = null }, client = null) {
  const sql = `
    INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const safeIp = ip_address ? String(ip_address).split(',')[0].trim().slice(0, 100) : null;
  const values = [
    user_id,
    username,
    action,
    entity_type,
    entity_id ? String(entity_id) : null,
    typeof details === 'object' ? JSON.stringify(details) : String(details),
    safeIp
  ];
  const executor = client || db;
  const res = await executor.query(sql, values);
  return res.rows[0];
}

async function findAll({ user_id = null, action = null, entity_type = null, start_date = null, end_date = null, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (user_id) {
    conditions.push(`user_id = $${idx++}`);
    params.push(parseInt(user_id, 10));
  }
  if (action) {
    conditions.push(`action = $${idx++}`);
    params.push(action);
  }
  if (entity_type) {
    conditions.push(`entity_type = $${idx++}`);
    params.push(entity_type);
  }
  if (start_date) {
    conditions.push(`created_at >= $${idx++}`);
    params.push(new Date(start_date));
  }
  if (end_date) {
    conditions.push(`created_at <= $${idx++}`);
    params.push(new Date(end_date));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await db.query(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`, params);
  const total = parseInt(countRes.rows[0].total, 10);

  const dataParams = [...params, limit, offset];
  const dataSql = `
    SELECT * FROM audit_logs
    ${whereClause}
    ORDER BY created_at DESC
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

module.exports = {
  logAction,
  findAll
};
