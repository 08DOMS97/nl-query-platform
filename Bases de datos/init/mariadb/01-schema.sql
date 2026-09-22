-- ============================================================================
--  MariaDB 11.4 (LTS) - esquema del banco de pruebas NL2SQL (dataset e-commerce)
--  Se ejecuta en el PRIMER arranque, con la base testdb ya seleccionada.
--  El usuario testuser lo crea la propia imagen (MARIADB_USER / MARIADB_PASSWORD)
--  con ALL PRIVILEGES sobre testdb.
--
--  8 tablas:
--    categories 1--N products
--    customers  1--N addresses / 1--N orders
--    orders     1--N order_items (N--1 products) / 1--N payments / 1--N shipments
-- ============================================================================

-- ----------------------------------------------------------------------------
-- categories
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    category_id INT          NOT NULL AUTO_INCREMENT,
    name        VARCHAR(80)  NOT NULL,
    description VARCHAR(255),
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    PRIMARY KEY (category_id),
    UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- customers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    customer_id       INT          NOT NULL AUTO_INCREMENT,
    first_name        VARCHAR(60)  NOT NULL,
    last_name         VARCHAR(60)  NOT NULL,
    email             VARCHAR(180) NOT NULL,
    phone             VARCHAR(30),
    date_of_birth     DATE,
    registration_date DATE         NOT NULL,
    status            VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE',
    country           VARCHAR(60)  NOT NULL,
    city              VARCHAR(80)  NOT NULL,
    PRIMARY KEY (customer_id),
    UNIQUE KEY uq_customers_email (email),
    KEY ix_customers_status (status),
    KEY ix_customers_city (city),
    KEY ix_customers_country (country),
    KEY ix_customers_registration (registration_date),
    CONSTRAINT ck_customers_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- addresses
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS addresses (
    address_id   INT          NOT NULL AUTO_INCREMENT,
    customer_id  INT          NOT NULL,
    address_type VARCHAR(10)  NOT NULL,
    address_line VARCHAR(160) NOT NULL,
    city         VARCHAR(80)  NOT NULL,
    state        VARCHAR(80),
    postal_code  VARCHAR(20),
    country      VARCHAR(60)  NOT NULL,
    is_default   BOOLEAN      NOT NULL DEFAULT FALSE,
    PRIMARY KEY (address_id),
    KEY ix_addresses_customer (customer_id),
    CONSTRAINT fk_addresses_customer
        FOREIGN KEY (customer_id) REFERENCES customers (customer_id),
    CONSTRAINT ck_addresses_type
        CHECK (address_type IN ('BILLING', 'SHIPPING', 'HOME'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    product_id  INT           NOT NULL AUTO_INCREMENT,
    category_id INT           NOT NULL,
    name        VARCHAR(140)  NOT NULL,
    description VARCHAR(400),
    price       DECIMAL(10,2) NOT NULL,
    stock       INT           NOT NULL DEFAULT 0,
    status      VARCHAR(12)   NOT NULL DEFAULT 'ACTIVE',
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id),
    KEY ix_products_category (category_id),
    KEY ix_products_status (status),
    KEY ix_products_price (price),
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories (category_id),
    CONSTRAINT ck_products_price  CHECK (price >= 0),
    CONSTRAINT ck_products_stock  CHECK (stock >= 0),
    CONSTRAINT ck_products_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- orders
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    order_id            INT           NOT NULL AUTO_INCREMENT,
    customer_id         INT           NOT NULL,
    order_date          DATETIME      NOT NULL,
    status              VARCHAR(12)   NOT NULL,
    subtotal            DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax                 DECIMAL(12,2) NOT NULL DEFAULT 0,
    shipping_cost       DECIMAL(12,2) NOT NULL DEFAULT 0,
    total               DECIMAL(12,2) NOT NULL DEFAULT 0,
    shipping_address_id INT,
    PRIMARY KEY (order_id),
    KEY ix_orders_customer (customer_id),
    KEY ix_orders_date (order_date),
    KEY ix_orders_status (status),
    KEY ix_orders_address (shipping_address_id),
    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id) REFERENCES customers (customer_id),
    CONSTRAINT fk_orders_address
        FOREIGN KEY (shipping_address_id) REFERENCES addresses (address_id),
    CONSTRAINT ck_orders_status CHECK (status IN
        ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
    CONSTRAINT ck_orders_amounts CHECK (subtotal >= 0 AND tax >= 0 AND shipping_cost >= 0 AND total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- order_items  (tabla intermedia orders <-> products)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    order_item_id INT           NOT NULL AUTO_INCREMENT,
    order_id      INT           NOT NULL,
    product_id    INT           NOT NULL,
    quantity      INT           NOT NULL,
    unit_price    DECIMAL(10,2) NOT NULL,
    discount      DECIMAL(10,2) NOT NULL DEFAULT 0,
    subtotal      DECIMAL(12,2) NOT NULL,
    PRIMARY KEY (order_item_id),
    UNIQUE KEY uq_order_items_order_product (order_id, product_id),
    KEY ix_order_items_product (product_id),
    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders (order_id),
    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id) REFERENCES products (product_id),
    CONSTRAINT ck_order_items_qty    CHECK (quantity > 0),
    CONSTRAINT ck_order_items_prices CHECK (unit_price >= 0 AND discount >= 0 AND subtotal >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- payments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    payment_id            INT           NOT NULL AUTO_INCREMENT,
    order_id              INT           NOT NULL,
    payment_date          DATETIME      NOT NULL,
    payment_method        VARCHAR(20)   NOT NULL,
    amount                DECIMAL(12,2) NOT NULL,
    status                VARCHAR(12)   NOT NULL,
    transaction_reference VARCHAR(40)   NOT NULL,
    PRIMARY KEY (payment_id),
    UNIQUE KEY uq_payments_txn (transaction_reference),
    KEY ix_payments_order (order_id),
    KEY ix_payments_status (status),
    KEY ix_payments_method (payment_method),
    KEY ix_payments_date (payment_date),
    CONSTRAINT fk_payments_order
        FOREIGN KEY (order_id) REFERENCES orders (order_id),
    CONSTRAINT ck_payments_amount CHECK (amount >= 0),
    CONSTRAINT ck_payments_method CHECK (payment_method IN
        ('CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'CASH_ON_DELIVERY')),
    CONSTRAINT ck_payments_status CHECK (status IN
        ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- shipments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipments (
    shipment_id     INT          NOT NULL AUTO_INCREMENT,
    order_id        INT          NOT NULL,
    shipment_date   DATETIME,
    delivery_date   DATETIME,
    carrier         VARCHAR(40),
    tracking_number VARCHAR(50),
    status          VARCHAR(12)  NOT NULL,
    PRIMARY KEY (shipment_id),
    UNIQUE KEY uq_shipments_tracking (tracking_number),
    KEY ix_shipments_order (order_id),
    KEY ix_shipments_status (status),
    KEY ix_shipments_date (shipment_date),
    CONSTRAINT fk_shipments_order
        FOREIGN KEY (order_id) REFERENCES orders (order_id),
    CONSTRAINT ck_shipments_status CHECK (status IN
        ('PREPARING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
