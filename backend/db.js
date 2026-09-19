/**
 * Camada de Acesso e Gerenciamento de Conexões do Banco de Dados PostgreSQL.
 * Compatível com Neon, Supabase, AWS RDS, Railway e fallback in-memory (pg-mem) para testes/dev.
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

let pool = null;
let isInMemory = false;

function initPool() {
  if (pool) return pool;

  if (config.databaseUrl && config.databaseUrl.trim().length > 0) {
    const { Pool } = require('pg');
    const isLocalhost = config.databaseUrl.includes('localhost') || config.databaseUrl.includes('127.0.0.1');
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: isLocalhost ? false : { rejectUnauthorized: false }
    });
    isInMemory = false;
  } else {
    // Modo de Desenvolvimento Local / Testes sem banco PostgreSQL externo configurado
    const { newDb, DataType } = require('pg-mem');
    const memDb = newDb();

    // Registra função nativa PostgreSQL to_char para o simulador em memória
    const toCharImpl = (val, fmt) => {
      if (!val) return '';
      const d = new Date(val);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    memDb.public.registerFunction({
      name: 'to_char',
      args: [DataType.timestamptz, DataType.text],
      returns: DataType.text,
      implementation: toCharImpl
    });

    memDb.public.registerFunction({
      name: 'to_char',
      args: [DataType.timestamp, DataType.text],
      returns: DataType.text,
      implementation: toCharImpl
    });

    // Carrega migrations e seeds automaticamente no banco in-memory
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const seedFile = path.join(__dirname, '../database/seeds/initial_seed.sql');

    const mFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const f of mFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
      memDb.public.none(sql);
    }
    if (fs.existsSync(seedFile)) {
      const seedSql = fs.readFileSync(seedFile, 'utf8');
      memDb.public.none(seedSql);
    }

    const adapter = memDb.adapters.createPg();
    pool = new adapter.Pool();
    isInMemory = true;
  }

  return pool;
}

/**
 * Executa uma consulta SQL parametrizada.
 */
async function query(text, params = []) {
  const p = initPool();
  return p.query(text, params);
}

/**
 * Obtém um cliente do pool para operações transacionais manuais.
 */
async function getClient() {
  const p = initPool();
  return p.connect();
}

/**
 * Executa um bloco de código dentro de uma transação PostgreSQL ACID.
 * Faz ROLLBACK automático em caso de exceção e COMMIT em caso de sucesso.
 */
async function runInTransaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('Erro ao realizar rollback:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  query,
  getClient,
  runInTransaction,
  isInMemory: () => isInMemory
};
