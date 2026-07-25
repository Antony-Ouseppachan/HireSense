import { useTheme } from "../context/ThemeContext";

export default function ThemeAmbient() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <>
      {/* Noise texture overlay */}
      <div className="ambient-noise" />

      {/* Light mode floating particles */}
      {isLight && (
        <>
          <div className="ambient-particle" style={{ top: "15%", left: "10%", width: 4, height: 4, animationDelay: "0s", animationDuration: "18s" }} />
          <div className="ambient-particle" style={{ top: "25%", left: "70%", width: 3, height: 3, animationDelay: "2s", animationDuration: "22s" }} />
          <div className="ambient-particle" style={{ top: "55%", left: "20%", width: 5, height: 5, animationDelay: "4s", animationDuration: "16s" }} />
          <div className="ambient-particle" style={{ top: "70%", left: "80%", width: 3, height: 3, animationDelay: "1s", animationDuration: "20s" }} />
          <div className="ambient-particle" style={{ top: "40%", left: "50%", width: 4, height: 4, animationDelay: "3s", animationDuration: "24s" }} />
          <div className="ambient-particle" style={{ top: "85%", left: "35%", width: 3, height: 3, animationDelay: "5s", animationDuration: "19s" }} />
          <div className="ambient-particle" style={{ top: "10%", left: "85%", width: 4, height: 4, animationDelay: "6s", animationDuration: "21s" }} />
          <div className="ambient-particle" style={{ top: "60%", left: "5%", width: 3, height: 3, animationDelay: "7s", animationDuration: "17s" }} />
          {/* Mesh gradient blobs */}
          <div className="ambient-mesh ambient-mesh-1" />
          <div className="ambient-mesh ambient-mesh-2" />
        </>
      )}
    </>
  );
}
