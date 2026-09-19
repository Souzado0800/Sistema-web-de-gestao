/**
 * View: Dashboard Principal e Alertas de Estoque.
 */
import { api } from '../api.js';
import { formatCurrency, formatDate, renderStockBadge } from '../components.js';
import { renderTimelineChart, renderRankingChart } from '../charts.js';

export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard de Estoque</h1>
        <p class="page-subtitle">Visão executiva em tempo real dos materiais, alertas e movimentações</p>
      </div>
    </div>

    <!-- CARDS DE KPIS -->
    <div class="kpi-grid" id="dashboard-kpis">
      <div class="kpi-card"><div class="kpi-content"><span class="kpi-label">Carregando indicadores...</span></div></div>
    </div>

    <!-- SEÇÃO: ALERTAS DE ESTOQUE -->
    <div class="content-card">
      <div class="card-header">
        <h2 class="card-title">Situação dos Níveis de Estoque</h2>
        <span class="text-muted" style="font-size: 0.8rem;">Atualização automática</span>
      </div>
      <div class="card-body">
        <div class="alert-banner-grid" id="stock-alerts-banners">
          <!-- Banners preenchidos via JS -->
        </div>
      </div>
    </div>

    <!-- GRÁFICOS DE MOVIMENTAÇÃO E RANKING -->
    <div class="charts-grid">
      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title">Movimentações: Entradas vs Saídas (Últimos 30 Dias)</h2>
        </div>
        <div class="card-body">
          <div id="chart-timeline" class="svg-chart-container"></div>
        </div>
      </div>

      <div class="content-card">
        <div class="card-header">
          <h2 class="card-title">Produtos Mais Consumidos (Ranking de Saídas)</h2>
        </div>
        <div class="card-body">
          <div id="chart-ranking" class="svg-chart-container"></div>
        </div>
      </div>
    </div>

    <!-- TABELA: ÚLTIMAS MOVIMENTAÇÕES -->
    <div class="content-card">
      <div class="card-header">
        <h2 class="card-title">Movimentações Recentes</h2>
        <a href="/movements" class="btn btn-sm btn-outline">Ver Todo o Histórico</a>
      </div>
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
                <th>Saldo Resultante</th>
                <th>Motivo / Destino</th>
                <th>Responsável / Usuário</th>
              </tr>
            </thead>
            <tbody id="recent-movements-tbody">
              <tr><td colspan="8" class="text-center text-muted">Carregando histórico recente...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  try {
    const [metricsData, chartsData] = await Promise.all([
      api.get('/dashboard/metrics'),
      api.get('/dashboard/charts', { days: 30 })
    ]);

    const m = metricsData.metrics || {};

    // 1. Renderiza KPIs
    const kpisEl = document.getElementById('dashboard-kpis');
    if (kpisEl) {
      kpisEl.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-value">${m.total_active_products || 0}</span>
            <span class="kpi-label">Produtos Cadastrados</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-value">${formatCurrency(m.total_stock_value || 0)}</span>
            <span class="kpi-label">Valor Total em Estoque</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon yellow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-value">${m.low_stock_count || 0}</span>
            <span class="kpi-label">Estoque Baixo / Mínimo</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon red">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-value">${m.zero_stock_count || 0}</span>
            <span class="kpi-label">Produtos Zerados</span>
          </div>
        </div>
      `;
    }

    // 2. Renderiza Banners de Alerta
    const alertsEl = document.getElementById('stock-alerts-banners');
    if (alertsEl) {
      alertsEl.innerHTML = `
        <div class="alert-banner-card normal">
          <div>
            <div class="alert-banner-title">Estoque Normal</div>
            <span style="font-size: 0.75rem;">Acima do estoque mínimo</span>
          </div>
          <div class="alert-banner-count">${m.normal_stock_count || 0}</div>
        </div>

        <div class="alert-banner-card low">
          <div>
            <div class="alert-banner-title">Estoque Baixo</div>
            <span style="font-size: 0.75rem;">No limite ou próximo ao mínimo</span>
          </div>
          <div class="alert-banner-count">${m.low_stock_count || 0}</div>
        </div>

        <div class="alert-banner-card critical">
          <div>
            <div class="alert-banner-title">Estoque Crítico</div>
            <span style="font-size: 0.75rem;">Abaixo de 50% do mínimo</span>
          </div>
          <div class="alert-banner-count">${m.critical_stock_count || 0}</div>
        </div>

        <div class="alert-banner-card zero">
          <div>
            <div class="alert-banner-title">Sem Estoque</div>
            <span style="font-size: 0.75rem;">Saldo zerado</span>
          </div>
          <div class="alert-banner-count">${m.zero_stock_count || 0}</div>
        </div>
      `;
    }

    // 3. Renderiza Gráficos
    renderTimelineChart('chart-timeline', chartsData.period_summary || []);
    renderRankingChart('chart-ranking', chartsData.top_consumed || []);

    // 4. Renderiza Movimentações Recentes
    const tbody = document.getElementById('recent-movements-tbody');
    if (tbody) {
      const movements = metricsData.recent_movements || [];
      if (movements.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">Nenhuma movimentação registrada no sistema ainda.</td></tr>`;
      } else {
        tbody.innerHTML = movements.map(m => {
          let typeBadge = `<span class="badge badge-normal">${m.movement_type}</span>`;
          if (m.movement_type === 'SAIDA') typeBadge = `<span class="badge badge-low" style="background:#fee2e2; color:#b91c1c;">SAÍDA</span>`;
          if (m.movement_type === 'AJUSTE') typeBadge = `<span class="badge badge-low">${m.movement_type}</span>`;
          if (m.movement_type === 'INVENTARIO') typeBadge = `<span class="badge" style="background:#e0e7ff; color:#4338ca;">INVENTÁRIO</span>`;

          return `
            <tr>
              <td>${formatDate(m.created_at)}</td>
              <td><code>${m.product_sku}</code></td>
              <td class="font-semibold">${m.product_name}</td>
              <td>${typeBadge}</td>
              <td class="font-semibold">${m.movement_type === 'SAIDA' ? '-' : '+'}${m.quantity} ${m.unit_measure || ''}</td>
              <td><strong>${m.resulting_stock}</strong></td>
              <td>${m.reason} ${m.department_name ? `<br><small class="text-muted">Setor: ${m.department_name}</small>` : ''}</td>
              <td>${m.responsible_person || m.user_name || '-'}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Erro ao carregar dados do dashboard:', err);
  }
}
