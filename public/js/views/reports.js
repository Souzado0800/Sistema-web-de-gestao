/**
 * View: Relatórios Gerenciais e Exportação de Dados (CSV e Impressão / PDF).
 */
import { api } from '../api.js';
import { formatCurrency, formatDate } from '../components.js';

export async function renderReports(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Relatórios Gerenciais</h1>
        <p class="page-subtitle">Emissão de relatórios analíticos de posição de estoque, consumo departamental e auditoria</p>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button id="btn-export-csv" class="btn btn-outline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span>Exportar CSV</span>
        </button>
        <button id="btn-print-report" class="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          <span>Imprimir / Gerar PDF</span>
        </button>
      </div>
    </div>

    <!-- SELETOR DE RELATÓRIO E FILTROS -->
    <div class="content-card">
      <div class="card-body" style="padding: 1.25rem;">
        <div class="filter-bar">
          <div class="form-group" style="margin-bottom:0; min-width:260px;">
            <label for="report-select-type" style="font-size:0.75rem; margin-bottom:0.25rem;">Tipo de Relatório</label>
            <select id="report-select-type" class="form-select font-semibold">
              <option value="stock">1. Posição Geral de Estoque Atual</option>
              <option value="low-stock">2. Produtos com Estoque Baixo / Reposição</option>
              <option value="consumption">3. Consumo por Departamento / Centro de Custo</option>
              <option value="movements">4. Movimentações por Período</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:0; max-width:160px;">
            <label for="report-filter-start" style="font-size:0.75rem; margin-bottom:0.25rem;">Data Inicial</label>
            <input type="date" id="report-filter-start" class="form-input">
          </div>

          <div class="form-group" style="margin-bottom:0; max-width:160px;">
            <label for="report-filter-end" style="font-size:0.75rem; margin-bottom:0.25rem;">Data Final</label>
            <input type="date" id="report-filter-end" class="form-input">
          </div>

          <button id="btn-generate-report" class="btn btn-outline" style="margin-top:auto;">Gerar Relatório</button>
        </div>
      </div>
    </div>

    <!-- RESULTADO DO RELATÓRIO -->
    <div class="content-card" id="printable-report-area">
      <div class="card-header">
        <div>
          <h2 class="card-title" id="report-title-display">Posição Geral de Estoque Atual</h2>
          <span class="text-muted" style="font-size:0.8rem;" id="report-meta-display">Gerado em: ${new Date().toLocaleDateString('pt-BR')}</span>
        </div>
        <div id="report-summary-badge" class="font-semibold" style="font-size:0.95rem; color:var(--primary);"></div>
      </div>
      <div class="card-body" style="padding: 0;">
        <div class="table-responsive">
          <table class="data-table" id="report-table">
            <thead id="report-thead"></thead>
            <tbody id="report-tbody">
              <tr><td class="text-center text-muted" style="padding:2rem;">Clique em "Gerar Relatório" para visualizar os dados.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Gera relatório padrão (Estoque atual)
  generateReport();

  document.getElementById('btn-generate-report').addEventListener('click', generateReport);
  document.getElementById('report-select-type').addEventListener('change', generateReport);

  // Impressão limpa via navegador
  document.getElementById('btn-print-report').addEventListener('click', () => {
    window.print();
  });

  // Exportação CSV
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    const reportType = document.getElementById('report-select-type').value;
    const startDate = document.getElementById('report-filter-start').value;
    const endDate = document.getElementById('report-filter-end').value;

    const endpoint = `/reports/${reportType}`;
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    api.downloadCsv(endpoint, params, `relatorio-${reportType}-${Date.now()}.csv`);
  });
}

