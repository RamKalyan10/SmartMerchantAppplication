"""Realistic synthetic retail merchant dataset generator for Smart Merchant ML Service.

Contains trends, weekly seasonality, festival spikes, product categories,
stock shortages, overstock cases, and labeled expense anomalies.
"""

import json
import math
import random
from datetime import date, datetime, timedelta
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "samples"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_FILE = OUTPUT_DIR / "sample_merchant_db.json"

CATEGORIES = [
    ("cat_grain", "Grains, Atta & Pulses"),
    ("cat_oil", "Edible Oils & Pure Ghee"),
    ("cat_dairy", "Dairy, Milk & Eggs"),
    ("cat_snack", "Snacks, Biscuits & Sweets"),
    ("cat_bev", "Beverages, Tea & Coffee"),
    ("cat_care", "Personal Care & Hygiene"),
    ("cat_spice", "Spices, Masalas & Condiments"),
    ("cat_clean", "Cleaning & Household"),
]

SAMPLE_PRODUCTS = [
    # Grains
    ("prd_grn_01", "Daawat Super Basmati Rice (1 Kg)", "cat_grain", 92, 118, 35, 15),
    ("prd_grn_02", "Aashirvaad MP Sharbati Atta (5 Kg)", "cat_grain", 215, 265, 40, 20),
    ("prd_grn_03", "Tata Sampann Toor Dal (1 Kg)", "cat_grain", 138, 168, 8, 20),  # Low stock / shortage
    ("prd_grn_04", "Tata Sampann Moong Dal (1 Kg)", "cat_grain", 122, 150, 30, 15),
    # Oils
    ("prd_oil_01", "Fortune Sunlite Refined Sunflower Oil (1 L)", "cat_oil", 118, 142, 28, 20),
    ("prd_oil_02", "Amul Pure Cow Ghee Tin (1 L)", "cat_oil", 520, 640, 65, 10),  # Overstock
    ("prd_oil_03", "Fortune Kachi Ghani Mustard Oil (1 L)", "cat_oil", 135, 165, 22, 15),
    # Dairy
    ("prd_dry_01", "Amul Taaza Toned Milk (1 L Tetra)", "cat_dairy", 56, 70, 35, 25),
    ("prd_dry_02", "Amul Pasteurised Butter (500g)", "cat_dairy", 228, 275, 18, 15),
    ("prd_dry_03", "Amul Fresh Paneer (200g)", "cat_dairy", 72, 92, 6, 20),  # Shortage
    # Snacks & Beverages
    ("prd_snk_01", "Britannia Good Day Butter Cookies (600g)", "cat_snack", 95, 120, 45, 20),
    ("prd_snk_02", "Haldiram's Nagpur Bhujia Sev (1 Kg)", "cat_snack", 210, 260, 30, 15),
    ("prd_bev_01", "Brooke Bond Red Label Tea (500g)", "cat_bev", 240, 295, 25, 15),
    ("prd_bev_02", "Bru Instant Coffee Jar (100g)", "cat_bev", 165, 210, 20, 10),
    # Care & Cleaning
    ("prd_car_01", "Dettol Original Bathing Soap (125g x 4)", "cat_care", 155, 195, 30, 15),
    ("prd_car_02", "Colgate Strong Teeth Toothpaste (200g)", "cat_care", 88, 115, 25, 15),
    ("prd_cln_01", "Surf Excel Quick Wash Detergent Powder (1 Kg)", "cat_clean", 145, 180, 28, 15),
    ("prd_cln_02", "Vim Dishwash Gel Lemon (750 ml)", "cat_clean", 125, 155, 32, 15),
    # Dead stock candidate
    ("prd_car_03", "Imported French Lavender Bath Salt (250g)", "cat_care", 450, 650, 25, 5),
]

EXPENSE_CATEGORIES = [
    ("Rent", 25000, 0.05),
    ("Staff Salary", 12000, 0.0),
    ("Electricity & Power", 4500, 0.20),
    ("Freight & Transport", 2800, 0.25),
    ("Software & Internet", 1500, 0.0),
    ("Packaging Bags & Supplies", 2000, 0.15),
    ("Maintenance & Repairs", 1200, 0.35),
]


