/**
 * Script CLI para limpeza geral do banco de dados.
 * Remove todos os dados operacionais (produtos, movimentações, compras, inventários),
 * preservando os usuários e configurações.
 */
const db = require('../backend/db');

async function cleanDatabase() {
  console.log('Iniciando limpeza geral do banco de dados...');
  try {
    await db.query('DELETE FROM stock_movements');
    await db.query('DELETE FROM inventory_items');
    await db.query('DELETE FROM inventory_sessions');
    await db.query('DELETE FROM purchase_order_items');
    await db.query('DELETE FROM purchase_orders');
    await db.query('DELETE FROM products');
    await db.query('DELETE FROM suppliers');
    await db.query('DELETE FROM departments');
    await db.query('DELETE FROM categories');
    console.log('✔ Todas as tabelas operacionais foram limpas com sucesso!');
    console.log('✔ Usuários e configurações foram preservados.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro ao limpar banco de dados:', err);
    process.exit(1);
  }
}

cleanDatabase();
