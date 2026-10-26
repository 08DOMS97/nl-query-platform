#!/usr/bin/env python3
# ============================================================================
#  generar_seed.py  -  Generador determinista del dataset de pruebas NL2SQL
# ----------------------------------------------------------------------------
#  Un unico modelo en memoria -> datos IDENTICOS (mismos valores logicos) para
#  los 4 motores, cada uno con su dialecto SQL. Semilla fija => reproducible.
#
#  Por que identico entre motores (y no "datos distintos por motor"):
#  el banco se usa para probar NL2SQL; la misma pregunta en lenguaje natural
#  debe poder compararse fila a fila entre PostgreSQL, MySQL, MariaDB y
#  SQL Server (equivalencia semantica de resultados). Los datos NO son
#  repetitivos ni artificiales: nombres, ciudades, precios, fechas y estados
#  varian de forma realista; lo unico que se mantiene es que el conjunto
#  logico es el mismo en los 4 motores.
#
#  Uso:   python generar_seed.py
#  Salida:
#     init/postgres/03-seed.sql
#     init/mysql/02-seed.sql
#     init/mariadb/02-seed.sql
#     init/sqlserver/03-seed.sql
#
#  NO editar los .sql generados a mano: se sobrescriben. Cambiar el modelo aqui.
# ============================================================================

import os
from collections import Counter
import random
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

SEED = 20260907
TODAY = date(2026, 9, 7)          # fecha de referencia del entorno
HERE = os.path.dirname(os.path.abspath(__file__))

rnd = random.Random(SEED)

# ---------------------------------------------------------------------------
# Utilidades de dinero / fechas
# ---------------------------------------------------------------------------
CENT = Decimal("0.01")


def money(x) -> Decimal:
    return Decimal(str(x)).quantize(CENT, rounding=ROUND_HALF_UP)


def rand_dt(d0: date, d1: date) -> datetime:
    """datetime aleatorio entre dos fechas (hora laboral sesgada)."""
    days = (d1 - d0).days
    d = d0 + timedelta(days=rnd.randint(0, days))
    hour = rnd.choices(range(8, 22), weights=[3, 4, 5, 6, 6, 5, 4, 5, 6, 7, 6, 4, 3, 2])[0]
    return datetime(d.year, d.month, d.day, hour, rnd.choice([0, 5, 12, 17, 23, 30, 41, 48, 55]), rnd.choice([0, 11, 22, 37, 49]))


def wchoice(options, r=rnd):
    """options: lista de (valor, peso)."""
    vals, weights = zip(*options)
    return r.choices(vals, weights=weights)[0]


# ---------------------------------------------------------------------------
# 1. CATEGORIES (15)
# ---------------------------------------------------------------------------
CATEGORY_DEFS = [
    ("Electronics", "Consumer electronics, audio and video devices"),
    ("Computers", "Laptops, desktops, components and peripherals"),
    ("Smartphones", "Mobile phones and phone accessories"),
    ("Home & Kitchen", "Small appliances, cookware and kitchen tools"),
    ("Books", "Printed books across fiction and non-fiction"),
    ("Clothing", "Casual and formal apparel for all seasons"),
    ("Footwear", "Shoes, boots and sandals"),
    ("Sports & Outdoors", "Fitness gear, camping and outdoor equipment"),
    ("Toys & Games", "Toys, board games and puzzles"),
    ("Beauty & Personal Care", "Skincare, fragrances and grooming devices"),
    ("Groceries", "Shelf-stable food and beverages"),
    ("Automotive", "Car accessories and maintenance gadgets"),
    ("Garden & Tools", "Power tools, hand tools and garden equipment"),
    ("Office Supplies", "Furniture and stationery for the workspace"),
    ("Pet Supplies", "Beds, feeders and accessories for pets"),
]
INACTIVE_CATEGORIES = {12, 15}  # Automotive y Pet Supplies: categoria desactivada

categories = []
for i, (name, desc) in enumerate(CATEGORY_DEFS, start=1):
    categories.append({
        "category_id": i,
        "name": name,
        "description": desc,
        "active": i not in INACTIVE_CATEGORIES,
    })

# ---------------------------------------------------------------------------
# 2. PRODUCTS (100)
# ---------------------------------------------------------------------------
BRANDS = ["Acme", "Globex", "Umbra", "Initech", "Soylent", "Hooli", "Stark",
          "Wayne", "Wonka", "Vandelay", "Nakatomi", "Kixel"]

PRODUCT_CATALOG = {
    1:  (["4K Smart TV", "Soundbar", "Bluetooth Speaker", "Wireless Earbuds", "Action Camera",
          "Power Bank", "Smartwatch", "Streaming Stick", "Over-Ear Headphones", "AV Receiver"], 24.99, 1999.99),
    2:  (["UltraBook 14", "Gaming Laptop 16", "Desktop Tower", "Mechanical Keyboard", "Wireless Mouse",
          "27in Monitor", "Docking Station", "External SSD 1TB", "RAM Kit 32GB", "Graphics Card"], 34.99, 3499.99),
    3:  (["Smartphone X", "Smartphone Lite", "Smartphone Pro", "Rugged Phone", "Foldable Phone",
          "Silicone Case", "Screen Protector", "Fast Charger 65W", "USB-C Cable 2m"], 8.99, 1799.99),
    4:  (["Espresso Machine", "Air Fryer XL", "Countertop Blender", "10pc Cookware Set", "Chef Knife Set",
          "Robot Vacuum", "Stand Mixer", "4-Slice Toaster", "Electric Kettle"], 13.99, 899.99),
    5:  (["Mystery Novel", "Illustrated Cookbook", "Historical Biography", "Programming Guide",
          "Children Picture Book", "World History Atlas", "Popular Science Reader", "Poetry Collection"], 6.99, 74.99),
    6:  (["Cotton T-Shirt", "Slim Jeans", "Windbreaker Jacket", "Pullover Hoodie", "Summer Dress",
          "Knit Sweater", "Chino Shorts", "Rain Coat", "Oxford Shirt", "Ankle Socks 6-Pack"], 6.99, 189.99),
    7:  (["Road Running Shoes", "Canvas Sneakers", "Leather Chelsea Boots", "Beach Sandals",
          "Trail Hiking Boots", "Formal Derby Shoes"], 18.99, 239.99),
    8:  (["Yoga Mat Pro", "Adjustable Dumbbell Set", "4-Person Camping Tent", "Mummy Sleeping Bag",
          "City Bicycle", "Hiking Backpack 40L", "Insulated Water Bottle", "Resistance Band Set"], 9.99, 1299.99),
    9:  (["Strategy Board Game", "Building Blocks 500pc", "RC Rally Car", "Jigsaw Puzzle 1000pc",
          "Collectible Figure", "Plush Bear"], 8.99, 119.99),
    10: (["Hydrating Face Cream", "Eau de Parfum 100ml", "Ionic Hair Dryer", "Electric Shaver", "Makeup Starter Kit"], 5.99, 189.99),
    11: (["Arabica Coffee Beans 1kg", "Extra Virgin Olive Oil 1L", "Dark Chocolate Box", "Loose Leaf Tea Set"], 3.99, 44.99),
    12: (["Handheld Car Vacuum", "Full HD Dash Cam", "Portable Jump Starter", "Digital Tire Inflator"], 12.99, 289.99),
    13: (["20V Cordless Drill", "100pc Tool Set", "Expandable Garden Hose", "Electric Lawn Mower", "Bypass Pruning Shears"], 11.99, 549.99),
    14: (["Ergonomic Office Chair", "Electric Standing Desk", "LED Desk Lamp", "A5 Notebook 3-Pack"], 4.99, 469.99),
    15: (["Orthopedic Dog Bed", "Multi-Level Cat Tree", "Automatic Pet Feeder", "Travel Pet Carrier"], 15.99, 329.99),
}

# cuantos productos por categoria (suma = 100); "Computers" es la mayor
PRODUCTS_PER_CATEGORY = {
    1: 12, 2: 14, 3: 9, 4: 10, 5: 8, 6: 11, 7: 6, 8: 7, 9: 5,
    10: 4, 11: 3, 12: 2, 13: 3, 14: 3, 15: 3,
}
assert sum(PRODUCTS_PER_CATEGORY.values()) == 100

PROD_STATUS = [("ACTIVE", 82), ("INACTIVE", 10), ("DISCONTINUED", 8)]