def generate_synthetic_data(days: int = 180):
    print(f"Generating {days} days of realistic synthetic retail data...")
    start_date = date.today() - timedelta(days=days)
    random.seed(42)

    # 1. Products
    products = []
    for p_id, name, cat_id, cost, sell, stock, reorder in SAMPLE_PRODUCTS:
        cat_name = dict(CATEGORIES).get(cat_id, "General")
        products.append({
            "id": p_id,
            "name": name,
            "sku": f"SKU-{p_id.upper()}",
            "store_id": "store_dwdm_001",
            "category_id": cat_id,
            "category_name": cat_name,
            "cost_price": cost,
            "selling_price": sell,
            "stock_quantity": stock,
            "min_stock_level": reorder,
            "unit": "Units",
        })

    # 2. Invoices across 180 days with weekly and growth trends
    invoices = []
    inv_seq = 10001
    for day_idx in range(days):
        cur_date = start_date + timedelta(days=day_idx)
        date_str = cur_date.isoformat()
        weekday = cur_date.weekday()

        # Weekly seasonality: Saturday/Sunday peak (+30%), Midweek lull (-15%)
        day_factor = 1.30 if weekday in [5, 6] else (0.85 if weekday in [1, 2] else 1.0)
        # Gentle business growth trend (+0.1% per day)
        trend_factor = 1.0 + (day_idx * 0.001)

        daily_count = int(random.randint(18, 26) * day_factor * trend_factor)

        for _ in range(daily_count):
            inv_id = f"INV-SYN-{inv_seq}"
            inv_seq += 1

            # Select 1 to 3 items
            basket_size = random.choices([1, 2, 3], weights=[0.55, 0.35, 0.10])[0]
            # Exclude dead stock product from frequent purchases
            active_pool = [p for p in products if p["id"] != "prd_car_03"]
            selected_prods = random.sample(active_pool, k=min(basket_size, len(active_pool)))

            items = []
            subtotal = 0.0
            for sp in selected_prods:
                qty = random.choices([1, 2], weights=[0.8, 0.2])[0]
                total = round(sp["selling_price"] * qty, 2)
                subtotal += total
                items.append({
                    "product_id": sp["id"],
                    "product_name": sp["name"],
                    "category_id": sp["category_id"],
                    "category_name": sp["category_name"],
                    "quantity": qty,
                    "unit_price": sp["selling_price"],
                    "cost_price": sp["cost_price"],
                    "total_amount": total,
                })

            discount = round(subtotal * 0.02, 2) if subtotal >= 1000 else 0.0
            tax = round((subtotal - discount) * 0.05, 2)
            grand_total = round(subtotal - discount + tax, 2)

            invoices.append({
                "id": inv_id,
                "invoice_number": inv_id,
                "store_id": "store_dwdm_001",
                "customer_name": random.choice(["Ramesh Sharma", "Sunita Patel", "Walk-in Customer", "Local Shopper"]),
                "date": date_str,
                "time": f"{random.randint(8, 21):02d}:{random.randint(0, 59):02d}:00",
                "items": items,
                "subtotal": subtotal,
                "discount": discount,
                "tax": tax,
                "total_amount": grand_total,
                "payment_method": random.choice(["UPI", "UPI", "Cash", "Card"]),
                "payment_status": "PAID",
                "is_synthetic": True,
            })

    # 3. Monthly Expenses & Occasional Injected Anomalies
    expenses = []
    exp_seq = 1
    months_count = max(1, days // 30)

    for m in range(months_count):
        m_date = start_date + timedelta(days=m * 30 + 1)
        for cat_name, base_amount, volatility in EXPENSE_CATEGORIES:
            variation = random.uniform(-volatility, volatility)
            amount = round(base_amount * (1.0 + variation), 2)
            is_anomaly = False

            # Inject a realistic anomaly into Electricity in month 4 (e.g. AC compressor leak)
            if cat_name == "Electricity & Power" and m == 3:
                amount = round(base_amount * 2.65, 2)  # ₹11,900
                is_anomaly = True

            expenses.append({
                "id": f"EXP-SYN-{exp_seq:04d}",
                "store_id": "store_dwdm_001",
                "date": m_date.isoformat(),
                "category": cat_name,
                "amount": amount,
                "vendor": f"Vendor for {cat_name}",
                "description": f"Monthly billing for {cat_name}",
                "is_synthetic": True,
                "is_anomaly_labeled": is_anomaly,
            })
            exp_seq += 1

    payload = {
        "metadata": {
            "type": "SYNTHETIC_DEVELOPMENT_DATA",
            "generated_at": datetime.now().isoformat(),
            "days_covered": days,
            "total_invoices": len(invoices),
            "total_expenses": len(expenses),
            "total_products": len(products),
        },
        "products": products,
        "invoices": invoices,
        "expenses": expenses,
    }

    with open(SAMPLE_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"Generated {len(invoices)} invoices, {len(expenses)} expenses, {len(products)} products.")
    print(f"Saved to: {SAMPLE_FILE}")


if __name__ == "__main__":
    generate_synthetic_data(180)
