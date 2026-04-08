from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from db import get_connection


SAMPLE_DESSERTS: list[tuple[str, str, float, int, int, str]] = [
    ("DSRT-001", "Chocolate Cake Slice", 4.50, 30, 10, "Section 3"),
    ("DSRT-002", "Cheesecake", 5.25, 25, 10, "Section 3"),
    ("DSRT-003", "Brownie", 3.00, 40, 15, "Section 3"),
    ("DSRT-004", "Strawberry Cupcake", 3.75, 35, 12, "Section 3"),
    ("DSRT-005", "Mango Pudding", 4.00, 20, 8, "Section 3"),
]


@dataclass
class CartItem:
    product_id: int
    sku: str
    name: str
    quantity: int
    unit_price: float

    @property
    def line_total(self) -> float:
        return self.quantity * self.unit_price


def create_user(username: str, password_hash: str, full_name: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)",
            (username.strip().lower(), password_hash, full_name.strip()),
        )


def get_user_by_username(username: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, full_name FROM users WHERE username = ?",
            (username.strip().lower(),),
        ).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, full_name FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return dict(row) if row else None


def list_sections() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, name FROM sections ORDER BY name ASC"
        ).fetchall()
    return [dict(row) for row in rows]


def add_section(name: str) -> None:
    with get_connection() as conn:
        conn.execute("INSERT INTO sections (name) VALUES (?)", (name.strip(),))


def update_section(section_id: int, name: str) -> bool:
    with get_connection() as conn:
        cur = conn.execute(
            "UPDATE sections SET name = ? WHERE id = ?",
            (name.strip(), section_id),
        )
    return cur.rowcount > 0


def delete_section(section_id: int) -> None:
    with get_connection() as conn:
        section = conn.execute(
            "SELECT id, name FROM sections WHERE id = ?",
            (section_id,),
        ).fetchone()
        if not section:
            raise ValueError("Section not found.")
        used = conn.execute(
            "SELECT COUNT(*) AS total FROM products WHERE section_id = ?",
            (section_id,),
        ).fetchone()
        if used["total"] > 0:
            raise ValueError("Cannot delete section with assigned products.")
        total_sections = conn.execute(
            "SELECT COUNT(*) AS total FROM sections"
        ).fetchone()
        if total_sections["total"] <= 1:
            raise ValueError("At least one section must remain.")
        conn.execute("DELETE FROM sections WHERE id = ?", (section_id,))


def get_default_section_id() -> int:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id FROM sections WHERE name = 'General'"
        ).fetchone()
        if row:
            return int(row["id"])
        cur = conn.execute("INSERT INTO sections (name) VALUES ('General')")
        return int(cur.lastrowid)


def add_product(
    sku: str,
    name: str,
    price: float,
    stock: int,
    low_stock_threshold: int = 10,
    section_id: int | None = None,
) -> None:
    if section_id is None:
        section_id = get_default_section_id()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO products (sku, name, price, stock, low_stock_threshold, section_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                sku.strip().upper(),
                name.strip(),
                price,
                stock,
                low_stock_threshold,
                section_id,
            ),
        )


def seed_sample_desserts() -> None:
    with get_connection() as conn:
        count_row = conn.execute("SELECT COUNT(*) AS total FROM products").fetchone()
        if count_row["total"] > 0:
            return
        section_rows = conn.execute("SELECT id, name FROM sections").fetchall()
        section_map = {row["name"]: row["id"] for row in section_rows}
        default_section_id = section_map.get("General")
        if default_section_id is None:
            cur = conn.execute("INSERT INTO sections (name) VALUES ('General')")
            default_section_id = cur.lastrowid
        conn.executemany(
            """
            INSERT INTO products
                (sku, name, price, stock, low_stock_threshold, section_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    sku,
                    name,
                    price,
                    stock,
                    threshold,
                    section_map.get(section_name, default_section_id),
                )
                for sku, name, price, stock, threshold, section_name in SAMPLE_DESSERTS
            ],
        )


def list_products() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                p.id,
                p.sku,
                p.name,
                p.price,
                p.stock,
                p.low_stock_threshold,
                p.section_id,
                COALESCE(s.name, 'General') AS section_name
            FROM products AS p
            LEFT JOIN sections AS s ON s.id = p.section_id
            ORDER BY p.name ASC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def find_product_by_sku(sku: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT
                p.id,
                p.sku,
                p.name,
                p.price,
                p.stock,
                p.low_stock_threshold,
                p.section_id,
                COALESCE(s.name, 'General') AS section_name
            FROM products AS p
            LEFT JOIN sections AS s ON s.id = p.section_id
            WHERE p.sku = ?
            """,
            (sku.strip().upper(),),
        ).fetchone()
    return dict(row) if row else None


