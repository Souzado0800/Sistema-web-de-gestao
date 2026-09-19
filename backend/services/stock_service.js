/**
 * Serviço de Regras de Negócio e Integridade Transacional de Estoque.
 * Utiliza bloqueio de linha pessimista (SELECT ... FOR UPDATE) para garantir
 * atomicidade e prevenção estrita de race conditions em ambiente serverless.
 */
const db = require('../db');
const movementRepo = require('../repositories/movement_repo');
const auditRepo = require('../repositories/audit_repo');
const settingsRepo = require('../repositories/settings_repo');

/**
 * Registra Entrada de Mercadoria/Material no estoque.
 */
async function registerEntry({
  product_id,
  quantity,
  supplier_id = null,
  invoice_number = null,
  unit_price = 0,
  reason = 'Compra',
  notes = '',
  user = null,
  ip_address = null
}) {
  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0) {
    const err = new Error('A quantidade de entrada deve ser maior que zero.');
    err.status = 400;
    throw err;
  }

  return db.runInTransaction(async (client) => {
    // 1. Bloqueia a linha do produto exclusivamente (FOR UPDATE)
    const prodRes = await client.query(
      `SELECT id, name, sku, current_stock, reference_price, status 
       FROM products 
       WHERE id = $1 
       FOR UPDATE`,
      [product_id]
    );

    if (prodRes.rows.length === 0) {
      const err = new Error(`Produto ID ${product_id} não encontrado.`);
      err.status = 404;
      throw err;
    }

    const product = prodRes.rows[0];
    if (product.status === 'archived') {
      const err = new Error(`O produto "${product.name}" está arquivado e não pode receber entradas.`);
      err.status = 400;
      throw err;
    }

    const previousStock = parseFloat(product.current_stock);
    const resultingStock = previousStock + qty;
    const uPrice = parseFloat(unit_price) || parseFloat(product.reference_price) || 0;
    const totalPrice = qty * uPrice;

    // 2. Atualiza o saldo do produto
    await client.query(
      `UPDATE products 
       SET current_stock = $1, 
           reference_price = CASE WHEN $2 > 0 THEN $2 ELSE reference_price END,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [resultingStock, uPrice, product_id]
    );

    // 3. Registra a movimentação no histórico imutável
    const movement = await movementRepo.create({
      product_id,
      movement_type: 'ENTRADA',
      quantity: qty,
      previous_stock: previousStock,
      resulting_stock: resultingStock,
      reason,
      department_id: null,
      responsible_person: null,
      user_id: user ? user.id : null,
      supplier_id: supplier_id || null,
      invoice_number: invoice_number || null,
      unit_price: uPrice,
      total_price: totalPrice,
      notes: notes || null
    }, client);

    // 4. Registra na trilha de auditoria
    await auditRepo.logAction({
      user_id: user ? user.id : null,
      username: user ? user.username : 'system',
      action: 'ESTOQUE_ENTRADA',
      entity_type: 'PRODUCT',
      entity_id: product_id,
      details: {
        product_name: product.name,
        sku: product.sku,
        quantity: qty,
        previous_stock: previousStock,
        resulting_stock: resultingStock,
        invoice_number,
        supplier_id
      },
      ip_address
    }, client);

    return {
      success: true,
      message: `Entrada de ${qty} registrada com sucesso. Novo saldo: ${resultingStock}`,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        previous_stock: previousStock,
        current_stock: resultingStock
      },
      movement
    };
  });
}

/**
 * Registra Saída/Retirada de Material do estoque com validação de saldo e bloqueio de concorrência.
 */
async function registerExit({
  product_id,
  quantity,
  department_id = null,
  responsible_person = '',
  reason = 'Uso interno',
  notes = '',
  user = null,
  ip_address = null
}) {
  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0) {
    const err = new Error('A quantidade de saída deve ser maior que zero.');
    err.status = 400;
    throw err;
  }

  if (!responsible_person || responsible_person.trim().length === 0) {
    const err = new Error('Informe o nome do funcionário responsável pela retirada.');
    err.status = 400;
    throw err;
  }

  return db.runInTransaction(async (client) => {
    // 1. Bloqueio pessimista de linha no PostgreSQL
    const prodRes = await client.query(
      `SELECT id, name, sku, current_stock, reference_price, status 
       FROM products 
       WHERE id = $1 
       FOR UPDATE`,
      [product_id]
    );

    if (prodRes.rows.length === 0) {
      const err = new Error(`Produto ID ${product_id} não encontrado.`);
      err.status = 404;
      throw err;
    }

    const product = prodRes.rows[0];
    if (product.status === 'archived') {
      const err = new Error(`O produto "${product.name}" está arquivado e não permite saídas.`);
      err.status = 400;
      throw err;
    }

    // 2. Valida política de estoque negativo
    const allowNegativeSetting = await settingsRepo.get('allow_negative_stock');
    const allowNegative = allowNegativeSetting === 'true';

    let resultingStock;
    let previousStock;

    if (!allowNegative) {
      // Atualização condicional atômica (Compare-And-Swap): garante que o saldo seja >= qty no momento exato do UPDATE
      const updateRes = await client.query(
        `UPDATE products 
         SET current_stock = current_stock - $1, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 AND current_stock >= $1
         RETURNING id, current_stock, (current_stock + $1) as previous_stock`,
        [qty, product_id]
      );

      if (updateRes.rows.length === 0) {
        // Busca saldo atual para mensagem precisa de erro
        const curRes = await client.query(`SELECT current_stock FROM products WHERE id = $1`, [product_id]);
        const curStock = curRes.rows.length > 0 ? parseFloat(curRes.rows[0].current_stock) : 0;
        const err = new Error(
          `Saldo insuficiente em estoque para o produto "${product.name}". ` +
          `Saldo atual: ${curStock}, Quantidade solicitada: ${qty}. Operação cancelada.`
        );
        err.status = 400;
        throw err;
      }

      resultingStock = parseFloat(updateRes.rows[0].current_stock);
      previousStock = parseFloat(updateRes.rows[0].previous_stock);
    } else {
      previousStock = parseFloat(product.current_stock);
      resultingStock = previousStock - qty;
      await client.query(
        `UPDATE products 
         SET current_stock = $1, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [resultingStock, product_id]
      );
    }

    const uPrice = parseFloat(product.reference_price) || 0;
    const totalPrice = qty * uPrice;

    // 4. Registra movimentação de saída
    const movement = await movementRepo.create({
      product_id,
      movement_type: 'SAIDA',
      quantity: qty,
      previous_stock: previousStock,
      resulting_stock: resultingStock,
      reason,
      department_id: department_id || null,
      responsible_person: responsible_person.trim(),
      user_id: user ? user.id : null,
      supplier_id: null,
      invoice_number: null,
      unit_price: uPrice,
      total_price: totalPrice,
      notes: notes || null
    }, client);

    // 5. Registra auditoria
    await auditRepo.logAction({
      user_id: user ? user.id : null,
      username: user ? user.username : 'system',
      action: 'ESTOQUE_SAIDA',
      entity_type: 'PRODUCT',
      entity_id: product_id,
      details: {
        product_name: product.name,
        sku: product.sku,
        quantity: qty,
        previous_stock: previousStock,
        resulting_stock: resultingStock,
        department_id,
        responsible_person: responsible_person.trim()
      },
      ip_address
    }, client);

    return {
      success: true,
      message: `Saída de ${qty} registrada com sucesso. Saldo restante: ${resultingStock}`,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        previous_stock: previousStock,
        current_stock: resultingStock
      },
      movement
    };
  });
}

