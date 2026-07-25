import { useEffect, useRef, useCallback, useState } from "react";

const SEVERITY = { low: "low", medium: "medium", high: "high", critical: "critical" };

function getSeverity(type, count) {
  if (type === "tab-switch") return count >= 3 ? SEVERITY.critical : count >= 2 ? SEVERITY.medium : SEVERITY.low;
  if (type === "copy") return SEVERITY.medium;
  if (type === "paste") return SEVERITY.medium;
  if (type === "fullscreen-exit") return count >= 2 ? SEVERITY.critical : SEVERITY.high;
  if (type === "right-click") return SEVERITY.low;
  if (type === "devtools") return SEVERITY.high;
  return SEVERITY.low;
}

export default function useAntiCheat({ onViolation, maxWarnings = 3, enabled = true, currentQuestion = 0 }) {
  const violationsRef = useRef([]);
  const [warnings, setWarnings] = useState(0);
  const [terminated, setTerminated] = useState(false);
  const prevCountRef = useRef(0);

  function getBrowserInfo() {
    return navigator.userAgent || "unknown";
  }

  const addViolation = useCallback((type, detail = "") => {
    if (!enabled) return;
    const violation = {
      timestamp: new Date().toISOString(),
      type,
      detail,
      severity: getSeverity(type, violationsRef.current.filter((v) => v.type === type).length + 1),
      questionNumber: currentQuestion + 1,
      browserInfo: getBrowserInfo(),
    };
    violationsRef.current.push(violation);
    const count = violationsRef.current.length;

    if (count > prevCountRef.current) {
      prevCountRef.current = count;
      setWarnings((w) => Math.min(w + 1, maxWarnings));
      if (onViolation) onViolation(violation, count);

      if (count >= maxWarnings) {
        setTerminated(true);
      }
    }
  }, [enabled, maxWarnings, onViolation, currentQuestion]);

  // Reset timeout ref for fullscreen retry coordination
  const retryFsRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.hidden) addViolation("tab-switch", "Tab hidden / switched");
    };

    const handleBlur = () => {
      addViolation("window-blur", "Browser window lost focus");
    };

    const handleCopy = (e) => {
      e.preventDefault();
      addViolation("copy", "Copy attempted");
    };

    const handleCut = (e) => {
      e.preventDefault();
      addViolation("cut", "Cut attempted");
    };

    const handlePaste = (e) => {
      e.preventDefault();
      addViolation("paste", "Paste attempted");
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      addViolation("right-click", "Right-click menu");
    };

    const handleKeyDown = (e) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if ((isCtrl && ["c", "v", "x", "s", "p", "a"].includes(e.key.toLowerCase())) ||
          e.key === "F12" ||
          (isCtrl && e.shiftKey && ["i", "j", "c"].includes(e.key.toLowerCase()))) {
        e.preventDefault();
        addViolation("keyboard-shortcut", `Blocked shortcut: ${e.key}`);
      }
    };

    const handleSelectStart = (e) => {
      e.preventDefault();
    };

    const handleBeforeUnload = (e) => {
      addViolation("page-refresh", "Page refresh / close attempted");
      e.preventDefault();
      e.returnValue = "";
    };

    const handlePopState = () => {
      addViolation("navigation", "Back/forward navigation");
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("copy", handleCopy, true);
    document.addEventListener("cut", handleCut, true);
    document.addEventListener("paste", handlePaste, true);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("selectstart", handleSelectStart);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    // Fullscreen detection
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        addViolation("fullscreen-exit", "Exited fullscreen mode");
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("copy", handleCopy, true);
      document.removeEventListener("cut", handleCut, true);
      document.removeEventListener("paste", handlePaste, true);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("selectstart", handleSelectStart);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (retryFsRef.current) clearTimeout(retryFsRef.current);
    };
  }, [enabled, addViolation]);

  return {
    warnings,
    terminated,
    violations: violationsRef.current,
    reset: () => {
      violationsRef.current = [];
      setWarnings(0);
      setTerminated(false);
      prevCountRef.current = 0;
    },
  };
}
