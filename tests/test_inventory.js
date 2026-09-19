/**
 * Testes Automatizados: Ciclo de Inventário Físico e Apuração de Divergências.
 */
const assert = require('assert');
const inventoryService = require('../backend/services/inventory_service');
const inventoryRepo = require('../backend/repositories/inventory_repo');
const productRepo = require('../backend/repositories/product_repo');
const movementRepo = require('../backend/repositories/movement_repo');

async function runInventoryTests() {
  console.log('--- [TESTE 3] Iniciando Testes de Inventário Físico ---');

  // Cria produto com 100 unidades no sistema
  const prod = await productRepo.create({
    sku: `INV-TEST-${Date.now()}`,
    name: 'Produto Teste Inventário Físico',
    unit_measure: 'Unidade',
    current_stock: 100,
    min_stock: 10,
    ideal_stock: 120
  });

  console.log(` ✔ Produto criado com saldo no sistema de 100 unidades`);

  // 1. Inicia sessão de inventário
  const session = await inventoryService.startSession({
    title: 'Inventário Físico Teste Automatizado',
    user: { id: 1, username: 'admin', full_name: 'Administrador' }
  });

  assert.ok(session.id, 'Sessão deve possuir ID gerado');
  assert.strictEqual(session.status, 'open', 'Sessão deve iniciar com status "open"');
  console.log(` ✔ Sessão de inventário "${session.code}" iniciada com sucesso`);

  // 2. Simula conferente físico informando contagem real:
  // No sistema consta 100, mas a contagem encontrou 97 (diferença de -3 unidades)
  const reconcileRes = await inventoryService.reconcileSession({
    session_id: session.id,
    counts: [
      {
        product_id: prod.id,
        counted_stock: 97,
        notes: '3 unidades avariadas descartadas'
      }
    ],
    user: { id: 1, username: 'admin', full_name: 'Administrador' }
  });

  assert.strictEqual(reconcileRes.status, 'completed', 'Sessão deve mudar para status "completed"');
  console.log(' ✔ Reconciliação finalizada com sucesso');

  // 3. Valida se o saldo do produto foi atualizado para 97
  const prodAfter = await productRepo.findById(prod.id);
  assert.strictEqual(parseFloat(prodAfter.current_stock), 97, 'Saldo do produto deve ter sido ajustado para 97');
  console.log(' ✔ Saldo do produto atualizado no banco para 97 unidades');

  // 4. Valida se a movimentação de inventário foi gravada no histórico
  const movements = await movementRepo.findByProductId(prod.id);
  const invMovement = movements.find(m => m.movement_type === 'INVENTARIO');
  assert.ok(invMovement, 'Deve existir movimentação do tipo INVENTARIO registrada');
  assert.strictEqual(parseFloat(invMovement.quantity), 3, 'Quantidade da divergência deve ser 3');
  assert.strictEqual(parseFloat(invMovement.previous_stock), 100, 'Saldo anterior deve ser 100');
  assert.strictEqual(parseFloat(invMovement.resulting_stock), 97, 'Saldo resultante deve ser 97');
  console.log(' ✔ Movimentação de inventário registrada com precisão no histórico imutável');

  console.log('--- [TESTE 3] CONCLUÍDO COM SUCESSO! ---\n');
}

module.exports = runInventoryTests;
