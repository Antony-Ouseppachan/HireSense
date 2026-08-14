import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { getProfile, getInterviews, getAuthenticatedUser, getAptitudeRemarks } from "../services/apiService";

function getDisplayName(user, profile) {
  if (profile?.first_name) {
    const f = profile.first_name.trim();
    if (f) return f.charAt(0).toUpperCase() + f.slice(1);
  }
  if (user?.displayName) return user.displayName;
  if (user?.email) {
    const name = user.email.split("@")[0].replace(/[._]/g, " ");
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return "There";
}

function extractInitials(profile, user) {
  if (profile?.first_name && profile?.last_name)
    return (profile.first_name[0] + profile.last_name[0]).toUpperCase();
  if (profile?.first_name) return profile.first_name[0].toUpperCase();
  const name = getDisplayName(user, profile);
  return name[0]?.toUpperCase() || "?";
}

function computeCompletion(profile) {
  return profile?.completion || { percentage: 0, missing: [] };
}

function computeInterviewStats(interviews) {
  const completed = (interviews || []).filter((i) => i.score != null);
  const total = (interviews || []).length;
  const avgScore = completed.length
    ? Math.round(completed.reduce((s, i) => s + (i.score || 0), 0) / completed.length)
    : 0;
  const bestScore = completed.length
    ? Math.max(...completed.map((i) => i.score || 0))
    : 0;
  return { totalCompleted: completed.length, totalInterviews: total, avgScore, bestScore };
}

function computeActivity(interviews, profile, backendUser) {
  const events = [];
  if (backendUser?.last_login) {
    events.push({ type: "login", label: "Logged In", date: backendUser.last_login, icon: "login" });
  }
  (interviews || []).forEach((iv) => {
    const date = iv.created_at || iv.date;
    if (date) {
      events.push({
        type: "interview",
        label: iv.score != null ? `Completed ${iv.category || "Interview"}` : `Started ${iv.category || "Interview"}`,
        date,
        icon: iv.score != null ? "check" : "play",
        score: iv.score,
      });
    }
  });
  if (profile?.resume_url) {
    events.push({ type: "resume", label: "Uploaded Resume", date: profile.updated_at || new Date().toISOString(), icon: "file" });
  }
  if (profile?.updated_at) {
    events.push({ type: "profile", label: "Updated Profile", date: profile.updated_at, icon: "user" });
  }
  events.sort((a, b) => new Date(b.date) - new Date(a.date));
  return events.slice(0, 10);
}

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(dateStr).toLocaleDateString();
}

function computeTasks(profile) {
  const tasks = [];
  const comp = computeCompletion(profile);
  if (!profile?.first_name) tasks.push({ id: "profile", label: "Complete Your Profile", priority: "high" });
  if (!profile?.resume_url) tasks.push({ id: "resume", label: "Upload Your Resume", priority: "high" });
  if (!profile?.skills?.length) tasks.push({ id: "skills", label: "Add Your Skills", priority: "medium" });
  if (!profile?.education?.length) tasks.push({ id: "education", label: "Add Educational Background", priority: "medium" });
  if (!profile?.weak_areas?.length) tasks.push({ id: "weak", label: "Identify Weak Areas", priority: "low" });
  if (comp.percentage < 100) tasks.push({ id: "complete", label: `Reach 100% Profile Completion (${comp.percentage}%)`, priority: "medium" });
  return tasks;
}

function computeHealth(profile, backendUser) {
  const comp = computeCompletion(profile);
  return {
    profileStrength: comp.percentage,
    securityScore: backendUser?.is_verified ? 80 : 40,
    passwordUpdated: profile?.updated_at || null,
    twoFA: false,
    storageUsed: profile?.resume_url ? 2.4 : 0,
    storageLimit: 50,
    subscription: "Free",
    emailVerified: !!backendUser?.is_verified,
  };
}

export default function useDashboardData() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [backendUser, setBackendUser] = useState(null);
  const [remarks, setRemarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!user?.email) return;
    setError(null);
    try {
      const [prof, ivs, bUser, remarksRes] = await Promise.allSettled([
        getProfile(),
        getInterviews(),
        getAuthenticatedUser(),
        getAptitudeRemarks(),
      ]);
      if (prof.status === "fulfilled") setProfile(prof.value?.profile || null);
      if (ivs.status === "fulfilled") setInterviews(ivs.value || []);
      if (bUser.status === "fulfilled") setBackendUser(bUser.value || null);
      if (remarksRes.status === "fulfilled") setRemarks(remarksRes.value?.remarks || []);
    } catch (e) {
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    if (!authLoading && user?.email) fetchAll();
    if (!authLoading && !user?.email) setLoading(false);
  }, [authLoading, user?.email, fetchAll]);

  useEffect(() => {
    if (!user?.email) return;
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [user?.email, fetchAll]);

  const displayName = useMemo(() => getDisplayName(user, profile), [user, profile]);
  const initials = useMemo(() => extractInitials(profile, user), [profile, user]);
  const completion = useMemo(() => computeCompletion(profile), [profile]);
  const interviewStats = useMemo(() => computeInterviewStats(interviews), [interviews]);
  const activity = useMemo(() => computeActivity(interviews, profile, backendUser), [interviews, profile, backendUser]);
  const tasks = useMemo(() => computeTasks(profile), [profile]);
  const health = useMemo(() => computeHealth(profile, backendUser), [profile, backendUser]);

  return {
    loading,
    error,
    refetch: fetchAll,
    profile,
    interviews,
    backendUser,
    user,
    displayName,
    initials,
    completion,
    interviewStats,
    activity,
    tasks,
    health,
    remarks,
    relativeTime,
  };
}