products = []
pid = 0
for cat_id, count in PRODUCTS_PER_CATEGORY.items():
    nouns, lo, hi = PRODUCT_CATALOG[cat_id]
    for k in range(count):
        pid += 1
        noun = nouns[k % len(nouns)]
        brand = rnd.choice(BRANDS)
        base = rnd.uniform(lo, hi)
        cents = rnd.choice([Decimal("0.99"), Decimal("0.99"), Decimal("0.95"),
                            Decimal("0.49"), Decimal("0.00")])
        price = money(int(base)) + cents
        if price < money(lo):
            price = money(lo) + cents
        products.append({
            "product_id": pid,
            "category_id": cat_id,
            "name": f"{brand} {noun}" + (f" ({rnd.choice(['Gen2', 'Plus', 'Max', 'Mini', 'SE', 'Compact'])})"
                                        if rnd.random() < 0.35 else ""),
            "description": f"{noun} by {brand}. Model line {rnd.randint(100, 990)}.",
            "price": price,
            "stock": 0,           # se ajusta abajo
            "status": wchoice(PROD_STATUS),
            "created_at": rand_dt(date(2022, 7, 1), date(2025, 11, 30)),
        })

# stock: agotados, bajos y normales
idx = list(range(len(products)))
rnd.shuffle(idx)
zero_stock = set(idx[:10])          # agotados
low_stock = set(idx[10:26])         # 1..9
for i, p in enumerate(products):
    if i in zero_stock:
        p["stock"] = 0
    elif i in low_stock:
        p["stock"] = rnd.randint(1, 9)
    else:
        p["stock"] = rnd.choice([rnd.randint(10, 60), rnd.randint(10, 60),
                                 rnd.randint(60, 250), rnd.randint(250, 900)])

# producto mas caro: valor unico y claramente el mayor
products.sort(key=lambda p: p["product_id"])
top = max(products, key=lambda p: p["price"])
top["price"] = money("4999.99")
top["name"] = "Stark Graphics Card (Max)"

# productos que NUNCA se venden (referencia para "productos sin ventas")
never_sold = set(rnd.sample([p["product_id"] for p in products], 18))
sellable = [p for p in products if p["product_id"] not in never_sold]

# peso de popularidad (cola larga: pocos best-sellers, muchos de venta baja)
pop_weight = {}
for p in sellable:
    w = rnd.choice([1, 1, 1, 1, 2, 2, 2, 3, 3, 5, 8])
    pop_weight[p["product_id"]] = w
for star in rnd.sample([p["product_id"] for p in sellable], 8):
    pop_weight[star] = 28   # best-sellers claros

# ---------------------------------------------------------------------------
# 3. CUSTOMERS (200)
# ---------------------------------------------------------------------------
FIRST_NAMES = ["Ana", "Bruno", "Carla", "Diego", "Elena", "Fernando", "Gabriela", "Hector",
               "Isabel", "Javier", "Karla", "Luis", "Marta", "Nestor", "Olivia", "Pablo",
               "Rosa", "Sergio", "Tania", "Ulises", "Valeria", "Walter", "Ximena", "Yago",
               "Zoe", "Andres", "Beatriz", "Camilo", "Daniela", "Emilio", "Fabiola", "Gustavo",
               "Helena", "Ignacio", "Julia", "Kevin", "Lucia", "Mateo", "Natalia", "Oscar",
               "Paula", "Ramiro", "Sofia", "Tomas", "Ursula", "Victor", "Wendy", "Yolanda",
               "Ricardo", "Monica"]
LAST_NAMES = ["Gomez", "Diaz", "Ruiz", "Herrera", "Castro", "Morales", "Reyes", "Cruz",
              "Flores", "Ortega", "Ramirez", "Vargas", "Mendoza", "Aguilar", "Rojas",
              "Navarro", "Cabrera", "Fuentes", "Salazar", "Cordoba", "Pineda", "Marroquin",
              "Interiano", "Batres", "Solis", "Escobar", "Palacios", "Quinonez", "Barrios",
              "Godoy", "Lemus", "Archila", "Villatoro", "Chavez", "Estrada", "Franco",
              "Guerra", "Ibanez", "Juarez", "Del Cid"]
# dominios RFC 2606 reservados: nunca corresponden a buzones reales
EMAIL_DOMAINS = ["example.com", "example.org", "example.net", "mail.example.com"]

# (peso, pais, ciudad, estado/departamento, prefijo telefonico)
LOCATIONS = [
    (52, "Guatemala", "Guatemala City", "Guatemala", "+502"),
    (14, "Guatemala", "Mixco", "Guatemala", "+502"),
    (12, "Guatemala", "Villa Nueva", "Guatemala", "+502"),
    (8,  "Guatemala", "Quetzaltenango", "Quetzaltenango", "+502"),
    (6,  "Guatemala", "Escuintla", "Escuintla", "+502"),
    (5,  "Guatemala", "Antigua Guatemala", "Sacatepequez", "+502"),
    (4,  "Guatemala", "Coban", "Alta Verapaz", "+502"),
    (10, "Mexico", "Mexico City", "CDMX", "+52"),
    (6,  "Mexico", "Guadalajara", "Jalisco", "+52"),
    (5,  "Mexico", "Monterrey", "Nuevo Leon", "+52"),
    (10, "El Salvador", "San Salvador", "San Salvador", "+503"),
    (4,  "El Salvador", "Santa Ana", "Santa Ana", "+503"),
    (6,  "Honduras", "Tegucigalpa", "Francisco Morazan", "+504"),
    (4,  "Honduras", "San Pedro Sula", "Cortes", "+504"),
    (9,  "United States", "Miami", "Florida", "+1"),
    (6,  "United States", "Houston", "Texas", "+1"),
    (5,  "United States", "Los Angeles", "California", "+1"),
    (8,  "Spain", "Madrid", "Madrid", "+34"),
    (5,  "Spain", "Barcelona", "Cataluna", "+34"),
    (7,  "Colombia", "Bogota", "Bogota DC", "+57"),
    (5,  "Colombia", "Medellin", "Antioquia", "+57"),
    (4,  "Costa Rica", "San Jose", "San Jose", "+506"),
    (3,  "Panama", "Panama City", "Panama", "+507"),
]
LOC_POP = [(loc, loc[0]) for loc in LOCATIONS]

CUST_STATUS = [("ACTIVE", 80), ("INACTIVE", 20)]

customers = []
used_emails = set()
used_names = set()
for cid in range(1, 201):
    while True:
        fn = rnd.choice(FIRST_NAMES)
        ln = rnd.choice(LAST_NAMES)
        if (fn, ln) not in used_names:
            used_names.add((fn, ln))
            break
    loc = wchoice(LOC_POP)
    _, country, city, state, phone_prefix = loc
    base_email = f"{fn}.{ln}".lower().replace(" ", "")
    email = f"{base_email}@{rnd.choice(EMAIL_DOMAINS)}"
    if email in used_emails:
        email = f"{base_email}{cid}@{rnd.choice(EMAIL_DOMAINS)}"
    used_emails.add(email)
    reg = date(2023, 1, 1) + timedelta(days=rnd.randint(0, (TODAY - date(2023, 1, 1)).days - 1))
    dob = date(1955, 1, 1) + timedelta(days=rnd.randint(0, (date(2006, 12, 31) - date(1955, 1, 1)).days))
    customers.append({
        "customer_id": cid,
        "first_name": fn,
        "last_name": ln,
        "email": email,
        "phone": f"{phone_prefix} {rnd.randint(2000, 9999)} {rnd.randint(1000, 9999)}",
        "date_of_birth": dob,
        "registration_date": reg,
        "status": wchoice(CUST_STATUS),
        "country": country,
        "city": city,
        "_state": state,
    })

# ---------------------------------------------------------------------------
# 4. ADDRESSES (~250)
# ---------------------------------------------------------------------------
STREETS = ["Avenida Reforma", "Calzada Roosevelt", "Boulevard Los Proceres", "Calle Real",
           "Avenida Las Americas", "Diagonal 6", "Ruta 4", "Via 5", "Calle Principal",
           "Avenida Petapa", "Calzada Aguilar Batres", "Calle del Comercio", "Paseo Central",
           "Avenida Central", "Calle Norte", "Carrera 15", "Gran Via", "Main Street",
           "Oak Avenue", "Sunset Boulevard"]
ADDR_TYPES = ["HOME", "BILLING", "SHIPPING"]

addresses = []
addr_id = 0
cust_addresses = {c["customer_id"]: [] for c in customers}
# 50 clientes con 2 direcciones, el resto con 1  => 250
two_addr = set(rnd.sample([c["customer_id"] for c in customers], 50))
for c in customers:
    n = 2 if c["customer_id"] in two_addr else 1
    for j in range(n):
        addr_id += 1
        is_default = (j == 0)
        addresses.append({
            "address_id": addr_id,
            "customer_id": c["customer_id"],
            "address_type": "HOME" if is_default else rnd.choice(["BILLING", "SHIPPING"]),
            "address_line": f"{rnd.randint(1, 480)} {rnd.choice(STREETS)}"
                            + (f", Apt {rnd.randint(1, 40)}" if rnd.random() < 0.3 else ""),
            "city": c["city"] if (is_default or rnd.random() < 0.7) else rnd.choice([l[2] for l in LOCATIONS if l[1] == c["country"]] or [c["city"]]),
            "state": c["_state"],
            "postal_code": f"{rnd.randint(1000, 99999):05d}",
            "country": c["country"],
            "is_default": is_default,
        })
    cust_addresses[c["customer_id"]] = [a["address_id"] for a in addresses if a["customer_id"] == c["customer_id"]]

