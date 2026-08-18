import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getInterviewById,
  submitInterviewResponses,
  analyzeTextFluency,
} from "../services/apiService";

const emptyAnalysis = {
  fluencyScore: 0,
  level: "Waiting",
  wordCount: 0,
  sentenceCount: 0,
  averageSentenceLength: 0,
  vocabularyRichness: 0,
  readabilityScore: 0,
  fillerWordCount: 0,
  fillerWords: [],
  repetition: [],
  transitionUsage: 0,
  sentenceQuality: 0,
  feedback: [],
};

function FluencyMeter({ score }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="fluency-meter">
      <div className="fluency-meter-top">
        <span>Fluency Score</span>
        <strong>{safeScore}/100</strong>
      </div>
      <div className="fluency-meter-track">
        <div className="fluency-meter-fill" style={{ width: `${safeScore}%` }} />
      </div>
    </div>
  );
}

function FluencyAnalysisCard({ analysis, title = "NLP Fluency Analysis" }) {
  const data = analysis || emptyAnalysis;

  return (
    <div className="fluency-card">
      <div className="fluency-card-header">
        <div>
          <h3>{title}</h3>
          <p>Text processing, vocabulary, readability and speaking-flow signals.</p>
        </div>
        <span className={`fluency-level level-${String(data.level || "waiting").toLowerCase().replace(/\s+/g, "-")}`}>
          {data.level || "Waiting"}
        </span>
      </div>

      <FluencyMeter score={data.fluencyScore} />

      <div className="fluency-stats">
        <div><span>Words</span><strong>{data.wordCount ?? 0}</strong></div>
        <div><span>Sentences</span><strong>{data.sentenceCount ?? 0}</strong></div>
        <div><span>Avg. sentence</span><strong>{data.averageSentenceLength ?? 0}</strong></div>
        <div><span>Vocabulary</span><strong>{Math.round((data.vocabularyRichness || 0) * 100)}%</strong></div>
        <div><span>Readability</span><strong>{data.readabilityScore ?? 0}</strong></div>
        <div><span>Fillers</span><strong>{data.fillerWordCount ?? 0}</strong></div>
      </div>

      <div className="fluency-details">
        <div>
          <h4>Filler words</h4>
          {data.fillerWords?.length ? (
            <div className="fluency-tags">
              {data.fillerWords.map((item) => (
                <span key={item.word}>{item.word} ×{item.count}</span>
              ))}
            </div>
          ) : (
            <p className="fluency-muted">None detected.</p>
          )}
        </div>

        <div>
          <h4>Repeated words</h4>
          {data.repetition?.length ? (
            <div className="fluency-tags">
              {data.repetition.map((item) => (
                <span key={item.word}>{item.word} ×{item.count}</span>
              ))}
            </div>
          ) : (
            <p className="fluency-muted">No significant repetition.</p>
          )}
        </div>
      </div>

      {data.feedback?.length > 0 && (
        <div className="fluency-feedback">
          <h4>Suggestions</h4>
          <ul>
            {data.feedback.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function InterviewSession() {
  const { id } = useParams();
  const [interview, setInterview] = useState(null);
  const [responses, setResponses] = useState([]);
  const [liveAnalysis, setLiveAnalysis] = useState({});
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [analyzing, setAnalyzing] = useState({});
  const [overallFluency, setOverallFluency] = useState(null);

  useEffect(() => {
    async function loadInterview() {
      try {
        const data = await getInterviewById(id);
        setInterview(data);
        const initial = (data.questions || []).map((question, index) => ({
          question: question.question || `Question ${index + 1}`,
          answer: data.responses?.[index]?.answer || ""
        }));
        setResponses(initial);

        const savedFeedback = Array.isArray(data.feedback) ? data.feedback : [];
        const restored = {};
        savedFeedback.forEach((item) => {
          if (item.fluency) restored[item.questionIndex] = item.fluency;
        });
        setLiveAnalysis(restored);
        if (data.fluency?.overallScore != null) {
          setOverallFluency(data.fluency.overallScore);
        }
      } catch (err) {
        setError("Unable to load interview session.");
      }
    }

    if (id) loadInterview();
  }, [id]);

  const handleResponseChange = (index, value) => {
    setResponses((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], answer: value };
      return next;
    });

    // Debounced local-to-server NLP analysis for the current answer.
    window.clearTimeout(window.__hireSenseNlpTimer?.[index]);
    window.__hireSenseNlpTimer = window.__hireSenseNlpTimer || {};

    if (!value.trim()) {
      setLiveAnalysis((prev) => ({ ...prev, [index]: emptyAnalysis }));
      return;
    }

    setAnalyzing((prev) => ({ ...prev, [index]: true }));
    window.__hireSenseNlpTimer[index] = window.setTimeout(async () => {
      try {
        const analysis = await analyzeTextFluency({ text: value });
        setLiveAnalysis((prev) => ({ ...prev, [index]: analysis }));
      } catch (err) {
        console.warn("Live NLP analysis failed:", err);
      } finally {
        setAnalyzing((prev) => ({ ...prev, [index]: false }));
      }
    }, 500);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const updated = await submitInterviewResponses(id, { responses });
      setInterview(updated);
      setSubmitted(true);
      setError(null);
      setOverallFluency(updated.fluency?.overallScore ?? null);

      const updatedAnalysis = {};
      (updated.feedback || []).forEach((item) => {
        if (item.fluency) updatedAnalysis[item.questionIndex] = item.fluency;
      });
      setLiveAnalysis(updatedAnalysis);
    } catch (err) {
      setError("Failed to submit interview responses.");
    }
  };

  if (error) return <div className="page-container"><p>{error}</p></div>;
  if (!interview) return <div className="page-container"><p>Loading interview session...</p></div>;

  return (
    <div className="page-container interview-session-page">
      <div className="interview-session-heading">
        <div>
          <h1>Mock Interview Session</h1>
          <p>Launched on {new Date(interview.created_at).toLocaleString()}</p>
        </div>
        {overallFluency != null && (
          <div className="overall-fluency-pill">
            <span>Overall Fluency</span>
            <strong>{overallFluency}/100</strong>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="form-card">
        {responses.map((item, index) => (
          <div key={index} className="question-block">
            <label>{item.question}</label>
            <textarea
              value={item.answer}
              onChange={(e) => handleResponseChange(index, e.target.value)}
              rows="5"
              placeholder="Type your answer here. HireSense will analyze your text for clarity and fluency."
            />

            <div className="live-nlp-status">
              {analyzing[index] ? "Analyzing text…" : item.answer?.trim() ? "NLP analysis updated" : "Enter an answer to start NLP analysis"}
            </div>

            {item.answer?.trim() && (
              <FluencyAnalysisCard
                analysis={liveAnalysis[index]}
                title={`Question ${index + 1} — Text Processing & Fluency`}
              />
            )}
          </div>
        ))}

        <button type="submit">Submit responses</button>
      </form>

      {submitted && interview.score != null && (
        <div className="card interview-feedback-card">
          <h2>Interview feedback</h2>
          <p>Score: {interview.score}</p>

          {interview.fluency?.overallScore != null && (
            <div className="overall-fluency-summary">
              <FluencyMeter score={interview.fluency.overallScore} />
              <p>
                The NLP engine analyzed {interview.fluency.answeredCount} of {interview.fluency.totalQuestions} responses.
              </p>
            </div>
          )}

          {interview.feedback?.length > 0 && (
            <div>
              {interview.feedback.map((item) => (
                <div className="feedback-item" key={item.questionIndex}>
                  <strong>Question {item.questionIndex + 1}</strong>
                  <p>{item.comment}</p>
                  <span>Rating: {item.rating}/5</span>
                  {item.fluency && <FluencyAnalysisCard analysis={item.fluency} title="Response NLP results" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default InterviewSession;
