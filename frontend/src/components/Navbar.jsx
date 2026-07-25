import { Link, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import "../styles/Navbar.css";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Logo from "./Logo";

function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`navbar${scrolled ? " scrolled" : ""}`}>
      <div className="nav-left">
        <Link to="/" className="brand">
          <Logo size={28} variant="mono" className="brand-logo" />
          <span className="brand-text">HIRESENSE</span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>Home</NavLink>
          <NavLink to="/interviews" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>Interview Studio</NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>Dashboard</NavLink>
          <NavLink to="/profile" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>Profile</NavLink>
        </nav>
      </div>
      <div className="nav-right">
        <button className="theme-toggle" onClick={toggle} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
          <svg viewBox="0 0 24 24" fill="none" className="theme-toggle-icon">
            {theme === "dark" ? (
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <>
                <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
        {user ? (
          <div className="user-badge">
            {user.is_verified ? (
              <span className="verified-badge" title="Email verified">
                <svg className="verified-badge-icon" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l2.4 2.2 3.2-.6.9 3.1 3 1.3-1 3.1 1 3.1-3 1.3-.9 3.1-3.2-.6L12 22l-2.4-2.2-3.2.6-.9-3.1-3-1.3 1-3.1-1-3.1 3-1.3.9-3.1 3.2.6L12 2z" fill="currentColor" opacity="0.3" />
                  <path d="M8.5 12.3l2.2 2.2 4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            ) : (
              <Link to="/profile" className="unverified-badge" title="Click to verify your email">
                <span className="unverified-dot" />
                Unverified
              </Link>
            )}
            <span className="user-status-dot" />
            <span className="user-email">{user.email}</span>
            <button className="btn btn-secondary" onClick={logout} style={{ marginLeft: "8px", padding: "6px 14px", fontSize: "11px" }}>Logout</button>
          </div>
        ) : (
          <NavLink to="/login" className="btn btn-primary" style={{ padding: "6px 18px", fontSize: "12px" }}>Login</NavLink>
        )}
      </div>
    </header>
  );
}

export default Navbar;
