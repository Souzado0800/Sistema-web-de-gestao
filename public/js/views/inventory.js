/**
 * View: Assistente de Inventário Físico e Conciliação de Estoque.
 */
import { api } from '../api.js';
import { state } from '../state.js';
import { showToast, showModal, closeModal, confirmDialog, formatDate } from '../components.js';

export async function renderInventory(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Inventário Físico</h1>
        <p class="page-subtitle">Realize contagens físicas periódicas, apure divergências e ajuste o estoque com total rastreabilidade</p>
      </div>
      <div>
        <button id="btn-start-inventory" class="btn btn-primary admin-only">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
          <span>Iniciar Nova Contagem</span>
        </button>
      </div>
    </div>

    <!-- SESSÃO ATIVA OU LISTA DE SESSÕES ANTERIORES -->
    <div id="inventory-content-area">
      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title">Sessões de Inventário Realizadas</h2>
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Título da Sessão</th>
                  <th>Categoria</th>
                  <th>Status</th>
                  <th>Itens Conferidos</th>
                  <th>Divergência Total</th>
                  <th>Criado por</th>
                  <th>Data Criação</th>
                  <th>Finalizado em</th>
                  <th class="text-right">Ação</th>
                </tr>
              </thead>
              <tbody id="inventory-sessions-tbody">
                <tr><td colspan="10" class="text-center text-muted">Carregando sessões de inventário...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  loadInventorySessions();

  const startBtn = document.getElementById('btn-start-inventory');
  if (startBtn) {
    if (!state.isAdmin()) startBtn.classList.add('hidden');
    startBtn.addEventListener('click', () => openNewSessionModal());
  }
}

