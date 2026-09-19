/**
 * Testes Automatizados: Transações e Atomicidade de Estoque.
 */
const assert = require('assert');
const stockService = require('../backend/services/stock_service');
const productRepo = require('../backend/repositories/product_repo');
const movementRepo = require('../backend/repositories/movement_repo');
const db = require('../backend/db');

async function runStockTransactionTests() {
  console.log('--- [TESTE 1] Iniciando Testes de Transações de Estoque ---');

  // 1. Cria um produto de teste isolado
  const prod = await productRepo.create({
    sku: `TEST-TRANS-${Date.now()}`,
    name: 'Produto Teste Transações',
    unit_measure: 'Caixa',
    current_stock: 20,
    min_stock: 5,
    ideal_stock: 50,
    reference_price: 15.00
  });
  assert.strictEqual(parseFloat(prod.current_stock), 20, 'Estoque inicial deve ser 20');
  console.log(' ✔ Produto de teste criado com sucesso (Saldo inicial: 20)');

  // 2. Teste de Entrada de Estoque
  const entryResult = await stockService.registerEntry({
    product_id: prod.id,
    quantity: 10,
    reason: 'Compra Teste',
    invoice_number: 'NF-TEST-01',
    user: { id: 1, username: 'admin' }
  });
  assert.strictEqual(entryResult.product.current_stock, 30, 'Novo estoque após entrada deve ser 30');

  const prodAfterEntry = await productRepo.findById(prod.id);
  assert.strictEqual(parseFloat(prodAfterEntry.current_stock), 30, 'Estoque no banco deve ser 30');
  console.log(' ✔ Entrada de 10 unidades confirmada. Saldo atualizado para 30 com sucesso');

  // 3. Teste de Saída Válida
  const exitResult = await stockService.registerExit({
    product_id: prod.id,
    quantity: 8,
    responsible_person: 'Carlos Almoxarife',
    reason: 'Uso interno',
    user: { id: 1, username: 'admin' }
  });
  assert.strictEqual(exitResult.product.current_stock, 22, 'Novo estoque após saída deve ser 22');

  const prodAfterExit = await productRepo.findById(prod.id);
  assert.strictEqual(parseFloat(prodAfterExit.current_stock), 22, 'Estoque no banco deve ser 22');
  console.log(' ✔ Saída de 8 unidades confirmada. Saldo atualizado para 22 com sucesso');

  // 4. Teste de Tentativa de Saída com Saldo Insuficiente (Deve Bloquear e Fazer Rollback)
  let errorCaught = false;
  try {
    await stockService.registerExit({
      product_id: prod.id,
      quantity: 50, // Saldo atual é 22, logo 50 deve falhar!
      responsible_person: 'Teste Erro',
      reason: 'Retirada Excessiva',
      user: { id: 1, username: 'admin' }
    });
  } catch (err) {
    errorCaught = true;
    assert.match(err.message, /Saldo insuficiente em estoque/i, 'Mensagem deve indicar saldo insuficiente');
  }
  assert.strictEqual(errorCaught, true, 'Deve lançar erro ao tentar retirar mais que o saldo disponível');

  // Verifica se o saldo permaneceu 22 (garantia de Rollback)
  const prodAfterRollback = await productRepo.findById(prod.id);
  assert.strictEqual(parseFloat(prodAfterRollback.current_stock), 22, 'Saldo deve permanecer intacto (22) após erro');
  console.log(' ✔ Bloqueio de saldo insuficiente e Rollback atômico validados com sucesso');

  // 5. Teste de Ajuste Manual de Estoque com Justificativa Obrigatória
  const adjResult = await stockService.registerAdjustment({
    product_id: prod.id,
    new_quantity: 25,
    reason: 'Contagem física de rotina',
    notes: 'Correção de inventário semanal',
    user: { id: 1, username: 'admin' }
  });
  assert.strictEqual(adjResult.product.current_stock, 25, 'Saldo após ajuste deve ser 25');

  const prodAfterAdj = await productRepo.findById(prod.id);
  assert.strictEqual(parseFloat(prodAfterAdj.current_stock), 25, 'Saldo no banco deve ser 25');
  console.log(' ✔ Ajuste manual de estoque de 22 para 25 registrado com sucesso');

  console.log('--- [TESTE 1] CONCLUÍDO COM SUCESSO! ---\n');
}

module.exports = runStockTransactionTests;
