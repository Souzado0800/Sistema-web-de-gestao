/**
 * Configuração da aplicação e leitura de variáveis de ambiente.
 */
const config = {
  env: process.env.APP_ENV || process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'chave_padrao_dev_segura_para_testes_locais_antigravity_1234567890',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  companyName: process.env.COMPANY_NAME || 'Empresa Exemplo S.A.',
  allowNegativeStock: process.env.ALLOW_NEGATIVE_STOCK === 'true'
};

module.exports = config;
