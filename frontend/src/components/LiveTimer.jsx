import { useState, useEffect, useRef } from "react";

export default function LiveTimer({ initialSeconds, onTimeUp, running = true }) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const intervalRef = useRef(null);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    setRemaining(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!running || remaining <= 0) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          onTimeUpRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, remaining <= 0]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining <= 300;
  const isCritical = remaining <= 60;
  const isPanic = remaining <= 30;

  return (
    <div className={`live-timer ${isUrgent ? "urgent" : ""} ${isCritical ? "critical" : ""} ${isPanic ? "panic" : ""}`}>
      <svg className="live-timer-ring" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle
          cx="24" cy="24" r="20" fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={125.6}
          strokeDashoffset={125.6 - (125.6 * remaining) / initialSeconds}
          transform="rotate(-90 24 24)"
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span className="live-timer-text">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  );
}
