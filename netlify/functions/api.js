/**
 * Netlify Function: API Serverless Principal.
 * Roteador unificado para todos os endpoints REST do Sistema de Gestão de Estoque.
 */
const { authenticate, generateToken, comparePassword, hashPassword } = require('../../backend/middleware/auth');
const { requireAdmin } = require('../../backend/middleware/rbac');
const userRepo = require('../../backend/repositories/user_repo');
const productRepo = require('../../backend/repositories/product_repo');
const movementRepo = require('../../backend/repositories/movement_repo');
const categoryRepo = require('../../backend/repositories/category_repo');
const departmentRepo = require('../../backend/repositories/department_repo');
const supplierRepo = require('../../backend/repositories/supplier_repo');
const auditRepo = require('../../backend/repositories/audit_repo');
const settingsRepo = require('../../backend/repositories/settings_repo');
const stockService = require('../../backend/services/stock_service');
const inventoryService = require('../../backend/services/inventory_service');
const purchaseService = require('../../backend/services/purchase_service');
const reportService = require('../../backend/services/report_service');
const db = require('../../backend/db');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

function jsonResponse(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, ...extraHeaders },
    body: JSON.stringify(data)
  };
}

function csvResponse(csvContent, filename) {
  return {
    statusCode: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    },
    body: csvContent
  };
}