# ---------------------------------------------------------------------------
# 5. ORDERS (300) - distribucion desigual de pedidos por cliente
# ---------------------------------------------------------------------------
#  55 clientes  -> 0 pedidos
#  60 clientes  -> 1
#  45 clientes  -> 2
#  22 clientes  -> 3
#  12 clientes  -> 4
#   4 clientes  -> 5
#   1 cliente   -> 7
#   1 cliente   -> 9   (maximo claro)
ORDER_PLAN = ([0] * 55) + ([1] * 60) + ([2] * 45) + ([3] * 22) + ([4] * 12) + ([5] * 4) + [7, 9]
assert len(ORDER_PLAN) == 200
assert sum(ORDER_PLAN) == 300
rnd.shuffle(ORDER_PLAN)
orders_count_by_customer = dict(zip([c["customer_id"] for c in customers], ORDER_PLAN))

YEAR_WEIGHTS = [(2023, 18), (2024, 27), (2025, 34), (2026, 21)]
MONTH_WEIGHTS = [1.0, 0.9, 1.0, 1.0, 1.05, 1.0, 1.15, 1.0, 1.0, 1.1, 1.25, 1.5]  # Dic sesgado


def rand_order_date():
    year = wchoice(YEAR_WEIGHTS)
    month = rnd.choices(range(1, 13), weights=MONTH_WEIGHTS)[0]
    if year == 2026 and month > 8:
        month = rnd.randint(1, 8)
    if year == 2026 and month == 8:
        day = rnd.randint(1, 31)
    else:
        day = rnd.randint(1, 28)
    hour = rnd.choices(range(8, 22))[0]
    return datetime(year, month, day, hour, rnd.choice([0, 9, 18, 27, 36, 45, 54]), rnd.choice([0, 15, 30, 45]))


def pick_order_status(odate: datetime, r=rnd) -> str:
    days_old = (TODAY - odate.date()).days
    if days_old > 60:
        st = wchoice([("DELIVERED", 70), ("CANCELLED", 13), ("SHIPPED", 6),
                      ("PROCESSING", 4), ("CONFIRMED", 4), ("PENDING", 3)], r)
    elif days_old > 21:
        st = wchoice([("DELIVERED", 38), ("SHIPPED", 18), ("PROCESSING", 12),
                      ("CONFIRMED", 10), ("CANCELLED", 14), ("PENDING", 8)], r)
    else:
        st = wchoice([("PENDING", 30), ("CONFIRMED", 24), ("PROCESSING", 20),
                      ("SHIPPED", 12), ("CANCELLED", 10), ("DELIVERED", 4)], r)
    if st == "DELIVERED" and days_old < 12:
        st = "SHIPPED"
    return st


SHIP_COSTS = [Decimal("0.00"), Decimal("0.00"), Decimal("4.99"), Decimal("9.99"),
              Decimal("14.99"), Decimal("19.99"), Decimal("29.99")]

orders = []
order_items = []
oid = 0
oi_id = 0
for c in customers:
    for _ in range(orders_count_by_customer[c["customer_id"]]):
        oid += 1
        odate = rand_order_date()
        status = pick_order_status(odate)
        # --- items ---
        k = wchoice([(1, 20), (2, 28), (3, 27), (4, 15), (5, 10)])
        chosen = rnd.sample(sellable, min(k, len(sellable)))
        # respetar popularidad: re-muestrear con peso
        pool = rnd.choices(sellable, weights=[pop_weight[p["product_id"]] for p in sellable], k=k * 3)
        seen, chosen = set(), []
        for p in pool:
            if p["product_id"] not in seen:
                seen.add(p["product_id"])
                chosen.append(p)
            if len(chosen) == k:
                break
        sub_total = Decimal("0.00")
        this_items = []
        for p in chosen:
            oi_id += 1
            qty = wchoice([(1, 34), (2, 26), (3, 18), (4, 10), (5, 7), (6, 5)])
            unit = p["price"]
            gross = money(unit * qty)
            if rnd.random() < 0.18:
                disc = money(gross * Decimal(str(rnd.choice([0.05, 0.10, 0.15, 0.20]))))
                if disc >= gross:
                    disc = money(gross * Decimal("0.10"))
            else:
                disc = Decimal("0.00")
            line = money(gross - disc)
            sub_total += line
            this_items.append({
                "order_item_id": oi_id,
                "order_id": oid,
                "product_id": p["product_id"],
                "quantity": qty,
                "unit_price": unit,
                "discount": disc,
                "subtotal": line,
            })
        tax = money(sub_total * Decimal("0.12"))
        shipping = Decimal("0.00") if sub_total > Decimal("400") and rnd.random() < 0.6 else rnd.choice(SHIP_COSTS)
        total = money(sub_total + tax + shipping)
        ship_addr = rnd.choice(cust_addresses[c["customer_id"]]) if cust_addresses[c["customer_id"]] else None
        orders.append({
            "order_id": oid,
            "customer_id": c["customer_id"],
            "order_date": odate,
            "status": status,
            "subtotal": sub_total,
            "tax": tax,
            "shipping_cost": shipping,
            "total": total,
            "shipping_address_id": ship_addr,
        })
        order_items.extend(this_items)

# ---------------------------------------------------------------------------
# 6. PAYMENTS (~300)
# ---------------------------------------------------------------------------
PAY_METHODS = [("CREDIT_CARD", 40), ("DEBIT_CARD", 20), ("PAYPAL", 15),
               ("BANK_TRANSFER", 15), ("CASH_ON_DELIVERY", 10)]

payments = []
pay_id = 0
txn_seq = 0


def next_txn(dt: datetime) -> str:
    global txn_seq
    txn_seq += 1
    return f"TXN-{dt.year}-{txn_seq:06d}"


def add_payment(order, pdate, method, amount, status):
    global pay_id
    pay_id += 1
    payments.append({
        "payment_id": pay_id,
        "order_id": order["order_id"],
        "payment_date": pdate,
        "payment_method": method,
        "amount": amount,
        "status": status,
        "transaction_reference": next_txn(pdate),
    })


def make_payments(o, r=rnd, methods=PAY_METHODS):
    """Pagos de un pedido, coherentes con su estado."""
    vals, weights = zip(*methods)
    method = r.choices(vals, weights=weights)[0]
    p_base = o["order_date"] + timedelta(days=r.randint(0, 3),
                                        hours=r.randint(0, 20), minutes=r.choice([0, 15, 30, 45]))
    st = o["status"]
    if st in ("DELIVERED", "SHIPPED"):
        if r.random() < 0.15:
            add_payment(o, p_base, method, o["total"], "FAILED")
            add_payment(o, p_base + timedelta(hours=r.randint(1, 30)), method, o["total"], "COMPLETED")
        else:
            add_payment(o, p_base, method, o["total"], "COMPLETED")
    elif st in ("PROCESSING", "CONFIRMED"):
        if r.random() < 0.7:
            add_payment(o, p_base, method, o["total"], "COMPLETED")
        else:
            add_payment(o, p_base, method, o["total"], "PENDING")
    elif st == "PENDING":
        if r.random() < 0.6:
            add_payment(o, p_base, method, o["total"], "PENDING")
    elif st == "CANCELLED":
        x = r.random()
        if x < 0.45:
            add_payment(o, p_base, method, o["total"], "COMPLETED")
            add_payment(o, p_base + timedelta(days=r.randint(1, 10)), method, o["total"], "REFUNDED")
        elif x < 0.75:
            add_payment(o, p_base, method, o["total"], "FAILED")


for o in orders:
    make_payments(o)

# ---------------------------------------------------------------------------
# 7. SHIPMENTS (~250)
# ---------------------------------------------------------------------------
CARRIERS = [("DHL", "DH"), ("FedEx", "FX"), ("UPS", "UP"),
            ("Guatex", "GX"), ("Cargo Expreso", "CE"), ("Forza Delivery", "FZ")]

shipments = []
shp_id = 0
trk_seq = 0

