/**
 * Gráficos SVG Nativos Leves e Responsivos (Zero Dependência Externa).
 */

export function renderTimelineChart(containerId, data = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 0.85rem;">
        Nenhuma movimentação registrada no período selecionado.
      </div>
    `;
    return;
  }

  const width = 600;
  const height = 240;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calcula valores máximos
  let maxVal = 10;
  data.forEach(d => {
    maxVal = Math.max(maxVal, parseFloat(d.total_in) || 0, parseFloat(d.total_out) || 0);
  });
  maxVal = Math.ceil(maxVal * 1.15); // margem no topo

  const barGroupWidth = chartWidth / data.length;
  const barWidth = Math.max(Math.min(barGroupWidth * 0.35, 20), 4);

  let barsSvg = '';
  let xLabels = '';

  data.forEach((d, i) => {
    const xCenter = padding.left + (i * barGroupWidth) + (barGroupWidth / 2);

    const inVal = parseFloat(d.total_in) || 0;
    const outVal = parseFloat(d.total_out) || 0;

    const inHeight = (inVal / maxVal) * chartHeight;
    const outHeight = (outVal / maxVal) * chartHeight;

    const inY = padding.top + (chartHeight - inHeight);
    const outY = padding.top + (chartHeight - outHeight);

    // Barra de Entrada (Verde)
    barsSvg += `
      <rect x="${xCenter - barWidth - 1}" y="${inY}" width="${barWidth}" height="${inHeight}" fill="#10b981" rx="2">
        <title>Entrada: ${inVal} un em ${d.day}</title>
      </rect>
    `;

    // Barra de Saída (Vermelho)
    barsSvg += `
      <rect x="${xCenter + 1}" y="${outY}" width="${barWidth}" height="${outHeight}" fill="#ef4444" rx="2">
        <title>Saída: ${outVal} un em ${d.day}</title>
      </rect>
    `;

    // Rótulo da data (apenas a cada N itens se houver muitos)
    const step = Math.ceil(data.length / 8);
    if (i % step === 0 || i === data.length - 1) {
      const dateParts = d.day.split('-');
      const shortDate = `${dateParts[2]}/${dateParts[1]}`;
      xLabels += `
        <text x="${xCenter}" y="${height - 15}" font-size="10" fill="#64748b" text-anchor="middle">${shortDate}</text>
      `;
    }
  });

  // Linhas de grade e eixo Y
  let gridSvg = '';
  const yTicks = 4;
  for (let t = 0; t <= yTicks; t++) {
    const tickVal = Math.round((maxVal / yTicks) * t);
    const yPos = padding.top + chartHeight - ((chartHeight / yTicks) * t);

    gridSvg += `
      <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="#f1f5f9" stroke-width="1" />
      <text x="${padding.left - 8}" y="${yPos + 3}" font-size="10" fill="#94a3b8" text-anchor="end">${tickVal}</text>
    `;
  }

  container.innerHTML = `
    <div style="position: relative; width: 100%; height: 100%;">
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 100%; display: block;" preserveAspectRatio="xMidYMid meet">
        ${gridSvg}
        ${barsSvg}
        ${xLabels}
      </svg>
      <div style="display: flex; align-items: center; justify-content: center; gap: 1.5rem; font-size: 0.75rem; margin-top: 0.25rem;">
        <span style="display: flex; align-items: center; gap: 0.4rem; color: #475569;">
          <span style="width: 10px; height: 10px; background: #10b981; border-radius: 2px;"></span> Entradas
        </span>
        <span style="display: flex; align-items: center; gap: 0.4rem; color: #475569;">
          <span style="width: 10px; height: 10px; background: #ef4444; border-radius: 2px;"></span> Saídas
        </span>
      </div>
    </div>
  `;
}

export function renderRankingChart(containerId, data = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 0.85rem;">
        Nenhum consumo registrado no período.
      </div>
    `;
    return;
  }

  const maxVal = Math.max(...data.map(d => parseFloat(d.total_consumed) || 0), 1);

  let barsHtml = data.map((item, idx) => {
    const consumed = parseFloat(item.total_consumed) || 0;
    const percentage = Math.round((consumed / maxVal) * 100);

    return `
      <div style="margin-bottom: 0.85rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
          <span style="font-weight: 600; color: #1e293b;">${idx + 1}. ${item.name} (${item.unit_measure})</span>
          <span style="font-weight: 700; color: #2563eb;">${consumed} un</span>
        </div>
        <div style="width: 100%; height: 8px; background-color: #f1f5f9; border-radius: 4px; overflow: hidden;">
          <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb); border-radius: 4px;"></div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div style="padding: 0.5rem 0;">
      ${barsHtml}
    </div>
  `;
}