exports.handler = async function (event, context) {
  // Tratamento de Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  // Normalização do caminho (remove prefixos /api/ ou /.netlify/functions/api/)
  let reqPath = event.path || '';
  reqPath = reqPath.replace(/^\/\.netlify\/functions\/api/, '');
  reqPath = reqPath.replace(/^\/api/, '');
  if (!reqPath.startsWith('/')) reqPath = '/' + reqPath;
  if (reqPath.length > 1 && reqPath.endsWith('/')) reqPath = reqPath.slice(0, -1);

  const method = event.httpMethod.toUpperCase();
  const query = event.queryStringParameters || {};
  let body = {};
  if (event.body) {
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      return jsonResponse(400, { error: 'Payload JSON malformado ou inválido.' });
    }
  }

  const rawIp = event.headers['client-ip'] || event.headers['x-forwarded-for'] || event.headers['x-client-ip'] || '127.0.0.1';
  const clientIp = (String(rawIp).split(',')[0] || '127.0.0.1').trim().slice(0, 100);

  try {
    // =========================================================================
    // 1. ROTAS PÚBLICAS DE AUTENTICAÇÃO
    // =========================================================================
    if (reqPath === '/auth/login' && method === 'POST') {
      const { username, password } = body;
      if (!username || !password) {
        return jsonResponse(400, { error: 'Informe o nome de usuário e a senha.' });
      }

      const user = await userRepo.findByUsername(username);
      if (!user || !user.active) {
        return jsonResponse(401, { error: 'Credenciais inválidas ou usuário inativo.' });
      }

      const passwordValid = await comparePassword(password, user.password_hash);
      if (!passwordValid) {
        return jsonResponse(401, { error: 'Credenciais inválidas ou usuário inativo.' });
      }

      const token = generateToken(user);

      await auditRepo.logAction({
        user_id: user.id,
        username: user.username,
        action: 'USUARIO_LOGIN',
        entity_type: 'USER',
        entity_id: user.id,
        details: { message: 'Login efetuado com sucesso' },
        ip_address: clientIp
      });

      return jsonResponse(200, {
        message: 'Login realizado com sucesso',
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          role: user.role
        }
      });
    }

    // A partir deste ponto, todas as rotas exigem autenticação
    const authUser = authenticate(event.headers);

    if (reqPath === '/auth/me' && method === 'GET') {
      const freshUser = await userRepo.findById(authUser.id);
      if (!freshUser || !freshUser.active) {
        return jsonResponse(401, { error: 'Usuário inativo ou inexistente.' });
      }
      return jsonResponse(200, { user: freshUser });
    }

    if (reqPath === '/auth/logout' && method === 'POST') {
      await auditRepo.logAction({
        user_id: authUser.id,
        username: authUser.username,
        action: 'USUARIO_LOGOUT',
        entity_type: 'USER',
        entity_id: authUser.id,
        details: { message: 'Logout realizado' },
        ip_address: clientIp
      });
      return jsonResponse(200, { message: 'Logout realizado com sucesso.' });
    }

    // =========================================================================
    // 2. DASHBOARD & KPIs
    // =========================================================================
    if (reqPath === '/dashboard/metrics' && method === 'GET') {
      const metrics = await productRepo.getStockMetrics();
      const replenishmentNeeds = await purchaseService.getReplenishmentList();
      const recentMovements = await movementRepo.findAll({ limit: 10, offset: 0 });

      return jsonResponse(200, {
        metrics,
        replenishment_alerts: replenishmentNeeds,
        recent_movements: recentMovements.data
      });
    }

    if (reqPath === '/dashboard/charts' && method === 'GET') {
      const days = parseInt(query.days || '30', 10);
      const periodData = await movementRepo.getSummaryByPeriod(days);
      const topConsumed = await movementRepo.getTopConsumedProducts(5, days);

      return jsonResponse(200, {
        period_summary: periodData,
        top_consumed: topConsumed
      });
    }

    // =========================================================================
    // 3. PRODUTOS & MATERIAIS
    // =========================================================================
    if (reqPath === '/products' && method === 'GET') {
      const result = await productRepo.findAll({
        search: query.search || '',
        category_id: query.category_id || null,
        status: query.status || 'active',
        stock_status: query.stock_status || '',
        limit: parseInt(query.limit || '50', 10),
        offset: parseInt(query.offset || '0', 10)
      });
      return jsonResponse(200, result);
    }

    if (reqPath === '/products' && method === 'POST') {
      requireAdmin(authUser);
      if (!body.name || !body.sku) {
        return jsonResponse(400, { error: 'Nome e código SKU são obrigatórios para cadastro do produto.' });
      }

      const existing = await productRepo.findBySku(body.sku);
      if (existing) {
        return jsonResponse(400, { error: `Já existe um produto cadastrado com o SKU "${body.sku}".` });
      }

      const product = await productRepo.create(body);

      // Se houver estoque inicial maior que zero, registra como movimentação inicial
      const initStock = parseFloat(body.current_stock);
      if (!isNaN(initStock) && initStock > 0) {
        await movementRepo.create({
          product_id: product.id,
          movement_type: 'ENTRADA',
          quantity: initStock,
          previous_stock: 0,
          resulting_stock: initStock,
          reason: 'Saldo Inicial de Cadastro',
          user_id: authUser.id,
          notes: 'Cadastro inicial do produto'
        });
      }

      await auditRepo.logAction({
        user_id: authUser.id,
        username: authUser.username,
        action: 'PRODUTO_CRIADO',
        entity_type: 'PRODUCT',
        entity_id: product.id,
        details: { name: product.name, sku: product.sku, initial_stock: initStock || 0 },
        ip_address: clientIp
      });

      return jsonResponse(201, { message: 'Produto cadastrado com sucesso!', product });
    }

    // Rota /products/:id
    const productMatch = reqPath.match(/^\/products\/(\d+)$/);
    if (productMatch) {
      const productId = parseInt(productMatch[1], 10);

      if (method === 'GET') {
        const product = await productRepo.findById(productId);
        if (!product) return jsonResponse(404, { error: 'Produto não encontrado.' });
        const movements = await movementRepo.findByProductId(productId, 20);
        return jsonResponse(200, { product, recent_movements: movements });
      }

      if (method === 'PUT') {
        requireAdmin(authUser);
        if (!body.name || !body.sku) {
          return jsonResponse(400, { error: 'Nome e SKU são campos obrigatórios.' });
        }
        const updated = await productRepo.update(productId, body);
        if (!updated) return jsonResponse(404, { error: 'Produto não encontrado.' });

        await auditRepo.logAction({
          user_id: authUser.id,
          username: authUser.username,
          action: 'PRODUTO_ALTERADO',
          entity_type: 'PRODUCT',
          entity_id: productId,
          details: { name: updated.name, sku: updated.sku },
          ip_address: clientIp
        });

        return jsonResponse(200, { message: 'Produto atualizado com sucesso.', product: updated });
      }
    }

    // Rota /products/:id/archive
    const archiveMatch = reqPath.match(/^\/products\/(\d+)\/archive$/);
    if (archiveMatch && method === 'POST') {
      requireAdmin(authUser);
      const productId = parseInt(archiveMatch[1], 10);
      const archived = await productRepo.archive(productId);
      if (!archived) return jsonResponse(404, { error: 'Produto não encontrado.' });

      await auditRepo.logAction({
        user_id: authUser.id,
        username: authUser.username,
        action: 'PRODUTO_ARQUIVADO',
        entity_type: 'PRODUCT',
        entity_id: productId,
        details: { name: archived.name, sku: archived.sku },
        ip_address: clientIp
      });

      return jsonResponse(200, { message: `Produto "${archived.name}" arquivado com sucesso. Seu histórico permanece preservado.` });
    }

    // =========================================================================
    // 4. MOVIMENTAÇÕES DE ESTOQUE (Entrada, Saída, Ajuste)
    // =========================================================================
    if (reqPath === '/movements' && method === 'GET') {
      const result = await movementRepo.findAll({
        product_id: query.product_id || null,
        category_id: query.category_id || null,
        movement_type: query.movement_type || null,
        department_id: query.department_id || null,
        user_id: query.user_id || null,
        start_date: query.start_date || null,
        end_date: query.end_date || null,
        search: query.search || '',
        limit: parseInt(query.limit || '50', 10),
        offset: parseInt(query.offset || '0', 10)
      });
      return jsonResponse(200, result);
    }

    if (reqPath === '/movements/entry' && method === 'POST') {
      const result = await stockService.registerEntry({
        product_id: body.product_id,
        quantity: body.quantity,
        supplier_id: body.supplier_id,
        invoice_number: body.invoice_number,
        unit_price: body.unit_price,
        reason: body.reason || 'Compra',
        notes: body.notes,
        user: authUser,
        ip_address: clientIp
      });
      return jsonResponse(200, result);
    }

    if (reqPath === '/movements/exit' && method === 'POST') {
      const result = await stockService.registerExit({
        product_id: body.product_id,
        quantity: body.quantity,
        department_id: body.department_id,
        responsible_person: body.responsible_person,
        reason: body.reason || 'Uso interno',
        notes: body.notes,
        user: authUser,
        ip_address: clientIp
      });
      return jsonResponse(200, result);
    }

    if (reqPath === '/movements/adjustment' && method === 'POST') {
      requireAdmin(authUser);
      const result = await stockService.registerAdjustment({
        product_id: body.product_id,
        new_quantity: body.new_quantity,
        reason: body.reason,
        notes: body.notes,
        user: authUser,
        ip_address: clientIp
      });
      return jsonResponse(200, result);
    }

    // =========================================================================
    // 5. INVENTÁRIO FÍSICO
    // =========================================================================
    if (reqPath === '/inventory/sessions' && method === 'GET') {
      const result = await inventoryRepo.findAllSessions({
        limit: parseInt(query.limit || '50', 10),
        offset: parseInt(query.offset || '0', 10)
      });
      return jsonResponse(200, result);
    }

    if (reqPath === '/inventory/sessions' && method === 'POST') {
      requireAdmin(authUser);
      const session = await inventoryService.startSession({
        title: body.title,
        category_id: body.category_id,
        notes: body.notes,
        user: authUser,
        ip_address: clientIp
      });
      return jsonResponse(201, { message: 'Sessão de inventário criada com sucesso!', session });
    }

    const invMatch = reqPath.match(/^\/inventory\/sessions\/(\d+)$/);
    if (invMatch && method === 'GET') {
      const session = await inventoryRepo.findSessionById(parseInt(invMatch[1], 10));
      if (!session) return jsonResponse(404, { error: 'Sessão de inventário não encontrada.' });
      return jsonResponse(200, { session });
    }

    const invReconcileMatch = reqPath.match(/^\/inventory\/sessions\/(\d+)\/reconcile$/);
    if (invReconcileMatch && method === 'POST') {
      requireAdmin(authUser);
      const session = await inventoryService.reconcileSession({
        session_id: parseInt(invReconcileMatch[1], 10),
        counts: body.counts || [],
        user: authUser,
        ip_address: clientIp
      });
      return jsonResponse(200, { message: 'Inventário reconciliado e finalizado com sucesso!', session });
    }

    // =========================================================================
    // 6. REPOSIÇÃO & ORDENS DE COMPRA
    // =========================================================================
    if (reqPath === '/purchases/replenishment' && method === 'GET') {
      const list = await purchaseService.getReplenishmentList();
      return jsonResponse(200, { items: list });
    }

    if (reqPath === '/purchases/orders' && method === 'GET') {
      const result = await purchaseRepo.findAllOrders({
        status: query.status || null,
        limit: parseInt(query.limit || '50', 10),
        offset: parseInt(query.offset || '0', 10)
      });
      return jsonResponse(200, result);
    }

    if (reqPath === '/purchases/orders' && method === 'POST') {
      requireAdmin(authUser);
      const order = await purchaseService.createOrder({
        supplier_id: body.supplier_id,
        notes: body.notes,
        items: body.items,
        user: authUser,
        ip_address: clientIp
      });
      return jsonResponse(201, { message: 'Ordem de compra criada com sucesso!', order });
    }

    const orderMatch = reqPath.match(/^\/purchases\/orders\/(\d+)$/);
    if (orderMatch && method === 'GET') {
      const order = await purchaseRepo.findOrderById(parseInt(orderMatch[1], 10));
      if (!order) return jsonResponse(404, { error: 'Ordem de compra não encontrada.' });
      return jsonResponse(200, { order });
    }

    const orderStatusMatch = reqPath.match(/^\/purchases\/orders\/(\d+)\/status$/);
    if (orderStatusMatch && method === 'PUT') {
      requireAdmin(authUser);
      const updated = await purchaseService.updateStatus(parseInt(orderStatusMatch[1], 10), body.status, authUser, clientIp);
      return jsonResponse(200, { message: 'Status atualizado com sucesso.', order: updated });
    }

    const orderReceiveMatch = reqPath.match(/^\/purchases\/orders\/(\d+)\/receive$/);
    if (orderReceiveMatch && method === 'POST') {
      requireAdmin(authUser);
      const result = await purchaseService.receiveOrder({
        order_id: parseInt(orderReceiveMatch[1], 10),
        invoice_number: body.invoice_number,
        items_received: body.items || [],
        user: authUser,
        ip_address: clientIp
      });
      return jsonResponse(200, result);
    }

    // =========================================================================
    // 7. CATEGORIAS, DEPARTAMENTOS E FORNECEDORES
    // =========================================================================
    // Categorias
    if (reqPath === '/categories' && method === 'GET') {
      const list = await categoryRepo.findAll();
      return jsonResponse(200, { categories: list });
    }
    if (reqPath === '/categories' && method === 'POST') {
      requireAdmin(authUser);
      if (!body.name) return jsonResponse(400, { error: 'O nome da categoria é obrigatório.' });
      const cat = await categoryRepo.create(body);
      return jsonResponse(201, { category: cat });
    }
    const catMatch = reqPath.match(/^\/categories\/(\d+)$/);
    if (catMatch) {
      const id = parseInt(catMatch[1], 10);
      if (method === 'PUT') {
        requireAdmin(authUser);
        const cat = await categoryRepo.update(id, body);
        return jsonResponse(200, { category: cat });
      }
      if (method === 'DELETE') {
        requireAdmin(authUser);
        await categoryRepo.remove(id);
        return jsonResponse(200, { message: 'Categoria excluída com sucesso.' });
      }
    }

    // Departamentos
    if (reqPath === '/departments' && method === 'GET') {
      const list = await departmentRepo.findAll({ activeOnly: query.active === 'true' });
      return jsonResponse(200, { departments: list });
    }
    if (reqPath === '/departments' && method === 'POST') {
      requireAdmin(authUser);
      if (!body.name) return jsonResponse(400, { error: 'O nome do departamento é obrigatório.' });
      const dep = await departmentRepo.create(body);
      return jsonResponse(201, { department: dep });
    }
    const depMatch = reqPath.match(/^\/departments\/(\d+)$/);
    if (depMatch) {
      const id = parseInt(depMatch[1], 10);
      if (method === 'PUT') {
        requireAdmin(authUser);
        const dep = await departmentRepo.update(id, body);
        return jsonResponse(200, { department: dep });
      }
      if (method === 'DELETE') {
        requireAdmin(authUser);
        await departmentRepo.remove(id);
        return jsonResponse(200, { message: 'Departamento desativado/removido com sucesso.' });
      }
    }

    // Fornecedores
    if (reqPath === '/suppliers' && method === 'GET') {
      const list = await supplierRepo.findAll({ search: query.search || '', activeOnly: query.active === 'true' });
      return jsonResponse(200, { suppliers: list });
    }
    if (reqPath === '/suppliers' && method === 'POST') {
      requireAdmin(authUser);
      if (!body.name) return jsonResponse(400, { error: 'O nome do fornecedor é obrigatório.' });
      const sup = await supplierRepo.create(body);
      return jsonResponse(201, { supplier: sup });
    }
    const supMatch = reqPath.match(/^\/suppliers\/(\d+)$/);
    if (supMatch) {
      const id = parseInt(supMatch[1], 10);
      if (method === 'PUT') {
        requireAdmin(authUser);
        const sup = await supplierRepo.update(id, body);
        return jsonResponse(200, { supplier: sup });
      }
      if (method === 'DELETE') {
        requireAdmin(authUser);
        await supplierRepo.remove(id);
        return jsonResponse(200, { message: 'Fornecedor removido/desativado com sucesso.' });
      }
    }

    // =========================================================================
    // 8. RELATÓRIOS & EXPORTAÇÕES (JSON e CSV)
    // =========================================================================
    if (reqPath === '/reports/stock' && method === 'GET') {
      const rows = await reportService.getCurrentStockReport(query);
      if (query.format === 'csv') {
        const columns = [
          { key: 'sku', label: 'SKU' },
          { key: 'name', label: 'Produto' },
          { key: 'category', label: 'Categoria' },
          { key: 'unit_measure', label: 'Unidade' },
          { key: 'current_stock', label: 'Estoque Atual' },
          { key: 'min_stock', label: 'Estoque Mínimo' },
          { key: 'ideal_stock', label: 'Estoque Ideal' },
          { key: 'location', label: 'Localização' },
          { key: 'supplier', label: 'Fornecedor' },
          { key: 'reference_price', label: 'Preço Ref. (R$)' },
          { key: 'total_value', label: 'Valor Total (R$)' },
          { key: 'situation', label: 'Situação' }
        ];
        return csvResponse(reportService.toCsv(rows, columns), 'relatorio-estoque-atual.csv');
      }
      return jsonResponse(200, { data: rows });
    }

    if (reqPath === '/reports/low-stock' && method === 'GET') {
      const rows = await reportService.getLowStockReport();
      if (query.format === 'csv') {
        const columns = [
          { key: 'sku', label: 'SKU' },
          { key: 'name', label: 'Produto' },
          { key: 'category', label: 'Categoria' },
          { key: 'unit_measure', label: 'Unidade' },
          { key: 'current_stock', label: 'Estoque Atual' },
          { key: 'min_stock', label: 'Estoque Mínimo' },
          { key: 'ideal_stock', label: 'Estoque Ideal' },
          { key: 'suggested_purchase', label: 'Sugestão Compra' },
          { key: 'supplier', label: 'Fornecedor' },
          { key: 'supplier_phone', label: 'Telefone Fornecedor' },
          { key: 'estimated_cost', label: 'Custo Estimado (R$)' }
        ];
        return csvResponse(reportService.toCsv(rows, columns), 'relatorio-estoque-critico.csv');
      }
      return jsonResponse(200, { data: rows });
    }

    if (reqPath === '/reports/consumption' && method === 'GET') {
      const rows = await reportService.getDepartmentConsumptionReport(query);
      if (query.format === 'csv') {
        const columns = [
          { key: 'department_name', label: 'Departamento / Centro de Custo' },
          { key: 'cost_center', label: 'Código CC' },
          { key: 'total_withdrawals', label: 'Total de Retiradas' },
          { key: 'total_items_withdrawn', label: 'Itens Retirados' },
          { key: 'total_cost_withdrawn', label: 'Custo Total (R$)' }
        ];
        return csvResponse(reportService.toCsv(rows, columns), 'relatorio-consumo-departamento.csv');
      }
      return jsonResponse(200, { data: rows });
    }

    if (reqPath === '/reports/movements' && method === 'GET') {
      const result = await movementRepo.findAll({ ...query, limit: 1000, offset: 0 });
      if (query.format === 'csv') {
        const columns = [
          { key: 'created_at', label: 'Data/Hora' },
          { key: 'product_sku', label: 'SKU' },
          { key: 'product_name', label: 'Produto' },
          { key: 'movement_type', label: 'Tipo' },
          { key: 'quantity', label: 'Quantidade' },
          { key: 'previous_stock', label: 'Saldo Anterior' },
          { key: 'resulting_stock', label: 'Saldo Resultante' },
          { key: 'reason', label: 'Motivo' },
          { key: 'department_name', label: 'Departamento' },
          { key: 'responsible_person', label: 'Responsável' },
          { key: 'user_name', label: 'Usuário Sistema' },
          { key: 'supplier_name', label: 'Fornecedor' },
          { key: 'invoice_number', label: 'Nota Fiscal' },
          { key: 'total_price', label: 'Valor Total (R$)' },
          { key: 'notes', label: 'Observação' }
        ];
        return csvResponse(reportService.toCsv(result.data, columns), 'relatorio-movimentacoes.csv');
      }
      return jsonResponse(200, result);
    }

    // =========================================================================
    // 9. USUÁRIOS, CONFIGURAÇÕES E AUDITORIA (Restrito a Administradores)
    // =========================================================================
    if (reqPath === '/users' && method === 'GET') {
      requireAdmin(authUser);
      const users = await userRepo.findAll();
      return jsonResponse(200, { users });
    }

    if (reqPath === '/users' && method === 'POST') {
      requireAdmin(authUser);
      if (!body.username || !body.full_name || !body.email || !body.password) {
        return jsonResponse(400, { error: 'Preencha todos os campos obrigatórios do usuário.' });
      }
      const existing = await userRepo.findByUsername(body.username);
      if (existing) {
        return jsonResponse(400, { error: 'Nome de usuário já está em uso.' });
      }

      const hash = await hashPassword(body.password);
      const user = await userRepo.create({
        username: body.username,
        full_name: body.full_name,
        email: body.email,
        password_hash: hash,
        role: body.role || 'operator',
        active: body.active !== undefined ? body.active : true
      });

      await auditRepo.logAction({
        user_id: authUser.id,
        username: authUser.username,
        action: 'USUARIO_CRIADO',
        entity_type: 'USER',
        entity_id: user.id,
        details: { username: user.username, role: user.role },
        ip_address: clientIp
      });

      return jsonResponse(201, { message: 'Usuário cadastrado com sucesso.', user });
    }

    const userMatch = reqPath.match(/^\/users\/(\d+)$/);
    if (userMatch && method === 'PUT') {
      requireAdmin(authUser);
      const id = parseInt(userMatch[1], 10);
      const updateData = {
        full_name: body.full_name,
        email: body.email,
        role: body.role,
        active: body.active
      };
      if (body.password && body.password.trim().length > 0) {
        updateData.password_hash = await hashPassword(body.password);
      }
      const updated = await userRepo.update(id, updateData);
      return jsonResponse(200, { message: 'Usuário atualizado com sucesso.', user: updated });
    }

    if (reqPath === '/audit' && method === 'GET') {
      requireAdmin(authUser);
      const result = await auditRepo.findAll({
        user_id: query.user_id || null,
        action: query.action || null,
        entity_type: query.entity_type || null,
        start_date: query.start_date || null,
        end_date: query.end_date || null,
        limit: parseInt(query.limit || '50', 10),
        offset: parseInt(query.offset || '0', 10)
      });
      return jsonResponse(200, result);
    }

    if (reqPath === '/settings' && method === 'GET') {
      const allSettings = await settingsRepo.getAll();
      return jsonResponse(200, { settings: allSettings });
    }

    if (reqPath === '/settings' && method === 'PUT') {
      requireAdmin(authUser);
      const updated = await settingsRepo.setMany(body);
      await auditRepo.logAction({
        user_id: authUser.id,
        username: authUser.username,
        action: 'CONFIGURACOES_ALTERADAS',
        entity_type: 'SETTINGS',
        entity_id: null,
        details: body,
        ip_address: clientIp
      });
      return jsonResponse(200, { message: 'Configurações atualizadas com sucesso.', settings: updated });
    }

    if (reqPath === '/settings/clean-database' && method === 'POST') {
      requireAdmin(authUser);
      await db.query('DELETE FROM stock_movements');
      await db.query('DELETE FROM inventory_items');
      await db.query('DELETE FROM inventory_sessions');
      await db.query('DELETE FROM purchase_order_items');
      await db.query('DELETE FROM purchase_orders');
      await db.query('DELETE FROM products');
      await db.query('DELETE FROM suppliers');
      await db.query('DELETE FROM departments');
      await db.query('DELETE FROM categories');
      await auditRepo.logAction({
        user_id: authUser.id,
        username: authUser.username,
        action: 'BANCO_DADOS_LIMPO',
        entity_type: 'SYSTEM',
        entity_id: null,
        details: { message: 'Todos os registros operacionais foram limpos pelo administrador' },
        ip_address: clientIp
      });
      return jsonResponse(200, { message: 'Todos os bancos e tabelas foram limpos com sucesso!' });
    }

    // Exportação completa de backup (JSON)
    if (reqPath === '/backup/export' && method === 'GET') {
      requireAdmin(authUser);
      const products = await db.query('SELECT * FROM products');
      const categories = await db.query('SELECT * FROM categories');
      const departments = await db.query('SELECT * FROM departments');
      const suppliers = await db.query('SELECT * FROM suppliers');
      const movements = await db.query('SELECT * FROM stock_movements');
      const settings = await db.query('SELECT * FROM settings');

      const backupData = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        exported_by: authUser.username,
        data: {
          categories: categories.rows,
          departments: departments.rows,
          suppliers: suppliers.rows,
          products: products.rows,
          movements: movements.rows,
          settings: settings.rows
        }
      };

      await auditRepo.logAction({
        user_id: authUser.id,
        username: authUser.username,
        action: 'BACKUP_EXPORTADO',
        entity_type: 'SYSTEM',
        entity_id: null,
        details: { total_products: products.rows.length, total_movements: movements.rows.length },
        ip_address: clientIp
      });

      return jsonResponse(200, backupData, {
        'Content-Disposition': `attachment; filename="backup-estoque-${Date.now()}.json"`
      });
    }

    // Se nenhuma rota coincidiu
    return jsonResponse(404, { error: `Endpoint não encontrado: ${method} ${reqPath}` });
  } catch (err) {
    console.error(`[API Error] ${method} ${reqPath}:`, err);
    const status = err.status || 500;
    const message = err.message || 'Erro interno no servidor ao processar a requisição.';
    return jsonResponse(status, { error: message });
  }
};