def make_shipment(o, r=rnd, carriers=CARRIERS, tracking=None):
    """Envio de un pedido (o ninguno), coherente con su estado."""
    global shp_id, trk_seq
    st = o["status"]
    make = False
    s_status = None
    if st == "DELIVERED":
        make, s_status = True, "DELIVERED"
    elif st == "SHIPPED":
        vals, weights = zip(*[("SHIPPED", 55), ("IN_TRANSIT", 45)])
        make, s_status = True, r.choices(vals, weights=weights)[0]
    elif st == "PROCESSING":
        if r.random() < 0.6:
            make, s_status = True, "PREPARING"
    elif st == "CONFIRMED":
        if r.random() < 0.2:
            make, s_status = True, "PREPARING"
    elif st == "CANCELLED":
        if r.random() < 0.15:
            make, s_status = True, "RETURNED"
    if not make:
        return
    shp_id += 1
    trk_seq += 1
    carrier, prefix = r.choice(carriers)
    if s_status == "PREPARING":
        ship_date = None
        deliv_date = None
    else:
        ship_date = o["order_date"] + timedelta(days=r.randint(1, 5),
                                                hours=r.randint(0, 10))
        if s_status == "DELIVERED":
            deliv_date = ship_date + timedelta(days=r.randint(1, 9), hours=r.randint(0, 12))
            if deliv_date.date() > TODAY:
                deliv_date = datetime(TODAY.year, TODAY.month, TODAY.day, 12, 0, 0)
        elif s_status == "RETURNED":
            deliv_date = ship_date + timedelta(days=r.randint(3, 15))
            if deliv_date.date() > TODAY:
                deliv_date = None
        else:
            deliv_date = None
    shipments.append({
        "shipment_id": shp_id,
        "order_id": o["order_id"],
        "shipment_date": ship_date,
        "delivery_date": deliv_date,
        "carrier": carrier,
        "tracking_number": tracking(carrier, prefix, r) if tracking else f"{prefix}{r.randint(10, 99)}{trk_seq:07d}",
        "status": s_status,
    })


for o in orders:
    make_shipment(o)

# ===========================================================================
#  8. VOLUMEN  (banco para medir eficiencia con EXPLAIN)
# ---------------------------------------------------------------------------
#  Las filas de las secciones 1-7 (dataset base) NO cambian: el volumen se
#  genera despues, con su propio generador aleatorio, y continua sus ids.
#  Sale en archivos aparte (NN-volumen.sql.gz) que cada motor carga despues
#  del seed base. Mismos datos logicos en los 4 motores.
#
#  Realismo: clientes con nombres, telefonos y direcciones con el formato de
#  su pais; pedidos posteriores al registro del cliente y del producto;
#  estacionalidad (diciembre, Black Friday, Hot Sale, quincena, fin de
#  semana); ids de pedidos en orden cronologico; metodos de pago y
#  transportistas segun el pais; productos descontinuados que dejan de venderse.
# ===========================================================================
import gzip
import math

import catalogo_volumen as cv

VOL_SEED = SEED + 1
VOL_CUSTOMERS_TOTAL = 50_000
VOL_PRODUCTS_TOTAL = 2_000
VOL_ORDERS_TOTAL = 250_000
VOL_ORDER_END = date(2026, 9, 6)        # ultimo dia con pedidos (TODAY - 1)
CATEGORY_INACTIVE_SINCE = datetime(2025, 6, 1)   # Automotive y Pet Supplies

BASE_COUNTS = {
    "categories": len(categories), "customers": len(customers), "addresses": len(addresses),
    "products": len(products), "orders": len(orders), "order_items": len(order_items),
    "payments": len(payments), "shipments": len(shipments),
}
BASE_COUNTERS = (pay_id, txn_seq, shp_id, trk_seq)

HOUR_WEIGHTS = [1, 0.6, 0.3, 0.2, 0.2, 0.4, 1, 2, 3.5, 5, 6, 6.5, 7, 6.5, 6, 6, 6.5, 7, 7.5,
                8, 8.5, 7.5, 5, 2.5]
WEEKDAY_WEIGHTS = [1.08, 1.02, 1.0, 1.0, 1.05, 0.88, 0.82]


def _black_friday(year):
    d = date(year, 11, 1)
    fridays = [d + timedelta(days=i) for i in range(30) if (d + timedelta(days=i)).weekday() == 4]
    return fridays[3]


PROMO_DAYS = set()
for _y in (2023, 2024, 2025):
    _bf = _black_friday(_y)
    PROMO_DAYS.update(_bf + timedelta(days=i) for i in range(-1, 4))     # jueves a lunes (Cyber Monday)
for _y in (2023, 2024, 2025, 2026):
    PROMO_DAYS.update(date(_y, 5, 25) + timedelta(days=i) for i in range(5))  # Hot Sale


def season_weight(d: date) -> float:
    w = MONTH_WEIGHTS[d.month - 1] * WEEKDAY_WEIGHTS[d.weekday()]
    if d in PROMO_DAYS:
        w *= 2.6 if d.month == 11 else 1.6
    if d.day in (1, 15, 16, 30, 31):    # quincena
        w *= 1.15
    return w


MAX_SEASON = max(season_weight(date(2023, 1, 1) + timedelta(days=i)) for i in range(1400))


def money_price(r, lo, hi):
    """Precio con terminacion comercial, log-uniforme entre lo y hi."""
    base = math.exp(r.uniform(math.log(lo), math.log(hi)))
    if base < 20:
        cents = r.choice(["0.99", "0.99", "0.49", "0.50", "0.75"])
    else:
        cents = r.choice(["0.99", "0.99", "0.99", "0.95", "0.49", "0.00"])
    return money(int(base)) + Decimal(cents)


def make_phone(r, country, prefix, area):
    if country == "Guatemala":
        return f"+502 {r.choice('2345553')}{r.randint(0, 999):03d} {r.randint(0, 9999):04d}"
    if country == "Mexico":
        if len(area) == 2:
            return f"+52 {area} {r.randint(1000, 9999)} {r.randint(0, 9999):04d}"
        return f"+52 {area} {r.randint(100, 999)} {r.randint(0, 9999):04d}"
    if country == "El Salvador":
        return f"+503 {r.choice('7762')}{r.randint(0, 999):03d} {r.randint(0, 9999):04d}"
    if country == "Honduras":
        return f"+504 {r.choice('9983')}{r.randint(0, 999):03d} {r.randint(0, 9999):04d}"
    if country == "Costa Rica":
        return f"+506 {r.choice('8862')}{r.randint(0, 999):03d} {r.randint(0, 9999):04d}"
    if country == "Panama":
        return f"+507 6{r.randint(0, 999):03d} {r.randint(0, 9999):04d}"
    if country == "Colombia":
        return f"+57 3{r.randint(0, 50):02d} {r.randint(100, 999)} {r.randint(0, 9999):04d}"
    if country == "Spain":
        return f"+34 6{r.randint(0, 99):02d} {r.randint(100, 999)} {r.randint(100, 999)}"
    return f"+1 {area} {r.randint(200, 999)} {r.randint(0, 9999):04d}"


GT_ZONAS_CAPITAL = [1, 2, 5, 6, 7, 7, 10, 11, 11, 12, 13, 14, 15, 16, 17, 18, 18, 21]


def make_address(r, loc):
    """(address_line, postal_code) con el formato del pais."""
    _, country, city, state, _, pc, _ = loc
    if country == "Guatemala":
        if city == "Guatemala City":
            zona = r.choice(GT_ZONAS_CAPITAL)
        else:
            zona = r.randint(1, 6)
        x = r.random()
        if x < 0.45:
            line = f"{r.randint(1, 32)} Calle {r.randint(1, 40)}-{r.randint(1, 99):02d}, Zona {zona}"
        elif x < 0.85:
            line = f"{r.randint(1, 20)}a Avenida {r.randint(1, 40)}-{r.randint(1, 99):02d}, Zona {zona}"
        else:
            line = f"{r.choice(cv.GT_COLONIAS)}, Lote {r.randint(1, 80)}, Zona {zona}"
        if r.random() < 0.15:
            line += f", Apto {r.randint(1, 20)}{r.choice('ABCD')}"
        postal = f"{pc}{zona:02d}" if city == "Guatemala City" else f"{pc}{r.randint(1, 9):02d}"
    elif country == "Mexico":
        line = f"{r.choice(cv.MX_CALLES)} {r.randint(10, 3999)}, {r.choice(cv.MX_COLONIAS)}"
        if r.random() < 0.25:
            line += f", Int. {r.randint(1, 30)}"
        postal = f"{pc}{r.randint(0, 999):03d}"
    elif country in ("El Salvador", "Honduras"):
        line = f"{r.choice(cv.SV_HN_CALLES)} #{r.randint(100, 4999)}"
        postal = f"{pc}{r.randint(101, 999)}"
    elif country == "United States":
        line = f"{r.randint(100, 19999)} {r.choice(cv.US_CALLES)}"
        if r.random() < 0.3:
            line += f", Apt {r.randint(1, 40)}{r.choice(['', 'A', 'B'])}"
        postal = f"{pc}{r.randint(1, 99):02d}"
    elif country == "Spain":
        line = f"{r.choice(cv.ES_CALLES)} {r.randint(1, 250)}, {r.randint(1, 9)}o {r.choice('ABCD')}"
        postal = f"{pc}{r.randint(1, 50):02d}"
    elif country == "Colombia":
        line = f"{r.choice(cv.CO_VIAS)} {r.randint(1, 170)} # {r.randint(1, 120)}-{r.randint(1, 99):02d}"
        if r.random() < 0.3:
            line += f", Apto {r.randint(101, 1504)}"
        postal = f"{pc}{r.randint(1, 999):03d}"
    else:   # Costa Rica / Panama
        ref = r.choice(cv.CR_PA_REF)
        line = f"{city}, {ref}" + (f" {r.randint(1, 30)}" if ref.endswith(("piso", "casa")) else "")
        postal = f"{pc}{r.randint(101, 999)}" if country == "Costa Rica" else f"{pc}{r.randint(10, 99)}"
    return line, postal


