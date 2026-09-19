/**
 * View: Reposição de Estoque Automática e Gestão de Ordens de Compra.
 */
import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, showModal, closeModal, confirmDialog, formatCurrency, formatDate } from '../components.js';

export async function renderPurchases(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Reposição & Ordens de Compra</h1>
        <p class="page-subtitle">Monitore produtos abaixo do nível mínimo, calcule sugestões de compra e gerencie pedidos</p>
      </div>
      <div>
        <button id="btn-new-purchase-order" class="btn btn-primary admin-only">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Nova Ordem de Compra</span>
        </button>
      </div>
    </div>

    <!-- SEÇÃO 1: ALERTAS DE REPOSIÇÃO NECESSÁRIA -->
    <div class="content-card">
      <div class="card-header">
        <div>
          <h2 class="card-title">Produtos que Precisam de Reposição Imediata</h2>
          <span class="text-muted" style="font-size: 0.8rem;">Critério: Estoque Atual &le; Estoque Mínimo</span>
        </div>
        <span id="replenishment-total-badge" class="badge badge-critical">0 itens</span>
      </div>
      <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Urgência</th>
                <th>SKU</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Estoque Atual</th>
                <th>Mínimo</th>
                <th>Ideal</th>
                <th>Sugestão de Compra</th>
                <th>Fornecedor Principal</th>
                <th>Custo Estimado</th>
              </tr>
            </thead>
            <tbody id="replenishment-table-tbody">
              <tr><td colspan="10" class="text-center text-muted">Carregando necessidades de reposição...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- SEÇÃO 2: ORDENS DE COMPRA -->
    <div class="content-card">
      <div class="card-header">
        <h2 class="card-title">Histórico de Ordens de Compra</h2>
        <div style="display:flex; gap:0.5rem;">
          <select id="orders-filter-status" class="form-select" style="max-width: 180px;">
            <option value="">Todos os Status</option>
            <option value="planejado">Planejado</option>
            <option value="em_compra">Em compra</option>
            <option value="pedido_realizado">Pedido Realizado</option>
            <option value="recebido">Recebido (No Estoque)</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>
      <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Fornecedor</th>
                <th>Status</th>
                <th>Itens / Unidades</th>
                <th>Valor Estimado</th>
                <th>Criado por</th>
                <th>Data Pedido</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="orders-table-tbody">
              <tr><td colspan="8" class="text-center text-muted">Carregando ordens de compra...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  loadReplenishmentItems();
  loadPurchaseOrders();

  const newOrderBtn = document.getElementById('btn-new-purchase-order');
  if (newOrderBtn) {
    if (!state.isAdmin()) newOrderBtn.classList.add('hidden');
    newOrderBtn.addEventListener('click', () => openNewOrderModal());
  }

  document.getElementById('orders-filter-status').addEventListener('change', (e) => {
    loadPurchaseOrders(e.target.value);
  });
}

async function loadReplenishmentItems() {
  const tbody = document.getElementById('replenishment-table-tbody');
  const badge = document.getElementById('replenishment-total-badge');
  if (!tbody) return;

  try {
    const data = await api.get('/purchases/replenishment');
    const items = data.items || [];

    if (badge) {
      badge.textContent = `${items.length} itens`;
      badge.className = items.length > 0 ? 'badge badge-critical' : 'badge badge-normal';
    }

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding:2.5rem;">Nenhum produto abaixo do estoque mínimo no momento. Estoque em situação normal!</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(it => {
      let urgencyBadge = `<span class="badge badge-low">Baixo</span>`;
      if (it.urgency === 'zero') urgencyBadge = `<span class="badge badge-zero">Sem Estoque</span>`;
      if (it.urgency === 'critical') urgencyBadge = `<span class="badge badge-critical">Crítico</span>`;

      return `
        <tr>
          <td>${urgencyBadge}</td>
          <td><code>${it.sku}</code></td>
          <td class="font-semibold">${it.name}</td>
          <td>${it.category_name || '-'}</td>
          <td class="font-semibold text-danger">${it.current_stock} ${it.unit_measure}</td>
          <td class="text-muted">${it.min_stock}</td>
          <td class="text-muted">${it.ideal_stock}</td>
          <td class="font-semibold" style="color:var(--primary); font-size:0.95rem;">
            +${it.suggested_quantity} ${it.unit_measure}
          </td>
          <td>${it.supplier_name || 'Não cadastrado'}</td>
          <td>${formatCurrency(it.estimated_cost)}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Erro ao carregar reposição:', err);
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Falha ao carregar reposição: ${err.message}</td></tr>`;
  }
}

