/**
 * Script Runner de Migrations do Banco de Dados PostgreSQL.
 */
const fs = require('fs');
const path = require('path');
const db = require('../backend/db');

async function runMigrations() {
  console.log('===> Iniciando execução das migrations PostgreSQL...');
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(` -> Executando migration: ${file}`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await db.query(sql);
      console.log(`    [OK] ${file} aplicada com sucesso.`);
    } catch (err) {
      console.error(`    [ERRO] Falha ao executar ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log('===> Todas as migrations foram executadas com sucesso!');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Erro fatal nas migrations:', err);
      process.exit(1);
    });
}

module.exports = runMigrations;