def norm(s):
    return s.lower().replace(" ", "")


def tracking_number(carrier, prefix, r):
    """Formato propio de cada transportista; trk_seq lo hace unico."""
    if carrier == "DHL":
        return f"{r.randint(10, 99)}{trk_seq:08d}"
    if carrier == "FedEx":
        return f"{r.randint(1000, 9999)}{trk_seq:08d}"
    if carrier == "UPS":
        return f"1Z{r.randint(100, 999)}{r.choice('ABEFWX')}{r.randint(10, 99)}{trk_seq:08d}"
    return f"{prefix}-{trk_seq:08d}-{r.randint(0, 9)}"


def generate_volume(seed):
    """Genera el volumen sobre el dataset base. Devuelve las filas nuevas por tabla."""
    global pay_id, txn_seq, shp_id, trk_seq
    del payments[BASE_COUNTS["payments"]:]
    del shipments[BASE_COUNTS["shipments"]:]
    pay_id, txn_seq, shp_id, trk_seq = BASE_COUNTERS
    r = random.Random(seed)
    loc_pop = [(loc, loc[0]) for loc in cv.LOCATIONS]

    # ---- clientes ---------------------------------------------------------
    used_emails_v = {c["email"] for c in customers}
    start = date(2023, 1, 1)
    span = (TODAY - start).days - 1
    v_customers = []
    for _ in range(VOL_CUSTOMERS_TOTAL - len(customers)):
        loc = wchoice(loc_pop, r)
        _, country, city, state, prefix, _, area = loc
        if country == "United States" and r.random() < 0.45:
            fn, lns = r.choice(cv.ANGLO_FIRST), [r.choice(cv.ANGLO_LAST)]
        else:
            fn = r.choice(cv.FIRST_NAMES_F if r.random() < 0.52 else cv.FIRST_NAMES_M)
            lns = [r.choice(cv.LAST_NAMES)]
            if r.random() < 0.65:
                lns.append(r.choice([x for x in cv.LAST_NAMES if x != lns[0]]))
        if r.random() < 0.10:                # clientes del lanzamiento (primer trimestre)
            reg = start + timedelta(days=r.randint(0, 89))
        else:
            reg = start + timedelta(days=int(span * (r.random() ** (1 / 1.3))))
        age = r.triangular(18, 78, 31)
        dob = TODAY - timedelta(days=int(age * 365.25) + r.randint(0, 364))
        if date(dob.year + 18, 1, 1) > reg:
            dob = date(reg.year - 18 - r.randint(0, 3), r.randint(1, 12), r.randint(1, 28))
        f1, l1 = norm(fn.split()[0]), norm(lns[0])
        yy = f"{dob.year % 100:02d}"
        pattern = r.choice([f"{f1}.{l1}", f"{f1}{l1}", f"{f1[0]}{l1}", f"{f1}.{l1}{yy}",
                            f"{f1}_{l1}", f"{f1[0]}{l1}{norm(lns[-1])[0]}", f"{f1}{l1}{r.randint(1, 99)}"])
        domain = wchoice(cv.EMAIL_DOMAINS, r)
        email, n = f"{pattern}@{domain}", 1
        while email in used_emails_v:
            n += 1
            email = f"{pattern}{n}@{domain}"
        used_emails_v.add(email)
        v_customers.append({
            "first_name": fn, "last_name": " ".join(lns), "email": email,
            "phone": make_phone(r, country, prefix, area) if r.random() < 0.94 else None,
            "date_of_birth": dob if r.random() < 0.9 else None,
            "registration_date": reg,
            "status": "INACTIVE" if r.random() < 0.17 else "ACTIVE",
            "country": country, "city": city, "_loc": loc,
        })
    v_customers.sort(key=lambda c: c["registration_date"])
    for i, c in enumerate(v_customers, start=len(customers) + 1):
        c["customer_id"] = i

    # ---- direcciones ------------------------------------------------------
    v_addresses = []
    aid = len(addresses)
    by_country = {}
    for loc in cv.LOCATIONS:
        by_country.setdefault(loc[1], []).append((loc, loc[0]))
    for c in v_customers:
        n = wchoice([(1, 64), (2, 28), (3, 8)], r)
        c["_addr"] = []
        for j in range(n):
            if j == 0:
                loc, atype = c["_loc"], "HOME"
            else:
                x = r.random()
                if x < 0.70:
                    loc = c["_loc"]
                elif x < 0.97:
                    loc = wchoice(by_country[c["country"]], r)
                else:
                    loc = wchoice([lp for lp in loc_pop if lp[0][1] != c["country"]], r)
                atype = r.choice(["BILLING", "SHIPPING", "SHIPPING"])
            line, postal = make_address(r, loc)
            aid += 1
            v_addresses.append({
                "address_id": aid, "customer_id": c["customer_id"], "address_type": atype,
                "address_line": line, "city": loc[2], "state": loc[3], "postal_code": postal,
                "country": loc[1], "is_default": j == 0,
            })
            c["_addr"].append((aid, loc[1]))

    # ---- productos --------------------------------------------------------
    used_names = {p["name"] for p in products}
    high_prices = {p["price"] for p in products if p["price"] >= 1000}
    v_products = []
    cat_pop = list(PRODUCTS_PER_CATEGORY.items())
    for _ in range(VOL_PRODUCTS_TOTAL - len(products)):
        cat = wchoice(cat_pop, r)
        spec = cv.PRODUCT_CATALOG[cat]
        for _try in range(40):
            noun, lo, hi, variants = r.choice(spec["items"])
            brand, line, variant = r.choice(spec["brands"]), r.choice(spec["lines"]), r.choice(variants)
            if cat == 5:
                name = f"{noun}{variant}"
                if _try > 3:
                    name += f", {r.choice(['2nd', '3rd', '4th', '5th', '6th', '7th'])} Printing {r.randint(2019, 2026)}"
            else:
                model = f" {r.choice('ABCDEGHKLMRSTVX')}{r.randint(10, 990)}" if cat in (1, 2, 3, 4, 12, 13) else ""
                name = " ".join(x for x in (brand, line, noun) if x) + variant + model
            if name not in used_names:
                break
        used_names.add(name)
        price = money_price(r, lo, hi)
        while price >= 1000 and price in high_prices:
            price -= 1
        high_prices.add(price)
        feats = r.sample(spec["features"], 2)
        desc = (f"{noun}{variant}. Published by {brand}. {feats[0]}." if cat == 5
                else f"{noun}{variant} by {brand}. {feats[0]}. {feats[1]}.")
        x = r.random()
        stock = 0 if x < 0.05 else r.randint(1, 9) if x < 0.17 else r.choice(
            [r.randint(10, 60), r.randint(10, 60), r.randint(60, 300), r.randint(300, 1500)])
        status = wchoice([("ACTIVE", 84), ("INACTIVE", 8), ("DISCONTINUED", 8)], r)
        t = r.random() ** 0.85
        created = rand_dt(date(2022, 7, 1), date(2022, 7, 1) + timedelta(days=int(t * (date(2026, 8, 15) - date(2022, 7, 1)).days)))
        v_products.append({
            "category_id": cat, "name": name, "description": desc, "price": price,
            "stock": stock, "status": status, "created_at": created,
        })
    v_products.sort(key=lambda p: p["created_at"])
    for i, p in enumerate(v_products, start=len(products) + 1):
        p["product_id"] = i

    # disponibilidad y popularidad (base + nuevos; los "nunca vendidos" base siguen sin venta)
    demand = {1: 1.3, 2: 1.2, 3: 1.4, 4: 1.1, 5: 0.9, 6: 1.2, 7: 0.9, 8: 0.8, 9: 0.7,
              10: 1.0, 11: 1.3, 12: 0.5, 13: 0.7, 14: 0.8, 15: 0.6}
    never_v = set(r.sample([p["product_id"] for p in v_products], int(len(v_products) * 0.07)))
    catalog = []
    for p in products + v_products:
        if p["product_id"] in never_sold or p["product_id"] in never_v:
            continue
        end = None
        if p["status"] != "ACTIVE":
            span_days = max(120, (datetime(2026, 9, 1) - p["created_at"]).days)
            end = p["created_at"] + timedelta(days=r.randint(120, span_days))
        if p["category_id"] in INACTIVE_CATEGORIES:
            end = min(end, CATEGORY_INACTIVE_SINCE) if end else CATEGORY_INACTIVE_SINCE
        w = r.lognormvariate(0, 1.1) * demand[p["category_id"]] / (float(p["price"]) ** 0.35)
        catalog.append((p, end, w))
    for k in r.sample(range(len(catalog)), 25):        # best-sellers del volumen
        p, end, w = catalog[k]
        catalog[k] = (p, end, w * 12)

    month_avail = {}
    ms = datetime(2023, 1, 1)
    while ms.date() <= VOL_ORDER_END:
        ne = datetime(ms.year + (ms.month == 12), ms.month % 12 + 1, 1)
        av = [(p, w) for p, end, w in catalog if p["created_at"] < ms and (end is None or end >= ne)]
        cw, acc = [], 0.0
        for _, w in av:
            acc += w
            cw.append(acc)
        month_avail[(ms.year, ms.month)] = ([p for p, _ in av], cw)
        ms = ne

    # ---- pedidos ----------------------------------------------------------
    #  Primero cuantos pedidos hay cada mes (crecimiento + temporada); despues,
    #  a que cliente le toca cada uno, entre los ya registrados y aun activos.
    for c in customers + v_customers:
        if c["customer_id"] > len(customers) and c["status"] == "INACTIVE":
            last = c["registration_date"] + timedelta(
                days=int(r.random() * (VOL_ORDER_END - c["registration_date"]).days))
        else:
            last = VOL_ORDER_END             # activos y clientes base: siguen comprando
        c["_window"] = (c["registration_date"], last)
        buyer = r.random() >= (0.30 if c["status"] == "INACTIVE" else 0.20)
        c["_w"] = min(r.lognormvariate(0, 0.9), 12.0) if buyer else 0.0
    base_addr = {}
    for a in addresses:
        base_addr.setdefault(a["customer_id"], []).append((a["address_id"], a["country"]))
    for c in customers:
        c["_addr"] = base_addr.get(c["customer_id"], [])

    year_growth = {2023: 1.0, 2024: 1.56, 2025: 2.13, 2026: 2.29}
    months = []
    ms = date(2023, 1, 1)
    while ms <= VOL_ORDER_END:
        ne = date(ms.year + (ms.month == 12), ms.month % 12 + 1, 1)
        me = min(ne - timedelta(days=1), VOL_ORDER_END)
        months.append((ms, me, year_growth[ms.year] * MONTH_WEIGHTS[ms.month - 1]
                       * ((me - ms).days + 1) / (ne - ms).days))
        ms = ne
    n_new = VOL_ORDERS_TOTAL - len(orders)
    tot_w = sum(w for _, _, w in months)
    quota = [int(n_new * w / tot_w) for _, _, w in months]
    rest = sorted(range(len(months)), key=lambda i: -(n_new * months[i][2] / tot_w - quota[i]))
    for i in rest[:n_new - sum(quota)]:
        quota[i] += 1

    buyers = [c for c in customers + v_customers if c["_w"] > 0]
    used_ts = {o["order_date"] for o in orders}
    hours = list(range(24))
    plan = []
    for (ms, me, _), q in zip(months, quota):
        elig = [c for c in buyers if c["_window"][0] <= me and c["_window"][1] >= ms]
        for c in r.choices(elig, weights=[c["_w"] for c in elig], k=q):
            d0, d1 = max(ms, c["_window"][0]), min(me, c["_window"][1])
            while True:
                d = d0 + timedelta(days=r.randint(0, (d1 - d0).days))
                if r.random() * MAX_SEASON <= season_weight(d):
                    break
            while True:
                ts = datetime(d.year, d.month, d.day, r.choices(hours, weights=HOUR_WEIGHTS)[0],
                              r.randint(0, 59), r.randint(0, 59))
                if ts not in used_ts:
                    used_ts.add(ts)
                    break
            plan.append((ts, c))
    plan.sort(key=lambda x: x[0])

    v_orders, v_items = [], []
    oid_v, oi_v = len(orders), len(order_items)
    for ts, c in plan:
        oid_v += 1
        avail, cw = month_avail[(ts.year, ts.month)]
        promo = ts.date() in PROMO_DAYS or (ts.month == 12 and ts.day <= 23)
        k = wchoice([(1, 30), (2, 28), (3, 20), (4, 11), (5, 6), (6, 3), (7, 1), (8, 1)], r)
        seen, chosen = set(), []
        for p in r.choices(avail, cum_weights=cw, k=k * 3):
            if p["product_id"] not in seen:
                seen.add(p["product_id"])
                chosen.append(p)
                if len(chosen) == k:
                    break
        sub_total = Decimal("0.00")
        for p in chosen:
            oi_v += 1
            if p["price"] >= 300:
                qty = wchoice([(1, 86), (2, 11), (3, 3)], r)
            elif p["price"] >= 30:
                qty = wchoice([(1, 50), (2, 28), (3, 12), (4, 6), (5, 4)], r)
            else:
                qty = wchoice([(1, 30), (2, 25), (3, 18), (4, 10), (5, 7), (6, 5), (10, 3), (12, 2)], r)
            gross = money(p["price"] * qty)
            if r.random() < (0.45 if promo else 0.12):
                disc = money(gross * Decimal(r.choice(["0.05", "0.10", "0.15", "0.20", "0.25", "0.30"])))
            else:
                disc = Decimal("0.00")
            line = money(gross - disc)
            sub_total += line
            v_items.append({
                "order_item_id": oi_v, "order_id": oid_v, "product_id": p["product_id"],
                "quantity": qty, "unit_price": p["price"], "discount": disc, "subtotal": line,
            })
        addr_list = c["_addr"]
        if addr_list and (len(addr_list) == 1 or r.random() < 0.85):
            ship_addr, ship_country = addr_list[0]
        elif addr_list:
            ship_addr, ship_country = r.choice(addr_list[1:])
        else:
            ship_addr, ship_country = None, c["country"]
        if ship_country == "Guatemala":
            shipping = Decimal("0.00") if sub_total > Decimal("400") and r.random() < 0.7 else r.choice(SHIP_COSTS)
        else:
            shipping = Decimal("0.00") if sub_total > Decimal("1500") and r.random() < 0.5 else \
                r.choice([Decimal("19.99"), Decimal("24.99"), Decimal("34.99"), Decimal("49.99")])
        tax = money(sub_total * Decimal("0.12"))
        o = {
            "order_id": oid_v, "customer_id": c["customer_id"], "order_date": ts,
            "status": pick_order_status(ts, r), "subtotal": sub_total, "tax": tax,
            "shipping_cost": shipping, "total": money(sub_total + tax + shipping),
            "shipping_address_id": ship_addr,
        }
        v_orders.append(o)
        methods = (cv.PAY_METHODS_GT if ship_country == "Guatemala"
                   else cv.PAY_METHODS_US if ship_country == "United States" else cv.PAY_METHODS_OTHER)
        make_payments(o, r, methods)
        make_shipment(o, r, cv.CARRIERS_GT if ship_country == "Guatemala" else cv.CARRIERS_INTL,
                      tracking_number)

    return {
        "customers": v_customers, "addresses": v_addresses, "products": v_products,
        "orders": v_orders, "order_items": v_items,
        "payments": payments[BASE_COUNTS["payments"]:], "shipments": shipments[BASE_COUNTS["shipments"]:],
    }


