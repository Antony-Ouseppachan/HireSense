import "../styles/LoadingSpinner.css";

export default function LoadingSpinner({ label = "Loading..." }) {
  return (
    <div className="loading-spinner">
      <div className="loading-orbit">
        <div className="loading-orbit-ring lor-outer" />
        <div className="loading-orbit-ring lor-mid" />
        <div className="loading-orbit-ring lor-inner" />
        <div className="loading-orbit-dot ldot-outer" />
        <div className="loading-orbit-dot ldot-mid" />
        <div className="loading-orbit-dot ldot-inner" />
        <div className="loading-orbit-core" />
      </div>
      <p className="loading-spinner-label">{label}</p>
    </div>
  );
}
