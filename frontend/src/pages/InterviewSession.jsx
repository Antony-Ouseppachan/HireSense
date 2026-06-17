import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getInterviewById, submitInterviewResponses } from "../services/apiService";

function InterviewSession({ token, user }) {
  const { id } = useParams();
  const [interview, setInterview] = useState(null);
  const [responses, setResponses] = useState([]);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function loadInterview() {
      try {
        const data = await getInterviewById(id, token);
        setInterview(data);
        const initial = (data.questions || []).map((question, index) => ({
          question: question.question || `Question ${index + 1}`,
          answer: data.responses?.[index]?.answer || ""
        }));
        setResponses(initial);
      } catch (err) {
        setError("Unable to load interview session.");
      }
    }

    if (id) {
      loadInterview();
    }
  }, [id, token]);

  const handleResponseChange = (index, value) => {
    setResponses((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], answer: value };
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const updated = await submitInterviewResponses(id, { responses }, token);
      setInterview(updated);
      setSubmitted(true);
      setError(null);
    } catch (err) {
      setError("Failed to submit interview responses.");
    }
  };

  if (error) {
    return <div className="page-container"><p>{error}</p></div>;
  }

  if (!interview) {
    return <div className="page-container"><p>Loading interview session...</p></div>;
  }

  return (
    <div className="page-container">
      <h1>Mock Interview Session</h1>
      <p>Launched on {new Date(interview.created_at).toLocaleString()}</p>

      <form onSubmit={handleSubmit} className="form-card">
        {responses.map((item, index) => (
          <div key={index} className="question-block">
            <label>{item.question}</label>
            <textarea
              value={item.answer}
              onChange={(e) => handleResponseChange(index, e.target.value)}
              rows="4"
            />
          </div>
        ))}

        <button type="submit">Submit responses</button>
      </form>

      {submitted && interview.score != null && (
        <div className="card">
          <h2>Interview feedback</h2>
          <p>Score: {interview.score}</p>
          {interview.feedback?.length > 0 && (
            <ul>
              {interview.feedback.map((item) => (
                <li key={item.questionIndex}>
                  <strong>Question {item.questionIndex + 1}:</strong> {item.comment} (Rating: {item.rating}/5)
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default InterviewSession;
