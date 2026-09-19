-- ==============================================================================
-- MIGRATION 002: Módulo de Inventário Físico e Conferência de Estoque
-- ==============================================================================

CREATE TABLE IF NOT EXISTS inventory_sessions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(150) NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'completed', 'cancelled'
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finalized_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    expected_stock NUMERIC(12,2) NOT NULL,
    counted_stock NUMERIC(12,2) NOT NULL,
    difference NUMERIC(12,2) NOT NULL, -- counted_stock - expected_stock
    notes TEXT,
    counted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_sessions_status ON inventory_sessions(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_session ON inventory_items(session_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_product ON inventory_items(product_id);
