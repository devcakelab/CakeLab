import { formatCurrency } from "../lib/posUtils";
import { useMemo, useState } from "react";

export default function InventoryView({
  inventoryForm,
  setInventoryForm,
  createProduct,
  sections,
  busy,
  madeProducts,
  ingredientProducts,
  archivedMadeProducts,
  archivedIngredientProducts,
  deleteProduct,
  archiveProduct,
  restoreProduct,
  restockProduct,
  createSection,
  updateSection,
  deleteSection,
}) {
  const [sectionName, setSectionName] = useState("");
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionName, setEditingSectionName] = useState("");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const sectionMap = useMemo(() => {
    const map = new Map();
    sections.forEach((section) => map.set(section.id, section.name));
    return map;
  }, [sections]);

  async function handleCreateSection(event) {
    event.preventDefault();
    const name = sectionName.trim();
    if (!name) return;
    await createSection(name);
    setSectionName("");
  }

  async function handleUpdateSection(event) {
    event.preventDefault();
    const name = editingSectionName.trim();
    if (!editingSectionId || !name) return;
    await updateSection(editingSectionId, name);
    setEditingSectionId(null);
    setEditingSectionName("");
  }

  async function handleDeleteSection(sectionId) {
    if (!window.confirm("Delete this category?")) return;
    await deleteSection(sectionId);
  }

  function ProductTable({ title, rows, emptyLabel, renderActions }) {
    return (
      <article className="panel">
        <h3>{title}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty">
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                rows.map((product) => {
                  const isLow = Number(product.stock) <= Number(product.low_stock_threshold);
                  return (
                    <tr key={product.id} className={isLow ? "row-warning" : ""}>
                      <td>{product.name}</td>
                      <td>{product.section_name || "General"}</td>
                      <td>{formatCurrency(product.price)}</td>
                      <td>
                        {product.stock}
                        {isLow ? <span className="badge">Low</span> : null}
                      </td>
                      <td>
                        {renderActions(product)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </article>
    );
  }

  return (
    <section className="view">
      <header className="view-header">
        <h2>Inventory</h2>
        <p className="muted">Manage categories and keep Made Products and Ingredients separated.</p>
      </header>

      <article className="panel">
        <h3>Add inventory item</h3>
        <form onSubmit={createProduct} className="inventory-form">
          <label className="field">
            <span>Type</span>
            <select
              value={inventoryForm.is_ingredient ? "ingredient" : "made"}
              onChange={(e) =>
                setInventoryForm((s) => ({
                  ...s,
                  is_ingredient: e.target.value === "ingredient",
                }))
              }
            >
              <option value="made">Made Product</option>
              <option value="ingredient">Ingredient</option>
            </select>
          </label>
          <label className="field">
            <span>Name</span>
            <input value={inventoryForm.name} onChange={(e) => setInventoryForm((s) => ({ ...s, name: e.target.value }))} required />
          </label>
          <label className="field">
            <span>Price</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={inventoryForm.price}
              onChange={(e) => setInventoryForm((s) => ({ ...s, price: e.target.value }))}
              required
            />
          </label>
          <label className="field">
            <span>Stock</span>
            <input
              type="number"
              min="0"
              value={inventoryForm.stock}
              onChange={(e) => setInventoryForm((s) => ({ ...s, stock: e.target.value }))}
              required
            />
          </label>
          <label className="field">
            <span>Low stock threshold</span>
            <input
              type="number"
              min="0"
              value={inventoryForm.low_stock_threshold}
              onChange={(e) => setInventoryForm((s) => ({ ...s, low_stock_threshold: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Category</span>
            <select value={inventoryForm.section} onChange={(e) => setInventoryForm((s) => ({ ...s, section: e.target.value }))}>
              <option value="">General</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary" disabled={busy}>
            Add item
          </button>
        </form>
      </article>

      <div className="inventory-sectors-grid">
        <ProductTable
          title={`Made Products (${madeProducts.length})`}
          rows={madeProducts}
          emptyLabel="No made products yet."
          renderActions={(product) => (
            <div className="inline-actions">
              <button className="btn-ghost" onClick={() => archiveProduct(product.id, product.name)}>
                Archive
              </button>
              <button className="btn-primary" onClick={() => restockProduct(product.id, product.name, product.stock)}>
                Restock
              </button>
            </div>
          )}
        />
        <ProductTable
          title={`Ingredients (${ingredientProducts.length})`}
          rows={ingredientProducts}
          emptyLabel="No ingredients yet."
          renderActions={(product) => (
            <button className="btn-danger" onClick={() => deleteProduct(product.id, product.name)}>
              Delete
            </button>
          )}
        />
      </div>

      <article className="panel">
        <button
          type="button"
          className="inventory-categories-toggle"
          onClick={() => setArchiveOpen((open) => !open)}
          aria-expanded={archiveOpen}
        >
          <span>Archived items</span>
          <span className="inventory-categories-chevron" aria-hidden="true">
            {archiveOpen ? "−" : "+"}
          </span>
        </button>

        {archiveOpen ? (
          <div className="inventory-categories-body">
            <p className="muted archive-hint">Restore archived products to make them visible in POS and Inventory.</p>
            <div className="inventory-sectors-grid">
              <ProductTable
                title={`Archived Made Products (${archivedMadeProducts.length})`}
                rows={archivedMadeProducts}
                emptyLabel="No archived made products."
                renderActions={(product) => (
                  <button className="btn-primary" onClick={() => restoreProduct(product.id, product.name)}>
                    Restore
                  </button>
                )}
              />
              <ProductTable
                title={`Archived Ingredients (${archivedIngredientProducts.length})`}
                rows={archivedIngredientProducts}
                emptyLabel="No archived ingredients."
                renderActions={(product) => (
                  <button className="btn-primary" onClick={() => restoreProduct(product.id, product.name)}>
                    Restore
                  </button>
                )}
              />
            </div>
          </div>
        ) : null}
      </article>

      <article className="panel">
        <button
          type="button"
          className="inventory-categories-toggle"
          onClick={() => setCategoriesOpen((open) => !open)}
          aria-expanded={categoriesOpen}
        >
          <span>Categories</span>
          <span className="inventory-categories-chevron" aria-hidden="true">
            {categoriesOpen ? "−" : "+"}
          </span>
        </button>

        {categoriesOpen ? (
          <div className="section-admin-grid inventory-categories-body">
            <form onSubmit={handleCreateSection} className="section-form">
              <h4>Create category</h4>
              <input
                placeholder="Category name"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                required
              />
              <button className="btn-primary">Create</button>
            </form>
            <form onSubmit={handleUpdateSection} className="section-form">
              <h4>Edit category</h4>
              <select
                value={editingSectionId ?? ""}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  setEditingSectionId(id);
                  setEditingSectionName(id ? sectionMap.get(id) || "" : "");
                }}
              >
                <option value="">Select category</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="New category name"
                value={editingSectionName}
                onChange={(e) => setEditingSectionName(e.target.value)}
                disabled={!editingSectionId}
                required
              />
              <button className="btn-primary" disabled={!editingSectionId}>
                Save
              </button>
            </form>
            <div className="section-form">
              <h4>Delete category</h4>
              <div className="section-list">
                {sections.map((section) => (
                  <div key={section.id} className="section-row">
                    <span>{section.name}</span>
                    <button className="btn-danger" onClick={() => handleDeleteSection(section.id)}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </article>
    </section>
  );
}