async function loadPurchaseOrders(statusFilter = '') {
  const tbody = document.getElementById('orders-table-tbody');
  if (!tbody) return;

  try {
    const res = await api.get('/purchases/orders', { status: statusFilter });
    const orders = res.data || [];

    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">Nenhuma ordem de compra encontrada.</td></tr>`;
      return;
    }

    const isAdmin = state.isAdmin();

    tbody.innerHTML = orders.map(o => {
      let statusBadge = `<span class="badge badge-low">${o.status}</span>`;
      if (o.status === 'recebido') statusBadge = `<span class="badge badge-normal">Recebido</span>`;
      if (o.status === 'cancelado') statusBadge = `<span class="badge badge-zero">Cancelado</span>`;
      if (o.status === 'pedido_realizado') statusBadge = `<span class="badge" style="background:#e0f2fe; color:#0369a1;">Pedido Feito</span>`;

      const canReceive = isAdmin && o.status !== 'recebido' && o.status !== 'cancelado';

      return `
        <tr>
          <td><code>${o.code}</code></td>
          <td class="font-semibold">${o.supplier_name || 'Vários / Não informado'}</td>
          <td>${statusBadge}</td>
          <td>${o.total_items || 0} produtos (${o.total_units_ordered || 0} un)</td>
          <td class="font-semibold">${formatCurrency(o.total_estimated)}</td>
          <td>${o.created_by_name || 'Admin'}</td>
          <td>${formatDate(o.created_at)}</td>
          <td class="text-right">
            <div class="table-actions" style="justify-content: flex-end;">
              <button class="btn btn-sm btn-outline btn-view-order" data-id="${o.id}">Ver Itens</button>
              ${canReceive ? `
                <button class="btn btn-sm btn-success btn-receive-order" data-id="${o.id}">Receber Compra</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-view-order').forEach(btn => {
      btn.addEventListener('click', () => openOrderDetailsModal(btn.dataset.id));
    });

    tbody.querySelectorAll('.btn-receive-order').forEach(btn => {
      btn.addEventListener('click', () => openReceiveOrderModal(btn.dataset.id));
    });

  } catch (err) {
    console.error('Erro ao listar ordens de compra:', err);
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Falha ao carregar ordens: ${err.message}</td></tr>`;
  }
}

async function openNewOrderModal() {
  try {
    const [supsRes, repRes] = await Promise.all([
      api.get('/suppliers', { active: 'true' }),
      api.get('/purchases/replenishment')
    ]);

    const suppliers = supsRes.suppliers || [];
    const repItems = repRes.items || [];

    const content = `
      <div class="modal-header">
        <h3 class="modal-title">Nova Ordem de Compra / Reposição</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <form id="form-new-order">
        <div class="modal-body">
          <div class="form-group">
            <label for="order-supplier">Fornecedor</label>
            <select id="order-supplier" class="form-select">
              <option value="">Selecione o fornecedor da compra...</option>
              ${suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="order-notes">Observações do Pedido</label>
            <textarea id="order-notes" class="form-textarea" rows="2" placeholder="Instruções de entrega, condições de pagamento..."></textarea>
          </div>

          <h4 style="font-size:0.95rem; font-weight:600; margin:1rem 0 0.5rem 0;">Selecione os Itens para a Compra</h4>
          <div style="max-height: 250px; overflow-y:auto; border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:0.5rem;">
            ${repItems.length === 0 ? '<p class="text-muted" style="padding:1rem; font-size:0.85rem;">Nenhum produto em alerta de reposição no momento. Todos os itens estão com estoque normal.</p>' : ''}
            ${repItems.map(it => `
              <div style="display:flex; align-items:center; justify-content:space-between; padding:0.5rem; border-bottom:1px solid #f1f5f9;">
                <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; cursor:pointer;">
                  <input type="checkbox" class="order-item-chk" value="${it.id}" data-name="${it.name}" data-price="${it.reference_price}" data-suggested="${it.suggested_quantity}" checked>
                  <span><strong>${it.name}</strong> (SKU: ${it.sku}) — Sugestão: ${it.suggested_quantity} ${it.unit_measure}</span>
                </label>
                <input type="number" step="0.01" min="1" class="form-input order-item-qty" value="${it.suggested_quantity}" style="max-width:90px; padding:0.3rem 0.5rem; font-size:0.825rem;">
              </div>
            `).join('')}
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline btn-modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Gerar Ordem de Compra</button>
        </div>
      </form>
    `;

    showModal(content, (modalRoot) => {
      modalRoot.querySelector('#form-new-order').addEventListener('submit', async (e) => {
        e.preventDefault();
        const chks = modalRoot.querySelectorAll('.order-item-chk:checked');
        if (chks.length === 0) {
          showToast('Selecione pelo menos um item para compor o pedido.', 'warning');
          return;
        }

        const items = [];
        chks.forEach(chk => {
          const row = chk.closest('div');
          const qtyInput = row.querySelector('.order-item-qty');
          items.push({
            product_id: parseInt(chk.value, 10),
            quantity: parseFloat(qtyInput.value) || parseFloat(chk.dataset.suggested),
            unit_price: parseFloat(chk.dataset.price) || 0
          });
        });

        try {
          await api.post('/purchases/orders', {
            supplier_id: modalRoot.querySelector('#order-supplier').value || null,
            notes: modalRoot.querySelector('#order-notes').value,
            items
          });
          showToast('Ordem de compra gerada com sucesso!');
          closeModal();
          loadPurchaseOrders();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openOrderDetailsModal(orderId) {
  try {
    const data = await api.get(`/purchases/orders/${orderId}`);
    const o = data.order;
    const items = o.items || [];

    const content = `
      <div class="modal-header">
        <div>
          <h3 class="modal-title">Ordem de Compra: ${o.code}</h3>
          <span class="text-muted" style="font-size:0.8rem;">Status: <strong>${o.status.toUpperCase()}</strong></span>
        </div>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div style="background:#f8fafc; padding:0.85rem; border-radius:var(--radius-sm); border:1px solid var(--border-color); margin-bottom:1.25rem; font-size:0.85rem;">
          <div>Fornecedor: <strong>${o.supplier_name || 'Não informado'}</strong> ${o.supplier_phone ? `(${o.supplier_phone})` : ''}</div>
          <div>Criado em: <strong>${formatDate(o.created_at)}</strong> por <strong>${o.created_by_name || 'Admin'}</strong></div>
          ${o.notes ? `<div>Obs: <em>${o.notes}</em></div>` : ''}
        </div>

        <h4 style="font-size:0.95rem; font-weight:600; margin-bottom:0.5rem;">Itens do Pedido</h4>
        <table class="data-table" style="font-size:0.825rem;">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Produto</th>
              <th>Pedido</th>
              <th>Recebido</th>
              <th>Preço Unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => `
              <tr>
                <td><code>${it.product_sku}</code></td>
                <td class="font-semibold">${it.product_name}</td>
                <td>${it.quantity_ordered} ${it.unit_measure}</td>
                <td>${it.quantity_received} ${it.unit_measure}</td>
                <td>${formatCurrency(it.unit_price)}</td>
                <td class="font-semibold">${formatCurrency(it.total_price)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="text-align:right; margin-top:0.75rem; font-size:1rem; font-weight:700;">
          Total Estimado: ${formatCurrency(o.total_estimated)}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline modal-close-btn">Fechar</button>
      </div>
    `;

    showModal(content);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openReceiveOrderModal(orderId) {
  try {
    const data = await api.get(`/purchases/orders/${orderId}`);
    const o = data.order;
    const items = o.items || [];

    const content = `
      <div class="modal-header">
        <div>
          <h3 class="modal-title" style="color:var(--success-hover);">Receber Compra: ${o.code}</h3>
          <span class="text-muted" style="font-size:0.8rem;">Conferir produtos entregues para dar entrada automática no estoque</span>
        </div>
        <button class="modal-close-btn">&times;</button>
      </div>
      <form id="form-receive-order">
        <div class="modal-body">
          <div class="form-group">
            <label for="rec-invoice">Número da Nota Fiscal de Entrega *</label>
            <input type="text" id="rec-invoice" class="form-input" placeholder="Ex: NF-98765" required>
          </div>

          <h4 style="font-size:0.95rem; font-weight:600; margin-bottom:0.5rem;">Conferência das Quantidades Recebidas</h4>
          <div class="table-responsive">
            <table class="data-table" style="font-size:0.825rem;">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Pedido Original</th>
                  <th>Quantidade Entregue Real *</th>
                  <th>Preço Unit. (R$)</th>
                </tr>
              </thead>
              <tbody id="receive-items-tbody">
                ${items.map(it => `
                  <tr data-prod-id="${it.product_id}">
                    <td class="font-semibold">${it.product_name}</td>
                    <td>${it.quantity_ordered} ${it.unit_measure}</td>
                    <td>
                      <input type="number" step="0.01" min="0" class="form-input rec-qty font-semibold" value="${it.quantity_ordered}" style="max-width:110px;">
                    </td>
                    <td>
                      <input type="number" step="0.01" min="0" class="form-input rec-price" value="${it.unit_price || 0}" style="max-width:110px;">
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="background:var(--success-light); border:1px solid #a7f3d0; padding:0.75rem 1rem; border-radius:var(--radius-sm); font-size:0.825rem; color:#065f46; margin-top:1rem;">
            ✔ Ao confirmar, o sistema registrará automaticamente as <strong>Entradas no Estoque</strong> para cada item, gerando os registros correspondentes no histórico de movimentações e na auditoria.
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline btn-modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-success">Confirmar Recebimento e Atualizar Estoque</button>
        </div>
      </form>
    `;

    showModal(content, (modalRoot) => {
      modalRoot.querySelector('#form-receive-order').addEventListener('submit', async (e) => {
        e.preventDefault();
        const invoiceNumber = modalRoot.querySelector('#rec-invoice').value;
        const rows = modalRoot.querySelectorAll('#receive-items-tbody tr');

        const itemsReceived = [];
        rows.forEach(r => {
          itemsReceived.push({
            product_id: parseInt(r.dataset.prodId, 10),
            quantity: parseFloat(r.querySelector('.rec-qty').value) || 0,
            unit_price: parseFloat(r.querySelector('.rec-price').value) || 0
          });
        });

        try {
          const res = await api.post(`/purchases/orders/${orderId}/receive`, {
            invoice_number: invoiceNumber,
            items: itemsReceived
          });
          showToast(res.message, 'success');
          closeModal();
          loadReplenishmentItems();
          loadPurchaseOrders();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}
