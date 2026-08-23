const test = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateOpenEnded,
  evaluateEnglishAssessment,
} = require("./englishEvaluationService");

test("short answers are scored as insufficient", async () => {
  const result = await evaluateOpenEnded({
    question: "Explain how you would communicate a project delay.",
    answer: "Okay.",
    forceDeterministic: true,
  });

  assert.equal(result.score, 15);
  assert.equal(result.usedLLM, false);
});

test("semantically different professional answers are evaluated without exact matching", async () => {
  const question = "Explain how you collaborated with your team to solve a problem.";
  const answers = [
    "I worked closely with my teammates to identify the issue, divide the work, and deliver a solution before the deadline.",
    "My team discussed the problem, shared responsibilities, and implemented the solution together.",
  ];

  const results = await Promise.all(answers.map((answer) => evaluateOpenEnded({
    question,
    answer,
    rubric: ["collaboration", "solution", "communication"],
    forceDeterministic: true,
  })));

  assert.ok(results.every((result) => result.score >= 40));
  assert.ok(Math.abs(results[0].score - results[1].score) <= 25);
});

test("objective and communication scores are separated", async () => {
  const result = await evaluateEnglishAssessment({
    difficulty: "medium",
    questions: [
      {
        id: 1,
        question_number: 1,
        type: "mcq",
        question: "Choose the correct sentence.",
        options: ["She go", "She goes", "She going", "She gone"],
        correct_answer: "1",
        topic: "grammar",
      },
      {
        id: 2,
        question_number: 2,
        type: "situational",
        question: "Explain how you would communicate a project delay.",
        topic: "situational",
        rubric: ["explain", "plan", "communication"],
      },
    ],
    answers: [1, "I would explain the cause clearly, share a revised plan, and communicate the next steps respectfully."],
  });

  assert.equal(result.categoryScores.englishProficiency, 100);
  assert.ok(Number.isInteger(result.categoryScores.communication));
  assert.equal(result.details.length, 2);
  assert.equal(result.details[1].breakdown.conciseness > 0, true);
});
