-- ==============================================================================
-- SEED INICIAL DE DADOS: Usuários, Categorias, Departamentos, Fornecedores e Produtos
-- ==============================================================================

-- 1. USUÁRIOS INICIAIS (Senha do admin: admin123 | Senha do operador: operador123)
INSERT INTO users (username, full_name, email, password_hash, role, active)
VALUES 
('admin', 'Administrador do Sistema', 'admin@empresa.com', '$2a$10$l.555jtZEOFimVzVJVfrT.ZWtXwuShQ2qELK4GE6uF3xqSYVIitQa', 'admin', true),
('operador', 'Operador de Estoque', 'operador@empresa.com', '$2a$10$XpbShGn21kn1US0gTjYrFeFuTB1CxeTr2lVKBrB2R2apzf.wybRIW', 'operator', true)
ON CONFLICT (username) DO NOTHING;

-- 2. CATEGORIAS DE PRODUTOS
INSERT INTO categories (name, description, color)
VALUES
('Escritório', 'Papelaria, pastas, canetas e suprimentos administrativos', '#2563eb'),
('Impressão', 'Toners, cartuchos de tinta, cilindros e papéis fotográficos', '#7c3aed'),
('Informática', 'Cabos, periféricos, adaptadores e componentes de TI', '#059669'),
('Limpeza', 'Produtos de higienização, desinfetantes e descartáveis', '#d97706'),
('Manutenção', 'Ferramentas, fitas, lâmpadas e materiais elétricos', '#dc2626')
ON CONFLICT (name) DO NOTHING;

-- 3. DEPARTAMENTOS / CENTROS DE CUSTO
INSERT INTO departments (name, description, cost_center, active)
VALUES
('Administrativo', 'Setor de gestão geral e diretoria executiva', 'ADM-01', true),
('Financeiro', 'Controladoria, contas a pagar e tesouraria', 'FIN-02', true),
('Tecnologia da Informação', 'Suporte técnico, infraestrutura e desenvolvimento', 'TI-03', true),
('Operações e Produção', 'Linha operacional, logística e expedição', 'OPS-04', true),
('Recursos Humanos', 'Gestão de pessoas, treinamento e departamento pessoal', 'RH-05', true)
ON CONFLICT (name) DO NOTHING;

-- 4. FORNECEDORES HOMOLOGADOS
INSERT INTO suppliers (name, corporate_name, cnpj, phone, email, contact_person, address, notes, active)
VALUES
('Distribuidora Papel & Cia', 'Papel & Cia Suprimentos Ltda', '12.345.678/0001-90', '(11) 3456-7890', 'vendas@papelecia.com.br', 'Carlos Silva', 'Av. Paulista, 1000 - SP', 'Fornecedor principal de papel e papéis especiais', true),
('Tech Supply Equipamentos', 'Tech Supply Comércio de Periféricos', '98.765.432/0001-10', '(11) 4002-8922', 'contato@techsupply.com.br', 'Mariana Costa', 'Rua Augusta, 500 - SP', 'Fornecedor de toners e acessórios de TI', true),
('CleanPro Higiene Profissional', 'CleanPro Soluções Químicas S.A.', '45.678.901/0001-23', '(11) 2233-4455', 'pedidos@cleanpro.com.br', 'Roberto Souza', 'Rua das Flores, 250 - Campinas/SP', 'Fornecedor homologado de materiais de limpeza', true)
ON CONFLICT DO NOTHING;

-- 5. PRODUTOS BASE (Incluindo os casos de uso obrigatórios do projeto)
INSERT INTO products (sku, name, category_id, unit_measure, description, current_stock, min_stock, ideal_stock, location, primary_supplier_id, reference_price, status)
VALUES
-- Caso 1: Papel A4 (Estoque inicial: 10, Mínimo: 3, Ideal: 20)
('PAP-A4-75G', 'Papel Sulfite A4 75g', 1, 'Resma', 'Caixa com resmas de papel branco 75g para impressão diária', 10, 3, 20, 'Almoxarifado A - Prateleira 1', 1, 28.50, 'active'),

-- Caso 2: Tinta Epson (Estoque: 2, Mínimo: 2, Ideal: 8 -> Alerta de reposição!)
('TNT-EPS-BK', 'Refil de Tinta Epson T544 Preto', 2, 'Frasco', 'Frasco de tinta preta 65ml para impressoras tanque de tinta', 2, 2, 8, 'Armário Impressão B - Gaveta 2', 2, 65.00, 'active'),

-- Caso 3: Caneta Azul (Estoque: 150, Mínimo: 30, Ideal: 100 -> Situação Normal)
('CAN-BIC-AZ', 'Caneta Esferográfica Azul 1.0mm', 1, 'Unidade', 'Caneta tradicional corpo transparente escrita média', 150, 30, 100, 'Almoxarifado A - Gaveteiro 3', 1, 1.80, 'active'),

-- Caso Crítico: Zerado
('CAB-HDMI-2M', 'Cabo HDMI 2.0 4K 2 metros', 3, 'Unidade', 'Cabo blindado para salas de reunião e estações de trabalho', 0, 5, 15, 'Depósito TI - Caixa 4', 2, 25.00, 'active'),

-- Caso Baixo: Próximo ou abaixo do mínimo
('LIMP-DET-5L', 'Detergente Neutro Concentrado 5L', 4, 'Galão', 'Detergente neutro para limpeza de copas e áreas comuns', 4, 5, 12, 'Depósito Limpeza - Prateleira C', 3, 32.00, 'active')
ON CONFLICT (sku) DO NOTHING;

-- 6. CONFIGURAÇÕES INICIAIS DA EMPRESA
INSERT INTO settings (key, value, description)
VALUES
('company_name', 'Empresa Exemplo S.A.', 'Nome oficial da empresa exibido no cabeçalho e relatórios'),
('currency_symbol', 'R$', 'Símbolo monetário padrão do sistema'),
('date_format', 'DD/MM/YYYY', 'Formato de exibição de datas'),
('allow_negative_stock', 'false', 'Impedir saídas caso o saldo do produto seja insuficiente'),
('low_stock_notification', 'true', 'Ativar alertas automáticos quando estoque <= mínimo')
ON CONFLICT (key) DO NOTHING;

-- 7. AUDITORIA DA INICIALIZAÇÃO
INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details)
VALUES (1, 'admin', 'SISTEMA_INICIALIZADO', 'SYSTEM', '1', '{"message": "Seed inicial de dados executado com sucesso"}');