def ties_in_references(vol):
    """Empates en el borde de un LIMIT de las 50 referencias: con empate, el
    resultado dependeria del motor. Devuelve las referencias afectadas."""
    all_p = products + vol["products"]
    all_c = customers + vol["customers"]
    all_o = orders + vol["orders"]
    all_i = order_items + vol["order_items"]
    pname = {p["product_id"]: p["name"] for p in all_p}
    pcat = {p["product_id"]: p["category_id"] for p in all_p}
    live = {o["order_id"] for o in all_o if o["status"] != "CANCELLED"}

    def distinct_top(values, n):
        top = sorted(values, reverse=True)[:n + 1]
        return len(set(top)) == len(top)

    def agg(pairs):
        out = {}
        for k, v in pairs:
            out[k] = out.get(k, 0) + v
        return out

    bad = []
    if not distinct_top([p["price"] for p in all_p], 10):
        bad.append("S03")
    if not distinct_top(list(agg((pname[i["product_id"]], i["quantity"]) for i in all_i).values()), 10):
        bad.append("M04")
    if not distinct_top(list(agg((c["city"], 1) for c in all_c).values()), 5):
        bad.append("M10")
    spend = agg((o["customer_id"], o["total"]) for o in all_o if o["status"] != "CANCELLED")
    if not distinct_top(list(spend.values()), 1):
        bad.append("C01")
    rev = agg(((pname[i["product_id"]], pcat[i["product_id"]]), i["subtotal"])
              for i in all_i if i["order_id"] in live)
    if not distinct_top(list(rev.values()), 5):
        bad.append("C08")
    cat_sales = agg((pcat[i["product_id"]], i["subtotal"]) for i in all_i if i["order_id"] in live)
    top_cat = max(cat_sales, key=cat_sales.get)
    units = agg((pname[i["product_id"]], i["quantity"]) for i in all_i
                if i["order_id"] in live and pcat[i["product_id"]] == top_cat)
    if not distinct_top(list(cat_sales.values()), 1) or not distinct_top(list(units.values()), 3):
        bad.append("C11")
    cnt = agg((o["customer_id"], 1) for o in all_o if o["status"] != "CANCELLED")
    if not distinct_top([money(spend[k] / cnt[k]) for k in cnt if cnt[k] > 1], 5):
        bad.append("C15")
    return bad


