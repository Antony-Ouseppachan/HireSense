import { useEffect, useState } from "react";
import "../styles/QuestionLoader.css";

const MESSAGES = [
  "Connecting to AI engine...",
  "Analyzing your profile...",
  "Generating questions...",
  "Calibrating difficulty...",
  "Almost there...",
];

export default function QuestionLoader({ visible }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [visibleMsg, setVisibleMsg] = useState(MESSAGES[0]);

  useEffect(() => {
    if (!visible) { setMsgIndex(0); setVisibleMsg(MESSAGES[0]); return; }
    const interval = setInterval(() => {
      setMsgIndex(prev => {
        const next = (prev + 1) % MESSAGES.length;
        setVisibleMsg(MESSAGES[next]);
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="question-loader-overlay">
      <div className="ql-rings">
        <div className="ql-ring ql-ring-1" />
        <div className="ql-ring ql-ring-2" />
        <div className="ql-ring ql-ring-3" />
        <div className="ql-ring ql-ring-4" />
        <div className="ql-core">
          <div className="ql-core-inner" />
        </div>
      </div>
      <div className="ql-particles">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="ql-particle" style={{
            "--i": i,
            "--x": `${50 + 40 * Math.cos(i * 0.524)}%`,
            "--y": `${50 + 40 * Math.sin(i * 0.524)}%`,
            "--d": `${1 + (i % 3) * 0.5}s`,
            "--r": `${i * 30}deg`,
          }} />
        ))}
      </div>
      <div className="ql-text-wrap">
        <p className="ql-label" key={msgIndex}>{visibleMsg}</p>
        <div className="ql-progress">
          <div className="ql-progress-bar" />
        </div>
        <p className="ql-hint">This may take a few seconds</p>
      </div>
    </div>
  );
}
