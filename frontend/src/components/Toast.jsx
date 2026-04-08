export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
      <span>{toast.message}</span>
      <button className="btn-ghost" onClick={onClose} aria-label="Close notification">
        Close
      </button>
    </div>
  );
}
