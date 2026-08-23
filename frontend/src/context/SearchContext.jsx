import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useExam } from "./ExamContext";
import { useAuth } from "./AuthContext";

const SearchContext = createContext(null);

export function SearchProvider({ children }) {
  const [isSearchOpen, setSearchOpen] = useState(false);
  const { isExamMode } = useExam();
  const { firebaseUser } = useAuth();

  const openSearch = useCallback(() => {
    if (!isExamMode && firebaseUser) {
      setSearchOpen(true);
    }
  }, [isExamMode, firebaseUser]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  const toggleSearch = useCallback(() => {
    if (!isExamMode && firebaseUser) {
      setSearchOpen((prev) => !prev);
    }
  }, [isExamMode, firebaseUser]);

  // Handle Ctrl+K / Cmd+K global shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        if (!firebaseUser || isExamMode) return; // Disable search when logged out or during exams
        e.preventDefault();
        toggleSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExamMode, firebaseUser, toggleSearch]);

  // Ensure search is closed if user somehow enters exam mode or logs out while open
  useEffect(() => {
    if (isExamMode || !firebaseUser) {
      setSearchOpen(false);
    }
  }, [isExamMode, firebaseUser]);

  return (
    <SearchContext.Provider
      value={{
        isSearchOpen,
        openSearch,
        closeSearch,
        toggleSearch,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export const useSearch = () => useContext(SearchContext);
