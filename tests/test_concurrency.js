/**
 * Testes Automatizados: Concorrência e Prevenção de Race Conditions no Estoque.
 */
const assert = require('assert');
const stockService = require('../backend/services/stock_service');
const productRepo = require('../backend/repositories/product_repo');

async function runConcurrencyTests() {
  console.log('--- [TESTE 2] Iniciando Teste de Concorrência e Race Condition ---');

  // Cria um produto com saldo inicial exato de 10 unidades
  const prod = await productRepo.create({
    sku: `CONCURR-${Date.now()}`,
    name: 'Produto Teste de Concorrência',
    unit_measure: 'Unidade',
    current_stock: 10,
    min_stock: 2,
    ideal_stock: 30
  });

  console.log(` ✔ Produto criado com saldo inicial de 10 unidades`);

  // Simula duas requisições de retirada concorrentes disparadas simultaneamente:
  // Usuário A tenta retirar 7 unidades
  // Usuário B tenta retirar 5 unidades
  // Total solicitado = 12 > 10. Apenas uma pode ter sucesso!
  console.log(' -> Disparando Usuário A (retirando 7) e Usuário B (retirando 5) em paralelo...');

  const promiseA = stockService.registerExit({
    product_id: prod.id,
    quantity: 7,
    responsible_person: 'Usuário A',
    reason: 'Uso urgente Setor A',
    user: { id: 1, username: 'admin' }
  });

  const promiseB = stockService.registerExit({
    product_id: prod.id,
    quantity: 5,
    responsible_person: 'Usuário B',
    reason: 'Uso urgente Setor B',
    user: { id: 2, username: 'operador' }
  });

  const [resA, resB] = await Promise.allSettled([promiseA, promiseB]);

  const successCount = [resA, resB].filter(r => r.status === 'fulfilled').length;
  const failureCount = [resA, resB].filter(r => r.status === 'rejected').length;

  console.log(` -> Resultados: ${successCount} aprovada(s), ${failureCount} rejeitada(s)`);

  assert.strictEqual(successCount, 1, 'Exatamente UMA requisição deve ser aprovada');
  assert.strictEqual(failureCount, 1, 'Exatamente UMA requisição deve ser rejeitada por falta de saldo');

  // Verifica o saldo final no banco de dados
  const finalProd = await productRepo.findById(prod.id);
  const finalStock = parseFloat(finalProd.current_stock);

  console.log(` -> Saldo final registrado no banco: ${finalStock}`);
  assert.ok(finalStock >= 0, 'O estoque final NUNCA pode ser negativo');
  assert.ok(finalStock === 3 || finalStock === 5, 'Saldo final deve ser exatamente 3 (se A venceu) ou 5 (se B venceu)');

  console.log(' ✔ Garantia de isolamento e integridade concorrente validada com sucesso!');
  console.log('--- [TESTE 2] CONCLUÍDO COM SUCESSO! ---\n');
}

module.exports = runConcurrencyTests;