vol_seed = VOL_SEED
for _attempt in range(20):
    volume = generate_volume(vol_seed)
    _ties = ties_in_references(volume)
    if not _ties:
        break
    print(f"semilla de volumen {vol_seed}: empates en {', '.join(_ties)}; se prueba la siguiente")
    vol_seed += 1
else:
    raise SystemExit("no se encontro una semilla de volumen sin empates")
VOL_SEED_USED = vol_seed
del payments[BASE_COUNTS["payments"]:]        # el seed base sale solo con sus filas
del shipments[BASE_COUNTS["shipments"]:]


# ===========================================================================
#  SERIALIZACION SQL POR DIALECTO
# ===========================================================================


class Dialect:
    def __init__(self, key):
        self.key = key
        self.nprefix = "N" if key == "sqlserver" else ""

    def lit(self, v):
        if v is None:
            return "NULL"
        if isinstance(v, bool):
            if self.key == "postgres":
                return "TRUE" if v else "FALSE"
            return "1" if v else "0"
        if isinstance(v, Decimal):
            return str(v)
        if isinstance(v, int):
            return str(v)
        if isinstance(v, float):
            return str(money(v))
        if isinstance(v, datetime):
            if self.key == "sqlserver":
                return "'" + v.strftime("%Y-%m-%dT%H:%M:%S") + "'"
            return "'" + v.strftime("%Y-%m-%d %H:%M:%S") + "'"
        if isinstance(v, date):
            return "'" + v.strftime("%Y-%m-%d") + "'"
        s = str(v).replace("'", "''")
        return f"{self.nprefix}'{s}'"

    def table(self, name):
        return f"dbo.{name}" if self.key == "sqlserver" else name


def emit_insert(dia: Dialect, table, columns, rows, chunk=200):
    if not rows:
        return []
    out = []
    collist = ", ".join(columns)
    tname = dia.table(table)
    for i in range(0, len(rows), chunk):
        part = rows[i:i + chunk]
        vals = ",\n".join(
            "  (" + ", ".join(dia.lit(r.get(col)) for col in columns) + ")"
            for r in part
        )
        out.append(f"INSERT INTO {tname} ({collist}) VALUES\n{vals};")
    return out


CUST_COLS = ["customer_id", "first_name", "last_name", "email", "phone",
             "date_of_birth", "registration_date", "status", "country", "city"]
ADDR_COLS = ["address_id", "customer_id", "address_type", "address_line", "city",
             "state", "postal_code", "country", "is_default"]
CAT_COLS = ["category_id", "name", "description", "active"]
PROD_COLS = ["product_id", "category_id", "name", "description", "price", "stock", "status", "created_at"]
ORD_COLS = ["order_id", "customer_id", "order_date", "status", "subtotal", "tax",
            "shipping_cost", "total", "shipping_address_id"]
OI_COLS = ["order_item_id", "order_id", "product_id", "quantity", "unit_price", "discount", "subtotal"]
PAY_COLS = ["payment_id", "order_id", "payment_date", "payment_method", "amount",
            "status", "transaction_reference"]
SHP_COLS = ["shipment_id", "order_id", "shipment_date", "delivery_date", "carrier",
            "tracking_number", "status"]

TABLES = [
    ("categories", CAT_COLS, categories, "category_id"),
    ("customers", CUST_COLS, customers, "customer_id"),
    ("addresses", ADDR_COLS, addresses, "address_id"),
    ("products", PROD_COLS, products, "product_id"),
    ("orders", ORD_COLS, orders, "order_id"),
    ("order_items", OI_COLS, order_items, "order_item_id"),
    ("payments", PAY_COLS, payments, "payment_id"),
    ("shipments", SHP_COLS, shipments, "shipment_id"),
]

HEADER = """-- ============================================================================
--  {motor} - datos de prueba del banco NL2SQL
--  GENERADO por generar_seed.py (semilla {seed}). NO editar a mano.
--  Dataset e-commerce: categories, customers, addresses, products, orders,
--  order_items, payments, shipments. Mismos datos logicos en los 4 motores.
-- ============================================================================
"""


def build_postgres():
    d = Dialect("postgres")
    parts = [HEADER.format(motor="PostgreSQL 16", seed=SEED), "BEGIN;", ""]
    for name, cols, rows, pk in TABLES:
        parts.append(f"-- {name}: {len(rows)} filas")
        parts.extend(emit_insert(d, name, cols, rows))
        parts.append(f"SELECT setval(pg_get_serial_sequence('{name}', '{pk}'), "
                     f"(SELECT COALESCE(MAX({pk}), 1) FROM {name}));")
        parts.append("")
    parts.append("COMMIT;")
    return "\n".join(parts) + "\n"


def build_mysql_like(motor):
    d = Dialect("mysql")
    parts = [HEADER.format(motor=motor, seed=SEED), "START TRANSACTION;", ""]
    for name, cols, rows, pk in TABLES:
        parts.append(f"-- {name}: {len(rows)} filas")
        parts.extend(emit_insert(d, name, cols, rows))
        parts.append("")
    parts.append("COMMIT;")
    parts.append("")
    parts.append("-- realinear contadores AUTO_INCREMENT (ALTER hace commit implicito)")
    for name, cols, rows, pk in TABLES:
        max_id = max((r[pk] for r in rows), default=1)
        parts.append(f"ALTER TABLE {name} AUTO_INCREMENT = {max_id + 1};")
    return "\n".join(parts) + "\n"


def build_sqlserver():
    d = Dialect("sqlserver")
    parts = [HEADER.format(motor="SQL Server 2022", seed=SEED)]
    parts.append("SET XACT_ABORT ON;")
    parts.append("GO")
    for name, cols, rows, pk in TABLES:
        parts.append(f"-- {name}: {len(rows)} filas (idempotente: solo si la tabla esta vacia)")
        parts.append(f"IF NOT EXISTS (SELECT 1 FROM dbo.{name})")
        parts.append("BEGIN")
        parts.append(f"SET IDENTITY_INSERT dbo.{name} ON;")
        parts.extend(emit_insert(d, name, cols, rows, chunk=200))
        parts.append(f"SET IDENTITY_INSERT dbo.{name} OFF;")
        parts.append("END")
        parts.append("GO")
    return "\n".join(parts) + "\n"


OUTPUTS = {
    os.path.join(HERE, "init", "postgres", "03-seed.sql"): build_postgres(),
    os.path.join(HERE, "init", "mysql", "02-seed.sql"): build_mysql_like("MySQL 8.0"),
    os.path.join(HERE, "init", "mariadb", "02-seed.sql"): build_mysql_like("MariaDB 11.4"),
    os.path.join(HERE, "init", "sqlserver", "03-seed.sql"): build_sqlserver(),
}

for path, content in OUTPUTS.items():
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(content)
    print(f"escrito  {os.path.relpath(path, HERE)}  ({len(content):,} bytes)")

# ---------------------------------------------------------------------------
# Volumen: archivos aparte, comprimidos (los motores cargan .sql.gz)
#   PostgreSQL: COPY (rapido); MySQL/MariaDB/SQL Server: INSERT por lotes.
#   Al final: contadores de identidad y estadisticas del optimizador, para
#   que EXPLAIN refleje el volumen real desde el primer arranque.
# ---------------------------------------------------------------------------
VOL_TABLES = [(name, cols, volume[name], pk) for name, cols, _, pk in TABLES if name in volume]
VOL_TOTALS = {name: BASE_COUNTS[name] + len(volume.get(name, [])) for name in BASE_COUNTS}

VOL_HEADER = """-- ============================================================================
--  {motor} - VOLUMEN del banco NL2SQL (para medir eficiencia con EXPLAIN)
--  GENERADO por generar_seed.py (semilla {seed}, volumen {vseed}). NO editar.
--  Se carga DESPUES del seed base: agrega filas sin tocar las existentes.
-- ============================================================================
"""


