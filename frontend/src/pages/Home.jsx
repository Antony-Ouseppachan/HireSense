function Home({ user }) {
  return (
    <div className="page-container">
      <h1>HireSense</h1>
      <p>AI-powered interview preparation and assessment for candidates who want to improve confidence, answers, and presentation skills.</p>
      <div className="home-boxes">
        <div className="card">
          <h2>Interview Prep</h2>
          <p>{user ? "Start a mock interview or review past sessions." : "Login to begin practicing your interview skills."}</p>
        </div>
        <div className="card">
          <h2>{user ? `Welcome back, ${user.email}` : "Get started"}</h2>
          <p>{user ? "Your next mock interview is ready." : "Login to begin your training."}</p>
        </div>
      </div>
    </div>
  );
}

export default Home;
