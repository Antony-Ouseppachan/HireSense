import { useMemo } from "react";

function Dashboard({ user, interviews, profile }) {
  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    const fields = [profile.education, profile.skills, profile.experience, profile.resume_url];
    const filled = fields.filter((value) => !!value).length;
    return Math.round((filled / fields.length) * 100);
  }, [profile]);

  const latestScore = interviews?.[0]?.score ?? null;

  return (
    <div className="page-container">
      <h1>Dashboard</h1>
      <div className="grid-list">
        <div className="card">
          <h3>Mock interviews completed</h3>
          <p>{interviews.length}</p>
        </div>
        <div className="card">
          <h3>Profile completion</h3>
          <p>{profileCompletion}%</p>
        </div>
        <div className="card">
          <h3>Latest interview score</h3>
          <p>{latestScore ?? "Not available"}</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
