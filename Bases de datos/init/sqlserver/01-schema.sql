-- ============================================================================
--  SQL Server 2022 - esquema del banco de pruebas NL2SQL (dataset e-commerce)
--  Lo aplica el servicio sqlserver-init contra la base testdb. Idempotente
--  (guardas IF OBJECT_ID ... IS NULL). Batches separados por GO.
--
--  8 tablas:
--    categories 1--N products
--    customers  1--N addresses / 1--N orders
--    orders     1--N order_items (N--1 products) / 1--N payments / 1--N shipments
-- ============================================================================

-- ----------------------------------------------------------------------------
-- categories
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.categories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.categories (
        category_id INT           IDENTITY(1,1) NOT NULL,
        name        NVARCHAR(80)  NOT NULL,
        description NVARCHAR(255)  NULL,
        active      BIT           NOT NULL CONSTRAINT DF_categories_active DEFAULT (1),
        CONSTRAINT PK_categories       PRIMARY KEY (category_id),
        CONSTRAINT UQ_categories_name  UNIQUE (name)
    );
END
GO

-- ----------------------------------------------------------------------------
-- customers
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.customers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.customers (
        customer_id       INT           IDENTITY(1,1) NOT NULL,
        first_name        NVARCHAR(60)  NOT NULL,
        last_name         NVARCHAR(60)  NOT NULL,
        email             NVARCHAR(180) NOT NULL,
        phone             NVARCHAR(30)  NULL,
        date_of_birth     DATE          NULL,
        registration_date DATE          NOT NULL,
        status            NVARCHAR(10)  NOT NULL CONSTRAINT DF_customers_status DEFAULT ('ACTIVE'),
        country           NVARCHAR(60)  NOT NULL,
        city              NVARCHAR(80)  NOT NULL,
        CONSTRAINT PK_customers        PRIMARY KEY (customer_id),
        CONSTRAINT UQ_customers_email  UNIQUE (email),
        CONSTRAINT CK_customers_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
    );
END
GO

-- ----------------------------------------------------------------------------
-- addresses
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.addresses', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.addresses (
        address_id   INT           IDENTITY(1,1) NOT NULL,
        customer_id  INT           NOT NULL,
        address_type NVARCHAR(10)  NOT NULL,
        address_line NVARCHAR(160) NOT NULL,
        city         NVARCHAR(80)  NOT NULL,
        state        NVARCHAR(80)  NULL,
        postal_code  NVARCHAR(20)  NULL,
        country      NVARCHAR(60)  NOT NULL,
        is_default   BIT           NOT NULL CONSTRAINT DF_addresses_is_default DEFAULT (0),
        CONSTRAINT PK_addresses          PRIMARY KEY (address_id),
        CONSTRAINT FK_addresses_customer FOREIGN KEY (customer_id) REFERENCES dbo.customers (customer_id),
        CONSTRAINT CK_addresses_type     CHECK (address_type IN ('BILLING', 'SHIPPING', 'HOME'))
    );
END
GO

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.products', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.products (
        product_id  INT            IDENTITY(1,1) NOT NULL,
        category_id INT            NOT NULL,
        name        NVARCHAR(140)  NOT NULL,
        description NVARCHAR(400)   NULL,
        price       DECIMAL(10,2)  NOT NULL,
        stock       INT            NOT NULL CONSTRAINT DF_products_stock DEFAULT (0),
        status      NVARCHAR(12)   NOT NULL CONSTRAINT DF_products_status DEFAULT ('ACTIVE'),
        created_at  DATETIME2(0)   NOT NULL CONSTRAINT DF_products_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_products          PRIMARY KEY (product_id),
        CONSTRAINT FK_products_category FOREIGN KEY (category_id) REFERENCES dbo.categories (category_id),
        CONSTRAINT CK_products_price    CHECK (price >= 0),
        CONSTRAINT CK_products_stock    CHECK (stock >= 0),
        CONSTRAINT CK_products_status   CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED'))
    );
END
GO

