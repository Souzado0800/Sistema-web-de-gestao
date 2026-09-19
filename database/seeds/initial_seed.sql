-- ==============================================================================
-- SEED INICIAL: Banco de Dados Limpo para Produção
-- Contém apenas os Usuários de Acesso e Configurações Essenciais do Sistema
-- ==============================================================================

-- 1. USUÁRIOS DE ACESSO INICIAL
-- Senha padrão do admin: admin123
-- Senha padrão do operador: operador123
INSERT INTO users (username, full_name, email, password_hash, role, active)
VALUES 
('admin', 'Administrador do Sistema', 'admin@empresa.com', '$2a$10$l.555jtZEOFimVzVJVfrT.ZWtXwuShQ2qELK4GE6uF3xqSYVIitQa', 'admin', true),
('operador', 'Operador de Almoxarifado', 'operador@empresa.com', '$2a$10$XpbShGn21kn1US0gTjYrFeFuTB1CxeTr2lVKBrB2R2apzf.wybRIW', 'operator', true)
ON CONFLICT (username) DO NOTHING;

-- 2. CONFIGURAÇÕES INICIAIS DO SISTEMA
INSERT INTO settings (key, value, description)
VALUES
('company_name', 'Gestão de Estoque', 'Nome oficial da empresa exibido no cabeçalho e relatórios'),
('currency_symbol', 'R$', 'Símbolo monetário padrão do sistema'),
('date_format', 'DD/MM/YYYY', 'Formato de exibição de datas'),
('allow_negative_stock', 'false', 'Impedir saídas caso o saldo do produto seja insuficiente'),
('low_stock_notification', 'true', 'Ativar alertas automáticos quando estoque <= mínimo')
ON CONFLICT (key) DO NOTHING;

-- 3. LOG DE INICIALIZAÇÃO
INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip_address)
VALUES (1, 'admin', 'SISTEMA_INICIALIZADO', 'SYSTEM', '1', '{"message": "Banco de dados limpo inicializado com sucesso para operação"}', '127.0.0.1');
