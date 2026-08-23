/* ==========================================================
   HireSense — English Deterministic Question Bank
   Priority 1: Zero-token curated questions.
   Covers: Grammar, Vocabulary, Comprehension, Sentence.
   Open-ended types are generated via LLM (Priority 3) with rubric.
   ========================================================== */

const BANK = [
  // ── Grammar (MCQ) ──
  { question: "Choose the correct sentence:", options: ["She don't like coffee.", "She doesn't likes coffee.", "She doesn't like coffee.", "She not like coffee."], correctAnswer: 2, topic: "grammar", difficulty: "easy", explanation: "'She' requires 'doesn't' + base form 'like'." },
  { question: "Identify the error: 'Each of the students have submitted their assignment.'", options: ["Each", "have", "their", "No error"], correctAnswer: 1, topic: "grammar", difficulty: "easy", explanation: "'Each' is singular, so 'has' is correct." },
  { question: "Fill the blank: She has lived here ___ 2018.", options: ["since", "for", "from", "by"], correctAnswer: 0, topic: "grammar", difficulty: "easy", explanation: "'Since' is used with a point in time (2018)." },
  { question: "Which is correct?", options: ["The team are winning.", "The team is winning.", "The team were winning.", "The team have winning."], correctAnswer: 1, topic: "grammar", difficulty: "easy", explanation: "Collective noun 'team' takes singular verb 'is'." },
  { question: "Choose the correct article: ___ university requires strong fundamentals.", options: ["An", "A", "The", "No article"], correctAnswer: 1, topic: "grammar", difficulty: "medium", explanation: "'University' begins with consonant sound /j/, so 'A'." },
  { question: "Identify the error: 'If I was you, I would accept the offer.'", options: ["If", "was", "would", "No error"], correctAnswer: 1, topic: "grammar", difficulty: "medium", explanation: "Subjunctive requires 'If I were you'." },
  { question: "Fill: 'Hardly ___ entered the hall when the lights went off.'", options: ["he had", "had he", "did he", "he"], correctAnswer: 1, topic: "grammar", difficulty: "medium", explanation: "Inversion after 'Hardly': 'Hardly had he...'" },
  { question: "Choose correct preposition: She is superior ___ him in experience.", options: ["than", "to", "from", "over"], correctAnswer: 1, topic: "grammar", difficulty: "medium", explanation: "'Superior' takes 'to', not 'than'." },
  { question: "Which sentence is grammatically correct?", options: ["Not only he passed but also got distinction.", "Not only did he pass but he also got distinction.", "Not only he did pass but also got distinction.", "Not only passed he but also got distinction."], correctAnswer: 1, topic: "grammar", difficulty: "hard", explanation: "Inversion after 'Not only': 'Not only did he pass...'" },
  { question: "Identify the error: 'The data suggests that the policy are effective.'", options: ["data", "suggests", "are", "No error"], correctAnswer: 2, topic: "grammar", difficulty: "hard", explanation: "'Data' is plural in formal use, but 'suggests' is singular; 'are' should be 'is' to match singular verb, or 'data suggest...are'." },

  // ── Vocabulary (MCQ) ──
  { question: "Choose the synonym of 'Meticulous':", options: ["Careless", "Precise", "Hasty", "Lenient"], correctAnswer: 1, topic: "vocabulary", difficulty: "easy", explanation: "Meticulous means showing great attention to detail; precise." },
  { question: "Choose the antonym of 'Abundant':", options: ["Scarce", "Plentiful", "Copious", "Ample"], correctAnswer: 0, topic: "vocabulary", difficulty: "easy", explanation: "Abundant means plentiful; scarce is opposite." },
  { question: "Fill: The manager's decision was ___ by all stakeholders.", options: ["commended", "condemned", "concealed", "compelled"], correctAnswer: 0, topic: "vocabulary", difficulty: "medium", explanation: "Commended = praised; fits professional context." },
  { question: "Choose the correctly spelled word:", options: ["Accomodate", "Accommodate", "Acommodate", "Accomodete"], correctAnswer: 1, topic: "vocabulary", difficulty: "easy", explanation: "Accommodate has double c and double m." },
  { question: "Synonym of 'Ubiquitous':", options: ["Rare", "Omnipresent", "Unique", "Scarce"], correctAnswer: 1, topic: "vocabulary", difficulty: "medium", explanation: "Ubiquitous = present everywhere." },
  { question: "Antonym of 'Verbose':", options: ["Concise", "Wordy", "Elaborate", "Loquacious"], correctAnswer: 0, topic: "vocabulary", difficulty: "medium", explanation: "Verbose = wordy; concise is opposite." },
  { question: "Fill: The report was ___; it covered all edge cases without unnecessary detail.", options: ["verbose", "succinct", "redundant", "vague"], correctAnswer: 1, topic: "vocabulary", difficulty: "hard", explanation: "Succinct = brief and clearly expressed." },
  { question: "Choose the appropriate word: 'The CEO's speech was ___ and inspired confidence.'", options: ["articulate", "inarticulate", "mumbling", "hesitant"], correctAnswer: 0, topic: "vocabulary", difficulty: "hard", explanation: "Articulate = fluent and clear." },

  // ── Sentence Construction (MCQ / ordering) ──
  { question: "Arrange to form a coherent sentence: P: the project / Q: despite many obstacles / R: was completed / S: on time", options: ["Q P R S", "P Q R S", "Q P S R", "P R Q S"], correctAnswer: 0, topic: "sentence", difficulty: "medium", explanation: "Correct order: Despite many obstacles the project was completed on time. Q P R S." },
  { question: "Choose the correctly punctuated sentence:", options: ["Its a beautiful day isn't it?", "It's a beautiful day, isn't it?", "Its a beautiful day, isn't it?", "It's a beautiful day isn't it."], correctAnswer: 1, topic: "sentence", difficulty: "easy", explanation: "Contraction It's + comma before question tag." },
  { question: "Sentence correction: 'He is more smarter than his brother.'", options: ["He is smarter than his brother.", "He is more smarter than his brother.", "He is smartest than his brother.", "No correction needed"], correctAnswer: 0, topic: "sentence", difficulty: "easy", explanation: "Double comparative 'more smarter' is incorrect; use 'smarter'." },
  { question: "Arrange: P: innovation / Q: requires / R: not only creativity / S: but also discipline", options: ["P Q R S", "R P Q S", "P R Q S", "R S P Q"], correctAnswer: 0, topic: "sentence", difficulty: "hard", explanation: "Innovation requires not only creativity but also discipline." },
  { question: "Complete: 'The proposal was rejected ___ it lacked sufficient data.'", options: ["because", "although", "despite", "whereas"], correctAnswer: 0, topic: "sentence", difficulty: "medium", explanation: "'Because' introduces cause." },

  // ── Reading Comprehension — Passage 1 (literal + inference) ──
  { passage: "Remote work has reshaped professional communication. While asynchronous tools like email and documentation reduce interruptions, they demand greater clarity and conciseness. Teams that adopt structured updates and explicit ownership report fewer misunderstandings. However, excessive documentation can create its own noise, burying critical information under routine updates.", question: "According to the passage, what do teams with fewer misunderstandings do?", options: ["Avoid all documentation", "Use structured updates and explicit ownership", "Rely only on synchronous meetings", "Reduce team size"], correctAnswer: 1, topic: "comprehension", difficulty: "medium", explanation: "Passage states structured updates and explicit ownership lead to fewer misunderstandings.", type: "comprehension" },
  { passage: "Remote work has reshaped professional communication. While asynchronous tools like email and documentation reduce interruptions, they demand greater clarity and conciseness. Teams that adopt structured updates and explicit ownership report fewer misunderstandings. However, excessive documentation can create its own noise, burying critical information under routine updates.", question: "What is a drawback of excessive documentation mentioned?", options: ["It increases interruptions", "It buries critical information", "It reduces clarity", "It prevents ownership"], correctAnswer: 1, topic: "comprehension", difficulty: "medium", explanation: "Excessive documentation buries critical information under routine updates." , type: "comprehension" },
  { passage: "Remote work has reshaped professional communication. While asynchronous tools like email and documentation reduce interruptions, they demand greater clarity and conciseness. Teams that adopt structured updates and explicit ownership report fewer misunderstandings. However, excessive documentation can create its own noise, burying critical information under routine updates.", question: "What is the main idea of the passage?", options: ["Remote work eliminates communication", "Asynchronous tools require balancing clarity with volume", "Documentation is always harmful", "Synchronous meetings are obsolete"], correctAnswer: 1, topic: "comprehension", difficulty: "hard", explanation: "Main idea is balancing asynchronous clarity with documentation volume." , type: "comprehension" },

  // ── Passage 2 ──
  { passage: "Effective feedback is specific, timely, and actionable. Vague praise like 'good job' offers little direction, while detailed observations help recipients understand what to repeat or change. Regular, lightweight feedback loops outperform infrequent, formal reviews in driving improvement.", question: "Why is 'good job' considered ineffective feedback?", options: ["It is too specific", "It lacks direction", "It is too timely", "It is overly detailed"], correctAnswer: 1, topic: "comprehension", difficulty: "easy", explanation: "Vague praise offers little direction.", type: "comprehension" },
  { passage: "Effective feedback is specific, timely, and actionable. Vague praise like 'good job' offers little direction, while detailed observations help recipients understand what to repeat or change. Regular, lightweight feedback loops outperform infrequent, formal reviews in driving improvement.", question: "What does the passage recommend over infrequent formal reviews?", options: ["No feedback", "Regular lightweight loops", "Annual reviews only", "Peer ratings"], correctAnswer: 1, topic: "comprehension", difficulty: "medium", explanation: "Regular, lightweight feedback loops outperform formal reviews.", type: "comprehension" },
];

function getDeterministicQuestions({ difficulty, count, excludeIds = new Set() }) {
  const pool = BANK.filter((q) => q.difficulty === difficulty && !excludeIds.has(q.question));
  // Prioritize shuffling without LLM
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((q, idx) => ({
    id: `q${idx + 1}`,
    type: q.type || "mcq",
    question: q.question,
    options: q.options ? [...q.options] : undefined,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    topic: q.topic,
    difficulty: q.difficulty,
    subDifficulty: q.difficulty,
    marks: 1,
    estimatedTime: q.type === "comprehension" ? 90 : 60,
    passage: q.passage || null,
    rubric: null,
  }));
}

function getBankSize() { return BANK.length; }

module.exports = { BANK, getDeterministicQuestions, getBankSize };