/**
 * Registra Ajuste Manual de Estoque (Correção, Contagem Física, Produto Danificado ou Perdido).
 * Não permite ajuste silencioso: motivo e responsável são obrigatórios.
 */
async function registerAdjustment({
  product_id,
  new_quantity,
  reason,
  notes = '',
  user = null,
  ip_address = null
}) {
  const newQty = parseFloat(new_quantity);
  if (isNaN(newQty) || newQty < 0) {
    const err = new Error('A nova quantidade informada deve ser um número válido maior ou igual a zero.');
    err.status = 400;
    throw err;
  }

  if (!reason || reason.trim().length === 0) {
    const err = new Error('O motivo do ajuste de estoque é obrigatório (ex: Contagem física, Produto danificado, Correção de inventário).');
    err.status = 400;
    throw err;
  }

  return db.runInTransaction(async (client) => {
    const prodRes = await client.query(
      `SELECT id, name, sku, current_stock, reference_price, status 
       FROM products 
       WHERE id = $1 
       FOR UPDATE`,
      [product_id]
    );

    if (prodRes.rows.length === 0) {
      const err = new Error(`Produto ID ${product_id} não encontrado.`);
      err.status = 404;
      throw err;
    }

    const product = prodRes.rows[0];
    const previousStock = parseFloat(product.current_stock);
    const difference = newQty - previousStock;

    if (difference === 0) {
      return {
        success: true,
        message: 'A nova quantidade informada é idêntica ao estoque atual. Nenhuma alteração foi necessária.',
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          current_stock: previousStock
        }
      };
    }

    // Atualiza o saldo do produto
    await client.query(
      `UPDATE products 
       SET current_stock = $1, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [newQty, product_id]
    );

    // Registra a movimentação de ajuste
    const movement = await movementRepo.create({
      product_id,
      movement_type: 'AJUSTE',
      quantity: Math.abs(difference),
      previous_stock: previousStock,
      resulting_stock: newQty,
      reason: reason.trim(),
      department_id: null,
      responsible_person: user ? user.full_name : 'Administrador',
      user_id: user ? user.id : null,
      supplier_id: null,
      invoice_number: null,
      unit_price: parseFloat(product.reference_price) || 0,
      total_price: Math.abs(difference) * (parseFloat(product.reference_price) || 0),
      notes: `Ajuste manual (${difference > 0 ? '+' : ''}${difference}). ${notes || ''}`.trim()
    }, client);

    // Registra na auditoria
    await auditRepo.logAction({
      user_id: user ? user.id : null,
      username: user ? user.username : 'system',
      action: 'ESTOQUE_AJUSTE',
      entity_type: 'PRODUCT',
      entity_id: product_id,
      details: {
        product_name: product.name,
        sku: product.sku,
        previous_stock: previousStock,
        new_quantity: newQty,
        difference,
        reason: reason.trim()
      },
      ip_address
    }, client);

    return {
      success: true,
      message: `Ajuste de estoque concluído com sucesso. Saldo alterado de ${previousStock} para ${newQty} (Diferença: ${difference > 0 ? '+' : ''}${difference}).`,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        previous_stock: previousStock,
        current_stock: newQty
      },
      movement
    };
  });
}

module.exports = {
  registerEntry,
  registerExit,
  registerAdjustment
};