def get_product_by_id(product_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT
                p.id,
                p.sku,
                p.name,
                p.price,
                p.stock,
                p.low_stock_threshold,
                p.section_id,
                COALESCE(s.name, 'General') AS section_name
            FROM products AS p
            LEFT JOIN sections AS s ON s.id = p.section_id
            WHERE p.id = ?
            """,
            (product_id,),
        ).fetchone()
    return dict(row) if row else None


def update_product(
    product_id: int,
    sku: str,
    name: str,
    price: float,
    stock: int,
    low_stock_threshold: int,
    section_id: int | None = None,
) -> bool:
    if section_id is None:
        section_id = get_default_section_id()
    with get_connection() as conn:
        cur = conn.execute(
            """
            UPDATE products
            SET
                sku = ?,
                name = ?,
                price = ?,
                stock = ?,
                low_stock_threshold = ?,
                section_id = ?
            WHERE id = ?
            """,
            (
                sku.strip().upper(),
                name.strip(),
                price,
                stock,
                low_stock_threshold,
                section_id,
                product_id,
            ),
        )
    return cur.rowcount > 0


def update_stock(sku: str, stock: int) -> bool:
    with get_connection() as conn:
        cur = conn.execute(
            "UPDATE products SET stock = ? WHERE sku = ?",
            (stock, sku.strip().upper()),
        )
    return cur.rowcount > 0


def restock_product(sku: str, amount: int) -> bool:
    with get_connection() as conn:
        cur = conn.execute(
            "UPDATE products SET stock = stock + ? WHERE sku = ?",
            (amount, sku.strip().upper()),
        )
    return cur.rowcount > 0


def delete_product_by_id(product_id: int) -> bool:
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
    return cur.rowcount > 0


def low_stock_products() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                p.id,
                p.sku,
                p.name,
                p.stock,
                p.low_stock_threshold,
                p.section_id,
                COALESCE(s.name, 'General') AS section_name
            FROM products AS p
            LEFT JOIN sections AS s ON s.id = p.section_id
            WHERE p.stock <= p.low_stock_threshold
            ORDER BY p.stock ASC, p.name ASC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def checkout(
    cart_items: list[CartItem],
    user_id: int | None = None,
    customer_name: str | None = None,
) -> int:
    if not cart_items:
        raise ValueError("Cart is empty.")

    with get_connection() as conn:
        for item in cart_items:
            current = conn.execute(
                "SELECT stock FROM products WHERE id = ?",
                (item.product_id,),
            ).fetchone()
            if not current:
                raise ValueError(f"Product no longer exists: {item.sku}")
            if current["stock"] < item.quantity:
                raise ValueError(
                    f"Insufficient stock for {item.sku}. Available: {current['stock']}"
                )

        total = sum(item.line_total for item in cart_items)
        clean_customer = (customer_name or "").strip() or "Walk-in Customer"
        cur = conn.execute(
            "INSERT INTO sales (user_id, customer_name, total) VALUES (?, ?, ?)",
            (user_id, clean_customer, total),
        )
        sale_id = cur.lastrowid

        for item in cart_items:
            conn.execute(
                """
                INSERT INTO sale_items
                    (sale_id, product_id, quantity, unit_price, line_total)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    sale_id,
                    item.product_id,
                    item.quantity,
                    item.unit_price,
                    item.line_total,
                ),
            )
            conn.execute(
                "UPDATE products SET stock = stock - ? WHERE id = ?",
                (item.quantity, item.product_id),
            )
    return int(sale_id)


def sales_summary() -> dict:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT
                COUNT(*) AS total_sales,
                COALESCE(SUM(total), 0) AS gross_revenue
            FROM sales
            """
        ).fetchone()
    return dict(row)


def list_sales(limit: int = 200) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                s.id,
                s.created_at,
                s.total,
                COALESCE(s.customer_name, 'Walk-in Customer') AS customer_name,
                COALESCE(u.full_name, 'Unknown') AS cashier_name,
                COUNT(si.id) AS item_count
            FROM sales AS s
            LEFT JOIN users AS u ON u.id = s.user_id
            LEFT JOIN sale_items AS si ON si.sale_id = s.id
            GROUP BY s.id, s.created_at, s.total, customer_name, cashier_name
            ORDER BY s.id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def get_sale_receipt(sale_id: int) -> dict | None:
    with get_connection() as conn:
        sale = conn.execute(
            """
            SELECT
                s.id,
                s.created_at,
                s.total,
                COALESCE(s.customer_name, 'Walk-in Customer') AS customer_name,
                COALESCE(u.full_name, 'Unknown') AS cashier_name
            FROM sales AS s
            LEFT JOIN users AS u ON u.id = s.user_id
            WHERE s.id = ?
            """,
            (sale_id,),
        ).fetchone()
        if not sale:
            return None
        items = conn.execute(
            """
            SELECT
                p.sku,
                p.name,
                si.quantity,
                si.unit_price,
                si.line_total
            FROM sale_items AS si
            JOIN products AS p ON p.id = si.product_id
            WHERE si.sale_id = ?
            ORDER BY si.id ASC
            """,
            (sale_id,),
        ).fetchall()
    return {"sale": dict(sale), "items": [dict(row) for row in items]}


def dashboard_stats() -> dict:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM products) AS total_products,
                (SELECT COUNT(*) FROM products WHERE stock <= low_stock_threshold) AS low_stock_count,
                (SELECT COUNT(*) FROM sales WHERE date(created_at) = date('now', 'localtime')) AS today_sales,
                (SELECT COALESCE(SUM(total), 0) FROM sales WHERE date(created_at) = date('now', 'localtime')) AS today_revenue,
                (SELECT COALESCE(SUM(total), 0) FROM sales WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')) AS this_month_revenue
            """
        ).fetchone()
    return dict(row)


