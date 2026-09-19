/**
 * Serviço de Sessões de Inventário Físico e Conciliação de Estoque.
 */
const db = require('../db');
const inventoryRepo = require('../repositories/inventory_repo');
const movementRepo = require('../repositories/movement_repo');
const auditRepo = require('../repositories/audit_repo');

/**
 * Inicia uma nova sessão de inventário físico.
 */
async function startSession({ title, category_id = null, notes = '', user = null, ip_address = null }) {
  if (!title || title.trim().length === 0) {
    const err = new Error('Informe um título identificador para a sessão de inventário.');
    err.status = 400;
    throw err;
  }

  const code = `INV-${Date.now().toString(36).toUpperCase()}`;

  return db.runInTransaction(async (client) => {
    const session = await inventoryRepo.createSession({
      code,
      title: title.trim(),
      category_id: category_id ? parseInt(category_id, 10) : null,
      notes: notes || '',
      created_by: user ? user.id : null
    }, client);

    // Carrega os produtos da categoria ou todos os ativos
    let prodSql = `SELECT id, sku, name, unit_measure, current_stock FROM products WHERE status = 'active'`;
    const prodParams = [];
    if (category_id) {
      prodSql += ` AND category_id = $1`;
      prodParams.push(parseInt(category_id, 10));
    }
    prodSql += ` ORDER BY name ASC`;

    const prodsRes = await client.query(prodSql, prodParams);

    // Registra cada item com a quantidade esperada atual
    for (const prod of prodsRes.rows) {
      await inventoryRepo.addItem({
        session_id: session.id,
        product_id: prod.id,
        expected_stock: parseFloat(prod.current_stock),
        counted_stock: parseFloat(prod.current_stock), // Inicializa com esperado
        notes: ''
      }, client);
    }

    await auditRepo.logAction({
      user_id: user ? user.id : null,
      username: user ? user.username : 'system',
      action: 'INVENTARIO_INICIADO',
      entity_type: 'INVENTORY_SESSION',
      entity_id: session.id,
      details: { code, title, category_id, total_products: prodsRes.rows.length },
      ip_address
    }, client);

    return inventoryRepo.findSessionById(session.id);
  });
}

/**
 * Registra as contagens físicas informadas pelo conferente e finaliza com aplicação dos ajustes.
 */
async function reconcileSession({ session_id, counts = [], user = null, ip_address = null }) {
  return db.runInTransaction(async (client) => {
    const sessionRes = await client.query(`SELECT * FROM inventory_sessions WHERE id = $1 FOR UPDATE`, [session_id]);
    if (sessionRes.rows.length === 0) {
      const err = new Error('Sessão de inventário não encontrada.');
      err.status = 404;
      throw err;
    }

    const session = sessionRes.rows[0];
    if (session.status === 'completed') {
      const err = new Error('Esta sessão de inventário já foi finalizada e os ajustes já foram aplicados.');
      err.status = 400;
      throw err;
    }

    // Atualiza itens com as contagens físicas reais
    for (const count of counts) {
      const counted = parseFloat(count.counted_stock);
      if (isNaN(counted) || counted < 0) continue;

      const itemRes = await client.query(
        `SELECT id, expected_stock, product_id FROM inventory_items WHERE session_id = $1 AND product_id = $2`,
        [session_id, count.product_id]
      );

      if (itemRes.rows.length > 0) {
        const item = itemRes.rows[0];
        const expected = parseFloat(item.expected_stock);
        const diff = counted - expected;

        await client.query(
          `UPDATE inventory_items 
           SET counted_stock = $1, difference = $2, notes = $3, counted_at = CURRENT_TIMESTAMP 
           WHERE id = $4`,
          [counted, diff, count.notes || '', item.id]
        );

        // Se houver divergência física, atualiza o saldo do produto e gera movimentação de inventário
        if (diff !== 0) {
          // Bloqueia produto
          const prodRes = await client.query(`SELECT current_stock, reference_price FROM products WHERE id = $1 FOR UPDATE`, [count.product_id]);
          if (prodRes.rows.length > 0) {
            const current = parseFloat(prodRes.rows[0].current_stock);
            const refPrice = parseFloat(prodRes.rows[0].reference_price) || 0;

            await client.query(`UPDATE products SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [counted, count.product_id]);

            await movementRepo.create({
              product_id: count.product_id,
              movement_type: 'INVENTARIO',
              quantity: Math.abs(diff),
              previous_stock: current,
              resulting_stock: counted,
              reason: `Ajuste de Inventário Físico (${session.code})`,
              department_id: null,
              responsible_person: user ? user.full_name : 'Conferente',
              user_id: user ? user.id : null,
              supplier_id: null,
              invoice_number: null,
              unit_price: refPrice,
              total_price: Math.abs(diff) * refPrice,
              notes: `Divergência apurada: ${diff > 0 ? '+' : ''}${diff}. Sessão: ${session.title}`
            }, client);
          }
        }
      }
    }

    // Finaliza a sessão
    await inventoryRepo.finalizeSession(session_id, client);

    // Auditoria
    await auditRepo.logAction({
      user_id: user ? user.id : null,
      username: user ? user.username : 'system',
      action: 'INVENTARIO_CONCLUIDO',
      entity_type: 'INVENTORY_SESSION',
      entity_id: session_id,
      details: { code: session.code, title: session.title, items_reconciled: counts.length },
      ip_address
    }, client);

    return inventoryRepo.findSessionById(session_id);
  });
}

module.exports = {
  startSession,
  reconcileSession
};
