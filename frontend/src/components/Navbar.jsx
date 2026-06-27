import { Link, NavLink } from "react-router-dom";
import "../styles/Navbar.css";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="nav-left">
        <Link to="/" className="brand">
          <svg className="brand-logo" viewBox="0 0 100 100">
            <circle className="logo-ring" cx="50" cy="50" r="40" />
            <polygon className="logo-core" points="50,32 65,42 60,58 40,58 35,42" />
            <circle className="logo-node" cx="50" cy="50" r="5" />
          </svg>
          <span className="brand-text">HIRESENSE</span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>Home</NavLink>
          <NavLink to="/interviews" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>Interview Prep</NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>Dashboard</NavLink>
          <NavLink to="/profile" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>Profile</NavLink>
        </nav>
      </div>
      <div className="nav-right">
        {user ? (
          <div className="user-badge">
            <span className="user-status-dot" />
            <span className="user-email">{user.email}</span>
            <button className="btn btn-secondary" onClick={logout} style={{ marginLeft: "12px" }}>Logout</button>
          </div>
        ) : (
          <NavLink to="/login" className="btn btn-primary">Login</NavLink>
        )}
      </div>
    </header>
  );
}

export default Navbar;
