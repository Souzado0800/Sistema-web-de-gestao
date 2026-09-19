/**
 * Script Runner para carga inicial de dados (Seeds).
 */
const fs = require('fs');
const path = require('path');
const db = require('../backend/db');

async function runSeed() {
  console.log('===> Iniciando execução do seed de dados...');
  const seedFile = path.join(__dirname, 'seeds', 'initial_seed.sql');

  if (!fs.existsSync(seedFile)) {
    console.warn('Arquivo de seed não encontrado:', seedFile);
    return;
  }

  const sql = fs.readFileSync(seedFile, 'utf8');
  try {
    await db.query(sql);
    console.log('===> Seed de dados executado com sucesso!');
  } catch (err) {
    console.error('Erro ao executar seed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Erro fatal no seed:', err);
      process.exit(1);
    });
}

module.exports = runSeed;
