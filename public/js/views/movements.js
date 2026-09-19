/**
 * View: Histórico Geral e Registro de Movimentações (Entrada, Saída, Ajuste).
 */
import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, showModal, closeModal, formatCurrency, formatDate, renderPagination } from '../components.js';

let movementFilters = {
  search: '',
  movement_type: '',
  department_id: '',
  start_date: '',
  end_date: '',
  limit: 25,
  offset: 0
};

export async function renderMovements(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Histórico de Movimentações</h1>
        <p class="page-subtitle">Registro completo, auditável e imutável de todas as entradas, saídas e correções de estoque</p>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button id="btn-export-movements-csv" class="btn btn-outline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span>Exportar CSV</span>
        </button>
        <button id="btn-open-entry" class="btn btn-success">
          <span>+ Nova Entrada</span>
        </button>
        <button id="btn-open-exit" class="btn btn-danger">
          <span>- Nova Saída</span>
        </button>
        <button id="btn-open-adj" class="btn btn-outline admin-only">
          <span>Ajustar Saldo</span>
        </button>
      </div>
    </div>

    <!-- FILTROS -->
    <div class="content-card">
      <div class="card-body" style="padding: 1.1rem 1.4rem;">
        <div class="filter-bar">
          <input type="text" id="mov-filter-search" class="form-input" style="max-width: 240px;" placeholder="Buscar por Produto, SKU, Responsável..." value="${movementFilters.search}">
          
          <select id="mov-filter-type" class="form-select" style="max-width: 160px;">
            <option value="">Todos os Tipos</option>
            <option value="ENTRADA">Entrada (+)</option>
            <option value="SAIDA">Saída (-)</option>
            <option value="AJUSTE">Ajuste Manual</option>
            <option value="INVENTARIO">Inventário Físico</option>
          </select>

          <select id="mov-filter-department" class="form-select" style="max-width: 180px;">
            <option value="">Todos os Setores</option>
          </select>

          <input type="date" id="mov-filter-start" class="form-input" style="max-width: 150px;" title="Data Inicial" value="${movementFilters.start_date}">
          <input type="date" id="mov-filter-end" class="form-input" style="max-width: 150px;" title="Data Final" value="${movementFilters.end_date}">

          <button id="btn-apply-mov-filters" class="btn btn-outline">Filtrar</button>
          <button id="btn-clear-mov-filters" class="btn btn-outline" style="color: #64748b;">Limpar</button>
        </div>
      </div>
    </div>

    <!-- TABELA DE MOVIMENTAÇÕES -->
    <div class="content-card">
      <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>SKU</th>
                <th>Produto</th>
                <th>Tipo</th>
                <th>Quantidade</th>
                <th>Saldo Anterior</th>
                <th>Saldo Resultante</th>
                <th>Motivo / NF</th>
                <th>Destino / Setor</th>
                <th>Responsável / Usuário</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody id="movements-table-tbody">
              <tr><td colspan="11" class="text-center text-muted">Carregando movimentações...</td></tr>
            </tbody>
          </table>
        </div>
        <div id="movements-pagination-container"></div>
      </div>
    </div>
  `;

  loadDepartmentsIntoFilter();
  loadMovementsList();

  // Eventos de Filtro
  document.getElementById('btn-apply-mov-filters').addEventListener('click', () => {
    movementFilters.search = document.getElementById('mov-filter-search').value;
    movementFilters.movement_type = document.getElementById('mov-filter-type').value;
    movementFilters.department_id = document.getElementById('mov-filter-department').value;
    movementFilters.start_date = document.getElementById('mov-filter-start').value;
    movementFilters.end_date = document.getElementById('mov-filter-end').value;
    movementFilters.offset = 0;
    loadMovementsList();
  });

  document.getElementById('btn-clear-mov-filters').addEventListener('click', () => {
    movementFilters = { search: '', movement_type: '', department_id: '', start_date: '', end_date: '', limit: 25, offset: 0 };
    document.getElementById('mov-filter-search').value = '';
    document.getElementById('mov-filter-type').value = '';
    document.getElementById('mov-filter-department').value = '';
    document.getElementById('mov-filter-start').value = '';
    document.getElementById('mov-filter-end').value = '';
    loadMovementsList();
  });

  // Botões de Ação
  document.getElementById('btn-open-entry').addEventListener('click', () => openStockEntryModal());
  document.getElementById('btn-open-exit').addEventListener('click', () => openStockExitModal());
  document.getElementById('btn-open-adj').addEventListener('click', () => openStockAdjustModal());

  // Exportar CSV
  document.getElementById('btn-export-movements-csv').addEventListener('click', () => {
    api.downloadCsv('/reports/movements', movementFilters, `movimentacoes-estoque-${Date.now()}.csv`);
  });
}

async function loadDepartmentsIntoFilter() {
  try {
    const data = await api.get('/departments');
    const select = document.getElementById('mov-filter-department');
    if (!select) return;
    (data.departments || []).forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Erro ao carregar departamentos:', err);
  }
}

export async function loadMovementsList() {
  const tbody = document.getElementById('movements-table-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted">Carregando movimentações...</td></tr>`;

  try {
    const res = await api.get('/movements', movementFilters);
    const list = res.data || [];

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted" style="padding:2.5rem;">Nenhuma movimentação encontrada com os filtros atuais.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(m => {
      let typeBadge = `<span class="badge badge-normal">${m.movement_type}</span>`;
      let sign = '+';
      if (m.movement_type === 'SAIDA') {
        typeBadge = `<span class="badge badge-low" style="background:#fee2e2; color:#b91c1c;">SAÍDA</span>`;
        sign = '-';
      } else if (m.movement_type === 'AJUSTE') {
        typeBadge = `<span class="badge badge-low">AJUSTE</span>`;
        sign = '';
      } else if (m.movement_type === 'INVENTARIO') {
        typeBadge = `<span class="badge" style="background:#e0e7ff; color:#4338ca;">INVENTÁRIO</span>`;
        sign = '';
      }

      return `
        <tr>
          <td>${formatDate(m.created_at)}</td>
          <td><code>${m.product_sku}</code></td>
          <td class="font-semibold">${m.product_name}</td>
          <td>${typeBadge}</td>
          <td class="font-semibold">${sign}${m.quantity} ${m.unit_measure || ''}</td>
          <td class="text-muted">${m.previous_stock}</td>
          <td><strong style="color:var(--text-main);">${m.resulting_stock}</strong></td>
          <td>
            ${m.reason}
            ${m.invoice_number ? `<br><small class="text-muted">NF: ${m.invoice_number}</small>` : ''}
          </td>
          <td>${m.department_name || '-'}</td>
          <td>${m.responsible_person || m.user_name || '-'}</td>
          <td class="text-muted" style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${m.notes || '-'}
          </td>
        </tr>
      `;
    }).join('');

    // Paginação
    const pagContainer = document.getElementById('movements-pagination-container');
    if (pagContainer) {
      const pag = renderPagination({
        total: res.total,
        limit: movementFilters.limit,
        offset: movementFilters.offset,
        onPageChange: (newOffset) => {
          movementFilters.offset = newOffset;
          loadMovementsList();
        }
      });
      if (pag) {
        pagContainer.innerHTML = pag.html;
        pag.attachEvents(pagContainer);
      } else {
        pagContainer.innerHTML = '';
      }
    }
  } catch (err) {
    console.error('Erro ao listar movimentações:', err);
    tbody.innerHTML = `<tr><td colspan="11" class="text-center text-danger">Falha ao carregar movimentações: ${err.message}</td></tr>`;
  }
}

