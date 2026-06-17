import { Link } from "react-router-dom";

function Navbar({ user }) {
  return (
    <header className="navbar">
      <div className="nav-left">
        <Link to="/" className="brand">HireSense</Link>
        <Link to="/interviews">Interview Prep</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/profile">Profile</Link>
      </div>
      <div className="nav-right">
        {user && (
          <>
            <span>{user.email}</span>
          </>
        )}
      </div>
    </header>
  );
}

export default Navbar;
