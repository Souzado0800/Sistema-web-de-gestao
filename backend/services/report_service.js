/**
 * Serviço de Relatórios Analíticos e Exportação de Dados (CSV).
 */
const db = require('../db');

/**
 * Converte um array de objetos para formato CSV com cabeçalhos e escape de caracteres.
 */
function toCsv(rows, columns) {
  if (!rows || rows.length === 0) return '';
  const header = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(';');
  const lines = rows.map(row => {
    return columns.map(c => {
      let val = row[c.key];
      if (val === null || val === undefined) val = '';
      if (typeof val === 'number') val = val.toString().replace('.', ',');
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(';');
  });
  return [header, ...lines].join('\r\n');
}

/**
 * Relatório 1: Posição Geral do Estoque Atual.
 */
async function getCurrentStockReport({ category_id = null, supplier_id = null, status = 'active' } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (status) {
    conditions.push(`p.status = $${idx++}`);
    params.push(status);
  }
  if (category_id) {
    conditions.push(`p.category_id = $${idx++}`);
    params.push(parseInt(category_id, 10));
  }
  if (supplier_id) {
    conditions.push(`p.primary_supplier_id = $${idx++}`);
    params.push(parseInt(supplier_id, 10));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      p.sku,
      p.name,
      c.name as category,
      p.unit_measure,
      p.current_stock,
      p.min_stock,
      p.ideal_stock,
      p.location,
      s.name as supplier,
      p.reference_price,
      (p.current_stock * p.reference_price) as total_value,
      CASE 
        WHEN p.current_stock <= 0 THEN 'Sem Estoque'
        WHEN p.current_stock <= p.min_stock THEN 'Abaixo do Mínimo'
        ELSE 'Normal'
      END as situation
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.primary_supplier_id = s.id
    ${where}
    ORDER BY c.name ASC, p.name ASC
  `;
  const res = await db.query(sql, params);
  return res.rows;
}

/**
 * Relatório 2: Produtos com Estoque Baixo ou Zerado (Necessidade de Compras).
 */
async function getLowStockReport() {
  const sql = `
    SELECT 
      p.sku,
      p.name,
      c.name as category,
      p.unit_measure,
      p.current_stock,
      p.min_stock,
      p.ideal_stock,
      GREATEST(p.ideal_stock - p.current_stock, 1) as suggested_purchase,
      s.name as supplier,
      s.phone as supplier_phone,
      p.reference_price,
      ((GREATEST(p.ideal_stock - p.current_stock, 1)) * p.reference_price) as estimated_cost
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.primary_supplier_id = s.id
    WHERE p.status = 'active' AND p.current_stock <= p.min_stock
    ORDER BY p.current_stock ASC, (p.min_stock - p.current_stock) DESC
  `;
  const res = await db.query(sql);
  return res.rows;
}

/**
 * Relatório 3: Consumo e Saídas por Departamento / Centro de Custo.
 */
async function getDepartmentConsumptionReport({ start_date = null, end_date = null } = {}) {
  const conditions = [`m.movement_type = 'SAIDA'`];
  const params = [];
  let idx = 1;

  if (start_date) {
    conditions.push(`m.created_at >= $${idx++}`);
    params.push(new Date(start_date));
  }
  if (end_date) {
    conditions.push(`m.created_at <= $${idx++}`);
    params.push(new Date(end_date));
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const sql = `
    SELECT 
      COALESCE(d.name, 'Não especificado') as department_name,
      d.cost_center,
      COUNT(m.id) as total_withdrawals,
      SUM(m.quantity) as total_items_withdrawn,
      SUM(m.total_price) as total_cost_withdrawn
    FROM stock_movements m
    LEFT JOIN departments d ON m.department_id = d.id
    ${where}
    GROUP BY d.name, d.cost_center
    ORDER BY total_cost_withdrawn DESC
  `;
  const res = await db.query(sql, params);
  return res.rows;
}

module.exports = {
  toCsv,
  getCurrentStockReport,
  getLowStockReport,
  getDepartmentConsumptionReport
};
