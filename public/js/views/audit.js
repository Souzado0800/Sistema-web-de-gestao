/**
 * View: Trilha de Auditoria Imutável do Sistema (Restrito a Administradores).
 */
import { api } from '../api.js';
import { showToast, showModal, formatDate, renderPagination } from '../components.js';

let auditFilters = {
  action: '',
  entity_type: '',
  limit: 50,
  offset: 0
};

export async function renderAudit(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Trilha de Auditoria</h1>
        <p class="page-subtitle">Registro cronológico detalhado e imutável de todas as ações sensíveis realizadas no sistema</p>
      </div>
    </div>

    <!-- FILTROS -->
    <div class="content-card">
      <div class="card-body" style="padding: 1.1rem 1.4rem;">
        <div class="filter-bar">
          <select id="audit-filter-action" class="form-select" style="max-width: 220px;">
            <option value="">Todas as Ações</option>
            <option value="ESTOQUE_ENTRADA">Entrada de Estoque</option>
            <option value="ESTOQUE_SAIDA">Saída de Estoque</option>
            <option value="ESTOQUE_AJUSTE">Ajuste de Saldo</option>
            <option value="PRODUTO_CRIADO">Produto Cadastrado</option>
            <option value="PRODUTO_ALTERADO">Produto Alterado</option>
            <option value="PRODUTO_ARQUIVADO">Produto Arquivado</option>
            <option value="INVENTARIO_INICIADO">Inventário Iniciado</option>
            <option value="INVENTARIO_CONCLUIDO">Inventário Concluído</option>
            <option value="ORDEM_COMPRA_CRIADA">Ordem de Compra Criada</option>
            <option value="ORDEM_COMPRA_RECEBIDA">Compra Recebida</option>
            <option value="USUARIO_LOGIN">Login de Usuário</option>
            <option value="CONFIGURACOES_ALTERADAS">Configurações Alteradas</option>
          </select>

          <button id="btn-apply-audit-filter" class="btn btn-outline">Filtrar</button>
        </div>
      </div>
    </div>

    <!-- TABELA DE LOGS -->
    <div class="content-card">
      <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Usuário</th>
                <th>Ação Realizada</th>
                <th>Entidade</th>
                <th>ID Afetado</th>
                <th>Endereço IP</th>
                <th class="text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody id="audit-table-tbody">
              <tr><td colspan="7" class="text-center text-muted">Carregando logs de auditoria...</td></tr>
            </tbody>
          </table>
        </div>
        <div id="audit-pagination-container"></div>
      </div>
    </div>
  `;

  loadAuditList();

  document.getElementById('btn-apply-audit-filter').addEventListener('click', () => {
    auditFilters.action = document.getElementById('audit-filter-action').value;
    auditFilters.offset = 0;
    loadAuditList();
  });
}

async function loadAuditList() {
  const tbody = document.getElementById('audit-table-tbody');
  if (!tbody) return;

  try {
    const res = await api.get('/audit', auditFilters);
    const logs = res.data || [];

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:2.5rem;">Nenhum registro de auditoria encontrado para o filtro.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td>${formatDate(l.created_at)}</td>
        <td class="font-semibold"><code>${l.username || 'sistema'}</code></td>
        <td><span class="badge badge-normal" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1;">${l.action}</span></td>
        <td>${l.entity_type}</td>
        <td>${l.entity_id || '-'}</td>
        <td class="text-muted font-mono" style="font-size:0.75rem;">${l.ip_address || '-'}</td>
        <td class="text-right">
          <button class="btn btn-sm btn-outline btn-view-audit-json" data-json='${l.details || "{}"}'>
            Ver JSON
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-view-audit-json').forEach(btn => {
      btn.addEventListener('click', () => {
        let formatted = btn.dataset.json;
        try {
          formatted = JSON.stringify(JSON.parse(btn.dataset.json), null, 2);
        } catch (e) {}

        showModal(`
          <div class="modal-header">
            <h3 class="modal-title">Detalhes do Evento de Auditoria</h3>
            <button class="modal-close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <pre style="background:#0f172a; color:#f8fafc; padding:1.25rem; border-radius:var(--radius-sm); font-family:monospace; font-size:0.85rem; overflow-x:auto;">${formatted}</pre>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline modal-close-btn">Fechar</button>
          </div>
        `);
      });
    });

    const pagContainer = document.getElementById('audit-pagination-container');
    if (pagContainer) {
      const pag = renderPagination({
        total: res.total,
        limit: auditFilters.limit,
        offset: auditFilters.offset,
        onPageChange: (newOffset) => {
          auditFilters.offset = newOffset;
          loadAuditList();
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
    console.error('Erro ao listar auditoria:', err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Falha ao carregar auditoria: ${err.message}</td></tr>`;
  }
}
