/**
 * Repositório de Configurações do Sistema.
 */
const db = require('../db');

async function getAll() {
  const res = await db.query(`SELECT key, value, description, updated_at FROM settings`);
  const settingsObj = {};
  for (const row of res.rows) {
    settingsObj[row.key] = row.value;
  }
  return settingsObj;
}

async function get(key) {
  const res = await db.query(`SELECT value FROM settings WHERE key = $1`, [key]);
  return res.rows[0] ? res.rows[0].value : null;
}

async function set(key, value, description = null) {
  const sql = `
    INSERT INTO settings (key, value, description, updated_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      description = COALESCE(EXCLUDED.description, settings.description),
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const res = await db.query(sql, [key, String(value), description]);
  return res.rows[0];
}

async function setMany(settingsMap) {
  const updated = {};
  for (const [key, value] of Object.entries(settingsMap)) {
    const res = await set(key, value);
    updated[key] = res.value;
  }
  return updated;
}

module.exports = {
  getAll,
  get,
  set,
  setMany
};
