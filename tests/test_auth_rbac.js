/**
 * Testes Automatizados: Autenticação, Tokens JWT, RBAC e Trilha de Auditoria.
 */
const assert = require('assert');
const { hashPassword, comparePassword, generateToken, verifyToken } = require('../backend/middleware/auth');
const { requireAdmin, requireRole } = require('../backend/middleware/rbac');
const userRepo = require('../backend/repositories/user_repo');
const auditRepo = require('../backend/repositories/audit_repo');

async function runAuthRbacTests() {
  console.log('--- [TESTE 4] Iniciando Testes de Autenticação e RBAC ---');

  // 1. Teste de Hashing Bcrypt
  const plainPassword = 'senhaSegura!123';
  const hash = await hashPassword(plainPassword);
  assert.notStrictEqual(plainPassword, hash, 'Hash não pode ser em texto puro');
  const isMatch = await comparePassword(plainPassword, hash);
  assert.strictEqual(isMatch, true, 'Senha correta deve validar com sucesso');
  const isWrong = await comparePassword('senhaErrada', hash);
  assert.strictEqual(isWrong, false, 'Senha incorreta deve ser rejeitada');
  console.log(' ✔ Hashing Bcrypt validado com sucesso');

  // 2. Teste de Token JWT
  const user = { id: 99, username: 'testuser', full_name: 'Usuário Teste', email: 'teste@empresa.com', role: 'operator' };
  const token = generateToken(user);
  assert.ok(token && typeof token === 'string', 'Token JWT deve ser gerado');

  const decoded = verifyToken(token);
  assert.strictEqual(decoded.username, 'testuser', 'Payload do token deve conter username');
  assert.strictEqual(decoded.role, 'operator', 'Payload do token deve conter role');
  console.log(' ✔ Geração e decodificação de token JWT validadas com sucesso');

  // 3. Teste de Permissões RBAC (Admin vs Operador)
  const adminUser = { id: 1, role: 'admin' };
  const operatorUser = { id: 2, role: 'operator' };

  // Admin deve passar
  assert.strictEqual(requireAdmin(adminUser), true, 'Admin deve ter permissão liberada');

  // Operador deve ser bloqueado em rotas administrativas (403)
  let blocked = false;
  try {
    requireAdmin(operatorUser);
  } catch (err) {
    blocked = true;
    assert.strictEqual(err.status, 403, 'Status deve ser 403 Forbidden');
    assert.match(err.message, /Acesso negado/i, 'Mensagem deve indicar acesso negado');
  }
  assert.strictEqual(blocked, true, 'Operador deve ser bloqueado em ação restrita a admin');
  console.log(' ✔ Regras de RBAC validadas: Operador bloqueado e Admin autorizado');

  // 4. Teste de Trilha de Auditoria
  const auditEntry = await auditRepo.logAction({
    user_id: 1,
    username: 'admin',
    action: 'TESTE_AUDITORIA',
    entity_type: 'UNIT_TEST',
    entity_id: '123',
    details: { test: true }
  });
  assert.ok(auditEntry.id, 'Entrada de auditoria deve ser persistida com ID');
  console.log(' ✔ Trilha de auditoria persistida com sucesso');

  console.log('--- [TESTE 4] CONCLUÍDO COM SUCESSO! ---\n');
}

module.exports = runAuthRbacTests;
