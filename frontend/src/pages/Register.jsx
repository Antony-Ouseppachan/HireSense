import { useState } from "react";

function Register({ onRegister }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("candidate");

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onRegister({ name, email, password, role });
  };

  return (
    <div className="page-container">
      <h1>Register</h1>
      <form onSubmit={handleSubmit} className="form-card">
        <label>Name</label>
        <input value={name} onChange={(event) => setName(event.target.value)} required />

        <label>Email</label>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />

        <label>Password</label>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />

        <label>Role</label>
        <select value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="candidate">Candidate</option>
          <option value="recruiter">Recruiter</option>
        </select>

        <button type="submit">Register</button>
      </form>
    </div>
  );
}

export default Register;