-- ----------------------------------------------------------------------------
-- orders
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.orders', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.orders (
        order_id            INT            IDENTITY(1,1) NOT NULL,
        customer_id         INT            NOT NULL,
        order_date          DATETIME2(0)   NOT NULL,
        status              NVARCHAR(12)   NOT NULL,
        subtotal            DECIMAL(12,2)  NOT NULL CONSTRAINT DF_orders_subtotal DEFAULT (0),
        tax                 DECIMAL(12,2)  NOT NULL CONSTRAINT DF_orders_tax DEFAULT (0),
        shipping_cost       DECIMAL(12,2)  NOT NULL CONSTRAINT DF_orders_shipping DEFAULT (0),
        total               DECIMAL(12,2)  NOT NULL CONSTRAINT DF_orders_total DEFAULT (0),
        shipping_address_id INT            NULL,
        CONSTRAINT PK_orders          PRIMARY KEY (order_id),
        CONSTRAINT FK_orders_customer FOREIGN KEY (customer_id) REFERENCES dbo.customers (customer_id),
        CONSTRAINT FK_orders_address  FOREIGN KEY (shipping_address_id) REFERENCES dbo.addresses (address_id),
        CONSTRAINT CK_orders_status   CHECK (status IN
            ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
        CONSTRAINT CK_orders_amounts  CHECK (subtotal >= 0 AND tax >= 0 AND shipping_cost >= 0 AND total >= 0)
    );
END
GO

-- ----------------------------------------------------------------------------
-- order_items  (tabla intermedia orders <-> products)
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.order_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.order_items (
        order_item_id INT            IDENTITY(1,1) NOT NULL,
        order_id      INT            NOT NULL,
        product_id    INT            NOT NULL,
        quantity      INT            NOT NULL,
        unit_price    DECIMAL(10,2)  NOT NULL,
        discount      DECIMAL(10,2)  NOT NULL CONSTRAINT DF_order_items_discount DEFAULT (0),
        subtotal      DECIMAL(12,2)  NOT NULL,
        CONSTRAINT PK_order_items               PRIMARY KEY (order_item_id),
        CONSTRAINT FK_order_items_order         FOREIGN KEY (order_id) REFERENCES dbo.orders (order_id),
        CONSTRAINT FK_order_items_product       FOREIGN KEY (product_id) REFERENCES dbo.products (product_id),
        CONSTRAINT UQ_order_items_order_product UNIQUE (order_id, product_id),
        CONSTRAINT CK_order_items_qty           CHECK (quantity > 0),
        CONSTRAINT CK_order_items_prices        CHECK (unit_price >= 0 AND discount >= 0 AND subtotal >= 0)
    );
END
GO

