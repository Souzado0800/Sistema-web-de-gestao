/**
 * View: Cadastro, Consulta, Edição e Histórico Individual de Produtos.
 */
import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, showModal, closeModal, confirmDialog, formatCurrency, formatDate, renderStockBadge, renderPagination } from '../components.js';

let currentFilters = {
  search: '',
  category_id: '',
  status: 'active',
  stock_status: '',
  limit: 25,
  offset: 0
};

export async function renderProducts(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Gestão de Produtos e Materiais</h1>
        <p class="page-subtitle">Cadastre, consulte e acompanhe os níveis de estoque de qualquer item da empresa</p>
      </div>
      <div>
        <button id="btn-add-product" class="btn btn-primary admin-only">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Novo Produto</span>
        </button>
      </div>
    </div>

    <!-- BARRA DE FILTROS -->
    <div class="content-card">
      <div class="card-body" style="padding: 1.1rem 1.4rem;">
        <div class="filter-bar">
          <input type="text" id="prod-filter-search" class="form-input" style="max-width: 280px;" placeholder="Buscar por Nome ou SKU..." value="${currentFilters.search}">
          
          <select id="prod-filter-category" class="form-select" style="max-width: 180px;">
            <option value="">Todas as Categorias</option>
          </select>

          <select id="prod-filter-stock" class="form-select" style="max-width: 180px;">
            <option value="">Todas as Situações</option>
            <option value="normal" ${currentFilters.stock_status === 'normal' ? 'selected' : ''}>Estoque Normal</option>
            <option value="low" ${currentFilters.stock_status === 'low' ? 'selected' : ''}>Estoque Baixo / Mínimo</option>
            <option value="zero" ${currentFilters.stock_status === 'zero' ? 'selected' : ''}>Sem Estoque (Zerados)</option>
          </select>

          <select id="prod-filter-status" class="form-select" style="max-width: 160px;">
            <option value="active" ${currentFilters.status === 'active' ? 'selected' : ''}>Ativos</option>
            <option value="archived" ${currentFilters.status === 'archived' ? 'selected' : ''}>Arquivados</option>
            <option value="all" ${currentFilters.status === 'all' ? 'selected' : ''}>Todos os Status</option>
          </select>

          <button id="btn-apply-filters" class="btn btn-outline">Filtrar</button>
          <button id="btn-clear-filters" class="btn btn-outline" style="color: #64748b;">Limpar</button>
        </div>
      </div>
    </div>

    <!-- TABELA DE PRODUTOS -->
    <div class="content-card">
      <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nome do Produto</th>
                <th>Categoria</th>
                <th>Unidade</th>
                <th>Estoque Atual</th>
                <th>Mínimo</th>
                <th>Ideal</th>
                <th>Situação</th>
                <th>Localização</th>
                <th>Preço Ref.</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="products-table-tbody">
              <tr><td colspan="11" class="text-center text-muted">Carregando catálogo de produtos...</td></tr>
            </tbody>
          </table>
        </div>
        <div id="products-pagination-container"></div>
      </div>
    </div>
  `;

  // Carrega categorias no filtro
  loadCategoriesIntoFilter();

  // Carrega lista de produtos
  loadProductsList();

  // Event Listeners
  const searchInput = document.getElementById('prod-filter-search');
  let searchTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentFilters.search = searchInput.value;
      currentFilters.offset = 0;
      loadProductsList();
    }, 400);
  });

  document.getElementById('btn-apply-filters').addEventListener('click', () => {
    currentFilters.search = document.getElementById('prod-filter-search').value;
    currentFilters.category_id = document.getElementById('prod-filter-category').value;
    currentFilters.stock_status = document.getElementById('prod-filter-stock').value;
    currentFilters.status = document.getElementById('prod-filter-status').value;
    currentFilters.offset = 0;
    loadProductsList();
  });

  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    currentFilters = { search: '', category_id: '', status: 'active', stock_status: '', limit: 25, offset: 0 };
    document.getElementById('prod-filter-search').value = '';
    document.getElementById('prod-filter-category').value = '';
    document.getElementById('prod-filter-stock').value = '';
    document.getElementById('prod-filter-status').value = 'active';
    loadProductsList();
  });

  const addBtn = document.getElementById('btn-add-product');
  if (addBtn) {
    if (!state.isAdmin()) addBtn.classList.add('hidden');
    addBtn.addEventListener('click', () => openProductFormModal());
  }
}

async function loadCategoriesIntoFilter() {
  try {
    const data = await api.get('/categories');
    const select = document.getElementById('prod-filter-category');
    if (!select) return;

    (data.categories || []).forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      if (String(currentFilters.category_id) === String(cat.id)) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Erro ao carregar categorias no filtro:', err);
  }
}

async function loadProductsList() {
  const tbody = document.getElementById('products-table-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted">Carregando dados...</td></tr>`;

  try {
    const res = await api.get('/products', currentFilters);
    const products = res.data || [];

    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted" style="padding: 2.5rem;">Nenhum produto encontrado para os critérios selecionados.</td></tr>`;
      return;
    }

    const isAdmin = state.isAdmin();

    tbody.innerHTML = products.map(p => {
      const isArchived = p.status === 'archived';
      return `
        <tr class="${isArchived ? 'opacity-60' : ''}">
          <td><code>${p.sku}</code></td>
          <td class="font-semibold cursor-pointer btn-view-prod" data-id="${p.id}" style="color: var(--primary);">
            ${p.name}
          </td>
          <td>
            <span style="display:inline-flex; align-items:center; gap:0.35rem;">
              <span style="width:8px; height:8px; border-radius:50%; background:${p.category_color || '#3b82f6'};"></span>
              ${p.category_name || 'Sem Categoria'}
            </span>
          </td>
          <td>${p.unit_measure}</td>
          <td class="font-semibold" style="font-size: 0.95rem;">${p.current_stock}</td>
          <td class="text-muted">${p.min_stock}</td>
          <td class="text-muted">${p.ideal_stock}</td>
          <td>${renderStockBadge(p.stock_alert_level, p.current_stock, p.min_stock)}</td>
          <td>${p.location || '-'}</td>
          <td>${formatCurrency(p.reference_price)}</td>
          <td class="text-right">
            <div class="table-actions" style="justify-content: flex-end;">
              <button class="btn btn-sm btn-outline btn-view-prod" data-id="${p.id}" title="Ver Detalhes e Histórico">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
              ${isAdmin && !isArchived ? `
                <button class="btn btn-sm btn-outline btn-edit-prod" data-id="${p.id}" title="Editar Produto">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn btn-sm btn-outline text-danger btn-archive-prod" data-id="${p.id}" data-name="${p.name}" title="Arquivar Produto">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Adiciona paginação
    const pagContainer = document.getElementById('products-pagination-container');
    if (pagContainer) {
      const pag = renderPagination({
        total: res.total,
        limit: currentFilters.limit,
        offset: currentFilters.offset,
        onPageChange: (newOffset) => {
          currentFilters.offset = newOffset;
          loadProductsList();
        }
      });
      if (pag) {
        pagContainer.innerHTML = pag.html;
        pag.attachEvents(pagContainer);
      } else {
        pagContainer.innerHTML = '';
      }
    }

    // Eventos de clique nas ações
    tbody.querySelectorAll('.btn-view-prod').forEach(btn => {
      btn.addEventListener('click', () => openProductDetailsModal(btn.dataset.id));
    });

    tbody.querySelectorAll('.btn-edit-prod').forEach(btn => {
      btn.addEventListener('click', () => openProductFormModal(btn.dataset.id));
    });

    tbody.querySelectorAll('.btn-archive-prod').forEach(btn => {
      btn.addEventListener('click', () => {
        confirmDialog({
          title: 'Arquivar Produto',
          message: `Deseja arquivar o produto "${btn.dataset.name}"? Ele deixará de receber novas saídas, mas seu histórico de movimentações permanecerá intacto para fins de auditoria.`,
          confirmText: 'Sim, Arquivar',
          onConfirm: async () => {
            try {
              await api.post(`/products/${btn.dataset.id}/archive`);
              showToast('Produto arquivado com sucesso!');
              loadProductsList();
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
      });
    });

  } catch (err) {
    console.error('Erro ao listar produtos:', err);
    tbody.innerHTML = `<tr><td colspan="11" class="text-center text-danger">Falha ao carregar produtos: ${err.message}</td></tr>`;
  }
}

/**
 * Modal de Detalhes Individuais do Produto com Timeline de Movimentações.
 */
export async function openProductDetailsModal(productId) {
  try {
    const data = await api.get(`/products/${productId}`);
    const p = data.product;
    const movements = data.recent_movements || [];

    const suggested = Math.max(parseFloat(p.ideal_stock) - parseFloat(p.current_stock), 0);

    const timelineHtml = movements.length === 0 
      ? '<p class="text-muted" style="font-size:0.85rem;">Nenhuma movimentação registrada para este produto até o momento.</p>'
      : `
        <div class="timeline">
          ${movements.map(m => {
            let dotClass = 'in';
            let sign = '+';
            if (m.movement_type === 'SAIDA') { dotClass = 'out'; sign = '-'; }
            if (m.movement_type === 'AJUSTE') { dotClass = 'adj'; sign = ''; }

            return `
              <div class="timeline-item">
                <div class="timeline-dot ${dotClass}"></div>
                <div class="timeline-content">
                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.2rem;">
                    <strong style="color:var(--text-main);">${m.movement_type}: ${sign}${m.quantity} ${p.unit_measure}</strong>
                    <span class="text-muted">${formatDate(m.created_at)}</span>
                  </div>
                  <div style="font-size:0.775rem; color:#475569;">
                    Motivo: <em>${m.reason}</em> ${m.department_name ? `• Setor: ${m.department_name}` : ''}
                  </div>
                  <div style="font-size:0.75rem; color:#64748b; margin-top:0.2rem;">
                    Saldo resultante: <strong>${m.resulting_stock}</strong> • Por: ${m.responsible_person || m.user_name || 'Sistema'}
                  </div>
                  ${m.notes ? `<div style="font-size:0.725rem; color:#94a3b8; font-style:italic;">Obs: ${m.notes}</div>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

    const content = `
      <div class="modal-header">
        <div>
          <h3 class="modal-title">${p.name}</h3>
          <span style="font-size: 0.8rem; color: #64748b;">Código SKU: <code>${p.sku}</code></span>
        </div>
        <button class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <!-- GRID DE PROPRIEDADES -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; background: #f8fafc; padding: 1.1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <div>
            <span class="text-muted" style="font-size:0.75rem; display:block;">Estoque Atual</span>
            <span class="font-semibold" style="font-size:1.3rem; color:${p.current_stock <= p.min_stock ? 'var(--danger)' : 'var(--success)'};">${p.current_stock} ${p.unit_measure}</span>
          </div>
          <div>
            <span class="text-muted" style="font-size:0.75rem; display:block;">Estoque Mínimo</span>
            <span class="font-semibold" style="font-size:1.1rem;">${p.min_stock} ${p.unit_measure}</span>
          </div>
          <div>
            <span class="text-muted" style="font-size:0.75rem; display:block;">Estoque Ideal</span>
            <span class="font-semibold" style="font-size:1.1rem;">${p.ideal_stock} ${p.unit_measure}</span>
          </div>
          <div>
            <span class="text-muted" style="font-size:0.75rem; display:block;">Sugestão Compra</span>
            <span class="font-semibold" style="font-size:1.1rem; color:var(--primary);">${suggested} ${p.unit_measure}</span>
          </div>
          <div>
            <span class="text-muted" style="font-size:0.75rem; display:block;">Preço de Referência</span>
            <span class="font-semibold">${formatCurrency(p.reference_price)}</span>
          </div>
          <div>
            <span class="text-muted" style="font-size:0.75rem; display:block;">Localização</span>
            <span>${p.location || 'Não especificada'}</span>
          </div>
        </div>

        <div style="margin-bottom: 1.25rem;">
          <h4 style="font-size:0.95rem; font-weight:600; margin-bottom:0.4rem;">Descrição e Especificações</h4>
          <p style="font-size:0.85rem; color:#475569;">${p.description || 'Nenhuma descrição detalhada informada.'}</p>
        </div>

        <hr style="border:none; border-top:1px solid var(--border-color); margin: 1.25rem 0;">

        <div>
          <h4 style="font-size:0.95rem; font-weight:600; margin-bottom:0.75rem;">Linha do Tempo de Movimentações</h4>
          ${timelineHtml}
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

/**
 * Modal de Cadastro e Edição de Produto.
 */
export async function openProductFormModal(productId = null) {
  try {
    const [categoriesRes, suppliersRes] = await Promise.all([
      api.get('/categories'),
      api.get('/suppliers', { active: 'true' })
    ]);

    const categories = categoriesRes.categories || [];
    const suppliers = suppliersRes.suppliers || [];

    let p = {
      sku: '',
      name: '',
      category_id: '',
      unit_measure: 'Unidade',
      description: '',
      current_stock: 0,
      min_stock: 0,
      ideal_stock: 0,
      location: '',
      primary_supplier_id: '',
      reference_price: 0,
      notes: ''
    };

    if (productId) {
      const data = await api.get(`/products/${productId}`);
      p = data.product;
    }

    const isEditing = !!productId;

    const content = `
      <div class="modal-header">
        <h3 class="modal-title">${isEditing ? 'Editar Produto' : 'Cadastrar Novo Produto'}</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <form id="form-product-save">
        <div class="modal-body">
          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1rem;">
            <div class="form-group">
              <label for="prod-sku">Código SKU / Identificador *</label>
              <input type="text" id="prod-sku" class="form-input font-mono" placeholder="Ex: PAP-A4-75G" value="${p.sku}" required>
            </div>
            <div class="form-group">
              <label for="prod-name">Nome do Produto / Material *</label>
              <input type="text" id="prod-name" class="form-input" placeholder="Ex: Papel Sulfite A4 75g" value="${p.name}" required>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label for="prod-category">Categoria</label>
              <select id="prod-category" class="form-select">
                <option value="">Selecione uma categoria...</option>
                ${categories.map(c => `<option value="${c.id}" ${String(p.category_id) === String(c.id) ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="prod-unit">Unidade de Medida *</label>
              <input type="text" id="prod-unit" class="form-input" placeholder="Ex: Resma, Unidade, Caixa, Frasco, Litro" value="${p.unit_measure}" required list="units-list">
              <datalist id="units-list">
                <option value="Unidade">
                <option value="Resma">
                <option value="Caixa">
                <option value="Pacote">
                <option value="Frasco">
                <option value="Galão">
                <option value="Litro">
                <option value="Quilograma">
                <option value="Metro">
                <option value="Rolo">
                <option value="Cartucho">
              </datalist>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
            ${!isEditing ? `
              <div class="form-group">
                <label for="prod-stock-init">Estoque Inicial</label>
                <input type="number" step="0.01" min="0" id="prod-stock-init" class="form-input" value="${p.current_stock}">
              </div>
            ` : ''}
            <div class="form-group">
              <label for="prod-stock-min">Estoque Mínimo (Alerta) *</label>
              <input type="number" step="0.01" min="0" id="prod-stock-min" class="form-input" value="${p.min_stock}" required>
            </div>
            <div class="form-group">
              <label for="prod-stock-ideal">Estoque Ideal (Máximo)</label>
              <input type="number" step="0.01" min="0" id="prod-stock-ideal" class="form-input" value="${p.ideal_stock}">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label for="prod-location">Localização / Almoxarifado</label>
              <input type="text" id="prod-location" class="form-input" placeholder="Ex: Almoxarifado A - Prateleira 2" value="${p.location || ''}">
            </div>
            <div class="form-group">
              <label for="prod-price">Preço de Referência (R$)</label>
              <input type="number" step="0.01" min="0" id="prod-price" class="form-input" placeholder="0,00" value="${p.reference_price || 0}">
            </div>
          </div>

          <div class="form-group">
            <label for="prod-supplier">Fornecedor Homologado Principal</label>
            <select id="prod-supplier" class="form-select">
              <option value="">Selecione um fornecedor...</option>
              ${suppliers.map(s => `<option value="${s.id}" ${String(p.primary_supplier_id) === String(s.id) ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="prod-desc">Descrição / Observações</label>
            <textarea id="prod-desc" class="form-textarea" rows="2" placeholder="Especificações técnicas, modelo compatível, etc.">${p.description || ''}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline btn-modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">${isEditing ? 'Salvar Alterações' : 'Cadastrar Produto'}</button>
        </div>
      </form>
    `;

    showModal(content, (modalRoot) => {
      const form = modalRoot.querySelector('#form-product-save');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
          sku: form.querySelector('#prod-sku').value,
          name: form.querySelector('#prod-name').value,
          category_id: form.querySelector('#prod-category').value || null,
          unit_measure: form.querySelector('#prod-unit').value,
          min_stock: parseFloat(form.querySelector('#prod-stock-min').value) || 0,
          ideal_stock: parseFloat(form.querySelector('#prod-stock-ideal').value) || 0,
          location: form.querySelector('#prod-location').value,
          reference_price: parseFloat(form.querySelector('#prod-price').value) || 0,
          primary_supplier_id: form.querySelector('#prod-supplier').value || null,
          description: form.querySelector('#prod-desc').value
        };

        if (!isEditing) {
          payload.current_stock = parseFloat(form.querySelector('#prod-stock-init').value) || 0;
        }

        try {
          if (isEditing) {
            await api.put(`/products/${productId}`, payload);
            showToast('Produto atualizado com sucesso!');
          } else {
            await api.post('/products', payload);
            showToast('Produto cadastrado com sucesso!');
          }
          closeModal();
          loadProductsList();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}
