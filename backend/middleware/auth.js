/**
 * Utilitários de Autenticação JWT e Hashing Bcrypt.
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');

/**
 * Gera um token JWT assinado para a sessão do usuário.
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    role: user.role
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/**
 * Valida o token JWT e extrai o payload do usuário.
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (err) {
    return null;
  }
}

/**
 * Extrai o token do cabeçalho de autorização ou cookies.
 */
function extractToken(headers = {}) {
  const authHeader = headers.authorization || headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const cookieHeader = headers.cookie || headers.Cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

/**
 * Hash seguro de senha usando bcrypt com 10 salt rounds.
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
}

/**
 * Compara senha informada com o hash salvo no banco.
 */
async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

/**
 * Middleware para autenticar requisições serverless.
 */
function authenticate(headers = {}) {
  const token = extractToken(headers);
  if (!token) {
    const err = new Error('Token de autenticação não fornecido');
    err.status = 401;
    throw err;
  }
  const user = verifyToken(token);
  if (!user) {
    const err = new Error('Sessão expirada ou inválida. Por favor, faça login novamente.');
    err.status = 401;
    throw err;
  }
  return user;
}

module.exports = {
  generateToken,
  verifyToken,
  extractToken,
  hashPassword,
  comparePassword,
  authenticate
};
