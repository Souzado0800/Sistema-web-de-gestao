/**
 * Executor Geral da Suíte de Testes Automatizados.
 */
const runStockTransactionTests = require('./test_stock_transactions');
const runConcurrencyTests = require('./test_concurrency');
const runInventoryTests = require('./test_inventory');
const runAuthRbacTests = require('./test_auth_rbac');
const runPurchaseTests = require('./test_purchases');
const runApiIntegrationTests = require('./test_api_endpoints');

async function runAll() {
  console.log('================================================================');
  console.log('   SISTEMA DE GESTÃO DE ESTOQUE — SUÍTE DE TESTES AUTOMATIZADOS');
  console.log('================================================================\n');

  const startTime = Date.now();

  try {
    await runStockTransactionTests();
    await runConcurrencyTests();
    await runInventoryTests();
    await runAuthRbacTests();
    await runPurchaseTests();
    await runApiIntegrationTests();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('================================================================');
    console.log(`   ✔ TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! (${duration}s)`);
    console.log('================================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ FALHA NOS TESTES:');
    console.error(err);
    process.exit(1);
  }
}

runAll();
