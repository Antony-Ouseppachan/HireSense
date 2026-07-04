import "/src/styles/LoadingSpinner.css";

export default function LoadingSpinner({ label = "Loading..." }) {
  return (
    <div className="skeleton-panel" role="status" aria-live="polite">
      <div className="skeleton-row skeleton-row-avatar" />
      <div className="skeleton-row skeleton-row-wide" />
      <div className="skeleton-row skeleton-row-medium" />
      <div className="skeleton-row skeleton-row-narrow" />
      <span className="skeleton-label">{label}</span>
    </div>
  );
}