async function generateReport() {
  const reportType = document.getElementById('report-select-type').value;
  const startDate = document.getElementById('report-filter-start').value;
  const endDate = document.getElementById('report-filter-end').value;

  const thead = document.getElementById('report-thead');
  const tbody = document.getElementById('report-tbody');
  const titleEl = document.getElementById('report-title-display');
  const badgeEl = document.getElementById('report-summary-badge');

  tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding:2rem;">Carregando dados do relatório...</td></tr>`;

  try {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const res = await api.get(`/reports/${reportType}`, params);
    const data = res.data || [];

    if (reportType === 'stock') {
      titleEl.textContent = 'Relatório 1: Posição Geral do Estoque Atual';
      thead.innerHTML = `
        <tr>
          <th>SKU</th>
          <th>Produto</th>
          <th>Categoria</th>
          <th>Unidade</th>
          <th>Estoque Atual</th>
          <th>Mínimo</th>
          <th>Ideal</th>
          <th>Localização</th>
          <th>Preço Ref.</th>
          <th>Valor Total (R$)</th>
          <th>Situação</th>
        </tr>
      `;

      let totalVal = 0;
      tbody.innerHTML = data.map(r => {
        totalVal += parseFloat(r.total_value) || 0;
        return `
          <tr>
            <td><code>${r.sku}</code></td>
            <td class="font-semibold">${r.name}</td>
            <td>${r.category || '-'}</td>
            <td>${r.unit_measure}</td>
            <td class="font-semibold">${r.current_stock}</td>
            <td class="text-muted">${r.min_stock}</td>
            <td class="text-muted">${r.ideal_stock}</td>
            <td>${r.location || '-'}</td>
            <td>${formatCurrency(r.reference_price)}</td>
            <td class="font-semibold">${formatCurrency(r.total_value)}</td>
            <td><span class="badge ${r.situation === 'Normal' ? 'badge-normal' : 'badge-low'}">${r.situation}</span></td>
          </tr>
        `;
      }).join('');

      badgeEl.textContent = `Patrimônio em Estoque: ${formatCurrency(totalVal)}`;

    } else if (reportType === 'low-stock') {
      titleEl.textContent = 'Relatório 2: Produtos em Alerta (Necessidade de Compras)';
      thead.innerHTML = `
        <tr>
          <th>SKU</th>
          <th>Produto</th>
          <th>Categoria</th>
          <th>Unidade</th>
          <th>Estoque Atual</th>
          <th>Mínimo</th>
          <th>Ideal</th>
          <th>Sugestão Compra</th>
          <th>Fornecedor</th>
          <th>Custo Estimado</th>
        </tr>
      `;

      let totalEst = 0;
      tbody.innerHTML = data.map(r => {
        totalEst += parseFloat(r.estimated_cost) || 0;
        return `
          <tr>
            <td><code>${r.sku}</code></td>
            <td class="font-semibold">${r.name}</td>
            <td>${r.category || '-'}</td>
            <td>${r.unit_measure}</td>
            <td class="font-semibold text-danger">${r.current_stock}</td>
            <td class="text-muted">${r.min_stock}</td>
            <td class="text-muted">${r.ideal_stock}</td>
            <td class="font-semibold" style="color:var(--primary);">+${r.suggested_purchase}</td>
            <td>${r.supplier || '-'}</td>
            <td class="font-semibold">${formatCurrency(r.estimated_cost)}</td>
          </tr>
        `;
      }).join('');

      badgeEl.textContent = `Investimento de Reposição: ${formatCurrency(totalEst)}`;

    } else if (reportType === 'consumption') {
      titleEl.textContent = 'Relatório 3: Consumo por Departamento / Centro de Custo';
      thead.innerHTML = `
        <tr>
          <th>Departamento / Setor</th>
          <th>Centro de Custo</th>
          <th>Total de Retiradas</th>
          <th>Itens Retirados</th>
          <th>Custo Total de Consumo</th>
        </tr>
      `;

      let totalCost = 0;
      tbody.innerHTML = data.map(r => {
        totalCost += parseFloat(r.total_cost_withdrawn) || 0;
        return `
          <tr>
            <td class="font-semibold">${r.department_name}</td>
            <td><code>${r.cost_center || 'Geral'}</code></td>
            <td>${r.total_withdrawals} vezes</td>
            <td class="font-semibold">${r.total_items_withdrawn || 0} un</td>
            <td class="font-semibold" style="color:var(--primary);">${formatCurrency(r.total_cost_withdrawn)}</td>
          </tr>
        `;
      }).join('');

      badgeEl.textContent = `Consumo Departamental Total: ${formatCurrency(totalCost)}`;

    } else if (reportType === 'movements') {
      titleEl.textContent = 'Relatório 4: Histórico Geral de Movimentações';
      thead.innerHTML = `
        <tr>
          <th>Data/Hora</th>
          <th>SKU</th>
          <th>Produto</th>
          <th>Tipo</th>
          <th>Quantidade</th>
          <th>Saldo Anterior</th>
          <th>Saldo Resultante</th>
          <th>Motivo</th>
          <th>Setor</th>
          <th>Responsável</th>
        </tr>
      `;

      tbody.innerHTML = data.map(r => `
        <tr>
          <td>${formatDate(r.created_at)}</td>
          <td><code>${r.product_sku}</code></td>
          <td class="font-semibold">${r.product_name}</td>
          <td><span class="badge ${r.movement_type === 'SAIDA' ? 'badge-low' : 'badge-normal'}">${r.movement_type}</span></td>
          <td class="font-semibold">${r.movement_type === 'SAIDA' ? '-' : '+'}${r.quantity}</td>
          <td>${r.previous_stock}</td>
          <td><strong>${r.resulting_stock}</strong></td>
          <td>${r.reason}</td>
          <td>${r.department_name || '-'}</td>
          <td>${r.responsible_person || r.user_name || '-'}</td>
        </tr>
      `).join('');

      badgeEl.textContent = `${data.length} movimentações no período`;
    }

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding:2.5rem;">Nenhum registro encontrado para este relatório com os filtros informados.</td></tr>`;
    }
  } catch (err) {
    console.error('Erro ao gerar relatório:', err);
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Falha ao emitir relatório: ${err.message}</td></tr>`;
  }
}
