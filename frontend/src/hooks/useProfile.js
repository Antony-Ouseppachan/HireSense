import { useState } from "react";
import { saveProfile as saveProfileApi, loadProfile as loadProfileApi } from "../services/apiService";

const initialProfile = {
  name: "",
  education: "",
  skills: "",
  experience: "",
  projects: "",
  role: "SDE"
};

export default function useProfile() {
  const [profile, setProfile] = useState(initialProfile);
  const [saved, setSaved] = useState(false);

  const handleChange = (e) => {
    setProfile((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const saveProfile = async () => {
    await saveProfileApi(profile);
    setSaved(true);
    alert("Profile saved 🚀");
  };

  const loadProfile = async () => {
    const data = await loadProfileApi();

    if (Object.keys(data).length > 0) {
      setProfile(data);
      alert("Profile loaded ✔");
    } else {
      alert("No profile found");
    }
  };

  return {
    profile,
    handleChange,
    saveProfile,
    loadProfile,
    saved,
    setSaved
  };
}