-- ----------------------------------------------------------------------------
-- payments
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.payments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.payments (
        payment_id            INT            IDENTITY(1,1) NOT NULL,
        order_id              INT            NOT NULL,
        payment_date          DATETIME2(0)   NOT NULL,
        payment_method        NVARCHAR(20)   NOT NULL,
        amount                DECIMAL(12,2)  NOT NULL,
        status                NVARCHAR(12)   NOT NULL,
        transaction_reference NVARCHAR(40)   NOT NULL,
        CONSTRAINT PK_payments        PRIMARY KEY (payment_id),
        CONSTRAINT FK_payments_order  FOREIGN KEY (order_id) REFERENCES dbo.orders (order_id),
        CONSTRAINT UQ_payments_txn    UNIQUE (transaction_reference),
        CONSTRAINT CK_payments_amount CHECK (amount >= 0),
        CONSTRAINT CK_payments_method CHECK (payment_method IN
            ('CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'CASH_ON_DELIVERY')),
        CONSTRAINT CK_payments_status CHECK (status IN
            ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'))
    );
END
GO

-- ----------------------------------------------------------------------------
-- shipments
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.shipments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.shipments (
        shipment_id     INT           IDENTITY(1,1) NOT NULL,
        order_id        INT           NOT NULL,
        shipment_date   DATETIME2(0)  NULL,
        delivery_date   DATETIME2(0)  NULL,
        carrier         NVARCHAR(40)  NULL,
        tracking_number NVARCHAR(50)  NULL,
        status          NVARCHAR(12)  NOT NULL,
        CONSTRAINT PK_shipments         PRIMARY KEY (shipment_id),
        CONSTRAINT FK_shipments_order   FOREIGN KEY (order_id) REFERENCES dbo.orders (order_id),
        CONSTRAINT UQ_shipments_tracking UNIQUE (tracking_number),
        CONSTRAINT CK_shipments_status  CHECK (status IN
            ('PREPARING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'))
    );
END
GO

-- ----------------------------------------------------------------------------
-- Indices  (FK, fechas, estados, email, relaciones frecuentes)
-- SQL Server NO indexa las FK automaticamente: se declaran de forma explicita.
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.customers', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_customers_status' AND object_id = OBJECT_ID(N'dbo.customers'))
        CREATE INDEX ix_customers_status       ON dbo.customers (status);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_customers_city' AND object_id = OBJECT_ID(N'dbo.customers'))
        CREATE INDEX ix_customers_city         ON dbo.customers (city);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_customers_country' AND object_id = OBJECT_ID(N'dbo.customers'))
        CREATE INDEX ix_customers_country      ON dbo.customers (country);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_customers_registration' AND object_id = OBJECT_ID(N'dbo.customers'))
        CREATE INDEX ix_customers_registration ON dbo.customers (registration_date);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_addresses_customer' AND object_id = OBJECT_ID(N'dbo.addresses'))
    CREATE INDEX ix_addresses_customer ON dbo.addresses (customer_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_products_category' AND object_id = OBJECT_ID(N'dbo.products'))
    CREATE INDEX ix_products_category ON dbo.products (category_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_products_status' AND object_id = OBJECT_ID(N'dbo.products'))
    CREATE INDEX ix_products_status ON dbo.products (status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_products_price' AND object_id = OBJECT_ID(N'dbo.products'))
    CREATE INDEX ix_products_price ON dbo.products (price);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_orders_customer' AND object_id = OBJECT_ID(N'dbo.orders'))
    CREATE INDEX ix_orders_customer ON dbo.orders (customer_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_orders_date' AND object_id = OBJECT_ID(N'dbo.orders'))
    CREATE INDEX ix_orders_date ON dbo.orders (order_date);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_orders_status' AND object_id = OBJECT_ID(N'dbo.orders'))
    CREATE INDEX ix_orders_status ON dbo.orders (status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_orders_address' AND object_id = OBJECT_ID(N'dbo.orders'))
    CREATE INDEX ix_orders_address ON dbo.orders (shipping_address_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_order_items_order' AND object_id = OBJECT_ID(N'dbo.order_items'))
    CREATE INDEX ix_order_items_order ON dbo.order_items (order_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_order_items_product' AND object_id = OBJECT_ID(N'dbo.order_items'))
    CREATE INDEX ix_order_items_product ON dbo.order_items (product_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_payments_order' AND object_id = OBJECT_ID(N'dbo.payments'))
    CREATE INDEX ix_payments_order ON dbo.payments (order_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_payments_status' AND object_id = OBJECT_ID(N'dbo.payments'))
    CREATE INDEX ix_payments_status ON dbo.payments (status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_payments_method' AND object_id = OBJECT_ID(N'dbo.payments'))
    CREATE INDEX ix_payments_method ON dbo.payments (payment_method);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_payments_date' AND object_id = OBJECT_ID(N'dbo.payments'))
    CREATE INDEX ix_payments_date ON dbo.payments (payment_date);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_shipments_order' AND object_id = OBJECT_ID(N'dbo.shipments'))
    CREATE INDEX ix_shipments_order ON dbo.shipments (order_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_shipments_status' AND object_id = OBJECT_ID(N'dbo.shipments'))
    CREATE INDEX ix_shipments_status ON dbo.shipments (status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_shipments_date' AND object_id = OBJECT_ID(N'dbo.shipments'))
    CREATE INDEX ix_shipments_date ON dbo.shipments (shipment_date);
GO
