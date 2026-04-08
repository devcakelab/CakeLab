from __future__ import annotations

import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).parent / "pos.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                price REAL NOT NULL CHECK (price >= 0),
                stock INTEGER NOT NULL CHECK (stock >= 0),
                low_stock_threshold INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
                section_id INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                ,
                FOREIGN KEY (section_id) REFERENCES sections(id)
            );

            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                customer_name TEXT,
                total REAL NOT NULL CHECK (total >= 0),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS sale_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL CHECK (quantity > 0),
                unit_price REAL NOT NULL CHECK (unit_price >= 0),
                line_total REAL NOT NULL CHECK (line_total >= 0),
                FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id)
            );
            """
        )

        columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(products)").fetchall()
        }
        if "low_stock_threshold" not in columns:
            conn.execute(
                "ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 10"
            )
        if "section_id" not in columns:
            conn.execute("ALTER TABLE products ADD COLUMN section_id INTEGER")

        # Seed starter sections only on a brand new database.
        section_count = conn.execute("SELECT COUNT(*) AS total FROM sections").fetchone()
        if section_count and section_count["total"] == 0:
            conn.execute("INSERT INTO sections (name) VALUES ('General')")
            conn.execute("INSERT INTO sections (name) VALUES ('Croissant')")
            conn.execute("INSERT INTO sections (name) VALUES ('Bread')")
            conn.execute("INSERT INTO sections (name) VALUES ('Section 3')")
        default_section = conn.execute(
            "SELECT id FROM sections WHERE name = 'General'"
        ).fetchone()
        if default_section:
            conn.execute(
                "UPDATE products SET section_id = ? WHERE section_id IS NULL",
                (default_section["id"],),
            )

        sales_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(sales)").fetchall()
        }
        if "user_id" not in sales_columns:
            conn.execute("ALTER TABLE sales ADD COLUMN user_id INTEGER")
        if "customer_name" not in sales_columns:
            conn.execute("ALTER TABLE sales ADD COLUMN customer_name TEXT")
