-- ==============================================================================
-- MIGRATION 001: Esquema Inicial do Banco de Dados (PostgreSQL)
-- ==============================================================================

-- 1. USUÁRIOS E PERMISSÕES (RBAC)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'operator', -- 'admin' ou 'operator'
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. CATEGORIAS DE PRODUTOS
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#2563eb',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. DEPARTAMENTOS / SETORES (Centros de Custo e Destinos de Saída)
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    cost_center VARCHAR(50),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. FORNECEDORES
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    corporate_name VARCHAR(150),
    cnpj VARCHAR(30),
    phone VARCHAR(30),
    email VARCHAR(100),
    contact_person VARCHAR(100),
    address TEXT,
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. PRODUTOS E MATERIAIS
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
    unit_measure VARCHAR(30) NOT NULL DEFAULT 'Unidade',
    description TEXT,
    current_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
    min_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
    ideal_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
    location VARCHAR(100),
    primary_supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    reference_price NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'archived'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. HISTÓRICO DE MOVIMENTAÇÕES DE ESTOQUE (Entradas, Saídas, Ajustes)
CREATE TABLE IF NOT EXISTS stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    movement_type VARCHAR(20) NOT NULL, -- 'ENTRADA', 'SAIDA', 'AJUSTE', 'INVENTARIO'
    quantity NUMERIC(12,2) NOT NULL,
    previous_stock NUMERIC(12,2) NOT NULL,
    resulting_stock NUMERIC(12,2) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    responsible_person VARCHAR(100),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    invoice_number VARCHAR(50),
    unit_price NUMERIC(12,2) DEFAULT 0,
    total_price NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. TRILHA DE AUDITORIA IMUTÁVEL
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(50),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50),
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. CONFIGURAÇÕES DO SISTEMA
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES DE PERFORMANCE E CONSULTAS FREQUENTES
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(current_stock, min_stock);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
