import { useMemo, useState } from "react";
import { formatCurrency } from "../lib/posUtils";

function saleOptionLabel(sale) {
  const createdAt = sale?.created_at ? new Date(sale.created_at).toLocaleString() : "Unknown date";
  return `#${sale.id} - ${sale.customer_name || "Walk-in Customer"} - ${formatCurrency(sale.total)} (${createdAt})`;
}

export default function IncidentReportsView({ sales, incidentReports, createIncidentReport, busy }) {
  const [form, setForm] = useState({
    saleId: "",
    details: "",
    attachment: null,
  });

  const saleOptions = useMemo(() => [...sales], [sales]);

  async function submitIncident(event) {
    event.preventDefault();
    const saleId = Number(form.saleId);
    const details = form.details.trim();
    if (!saleId || !details) return;
    const ok = await createIncidentReport({
      sale_id: saleId,
      details,
      attachment: form.attachment,
    });
    if (ok) {
      setForm({ saleId: "", details: "", attachment: null });
    }
  }

  return (
    <section className="view incident-view">
      <header className="view-header">
        <h2>Incident Report</h2>
        <p className="muted">Log incidents for specific sales and track their status updates.</p>
      </header>

      <div className="incident-layout">
        <article className="panel incident-panel-compact">
          <h3>Report an incident</h3>
          {saleOptions.length === 0 ? (
            <p className="muted">No sales available yet. Complete a sale first before filing an incident.</p>
          ) : (
            <form onSubmit={submitIncident} className="incident-form-grid">
              <label className="field">
                <span>Select sale</span>
                <select value={form.saleId} onChange={(e) => setForm((s) => ({ ...s, saleId: e.target.value }))} required>
                  <option value="">Choose a sale</option>
                  {saleOptions.map((sale) => (
                    <option key={sale.id} value={sale.id}>
                      {saleOptionLabel(sale)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Attachment (image)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setForm((s) => ({ ...s, attachment: e.target.files?.[0] || null }))}
                />
              </label>
              <label className="field">
                <span>What happened?</span>
                <textarea
                  className="incident-textarea"
                  value={form.details}
                  onChange={(e) => setForm((s) => ({ ...s, details: e.target.value }))}
                  placeholder="Describe the incident details..."
                  rows={3}
                  required
                />
              </label>
              <button className="btn-primary incident-submit-btn" disabled={busy}>
                {busy ? "Saving..." : "Save incident report"}
              </button>
            </form>
          )}
        </article>

        <article className="panel incident-panel-compact">
          <h3>Recent incident reports</h3>
          <div className="incident-list">
            {incidentReports.length === 0 ? <p className="empty">No incident reports yet.</p> : null}
            {incidentReports.map((incident) => (
              <article className="incident-item" key={incident.id}>
                <div className="incident-item-header">
                  <strong>Sale #{incident.sale_number}</strong>
                  <span className="muted">{new Date(incident.created_at).toLocaleString()}</span>
                </div>
                <p className="incident-item-text">{incident.details}</p>
                <p className="muted incident-item-meta">Reported by {incident.created_by_name || "Unknown"}</p>
                {incident.attachment_url ? (
                  <a href={incident.attachment_url} target="_blank" rel="noreferrer" className="incident-image-link">
                    <img src={incident.attachment_url} alt={`Incident evidence for sale ${incident.sale_number}`} />
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
