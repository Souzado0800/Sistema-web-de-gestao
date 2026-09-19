/**
 * Serviço de Reposição de Estoque e Gestão de Ordens de Compra.
 */
const db = require('../db');
const purchaseRepo = require('../repositories/purchase_repo');
const stockService = require('./stock_service');
const auditRepo = require('../repositories/audit_repo');

async function getReplenishmentList() {
  return purchaseRepo.findReplenishmentNeeds();
}

async function createOrder({ supplier_id = null, notes = '', items = [], user = null, ip_address = null }) {
  if (!items || items.length === 0) {
    const err = new Error('Selecione pelo menos um item para compor a ordem de compra.');
    err.status = 400;
    throw err;
  }

  const code = `OC-${Date.now().toString(36).toUpperCase()}`;

  const order = await purchaseRepo.createOrder({
    code,
    supplier_id: supplier_id ? parseInt(supplier_id, 10) : null,
    notes: notes || '',
    created_by: user ? user.id : null,
    items
  });

  await auditRepo.logAction({
    user_id: user ? user.id : null,
    username: user ? user.username : 'system',
    action: 'ORDEM_COMPRA_CRIADA',
    entity_type: 'PURCHASE_ORDER',
    entity_id: order.id,
    details: { code, supplier_id, total_items: items.length },
    ip_address
  });

  return order;
}

async function updateStatus(id, status, user = null, ip_address = null) {
  const validStatuses = ['planejado', 'em_compra', 'pedido_realizado', 'recebido', 'cancelado'];
  if (!validStatuses.includes(status)) {
    const err = new Error(`Status inválido. Permitidos: ${validStatuses.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const updated = await purchaseRepo.updateStatus(id, status);

  await auditRepo.logAction({
    user_id: user ? user.id : null,
    username: user ? user.username : 'system',
    action: 'ORDEM_COMPRA_STATUS',
    entity_type: 'PURCHASE_ORDER',
    entity_id: id,
    details: { new_status: status },
    ip_address
  });

  return updated;
}

/**
 * Recebimento de Ordem de Compra:
 * Ao confirmar a entrega dos produtos comprados, gera automaticamente as entradas correspondentes no estoque.
 */
async function receiveOrder({ order_id, invoice_number = '', items_received = [], user = null, ip_address = null }) {
  const order = await purchaseRepo.findOrderById(order_id);
  if (!order) {
    const err = new Error('Ordem de compra não encontrada.');
    err.status = 404;
    throw err;
  }

  if (order.status === 'recebido') {
    const err = new Error('Esta ordem de compra já foi totalmente recebida e processada no estoque.');
    err.status = 400;
    throw err;
  }

  const registeredEntries = [];

  // Itera sobre os itens recebidos e executa entrada atômica de cada um
  for (const item of items_received) {
    const qty = parseFloat(item.quantity);
    if (qty <= 0) continue;

    const entryRes = await stockService.registerEntry({
      product_id: item.product_id,
      quantity: qty,
      supplier_id: order.supplier_id,
      invoice_number: invoice_number || `OC-${order.code}`,
      unit_price: parseFloat(item.unit_price) || 0,
      reason: 'Compra Recebida',
      notes: `Entrada via Ordem de Compra ${order.code}. ${item.notes || ''}`.trim(),
      user,
      ip_address
    });

    registeredEntries.push(entryRes);

    // Atualiza quantidade recebida no item do pedido
    await db.query(
      `UPDATE purchase_order_items 
       SET quantity_received = quantity_received + $1, received_at = CURRENT_TIMESTAMP 
       WHERE order_id = $2 AND product_id = $3`,
      [qty, order_id, item.product_id]
    );
  }

  // Atualiza status do pedido para 'recebido'
  await purchaseRepo.updateStatus(order_id, 'recebido');

  await auditRepo.logAction({
    user_id: user ? user.id : null,
    username: user ? user.username : 'system',
    action: 'ORDEM_COMPRA_RECEBIDA',
    entity_type: 'PURCHASE_ORDER',
    entity_id: order_id,
    details: { code: order.code, invoice_number, items_count: registeredEntries.length },
    ip_address
  });

  return {
    success: true,
    message: `Ordem de Compra ${order.code} recebida com sucesso! ${registeredEntries.length} produto(s) atualizado(s) no estoque.`,
    order: await purchaseRepo.findOrderById(order_id),
    entries: registeredEntries
  };
}

module.exports = {
  getReplenishmentList,
  createOrder,
  updateStatus,
  receiveOrder
};
