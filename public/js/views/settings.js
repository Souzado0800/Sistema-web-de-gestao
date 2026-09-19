/**
 * View: Configurações Gerais do Sistema e Backup de Dados.
 */
import { api } from '../api.js';
import { state } from '../state.js';
import { showToast } from '../components.js';

export async function renderSettings(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Configurações do Sistema</h1>
        <p class="page-subtitle">Ajuste os parâmetros operacionais da empresa, regras de validação de estoque e rotinas de backup</p>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1.75rem; align-items:start;">
      <!-- FORMULÁRIO DE CONFIGURAÇÕES -->
      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title">Parâmetros Operacionais da Empresa</h2>
        </div>
        <form id="form-settings-save">
          <div class="card-body">
            <div class="form-group">
              <label for="set-company">Nome Oficial da Empresa / Sistema</label>
              <input type="text" id="set-company" class="form-input" placeholder="Ex: Indústria XYZ Ltda" required>
              <span class="text-muted" style="font-size:0.75rem;">Exibido no cabeçalho, barra lateral e relatórios emitidos.</span>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
              <div class="form-group">
                <label for="set-currency">Símbolo Monetário</label>
                <input type="text" id="set-currency" class="form-input" value="R$" required>
              </div>
              <div class="form-group">
                <label for="set-date-format">Formato de Data</label>
                <select id="set-date-format" class="form-select">
                  <option value="DD/MM/YYYY">DD/MM/YYYY (Brasil / Padrão)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                </select>
              </div>
            </div>

            <hr style="border:none; border-top:1px solid var(--border-color); margin:1.25rem 0;">

            <h3 style="font-size:0.95rem; font-weight:600; margin-bottom:0.75rem;">Regras de Validação de Estoque</h3>

            <div class="form-group">
              <label style="display:flex; align-items:flex-start; gap:0.6rem; cursor:pointer;">
                <input type="checkbox" id="set-allow-negative" style="margin-top:0.25rem;">
                <div>
                  <strong style="font-size:0.875rem; display:block;">Permitir Estoque Negativo em Saídas</strong>
                  <span class="text-muted" style="font-size:0.775rem;">
                    Por padrão <strong>desativado</strong> para garantir integridade física. Quando desativado, o sistema bloqueia qualquer saída que exceda o saldo atual.
                  </span>
                </div>
              </label>
            </div>

            <div class="form-group">
              <label style="display:flex; align-items:flex-start; gap:0.6rem; cursor:pointer;">
                <input type="checkbox" id="set-low-notif" checked style="margin-top:0.25rem;">
                <div>
                  <strong style="font-size:0.875rem; display:block;">Notificações Visuais de Estoque Baixo</strong>
                  <span class="text-muted" style="font-size:0.775rem;">
                    Exibe alerta no sino superior e no painel do Dashboard quando qualquer produto atingir <code>estoque atual &le; estoque mínimo</code>.
                  </span>
                </div>
              </label>
            </div>
          </div>
          <div class="card-header" style="background:#f8fafc; border-top:1px solid var(--border-color); justify-content:flex-end;">
            <button type="submit" class="btn btn-primary">Salvar Configurações</button>
          </div>
        </form>
      </div>

      <!-- PAINEL DE BACKUP E SEGURANÇA -->
      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title">Backup & Segurança</h2>
        </div>
        <div class="card-body">
          <p style="font-size:0.825rem; color:#475569; margin-bottom:1rem;">
            Exporte um snapshot completo com todos os produtos, categorias, fornecedores, departamentos e histórico de movimentações em formato JSON estruturado.
          </p>

          <button id="btn-download-backup" class="btn btn-outline btn-block">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Baixar Backup Completo (JSON)</span>
          </button>

          <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--border-color); font-size:0.775rem; color:var(--text-muted);">
            <strong style="color:var(--text-main); display:block; margin-bottom:0.25rem;">Ambiente Serverless & PostgreSQL:</strong>
            No PostgreSQL gerenciado (Neon / Supabase), backups diários e point-in-time recovery (PITR) são executados automaticamente pelo provedor de banco de dados.
          </div>
        </div>
      </div>
    </div>
  `;

  loadSettingsForm();

  document.getElementById('form-settings-save').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      company_name: document.getElementById('set-company').value,
      currency_symbol: document.getElementById('set-currency').value,
      date_format: document.getElementById('set-date-format').value,
      allow_negative_stock: document.getElementById('set-allow-negative').checked ? 'true' : 'false',
      low_stock_notification: document.getElementById('set-low-notif').checked ? 'true' : 'false'
    };

    try {
      await api.put('/settings', payload);
      showToast('Configurações salvas com sucesso!');
      state.setSettings(payload);
      const companyEl = document.getElementById('sidebar-company-name');
      if (companyEl) companyEl.textContent = payload.company_name;
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-download-backup').addEventListener('click', async () => {
    try {
      const data = await api.get('/backup/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `backup-estoque-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      showToast('Backup exportado com sucesso!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadSettingsForm() {
  try {
    const data = await api.get('/settings');
    const s = data.settings || {};

    const companyInput = document.getElementById('set-company');
    const currencyInput = document.getElementById('set-currency');
    const dateFormatSelect = document.getElementById('set-date-format');
    const allowNegChk = document.getElementById('set-allow-negative');
    const notifChk = document.getElementById('set-low-notif');

    if (companyInput) companyInput.value = s.company_name || 'Empresa Exemplo S.A.';
    if (currencyInput) currencyInput.value = s.currency_symbol || 'R$';
    if (dateFormatSelect && s.date_format) dateFormatSelect.value = s.date_format;
    if (allowNegChk) allowNegChk.checked = s.allow_negative_stock === 'true';
    if (notifChk) notifChk.checked = s.low_stock_notification !== 'false';
  } catch (err) {
    console.error('Erro ao carregar configurações:', err);
  }
}
