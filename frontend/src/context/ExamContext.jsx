import { createContext, useContext, useState, useCallback } from "react";

const ExamContext = createContext(null);

export function ExamProvider({ children }) {
  const [isExamMode, setExamMode] = useState(false);

  const enableExamMode = useCallback(() => setExamMode(true), []);
  const disableExamMode = useCallback(() => setExamMode(false), []);

  return (
    <ExamContext.Provider value={{ isExamMode, enableExamMode, disableExamMode }}>
      {children}
    </ExamContext.Provider>
  );
}

export const useExam = () => useContext(ExamContext);
