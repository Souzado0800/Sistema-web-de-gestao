-- ==============================================================================
-- SEED INICIAL DE DADOS: Empresa de Engenharia & Construções
-- Usuários, Categorias, Departamentos, Fornecedores e Produtos
-- ==============================================================================

-- 1. USUÁRIOS INICIAIS (Senha do admin: admin123 | Senha do operador: operador123)
INSERT INTO users (username, full_name, email, password_hash, role, active)
VALUES 
('admin', 'Engenheiro Coordenador (Admin)', 'coordenacao@novaeraengenharia.com.br', '$2a$10$l.555jtZEOFimVzVJVfrT.ZWtXwuShQ2qELK4GE6uF3xqSYVIitQa', 'admin', true),
('operador', 'Almoxarife de Obra (Operador)', 'almoxarifado@novaeraengenharia.com.br', '$2a$10$XpbShGn21kn1US0gTjYrFeFuTB1CxeTr2lVKBrB2R2apzf.wybRIW', 'operator', true)
ON CONFLICT (username) DO NOTHING;

-- 2. CATEGORIAS DE ENGENHARIA
INSERT INTO categories (name, description, color)
VALUES
('EPIs e Segurança do Trabalho', 'Equipamentos de proteção individual certificados (NR-06) para canteiro e equipe técnica', '#dc2626'),
('Instrumentos de Medição e Precisão', 'Trenas a laser, níveis ópticos, esquadros, paquímetros e ferramentas topográficas', '#2563eb'),
('Consumíveis de Obra e Instalação', 'Discos de corte, brocas SDS, abrasivos, parafusos parabolt, fitas e selantes PU40', '#d97706'),
('Materiais Elétricos e Cabeamento', 'Cabos flexíveis, disjuntores DIN, conectores Wago e fitas de alta isolação', '#059669'),
('Projetos, Plotter e Escritório Técnico', 'Bobinas de plotter A0/A1, suprimentos CAD, pranchetas de campo e relatórios', '#7c3aed')
ON CONFLICT (name) DO NOTHING;

-- 3. DEPARTAMENTOS / CENTROS DE CUSTO DE ENGENHARIA
INSERT INTO departments (name, description, cost_center, active)
VALUES
('Engenharia Civil e Canteiro de Obras', 'Execução de obras civis, fundações e estruturas em campo', 'ENG-OBRA-01', true),
('Projetos, BIM e Planejamento', 'Projetos arquitetônicos, modelagem BIM, memoriais e cronogramas', 'PRJ-BIM-02', true),
('Engenharia Elétrica e Instalações', 'Projetos e montagens elétricas de baixa e média tensão', 'ENG-ELET-03', true),
('Segurança do Trabalho e Meio Ambiente (SESMT)', 'Fiscalização de segurança, DDS, controle de EPIs e conformidade NR', 'SESMT-04', true),
('Diretoria de Operações e Contratos', 'Gestão corporativa de contratos de engenharia e suprimentos', 'DIR-OPS-05', true)
ON CONFLICT (name) DO NOTHING;

-- 4. FORNECEDORES HOMOLOGADOS DE ENGENHARIA
INSERT INTO suppliers (name, corporate_name, cnpj, phone, email, contact_person, address, notes, active)
VALUES
('Engenharia & Obras Suprimentos', 'Engenharia & Obras Materiais e Abrasivos Ltda', '12.345.678/0001-90', '(11) 3456-7890', 'vendas@engenhariaeobras.com.br', 'Carlos Andrade', 'Av. das Indústrias, 1400 - Distrito Industrial - SP', 'Fornecedor homologado de EPIs, brocas e abrasivos para canteiro', true),
('TopGeo Instrumentos de Precisão', 'TopGeo Equipamentos de Medição e Topografia Ltda', '98.765.432/0001-10', '(11) 4002-8922', 'contato@topgeo.com.br', 'Mariana Valença', 'Rua dos Engenheiros, 350 - Curitiba/PR', 'Fornecedor de trenas laser, níveis ópticos e instrumentos de medição', true),
('EletroVolt Distribuidora Elétrica', 'EletroVolt Materiais Elétricos e Cabos S.A.', '45.678.901/0001-23', '(11) 2233-4455', 'pedidos@eletrovolt.com.br', 'Roberto Menezes', 'Rodovia Anhanguera, km 104 - Campinas/SP', 'Fornecedor de fios, cabos de cobre e componentes elétricos industriais', true),
('PlotterTech Suprimentos de Projetos', 'PlotterTech Comércio de Papéis Técnicos Ltda', '33.444.555/0001-67', '(11) 5566-7788', 'contato@plottertech.com.br', 'Fernanda Lima', 'Av. Paulista, 2020 - Bela Vista - SP', 'Fornecedor de bobinas de plotter, cartuchos e insumos para escritório técnico', true)
ON CONFLICT DO NOTHING;

