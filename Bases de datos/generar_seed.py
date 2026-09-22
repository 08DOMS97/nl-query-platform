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


def wchoice(options):
    """options: lista de (valor, peso)."""
    vals, weights = zip(*options)
    return rnd.choices(vals, weights=weights)[0]


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


def pick_order_status(odate: datetime) -> str:
    days_old = (TODAY - odate.date()).days
    if days_old > 60:
        st = wchoice([("DELIVERED", 70), ("CANCELLED", 13), ("SHIPPED", 6),
                      ("PROCESSING", 4), ("CONFIRMED", 4), ("PENDING", 3)])
    elif days_old > 21:
        st = wchoice([("DELIVERED", 38), ("SHIPPED", 18), ("PROCESSING", 12),
                      ("CONFIRMED", 10), ("CANCELLED", 14), ("PENDING", 8)])
    else:
        st = wchoice([("PENDING", 30), ("CONFIRMED", 24), ("PROCESSING", 20),
                      ("SHIPPED", 12), ("CANCELLED", 10), ("DELIVERED", 4)])
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


for o in orders:
    method = wchoice(PAY_METHODS)
    p_base = o["order_date"] + timedelta(days=rnd.randint(0, 3),
                                        hours=rnd.randint(0, 20), minutes=rnd.choice([0, 15, 30, 45]))
    st = o["status"]
    if st in ("DELIVERED", "SHIPPED"):
        if rnd.random() < 0.15:
            add_payment(o, p_base, method, o["total"], "FAILED")
            add_payment(o, p_base + timedelta(hours=rnd.randint(1, 30)), method, o["total"], "COMPLETED")
        else:
            add_payment(o, p_base, method, o["total"], "COMPLETED")
    elif st in ("PROCESSING", "CONFIRMED"):
        if rnd.random() < 0.7:
            add_payment(o, p_base, method, o["total"], "COMPLETED")
        else:
            add_payment(o, p_base, method, o["total"], "PENDING")
    elif st == "PENDING":
        if rnd.random() < 0.6:
            add_payment(o, p_base, method, o["total"], "PENDING")
    elif st == "CANCELLED":
        r = rnd.random()
        if r < 0.45:
            add_payment(o, p_base, method, o["total"], "COMPLETED")
            add_payment(o, p_base + timedelta(days=rnd.randint(1, 10)), method, o["total"], "REFUNDED")
        elif r < 0.75:
            add_payment(o, p_base, method, o["total"], "FAILED")

# ---------------------------------------------------------------------------
# 7. SHIPMENTS (~250)
# ---------------------------------------------------------------------------
CARRIERS = [("DHL", "DH"), ("FedEx", "FX"), ("UPS", "UP"),
            ("Guatex", "GX"), ("Cargo Expreso", "CE"), ("Forza Delivery", "FZ")]

shipments = []
shp_id = 0
trk_seq = 0

for o in orders:
    st = o["status"]
    make = False
    s_status = None
    if st == "DELIVERED":
        make, s_status = True, "DELIVERED"
    elif st == "SHIPPED":
        make, s_status = True, wchoice([("SHIPPED", 55), ("IN_TRANSIT", 45)])
    elif st == "PROCESSING":
        if rnd.random() < 0.6:
            make, s_status = True, "PREPARING"
    elif st == "CONFIRMED":
        if rnd.random() < 0.2:
            make, s_status = True, "PREPARING"
    elif st == "CANCELLED":
        if rnd.random() < 0.15:
            make, s_status = True, "RETURNED"
    if not make:
        continue
    shp_id += 1
    trk_seq += 1
    carrier, prefix = rnd.choice(CARRIERS)
    if s_status == "PREPARING":
        ship_date = None
        deliv_date = None
    else:
        ship_date = o["order_date"] + timedelta(days=rnd.randint(1, 5),
                                                hours=rnd.randint(0, 10))
        if s_status == "DELIVERED":
            deliv_date = ship_date + timedelta(days=rnd.randint(1, 9), hours=rnd.randint(0, 12))
            if deliv_date.date() > TODAY:
                deliv_date = datetime(TODAY.year, TODAY.month, TODAY.day, 12, 0, 0)
        elif s_status == "RETURNED":
            deliv_date = ship_date + timedelta(days=rnd.randint(3, 15))
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
        "tracking_number": f"{prefix}{rnd.randint(10, 99)}{trk_seq:07d}",
        "status": s_status,
    })

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
