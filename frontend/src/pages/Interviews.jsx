import { useNavigate } from "react-router-dom";

function Interviews({ user, profile, interviews, onStartInterview }) {
  const navigate = useNavigate();

  const handleStart = async () => {
    const session = await onStartInterview();
    if (session?.id) {
      navigate(`/interviews/${session.id}`);
    }
  };

  return (
    <div className="page-container">
      <h1>Interview Preparation</h1>
      <p>Launch AI-powered mock interviews designed around your profile and skills.</p>

      <div className="card">
        <h2>Ready to practice?</h2>
        <p>Complete your profile and upload your resume to receive tailored interview questions and feedback.</p>
        <button onClick={handleStart}>Start a new mock interview</button>
      </div>

      <div className="card">
        <h2>Previous sessions</h2>
        {interviews.length === 0 ? (
          <p>No mock interviews yet. Start a new session to see your performance history.</p>
        ) : (
          <ul className="session-list">
            {interviews.map((session) => (
              <li key={session.id}>
                <button className="link-button" onClick={() => navigate(`/interviews/${session.id}`)}>
                  Session {session.id} · Score: {session.score ?? "Pending"}
                </button>
                <span>{new Date(session.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Interviews;