-- 5. CATÁLOGO DE PRODUTOS DE ENGENHARIA
INSERT INTO products (sku, name, category_id, unit_measure, description, current_stock, min_stock, ideal_stock, location, primary_supplier_id, reference_price, status)
VALUES
-- EPIs e Segurança
('EPI-CAP-BR', 'Capacete de Segurança com Jugular Classe B Branco', 1, 'Unidade', 'Capacete de proteção para engenheiros e visitantes em canteiro de obras (CA 31.469)', 35, 10, 50, 'Almoxarifado Central - Prateleira EPI 01', 1, 38.50, 'active'),
('EPI-OCU-INC', 'Óculos de Proteção Antirrisco e Antiembassante Incolor', 1, 'Par', 'Óculos de proteção em policarbonato com proteção lateral e UV (CA 27.776)', 60, 20, 100, 'Almoxarifado Central - Prateleira EPI 02', 1, 14.50, 'active'),

-- Instrumentos de Medição
('MED-TRN-50M', 'Trena a Laser Profissional com Alcance de 50 Metros', 2, 'Unidade', 'Medidor laser digital de alta precisão (+- 1.5mm) com cálculo de área e volume', 5, 2, 10, 'Armário de Instrumentos - Gaveta 02', 2, 320.00, 'active'),

-- Consumíveis de Canteiro e Abrasivos
('DIS-CRT-115', 'Disco de Corte Diamantado 115mm para Concreto e Alvenaria', 3, 'Unidade', 'Disco turbo de alto rendimento para corte a seco em concreto, tijolos e pedras', 45, 15, 60, 'Almoxarifado Obras - Caixa D-04', 1, 28.00, 'active'),
('FRR-BRC-8MM', 'Broca SDS Plus de Wídea para Concreto 8mm x 160mm', 3, 'Unidade', 'Broca de metal duro com ponta centralizadora para furação em lajes e vigas', 4, 5, 15, 'Almoxarifado Ferramentas - Gaveta F3', 1, 22.00, 'active'),

-- Materiais Elétricos
('CAB-FLX-25AZ', 'Cabo Flexível 2.5mm² 750V Rolo com 100 Metros Azul', 4, 'Rolo', 'Condutor de cobre eletrolítico antichama para circuitos elétricos de tomadas e iluminação', 0, 3, 10, 'Depósito Elétrica - Palete 02', 3, 185.00, 'active'),

-- Projetos e Escritório Técnico
('PLT-BOB-914', 'Bobina de Papel Sulfite Plotter 914mm x 50m (A0/A1) 75g', 5, 'Rolo', 'Papel técnico de alta alvura para plotagem de plantas executivas de engenharia e arquitetura', 12, 4, 25, 'Almoxarifado Projetos - Rack B1', 4, 85.00, 'active'),
('PRN-ACR-A4', 'Prancheta Acrílica A4 com Garra Metálica para Vistoria', 5, 'Unidade', 'Prancheta rígida transparente para inspeção de campo, diário de obras e pranchas reduzidas', 25, 8, 30, 'Almoxarifado Projetos - Prateleira P1', 4, 18.90, 'active'),

-- Produtos do Benchmark Técnico Obrigatório
('PAP-A4-75G', 'Papel Sulfite A4 75g para Relatórios e Diários de Obra', 5, 'Resma', 'Papel branco 75g para impressão de relatórios de medição, ARTs e memoriais descritivos', 10, 3, 20, 'Almoxarifado Projetos - Prateleira 1', 4, 28.50, 'active'),
('TNT-EPS-BK', 'Refil de Tinta Epson T544 Preto para Plotter e Projetos CAD', 5, 'Frasco', 'Frasco de tinta preta 65ml para impressoras de escritório técnico e pranchas de engenharia', 2, 2, 8, 'Sala de Plotagem - Armário B', 4, 65.00, 'active'),
('CAN-BIC-AZ', 'Caneta Marcadora Técnica Azul 1.0mm para Gabaritos', 5, 'Unidade', 'Caneta azul resistente para marcação em projetos de campo e conferência de plantas', 150, 30, 100, 'Almoxarifado Projetos - Gaveteiro 3', 4, 2.20, 'active')
ON CONFLICT (sku) DO NOTHING;

-- 6. CONFIGURAÇÕES INICIAIS DA EMPRESA DE ENGENHARIA
INSERT INTO settings (key, value, description)
VALUES
('company_name', 'Nova Era Engenharia & Construções', 'Nome oficial da empresa exibido no cabeçalho e relatórios'),
('currency_symbol', 'R$', 'Símbolo monetário padrão do sistema'),
('date_format', 'DD/MM/YYYY', 'Formato de exibição de datas'),
('allow_negative_stock', 'false', 'Impedir saídas caso o saldo do produto seja insuficiente'),
('low_stock_notification', 'true', 'Ativar alertas automáticos quando estoque <= mínimo')
ON CONFLICT (key) DO NOTHING;

-- 7. AUDITORIA DA INICIALIZAÇÃO
INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip_address)
VALUES (1, 'admin', 'SISTEMA_INICIALIZADO', 'SYSTEM', '1', '{"message": "Seed inicial com dados de Engenharia & Construções executado com sucesso"}', '127.0.0.1');
