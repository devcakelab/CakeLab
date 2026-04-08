from __future__ import annotations

import sqlite3

from db import init_db
from services import (
    CartItem,
    add_product,
    checkout,
    delete_product,
    find_product_by_sku,
    list_products,
    restock_product,
    sales_summary,
    seed_sample_desserts,
    update_stock,
)


def read_float(prompt: str) -> float:
    while True:
        raw = input(prompt).strip()
        try:
            value = float(raw)
            if value < 0:
                print("Value cannot be negative.")
                continue
            return value
        except ValueError:
            print("Please enter a valid number.")


def read_int(prompt: str, minimum: int = 0) -> int:
    while True:
        raw = input(prompt).strip()
        try:
            value = int(raw)
            if value < minimum:
                print(f"Value must be at least {minimum}.")
                continue
            return value
        except ValueError:
            print("Please enter a valid integer.")


def print_products() -> None:
    products = list_products()
    if not products:
        print("\nNo products in inventory.\n")
        return

    print("\nInventory:")
    print("-" * 68)
    print(f"{'SKU':<12} {'Name':<28} {'Price':>10} {'Stock':>10}")
    print("-" * 68)
    for p in products:
        print(f"{p['sku']:<12} {p['name']:<28} {p['price']:>10.2f} {p['stock']:>10}")
    print("-" * 68)


def inventory_menu() -> None:
    while True:
        print(
            """
=== Inventory ===
1. List products
2. Add product
3. Set stock
4. Restock product
5. Delete product
0. Back
"""
        )
        choice = input("Choose an option: ").strip()

        if choice == "1":
            print_products()
        elif choice == "2":
            sku = input("SKU: ").strip().upper()
            name = input("Name: ").strip()
            price = read_float("Price: ")
            stock = read_int("Initial stock: ", 0)
            try:
                add_product(sku, name, price, stock)
                print("Product added.\n")
            except sqlite3.IntegrityError:
                print("SKU already exists.\n")
        elif choice == "3":
            sku = input("SKU: ").strip().upper()
            stock = read_int("New stock value: ", 0)
            if update_stock(sku, stock):
                print("Stock updated.\n")
            else:
                print("Product not found.\n")
        elif choice == "4":
            sku = input("SKU: ").strip().upper()
            amount = read_int("Amount to add: ", 1)
            if restock_product(sku, amount):
                print("Product restocked.\n")
            else:
                print("Product not found.\n")
        elif choice == "5":
            sku = input("SKU to delete: ").strip().upper()
            if delete_product(sku):
                print("Product deleted.\n")
            else:
                print("Product not found.\n")
        elif choice == "0":
            break
        else:
            print("Invalid option.\n")


def pos_menu() -> None:
    cart: list[CartItem] = []

    while True:
        print(
            """
=== POS ===
1. Add item to cart
2. View cart
3. Checkout
4. Clear cart
0. Back
"""
        )
        choice = input("Choose an option: ").strip()

        if choice == "1":
            sku = input("Enter SKU: ").strip().upper()
            product = find_product_by_sku(sku)
            if not product:
                print("Product not found.\n")
                continue

            qty = read_int("Quantity: ", 1)
            if qty > product["stock"]:
                print(f"Insufficient stock. Available: {product['stock']}\n")
                continue

            for existing in cart:
                if existing.product_id == product["id"]:
                    if existing.quantity + qty > product["stock"]:
                        print(f"Insufficient stock. Available: {product['stock']}\n")
                        break
                    existing.quantity += qty
                    print("Item quantity updated in cart.\n")
                    break
            else:
                cart.append(
                    CartItem(
                        product_id=product["id"],
                        sku=product["sku"],
                        name=product["name"],
                        quantity=qty,
                        unit_price=product["price"],
                    )
                )
                print("Item added to cart.\n")

        elif choice == "2":
            if not cart:
                print("Cart is empty.\n")
                continue

            print("\nCart:")
            print("-" * 76)
            print(f"{'SKU':<12} {'Name':<25} {'Qty':>6} {'Price':>12} {'Line Total':>14}")
            print("-" * 76)
            total = 0.0
            for item in cart:
                line = item.line_total
                total += line
                print(
                    f"{item.sku:<12} {item.name:<25} {item.quantity:>6} "
                    f"{item.unit_price:>12.2f} {line:>14.2f}"
                )
            print("-" * 76)
            print(f"{'TOTAL':>70} {total:>5.2f}\n")

        elif choice == "3":
            if not cart:
                print("Cart is empty.\n")
                continue
            try:
                sale_id = checkout(cart)
            except ValueError as exc:
                print(f"Checkout failed: {exc}\n")
                continue
            print(f"Checkout complete. Sale ID: {sale_id}\n")
            cart.clear()

        elif choice == "4":
            cart.clear()
            print("Cart cleared.\n")
        elif choice == "0":
            break
        else:
            print("Invalid option.\n")


def reports_menu() -> None:
    summary = sales_summary()
    print("\n=== Sales Summary ===")
    print(f"Total sales count: {summary['total_sales']}")
    print(f"Gross revenue: {summary['gross_revenue']:.2f}\n")


def main() -> None:
    init_db()
    seed_sample_desserts()
    while True:
        print(
            """
========== Python POS ==========
1. POS (Checkout)
2. Inventory
3. Sales Summary
0. Exit
"""
        )
        choice = input("Choose an option: ").strip()
        if choice == "1":
            pos_menu()
        elif choice == "2":
            inventory_menu()
        elif choice == "3":
            reports_menu()
        elif choice == "0":
            print("Goodbye.")
            break
        else:
            print("Invalid option.\n")


if __name__ == "__main__":
    main()
