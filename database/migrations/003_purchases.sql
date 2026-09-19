-- ==============================================================================
-- MIGRATION 003: Módulo de Reposição e Ordens de Compra
-- ==============================================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'planejado', -- 'planejado', 'em_compra', 'pedido_realizado', 'recebido', 'cancelado'
    total_estimated NUMERIC(12,2) DEFAULT 0,
    total_actual NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_ordered NUMERIC(12,2) NOT NULL,
    quantity_received NUMERIC(12,2) NOT NULL DEFAULT 0,
    unit_price NUMERIC(12,2) DEFAULT 0,
    total_price NUMERIC(12,2) DEFAULT 0,
    received_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_order ON purchase_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_order_items(product_id);
