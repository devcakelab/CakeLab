export default function MetricCard({ label, value, tone = "default" }) {
  return (
    <article className={`metric metric-${tone}`}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
    </article>
  );
}