/**
 * Modal: Registrar Entrada de Estoque.
 */
export async function openStockEntryModal(preselectedProductId = null) {
  try {
    const [prodsRes, supsRes] = await Promise.all([
      api.get('/products', { status: 'active', limit: 500 }),
      api.get('/suppliers', { active: 'true' })
    ]);

    const products = prodsRes.data || [];
    const suppliers = supsRes.suppliers || [];

    const content = `
      <div class="modal-header">
        <h3 class="modal-title" style="color: var(--success-hover);">Registrar Entrada de Mercadoria</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <form id="form-stock-entry">
        <div class="modal-body">
          <div class="form-group">
            <label for="entry-prod">Produto / Material *</label>
            <select id="entry-prod" class="form-select" required>
              <option value="">Selecione o produto que está entrando...</option>
              ${products.map(p => `
                <option value="${p.id}" data-stock="${p.current_stock}" data-unit="${p.unit_measure}" data-price="${p.reference_price}" ${String(preselectedProductId) === String(p.id) ? 'selected' : ''}>
                  ${p.name} (SKU: ${p.sku}) — Saldo Atual: ${p.current_stock} ${p.unit_measure}
                </option>
              `).join('')}
            </select>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label for="entry-qty">Quantidade a Adicionar *</label>
              <input type="number" step="0.01" min="0.01" id="entry-qty" class="form-input" placeholder="Ex: 20" required>
            </div>
            <div class="form-group">
              <label for="entry-unit-price">Valor Unitário (R$)</label>
              <input type="number" step="0.01" min="0" id="entry-unit-price" class="form-input" placeholder="0,00">
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label for="entry-supplier">Fornecedor</label>
              <select id="entry-supplier" class="form-select">
                <option value="">Selecione o fornecedor (opcional)...</option>
                ${suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="entry-invoice">Número da Nota Fiscal</label>
              <input type="text" id="entry-invoice" class="form-input" placeholder="Ex: NF-12345">
            </div>
          </div>

          <div class="form-group">
            <label for="entry-reason">Motivo da Entrada</label>
            <select id="entry-reason" class="form-select">
              <option value="Compra">Compra</option>
              <option value="Reposição Mensal">Reposição Mensal</option>
              <option value="Devolução Interna">Devolução Interna</option>
              <option value="Bonificação / Doação">Bonificação / Doação</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div class="form-group">
            <label for="entry-notes">Observações</label>
            <textarea id="entry-notes" class="form-textarea" rows="2" placeholder="Informações adicionais do lote ou recebimento..."></textarea>
          </div>

          <!-- PRÉVIA DO SALDO RESULTANTE -->
          <div id="entry-preview" style="background:var(--success-light); border:1px solid #a7f3d0; padding:0.75rem 1rem; border-radius:var(--radius-sm); font-size:0.85rem; color:#065f46; display:none;">
            Saldo Anterior: <strong id="entry-prev-stock">0</strong> | Entrada: <strong id="entry-add-stock">0</strong> | <strong>Novo Saldo: <span id="entry-new-stock">0</span></strong>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline btn-modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-success">Confirmar Entrada</button>
        </div>
      </form>
    `;

    showModal(content, (modalRoot) => {
      const prodSelect = modalRoot.querySelector('#entry-prod');
      const qtyInput = modalRoot.querySelector('#entry-qty');
      const previewBox = modalRoot.querySelector('#entry-preview');
      const prevStockEl = modalRoot.querySelector('#entry-prev-stock');
      const addStockEl = modalRoot.querySelector('#entry-add-stock');
      const newStockEl = modalRoot.querySelector('#entry-new-stock');
      const priceInput = modalRoot.querySelector('#entry-unit-price');

      const updatePreview = () => {
        const selected = prodSelect.options[prodSelect.selectedIndex];
        if (!selected || !selected.value) {
          previewBox.style.display = 'none';
          return;
        }
        const currentStock = parseFloat(selected.dataset.stock) || 0;
        const addQty = parseFloat(qtyInput.value) || 0;
        if (selected.dataset.price && !priceInput.value) {
          priceInput.value = selected.dataset.price;
        }
        prevStockEl.textContent = `${currentStock} ${selected.dataset.unit || ''}`;
        addStockEl.textContent = `${addQty} ${selected.dataset.unit || ''}`;
        newStockEl.textContent = `${currentStock + addQty} ${selected.dataset.unit || ''}`;
        previewBox.style.display = 'block';
      };

      prodSelect.addEventListener('change', updatePreview);
      qtyInput.addEventListener('input', updatePreview);
      if (preselectedProductId) updatePreview();

      modalRoot.querySelector('#form-stock-entry').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          product_id: parseInt(prodSelect.value, 10),
          quantity: parseFloat(qtyInput.value),
          supplier_id: modalRoot.querySelector('#entry-supplier').value || null,
          invoice_number: modalRoot.querySelector('#entry-invoice').value || null,
          unit_price: parseFloat(priceInput.value) || 0,
          reason: modalRoot.querySelector('#entry-reason').value,
          notes: modalRoot.querySelector('#entry-notes').value
        };

        try {
          const res = await api.post('/movements/entry', payload);
          showToast(res.message, 'success');
          closeModal();
          loadMovementsList();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Modal: Registrar Saída / Retirada de Estoque.
 */
export async function openStockExitModal(preselectedProductId = null) {
  try {
    const [prodsRes, depsRes] = await Promise.all([
      api.get('/products', { status: 'active', limit: 500 }),
      api.get('/departments', { active: 'true' })
    ]);

    const products = prodsRes.data || [];
    const departments = depsRes.departments || [];

    const content = `
      <div class="modal-header">
        <h3 class="modal-title" style="color: var(--danger-hover);">Registrar Saída de Material</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <form id="form-stock-exit">
        <div class="modal-body">
          <div class="form-group">
            <label for="exit-prod">Produto / Material *</label>
            <select id="exit-prod" class="form-select" required>
              <option value="">Selecione o produto que está saindo...</option>
              ${products.map(p => `
                <option value="${p.id}" data-stock="${p.current_stock}" data-unit="${p.unit_measure}" ${String(preselectedProductId) === String(p.id) ? 'selected' : ''}>
                  ${p.name} (SKU: ${p.sku}) — Saldo Disponível: ${p.current_stock} ${p.unit_measure}
                </option>
              `).join('')}
            </select>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label for="exit-qty">Quantidade a Retirar *</label>
              <input type="number" step="0.01" min="0.01" id="exit-qty" class="form-input" placeholder="Ex: 3" required>
            </div>
            <div class="form-group">
              <label for="exit-dept">Departamento / Setor de Destino *</label>
              <select id="exit-dept" class="form-select" required>
                <option value="">Selecione o setor consumidor...</option>
                ${departments.map(d => `<option value="${d.id}">${d.name} (${d.cost_center || 'Geral'})</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label for="exit-resp">Funcionário Responsável / Solicitante *</label>
              <input type="text" id="exit-resp" class="form-input" placeholder="Ex: João Silva" required>
            </div>
            <div class="form-group">
              <label for="exit-reason">Motivo da Retirada</label>
              <select id="exit-reason" class="form-select">
                <option value="Uso interno">Uso interno</option>
                <option value="Consumo diário">Consumo diário</option>
                <option value="Manutenção">Manutenção</option>
                <option value="Projeto / Evento">Projeto / Evento</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="exit-notes">Observações</label>
            <textarea id="exit-notes" class="form-textarea" rows="2" placeholder="Ex: Impressão de relatórios gerenciais da diretoria..."></textarea>
          </div>

          <!-- PRÉVIA DO SALDO E AVISO DE SALDO INSUFICIENTE -->
          <div id="exit-preview" style="padding:0.75rem 1rem; border-radius:var(--radius-sm); font-size:0.85rem; display:none;">
            Saldo Atual: <strong id="exit-prev-stock">0</strong> | Retirada: <strong id="exit-sub-stock">0</strong> | <strong>Saldo Restante: <span id="exit-new-stock">0</span></strong>
          </div>
          <div id="exit-warning" style="display:none; margin-top:0.5rem; background:var(--danger-light); color:var(--danger-hover); padding:0.6rem 0.9rem; border-radius:var(--radius-sm); font-size:0.825rem; font-weight:600;">
            ⚠ Atenção: A quantidade solicitada é maior que o saldo em estoque! A saída será bloqueada.
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline btn-modal-cancel">Cancelar</button>
          <button type="submit" id="btn-submit-exit" class="btn btn-danger">Confirmar Saída</button>
        </div>
      </form>
    `;

    showModal(content, (modalRoot) => {
      const prodSelect = modalRoot.querySelector('#exit-prod');
      const qtyInput = modalRoot.querySelector('#exit-qty');
      const previewBox = modalRoot.querySelector('#exit-preview');
      const warningBox = modalRoot.querySelector('#exit-warning');
      const prevStockEl = modalRoot.querySelector('#exit-prev-stock');
      const subStockEl = modalRoot.querySelector('#exit-sub-stock');
      const newStockEl = modalRoot.querySelector('#exit-new-stock');
      const submitBtn = modalRoot.querySelector('#btn-submit-exit');

      const updatePreview = () => {
        const selected = prodSelect.options[prodSelect.selectedIndex];
        if (!selected || !selected.value) {
          previewBox.style.display = 'none';
          warningBox.style.display = 'none';
          return;
        }
        const currentStock = parseFloat(selected.dataset.stock) || 0;
        const subQty = parseFloat(qtyInput.value) || 0;
        const resulting = currentStock - subQty;

        prevStockEl.textContent = `${currentStock} ${selected.dataset.unit || ''}`;
        subStockEl.textContent = `${subQty} ${selected.dataset.unit || ''}`;
        newStockEl.textContent = `${resulting} ${selected.dataset.unit || ''}`;

        if (subQty > currentStock) {
          previewBox.style.background = '#fef2f2';
          previewBox.style.border = '1px solid #fecaca';
          previewBox.style.color = '#991b1b';
          warningBox.style.display = 'block';
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.5';
        } else {
          previewBox.style.background = '#f1f5f9';
          previewBox.style.border = '1px solid #cbd5e1';
          previewBox.style.color = '#1e293b';
          warningBox.style.display = 'none';
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
        }
        previewBox.style.display = 'block';
      };

      prodSelect.addEventListener('change', updatePreview);
      qtyInput.addEventListener('input', updatePreview);
      if (preselectedProductId) updatePreview();

      modalRoot.querySelector('#form-stock-exit').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          product_id: parseInt(prodSelect.value, 10),
          quantity: parseFloat(qtyInput.value),
          department_id: modalRoot.querySelector('#exit-dept').value || null,
          responsible_person: modalRoot.querySelector('#exit-resp').value,
          reason: modalRoot.querySelector('#exit-reason').value,
          notes: modalRoot.querySelector('#exit-notes').value
        };

        try {
          const res = await api.post('/movements/exit', payload);
          showToast(res.message, 'success');
          closeModal();
          loadMovementsList();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Modal: Registrar Ajuste Manual de Estoque (Correção Física, Avaria, Perda).
 */
export async function openStockAdjustModal(preselectedProductId = null) {
  try {
    const prodsRes = await api.get('/products', { status: 'active', limit: 500 });
    const products = prodsRes.data || [];

    const content = `
      <div class="modal-header">
        <h3 class="modal-title" style="color: var(--warning-hover);">Ajustar Saldo de Estoque</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <form id="form-stock-adjust">
        <div class="modal-body">
          <div class="form-group">
            <label for="adj-prod">Produto / Material *</label>
            <select id="adj-prod" class="form-select" required>
              <option value="">Selecione o produto a ajustar...</option>
              ${products.map(p => `
                <option value="${p.id}" data-stock="${p.current_stock}" data-unit="${p.unit_measure}" ${String(preselectedProductId) === String(p.id) ? 'selected' : ''}>
                  ${p.name} (SKU: ${p.sku}) — Saldo Atual: ${p.current_stock} ${p.unit_measure}
                </option>
              `).join('')}
            </select>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>Saldo Atual no Sistema</label>
              <input type="text" id="adj-current" class="form-input" readonly style="background:#f1f5f9;" value="0">
            </div>
            <div class="form-group">
              <label for="adj-new-qty">Nova Quantidade Real *</label>
              <input type="number" step="0.01" min="0" id="adj-new-qty" class="form-input" placeholder="Digite o saldo real" required>
            </div>
          </div>

          <div class="form-group">
            <label for="adj-reason">Motivo Obrigatório do Ajuste *</label>
            <select id="adj-reason" class="form-select" required>
              <option value="">Selecione a justificativa do ajuste...</option>
              <option value="Contagem física de rotina">Contagem física de rotina</option>
              <option value="Produto danificado / Avaria">Produto danificado / Avaria</option>
              <option value="Produto perdido / Extraviado">Produto perdido / Extraviado</option>
              <option value="Validade expirada">Validade expirada</option>
              <option value="Correção de erro de digitação de entrada">Correção de erro de digitação de entrada</option>
              <option value="Divergência de inventário">Divergência de inventário</option>
              <option value="Outro">Outro (especificar nas observações)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="adj-notes">Observações Detalhadas</label>
            <textarea id="adj-notes" class="form-textarea" rows="2" placeholder="Justifique a alteração para fins de auditoria interna..."></textarea>
          </div>

          <div id="adj-preview" style="background:var(--warning-light); border:1px solid #fde68a; padding:0.75rem 1rem; border-radius:var(--radius-sm); font-size:0.85rem; color:#92400e; display:none;">
            Diferença Apurada: <strong id="adj-diff-val">0</strong> (será registrado na auditoria)
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline btn-modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Confirmar Ajuste</button>
        </div>
      </form>
    `;

    showModal(content, (modalRoot) => {
      const prodSelect = modalRoot.querySelector('#adj-prod');
      const curInput = modalRoot.querySelector('#adj-current');
      const newQtyInput = modalRoot.querySelector('#adj-new-qty');
      const previewBox = modalRoot.querySelector('#adj-preview');
      const diffValEl = modalRoot.querySelector('#adj-diff-val');

      const updatePreview = () => {
        const selected = prodSelect.options[prodSelect.selectedIndex];
        if (!selected || !selected.value) {
          curInput.value = '0';
          previewBox.style.display = 'none';
          return;
        }
        const curStock = parseFloat(selected.dataset.stock) || 0;
        curInput.value = `${curStock} ${selected.dataset.unit || ''}`;

        const newStock = parseFloat(newQtyInput.value);
        if (!isNaN(newStock)) {
          const diff = newStock - curStock;
          diffValEl.textContent = `${diff > 0 ? '+' : ''}${diff} ${selected.dataset.unit || ''}`;
          previewBox.style.display = 'block';
        } else {
          previewBox.style.display = 'none';
        }
      };

      prodSelect.addEventListener('change', updatePreview);
      newQtyInput.addEventListener('input', updatePreview);
      if (preselectedProductId) updatePreview();

      modalRoot.querySelector('#form-stock-adjust').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          product_id: parseInt(prodSelect.value, 10),
          new_quantity: parseFloat(newQtyInput.value),
          reason: modalRoot.querySelector('#adj-reason').value,
          notes: modalRoot.querySelector('#adj-notes').value
        };

        try {
          const res = await api.post('/movements/adjustment', payload);
          showToast(res.message, 'success');
          closeModal();
          loadMovementsList();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}
