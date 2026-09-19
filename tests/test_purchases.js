/**
 * Testes Automatizados: Alertas de Reposição e Ciclo de Ordens de Compra.
 */
const assert = require('assert');
const purchaseService = require('../backend/services/purchase_service');
const productRepo = require('../backend/repositories/product_repo');
const stockService = require('../backend/services/stock_service');

async function runPurchaseTests() {
  console.log('--- [TESTE 5] Iniciando Testes de Reposição e Ordens de Compra ---');

  // Garante que os produtos dos casos 2 e 3 estejam presentes
  let existingTinta = await productRepo.findBySku('TNT-EPS-BK');
  if (!existingTinta) {
    await productRepo.create({
      sku: 'TNT-EPS-BK',
      name: 'Refil de Tinta Epson T544 Preto',
      unit_measure: 'Frasco',
      current_stock: 2,
      min_stock: 2,
      ideal_stock: 8,
      reference_price: 65.00
    });
  }
  let existingCaneta = await productRepo.findBySku('CAN-BIC-AZ');
  if (!existingCaneta) {
    await productRepo.create({
      sku: 'CAN-BIC-AZ',
      name: 'Caneta Esferográfica Azul 1.0mm',
      unit_measure: 'Unidade',
      current_stock: 150,
      min_stock: 30,
      ideal_stock: 100,
      reference_price: 2.20
    });
  }

  // 1. Validação dos Casos Práticos do Prompt:
  // Caso 2: Tinta Epson Preto (Estoque: 2, Mín: 2, Ideal: 8) -> DEVE GERAR ALERTA DE REPOSIÇÃO
  // Caso 3: Caneta Azul (Estoque: 150, Mín: 30, Ideal: 100) -> NÃO DEVE GERAR ALERTA
  const replenishmentList = await purchaseService.getReplenishmentList();

  const tintaEpson = replenishmentList.find(i => i.sku === 'TNT-EPS-BK');
  assert.ok(tintaEpson, 'Tinta Epson Preto DEVE estar na lista de reposição pois estoque (2) <= mínimo (2)');
  assert.strictEqual(parseFloat(tintaEpson.suggested_quantity), 6, 'Sugestão de reposição deve ser ideal (8) - atual (2) = 6 unidades');
  console.log(' ✔ Caso 2 do Prompt validado: Tinta Epson identificada em alerta com sugestão de 6 frascos');

  const canetaAzul = replenishmentList.find(i => i.sku === 'CAN-BIC-AZ');
  assert.strictEqual(canetaAzul, undefined, 'Caneta Azul NÃO deve estar na lista de reposição (estoque 150 > mínimo 30)');
  console.log(' ✔ Caso 3 do Prompt validado: Caneta Azul não gera alerta falso');

  // 2. Criação de Ordem de Compra
  const order = await purchaseService.createOrder({
    notes: 'Pedido de reposição mensal de tintas',
    items: [
      {
        product_id: tintaEpson.id,
        quantity: 6,
        unit_price: 65.00
      }
    ],
    user: { id: 1, username: 'admin' }
  });

  assert.ok(order.id, 'Ordem de compra deve ser criada com ID');
  assert.strictEqual(order.status, 'planejado', 'Status inicial deve ser "planejado"');
  console.log(` ✔ Ordem de compra "${order.code}" gerada com sucesso`);

  // 3. Recebimento da Compra e Atualização Automática de Estoque
  const stockBeforeReceive = parseFloat((await productRepo.findById(tintaEpson.id)).current_stock);
  assert.strictEqual(stockBeforeReceive, 2, 'Saldo antes do recebimento deve ser 2');

  const receiveResult = await purchaseService.receiveOrder({
    order_id: order.id,
    invoice_number: 'NF-EPSON-987',
    items_received: [
      {
        product_id: tintaEpson.id,
        quantity: 6,
        unit_price: 65.00
      }
    ],
    user: { id: 1, username: 'admin' }
  });

  assert.strictEqual(receiveResult.success, true, 'Recebimento deve ser bem-sucedido');

  const stockAfterReceive = parseFloat((await productRepo.findById(tintaEpson.id)).current_stock);
  assert.strictEqual(stockAfterReceive, 8, 'Saldo após receber compra deve subir de 2 para 8 (estoque ideal atingido)');
  console.log(' ✔ Recebimento da Ordem de Compra gerou entrada automática no estoque (Saldo atualizado para 8)');

  console.log('--- [TESTE 5] CONCLUÍDO COM SUCESSO! ---\n');
}

module.exports = runPurchaseTests;