async function loadInventorySessions() {
  const tbody = document.getElementById('inventory-sessions-tbody');
  if (!tbody) return;

  try {
    const res = await api.get('/inventory/sessions');
    const sessions = res.data || [];

    if (sessions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding:2.5rem;">Nenhuma sessão de inventário realizada ainda. Clique em "Iniciar Nova Contagem" para começar.</td></tr>`;
      return;
    }

    tbody.innerHTML = sessions.map(s => {
      const isCompleted = s.status === 'completed';
      const statusBadge = isCompleted 
        ? `<span class="badge badge-normal">Concluído</span>`
        : `<span class="badge badge-low">Em Aberto</span>`;

      return `
        <tr>
          <td><code>${s.code}</code></td>
          <td class="font-semibold">${s.title}</td>
          <td>${s.category_name || 'Estoque Geral (Todas)'}</td>
          <td>${statusBadge}</td>
          <td>${s.total_items_counted || 0} produtos</td>
          <td class="font-semibold" style="color: ${parseFloat(s.total_divergence) > 0 ? 'var(--danger)' : 'var(--success)'};">
            ${s.total_divergence || 0} un
          </td>
          <td>${s.created_by_name || 'Admin'}</td>
          <td>${formatDate(s.created_at)}</td>
          <td>${formatDate(s.finalized_at)}</td>
          <td class="text-right">
            <button class="btn btn-sm btn-outline btn-view-session" data-id="${s.id}">
              ${isCompleted ? 'Ver Relatório' : 'Continuar Contagem'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-view-session').forEach(btn => {
      btn.addEventListener('click', () => openSessionDetails(btn.dataset.id));
    });
  } catch (err) {
    console.error('Erro ao listar sessões de inventário:', err);
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Falha ao carregar sessões: ${err.message}</td></tr>`;
  }
}

async function openNewSessionModal() {
  try {
    const data = await api.get('/categories');
    const categories = data.categories || [];

    const content = `
      <div class="modal-header">
        <h3 class="modal-title">Iniciar Nova Sessão de Inventário</h3>
        <button class="modal-close-btn">&times;</button>
      </div>
      <form id="form-start-inventory">
        <div class="modal-body">
          <div class="form-group">
            <label for="inv-title">Título / Descrição da Conferência *</label>
            <input type="text" id="inv-title" class="form-input" placeholder="Ex: Inventário Mensal Almoxarifado Central - Setembro/2026" required>
          </div>

          <div class="form-group">
            <label for="inv-cat">Escopo do Inventário</label>
            <select id="inv-cat" class="form-select">
              <option value="">Todo o Estoque (Todas as Categorias)</option>
              ${categories.map(c => `<option value="${c.id}">Apenas Categoria: ${c.name}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="inv-notes">Observações</label>
            <textarea id="inv-notes" class="form-textarea" rows="2" placeholder="Ex: Conferência trimestral de materiais de consumo..."></textarea>
          </div>

          <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:0.85rem 1rem; border-radius:var(--radius-sm); font-size:0.825rem; color:#1e40af;">
            ℹ O sistema carregará a lista de todos os produtos do escopo selecionado com as quantidades registradas atualmente. Na próxima etapa você poderá informar a contagem física real de cada item.
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline btn-modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Criar e Iniciar Contagem</button>
        </div>
      </form>
    `;

    showModal(content, (modalRoot) => {
      modalRoot.querySelector('#form-start-inventory').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          title: modalRoot.querySelector('#inv-title').value,
          category_id: modalRoot.querySelector('#inv-cat').value || null,
          notes: modalRoot.querySelector('#inv-notes').value
        };

        try {
          const res = await api.post('/inventory/sessions', payload);
          showToast('Sessão de inventário criada com sucesso!');
          closeModal();
          openSessionDetails(res.session.id);
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
 * Tela de Assistente de Contagem Física e Divergências da Sessão.
 */
async function openSessionDetails(sessionId) {
  const contentArea = document.getElementById('inventory-content-area');
  if (!contentArea) return;

  contentArea.innerHTML = `<div class="content-card"><div class="card-body text-center text-muted">Carregando itens da conferência...</div></div>`;

  try {
    const data = await api.get(`/inventory/sessions/${sessionId}`);
    const s = data.session;
    const items = s.items || [];
    const isCompleted = s.status === 'completed';

    contentArea.innerHTML = `
      <div style="margin-bottom: 1rem; display:flex; justify-content:space-between; align-items:center;">
        <button id="btn-back-to-sessions" class="btn btn-sm btn-outline">← Voltar para Lista de Sessões</button>
        <div style="font-size:0.85rem; color:var(--text-muted);">
          Código: <strong>${s.code}</strong> • Status: <strong>${isCompleted ? 'Concluído' : 'Em Aberto'}</strong>
        </div>
      </div>

      <div class="content-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">${s.title}</h2>
            <span class="text-muted" style="font-size:0.8rem;">Escopo: ${s.category_name || 'Estoque Geral'} • Total de Produtos: ${items.length}</span>
          </div>
          ${!isCompleted ? `
            <button id="btn-reconcile-inventory" class="btn btn-success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Confirmar e Aplicar Ajustes no Estoque</span>
            </button>
          ` : `
            <span class="badge badge-normal" style="font-size:0.85rem; padding:0.4rem 0.8rem;">
              ✔ Inventário Finalizado e Ajustado
            </span>
          `}
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Produto</th>
                  <th>Unidade</th>
                  <th>Estoque Sistema</th>
                  <th>Contagem Física Encontrada</th>
                  <th>Divergência Calculada</th>
                  <th>Observação da Contagem</th>
                </tr>
              </thead>
              <tbody id="inventory-items-tbody">
                ${items.map(it => {
                  const expected = parseFloat(it.expected_stock);
                  const counted = parseFloat(it.counted_stock);
                  const diff = counted - expected;

                  return `
                    <tr data-prod-id="${it.product_id}">
                      <td><code>${it.product_sku}</code></td>
                      <td class="font-semibold">${it.product_name}</td>
                      <td>${it.unit_measure}</td>
                      <td class="item-expected font-semibold" style="font-size:0.95rem;">${expected}</td>
                      <td style="max-width: 140px;">
                        ${!isCompleted ? `
                          <input type="number" step="0.01" min="0" class="form-input item-counted-input font-semibold" value="${counted}" style="max-width:110px;">
                        ` : `
                          <strong style="font-size:0.95rem;">${counted}</strong>
                        `}
                      </td>
                      <td>
                        <span class="item-diff-badge font-semibold" style="font-size:0.95rem; color:${diff === 0 ? 'var(--success)' : (diff > 0 ? 'var(--primary)' : 'var(--danger)')};">
                          ${diff === 0 ? '0 (Correto)' : (diff > 0 ? `+${diff} (Sobra)` : `${diff} (Falta)`)}
                        </span>
                      </td>
                      <td>
                        ${!isCompleted ? `
                          <input type="text" class="form-input item-notes-input" placeholder="Justificativa da divergência..." value="${it.notes || ''}">
                        ` : `
                          <span class="text-muted">${it.notes || '-'}</span>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-back-to-sessions').addEventListener('click', () => {
      renderInventory(document.getElementById('view-container'));
    });

    if (!isCompleted) {
      // Atualização de divergência em tempo real ao digitar
      const rows = contentArea.querySelectorAll('#inventory-items-tbody tr');
      rows.forEach(row => {
        const expected = parseFloat(row.querySelector('.item-expected').textContent) || 0;
        const input = row.querySelector('.item-counted-input');
        const diffBadge = row.querySelector('.item-diff-badge');

        input.addEventListener('input', () => {
          const counted = parseFloat(input.value) || 0;
          const diff = counted - expected;
          diffBadge.textContent = diff === 0 ? '0 (Correto)' : (diff > 0 ? `+${diff} (Sobra)` : `${diff} (Falta)`);
          diffBadge.style.color = diff === 0 ? 'var(--success)' : (diff > 0 ? 'var(--primary)' : 'var(--danger)');
        });
      });

      // Botão de Conciliação
      document.getElementById('btn-reconcile-inventory').addEventListener('click', () => {
        confirmDialog({
          title: 'Finalizar Inventário e Aplicar Ajustes',
          message: 'Ao confirmar, o saldo do estoque dos produtos divergentes será atualizado e serão geradas movimentações de auditoria tipo "INVENTARIO" para cada diferença encontrada. Deseja prosseguir?',
          confirmText: 'Sim, Aplicar Ajustes',
          isDanger: false,
          onConfirm: async () => {
            const counts = [];
            rows.forEach(r => {
              counts.push({
                product_id: parseInt(r.dataset.prodId, 10),
                counted_stock: parseFloat(r.querySelector('.item-counted-input').value) || 0,
                notes: r.querySelector('.item-notes-input').value
              });
            });

            try {
              const res = await api.post(`/inventory/sessions/${sessionId}/reconcile`, { counts });
              showToast(res.message, 'success');
              openSessionDetails(sessionId);
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
      });
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}