def copy_val(v):
    if v is None:
        return "\\N"
    if isinstance(v, bool):
        return "t" if v else "f"
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, date):
        return v.strftime("%Y-%m-%d")
    return str(v).replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n")


def build_postgres_volume():
    parts = [VOL_HEADER.format(motor="PostgreSQL 16", seed=SEED, vseed=VOL_SEED_USED), "BEGIN;", ""]
    for name, cols, rows, pk in VOL_TABLES:
        parts.append(f"-- {name}: {len(rows)} filas")
        parts.append(f"COPY {name} ({', '.join(cols)}) FROM stdin;")
        parts.extend("\t".join(copy_val(r.get(c)) for c in cols) for r in rows)
        parts.append("\\.")
        parts.append(f"SELECT setval(pg_get_serial_sequence('{name}', '{pk}'), (SELECT MAX({pk}) FROM {name}));")
        parts.append("")
    parts.append("COMMIT;")
    parts.append("VACUUM ANALYZE;")   # visibility map: habilita los Index Only Scan
    return "\n".join(parts) + "\n"


def build_mysql_like_volume(motor):
    d = Dialect("mysql")
    parts = [VOL_HEADER.format(motor=motor, seed=SEED, vseed=VOL_SEED_USED),
             "SET NAMES utf8mb4;", "START TRANSACTION;", ""]
    for name, cols, rows, pk in VOL_TABLES:
        parts.append(f"-- {name}: {len(rows)} filas")
        parts.extend(emit_insert(d, name, cols, rows, chunk=1000))
        parts.append("")
    parts.append("COMMIT;")
    parts.append("")
    for name, cols, rows, pk in VOL_TABLES:
        parts.append(f"ALTER TABLE {name} AUTO_INCREMENT = {VOL_TOTALS[name] + 1};")
    parts.append("ANALYZE TABLE " + ", ".join(n for n, _, _, _ in TABLES) + ";")
    return "\n".join(parts) + "\n"


def build_sqlserver_volume():
    d = Dialect("sqlserver")
    parts = [VOL_HEADER.format(motor="SQL Server 2022", seed=SEED, vseed=VOL_SEED_USED),
             "SET NOCOUNT ON;", "SET XACT_ABORT ON;", "GO"]
    for name, cols, rows, pk in VOL_TABLES:
        parts.append(f"-- {name}: {len(rows)} filas")
        parts.append("BEGIN TRANSACTION;")
        parts.append(f"SET IDENTITY_INSERT dbo.{name} ON;")
        for k, stmt in enumerate(emit_insert(d, name, cols, rows, chunk=1000), start=1):
            parts.append(stmt)
            if k % 10 == 0:
                parts.append("GO")
        parts.append(f"SET IDENTITY_INSERT dbo.{name} OFF;")
        parts.append("COMMIT;")
        parts.append("GO")
    for name, _, _, _ in TABLES:
        parts.append(f"UPDATE STATISTICS dbo.{name} WITH FULLSCAN;")
    parts.append("GO")
    return "\n".join(parts) + "\n"


VOL_OUTPUTS = {
    os.path.join(HERE, "init", "postgres", "04-volumen.sql.gz"): build_postgres_volume,
    os.path.join(HERE, "init", "mysql", "03-volumen.sql.gz"): lambda: build_mysql_like_volume("MySQL 8.0"),
    os.path.join(HERE, "init", "mariadb", "03-volumen.sql.gz"): lambda: build_mysql_like_volume("MariaDB 11.4"),
    os.path.join(HERE, "init", "sqlserver", "04-volumen.sql.gz"): build_sqlserver_volume,
}

for path, build in VOL_OUTPUTS.items():
    content = build().encode("utf-8")
    # mtime=0: el .gz sale identico en cada corrida (reproducible)
    with open(path, "wb") as raw, gzip.GzipFile(filename="", fileobj=raw, mode="wb", compresslevel=9, mtime=0) as fh:
        fh.write(content)
    print(f"escrito  {os.path.relpath(path, HERE)}  ({len(content):,} bytes sin comprimir, "
          f"{os.path.getsize(path):,} comprimido)")

# ---------------------------------------------------------------------------
# Resumen para consola / README
# ---------------------------------------------------------------------------
paid_orders = {p["order_id"] for p in payments if p["status"] == "COMPLETED"}
shipped_orders = {s["order_id"] for s in shipments}
cust_with_orders = {o["customer_id"] for o in orders}
sold_products = {oi["product_id"] for oi in order_items}
spend = {}
for o in orders:
    spend[o["customer_id"]] = spend.get(o["customer_id"], Decimal("0")) + o["total"]

print("\n=== RESUMEN DEL DATASET ===")
for name, cols, rows, pk in TABLES:
    print(f"  {name:<14} {len(rows):>5}")
print(f"  {'TOTAL':<14} {sum(len(r) for _, _, r, _ in TABLES):>5}")
print("---")
print(f"  clientes sin pedidos ...... {200 - len(cust_with_orders)}")
print(f"  clientes con >3 pedidos ... {sum(1 for v in orders_count_by_customer.values() if v > 3)}")
print(f"  max pedidos de un cliente . {max(orders_count_by_customer.values())}")
print(f"  productos nunca vendidos .. {100 - len(sold_products)}")
print(f"  productos agotados (0) .... {sum(1 for p in products if p['stock'] == 0)}")
print(f"  productos stock < 10 ...... {sum(1 for p in products if p['stock'] < 10)}")
print(f"  pedidos 2025 .............. {sum(1 for o in orders if o['order_date'].year == 2025)}")
print(f"  pedidos CANCELLED ......... {sum(1 for o in orders if o['status'] == 'CANCELLED')}")
print(f"  pedidos PENDING .......... {sum(1 for o in orders if o['status'] == 'PENDING')}")
print(f"  pagos PENDING ............. {sum(1 for p in payments if p['status'] == 'PENDING')}")
print(f"  pagos FAILED ............. {sum(1 for p in payments if p['status'] == 'FAILED')}")
print(f"  ventas totales (todas) ... {sum((o['total'] for o in orders), Decimal('0'))}")
print(f"  ventas (sin CANCELLED) ... {sum((o['total'] for o in orders if o['status'] != 'CANCELLED'), Decimal('0'))}")
print(f"  ticket promedio .......... {money(sum((o['total'] for o in orders), Decimal('0')) / len(orders))}")
top_cust = max(spend.items(), key=lambda kv: kv[1])
print(f"  cliente que mas gasta .... #{top_cust[0]}  ({top_cust[1]})")
print(f"  producto mas caro ........ {top['name']}  ({top['price']})")

# ---------------------------------------------------------------------------
# Resumen del banco completo (base + volumen)
# ---------------------------------------------------------------------------
all_orders = orders + volume["orders"]
all_items = order_items + volume["order_items"]
all_customers = customers + volume["customers"]
all_products = products + volume["products"]
v_cust_with_orders = {o["customer_id"] for o in all_orders}
v_sold = {i["product_id"] for i in all_items}
print(f"\n=== BANCO COMPLETO (base + volumen, semilla de volumen {VOL_SEED_USED}) ===")
for name in BASE_COUNTS:
    print(f"  {name:<14} {VOL_TOTALS[name]:>9,}")
print(f"  {'TOTAL':<14} {sum(VOL_TOTALS.values()):>9,}")
print("---")
print(f"  clientes sin pedidos ...... {len(all_customers) - len(v_cust_with_orders):,}")
print(f"  clientes ACTIVE/INACTIVE .. {sum(c['status'] == 'ACTIVE' for c in all_customers):,} / "
      f"{sum(c['status'] == 'INACTIVE' for c in all_customers):,}")
print(f"  max pedidos de un cliente . {max(Counter(o['customer_id'] for o in all_orders).values())}")
print(f"  productos nunca vendidos .. {len(all_products) - len(v_sold):,}")
print(f"  productos agotados (0) .... {sum(p['stock'] == 0 for p in all_products):,}")
print(f"  productos stock < 10 ...... {sum(p['stock'] < 10 for p in all_products):,}")
print(f"  pedidos por anio .......... " + " / ".join(
    f"{y}: {n:,}" for y, n in sorted(Counter(o['order_date'].year for o in all_orders).items())))
print(f"  pedidos CANCELLED ......... {sum(o['status'] == 'CANCELLED' for o in all_orders):,}")
print(f"  paises / ciudades ......... {len({c['country'] for c in all_customers})} / {len({c['city'] for c in all_customers})}")
print(f"  ciudad con mas clientes ... {Counter(c['city'] for c in all_customers).most_common(1)[0]}")
print(f"  producto mas caro ......... {max(all_products, key=lambda p: p['price'])['name']}")
