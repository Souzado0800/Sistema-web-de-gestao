/**
 * Testes de Integração E2E da API Serverless (Netlify Function Handler).
 */
const assert = require('assert');
const apiFunction = require('../netlify/functions/api');

async function callApi(method, path, body = null, headers = {}, query = {}) {
  const event = {
    httpMethod: method,
    path: `/api${path}`,
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    queryStringParameters: query,
    body: body ? JSON.stringify(body) : null
  };

  const response = await apiFunction.handler(event, {});
  let data;
  try {
    data = JSON.parse(response.body);
  } catch (e) {
    data = response.body;
  }

  return {
    status: response.statusCode,
    headers: response.headers,
    data
  };
}

async function runApiIntegrationTests() {
  console.log('================================================================');
  console.log('   INICIANDO TESTES DE INTEGRAÇÃO DA NETLIFY FUNCTION API');
  console.log('================================================================\n');

  // 1. Login com Admin
  const loginRes = await callApi('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  assert.strictEqual(loginRes.status, 200, 'Login deve retornar 200 OK');
  assert.ok(loginRes.data.token, 'Deve retornar token JWT');
  const token = loginRes.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log(' ✔ [API] POST /api/auth/login autenticado com sucesso (Token JWT gerado)');

  // 2. Dashboard Metrics
  const metricsRes = await callApi('GET', '/dashboard/metrics', null, authHeaders);
  assert.strictEqual(metricsRes.status, 200);
  assert.ok(metricsRes.data.metrics.total_active_products > 0);
  console.log(' ✔ [API] GET /api/dashboard/metrics retornou KPIs e métricas consolidadas');

  // 3. Dashboard Charts
  const chartsRes = await callApi('GET', '/dashboard/charts', null, authHeaders, { days: 30 });
  assert.strictEqual(chartsRes.status, 200);
  assert.ok(Array.isArray(chartsRes.data.top_consumed));
  console.log(' ✔ [API] GET /api/dashboard/charts retornou dados de linha temporal e ranking');

  // 4. Listagem de Produtos
  let prodsRes = await callApi('GET', '/products', null, authHeaders);
  assert.strictEqual(prodsRes.status, 200);

  // Garante a existência dos produtos dos casos de teste
  let caneta = prodsRes.data.data.find(p => p.sku === 'CAN-BIC-AZ');
  if (!caneta) {
    const created = await callApi('POST', '/products', {
      sku: 'CAN-BIC-AZ',
      name: 'Caneta Esferográfica Azul 1.0mm',
      unit_measure: 'Unidade',
      current_stock: 150,
      min_stock: 30,
      ideal_stock: 100,
      reference_price: 2.20
    }, authHeaders);
    caneta = created.data.product;
  }
  let papel = prodsRes.data.data.find(p => p.sku === 'PAP-A4-75G');
  if (!papel) {
    await callApi('POST', '/products', {
      sku: 'PAP-A4-75G',
      name: 'Papel Sulfite A4 75g',
      unit_measure: 'Resma',
      current_stock: 10,
      min_stock: 3,
      ideal_stock: 20,
      reference_price: 28.50
    }, authHeaders);
  }
  prodsRes = await callApi('GET', '/products', null, authHeaders);
  console.log(` ✔ [API] GET /api/products retornou ${prodsRes.data.data.length} produtos`);

  // 5. Validação do Caso 4 do Prompt:
  // Saída de 20 canetas da Caneta Azul (Estoque inicial: 150 -> Novo saldo: 130)
  assert.ok(caneta, 'Caneta Azul deve existir no catálogo');
  const initialStock = parseFloat(caneta.current_stock);

  let deptRes = await callApi('GET', '/departments', null, authHeaders);
  let deptId = null;
  if (deptRes.data.departments && deptRes.data.departments.length > 0) {
    deptId = deptRes.data.departments[0].id;
  } else {
    const createdDept = await callApi('POST', '/departments', {
      name: 'Administrativo',
      description: 'Setor Administrativo',
      cost_center: 'ADM-01'
    }, authHeaders);
    deptId = createdDept.data.department.id;
  }

  const exitRes = await callApi('POST', '/movements/exit', {
    product_id: caneta.id,
    quantity: 20,
    department_id: deptId,
    responsible_person: 'João Funcionário',
    reason: 'Uso interno',
    notes: 'Impressão e despacho de documentos'
  }, authHeaders);

  assert.strictEqual(exitRes.status, 200, 'Saída de estoque deve retornar 200 OK');
  assert.strictEqual(exitRes.data.product.current_stock, initialStock - 20, 'Saldo deve reduzir em 20 unidades');
  console.log(` ✔ [API] Caso 4 do Prompt validado com sucesso: Retirada de 20 canetas registrada! Saldo de ${initialStock} -> ${exitRes.data.product.current_stock}`);

  // 6. Relatório CSV
  const csvRes = await callApi('GET', '/reports/stock', null, authHeaders, { format: 'csv' });
  assert.strictEqual(csvRes.status, 200);
  assert.ok(csvRes.headers['Content-Type'].includes('text/csv'));
  assert.ok(csvRes.data.includes('PAP-A4-75G'));
  console.log(' ✔ [API] GET /api/reports/stock?format=csv gerou arquivo CSV exportável');

  // 7. Fornecedores, Categorias e Departamentos (utilizados no modal de edição)
  const suppRes = await callApi('GET', '/suppliers', null, authHeaders, { active: 'true' });
  assert.strictEqual(suppRes.status, 200, 'GET /suppliers deve retornar 200 OK');
  assert.ok(Array.isArray(suppRes.data.suppliers), 'Deve retornar array de fornecedores');
  console.log(` ✔ [API] GET /api/suppliers retornou ${suppRes.data.suppliers.length} fornecedores ativos`);

  const catRes = await callApi('GET', '/categories', null, authHeaders);
  assert.strictEqual(catRes.status, 200, 'GET /categories deve retornar 200 OK');
  assert.ok(Array.isArray(catRes.data.categories), 'Deve retornar array de categorias');
  console.log(` ✔ [API] GET /api/categories retornou ${catRes.data.categories.length} categorias`);

  const deptListRes = await callApi('GET', '/departments', null, authHeaders);
  assert.strictEqual(deptListRes.status, 200, 'GET /departments deve retornar 200 OK');
  assert.ok(Array.isArray(deptListRes.data.departments), 'Deve retornar array de departamentos');
  console.log(` ✔ [API] GET /api/departments retornou ${deptListRes.data.departments.length} departamentos`);

  // 8. Auditoria
  const auditRes = await callApi('GET', '/audit', null, authHeaders);
  assert.strictEqual(auditRes.status, 200);
  assert.ok(auditRes.data.data.length > 0);
  console.log(` ✔ [API] GET /api/audit retornou ${auditRes.data.data.length} registros imutáveis`);

  console.log('\n================================================================');
  console.log('   ✔ TESTES DE INTEGRAÇÃO DA API CONCLUÍDOS COM 100% DE SUCESSO!');
  console.log('================================================================\n');
}

if (require.main === module) {
  runApiIntegrationTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = runApiIntegrationTests;
