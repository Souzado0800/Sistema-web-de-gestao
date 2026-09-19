/**
 * Controle de Acesso Baseado em Papéis (RBAC - Role-Based Access Control).
 * Perfis suportados: 'admin' e 'operator'.
 */

function requireRole(user, allowedRoles = ['admin']) {
  if (!user) {
    const err = new Error('Usuário não autenticado');
    err.status = 401;
    throw err;
  }
  if (!allowedRoles.includes(user.role)) {
    const err = new Error(`Acesso negado. Ação restrita a perfis: ${allowedRoles.join(', ')}`);
    err.status = 403;
    throw err;
  }
  return true;
}

function requireAdmin(user) {
  return requireRole(user, ['admin']);
}

module.exports = {
  requireRole,
  requireAdmin
};