def dashboard_insights() -> dict:
    today = date.today()
    month_keys = []
    for back in range(2, -1, -1):
        probe = date(today.year, today.month, 1)
        for _ in range(back):
            probe = (probe.replace(day=1) - timedelta(days=1)).replace(day=1)
        month_keys.append(probe.strftime("%Y-%m"))

    week_starts = [today - timedelta(days=today.weekday()) - timedelta(days=7 * i) for i in range(4, -1, -1)]
    week_keys = [w.strftime("%Y-W%W") for w in week_starts]

    with get_connection() as conn:
        top_rows = conn.execute(
            """
            SELECT
                p.name,
                CASE
                    WHEN lower(p.name) LIKE '%brownie%' OR lower(p.name) LIKE '%chocolate%' THEN '🍫'
                    WHEN lower(p.name) LIKE '%cheesecake%' OR lower(p.name) LIKE '%cake%' THEN '🍰'
                    WHEN lower(p.name) LIKE '%cupcake%' THEN '🧁'
                    WHEN lower(p.name) LIKE '%pudding%' THEN '🍮'
                    WHEN lower(p.name) LIKE '%croissant%' THEN '🥐'
                    WHEN lower(p.name) LIKE '%mango%' THEN '🥭'
                    ELSE '🍩'
                END AS icon,
                COALESCE(SUM(si.quantity), 0) AS qty_sold,
                COALESCE(SUM(si.line_total), 0) AS revenue
            FROM sale_items AS si
            JOIN products AS p ON p.id = si.product_id
            JOIN sales AS s ON s.id = si.sale_id
            GROUP BY p.id, p.name
            ORDER BY qty_sold DESC, revenue DESC
            LIMIT 3
            """
        ).fetchall()
        week_rows = conn.execute(
            """
            SELECT
                strftime('%Y-W%W', created_at, 'localtime') AS bucket,
                COALESCE(SUM(total), 0) AS revenue
            FROM sales
            WHERE date(created_at, 'localtime') >= date('now', 'localtime', '-34 day')
            GROUP BY bucket
            """
        ).fetchall()
        month_rows = conn.execute(
            """
            SELECT
                strftime('%Y-%m', created_at, 'localtime') AS bucket,
                COALESCE(SUM(total), 0) AS revenue
            FROM sales
            WHERE date(created_at, 'localtime') >= date('now', 'localtime', 'start of month', '-2 month')
            GROUP BY bucket
            """
        ).fetchall()

    week_map = {row["bucket"]: float(row["revenue"]) for row in week_rows}
    month_map = {row["bucket"]: float(row["revenue"]) for row in month_rows}

    weekly = [
        {"label": f"Week {idx + 1}", "value": round(week_map.get(key, 0.0), 2)}
        for idx, key in enumerate(week_keys)
    ]
    monthly = [
        {
            "label": date.fromisoformat(f"{key}-01").strftime("%B"),
            "value": round(month_map.get(key, 0.0), 2),
        }
        for key in month_keys
    ]

    top_sellers = [dict(row) for row in top_rows]
    return {"top_sellers": top_sellers, "weekly": weekly, "monthly": monthly}


def sales_report(period: str) -> list[dict]:
    period = period.lower()
    if period == "daily":
        date_expr = "date(created_at)"
    elif period == "weekly":
        date_expr = "strftime('%Y-W%W', created_at)"
    elif period == "monthly":
        date_expr = "strftime('%Y-%m', created_at)"
    else:
        raise ValueError("Invalid period.")

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
                {date_expr} AS period_label,
                COUNT(*) AS sale_count,
                COALESCE(SUM(total), 0) AS revenue
            FROM sales
            GROUP BY period_label
            ORDER BY period_label DESC
            LIMIT 30
            """
        ).fetchall()
    return [dict(row) for row in rows]


def user_performance_metrics() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                u.id,
                u.full_name,
                u.username,
                COUNT(s.id) AS sales_count,
                COALESCE(SUM(s.total), 0) AS revenue
            FROM users AS u
            LEFT JOIN sales AS s ON s.user_id = u.id
            GROUP BY u.id, u.full_name, u.username
            ORDER BY revenue DESC, sales_count DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]
