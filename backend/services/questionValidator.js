/**
 * questionValidator.js
 * Validates every generated question before saving to PostgreSQL.
 * Returns structured error messages so the generator can regenerate
 * only the failing question (not the entire batch).
 */

const VALID_TYPES = new Set(["mcq", "multiple", "numerical", "boolean", "comprehension"]);
const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

/* Strings that indicate a placeholder / missing option value rather than a
   genuine answer. Rejects empty, whitespace-only and common filler tokens. */
const PLACEHOLDER_PATTERN = /^(\.{3,}|option|options?|choice|choices?|none|nil|null|n\/a|na|tbd|todo|\?{2,}|\.+)$/i;

/**
 * An option is usable only if it is a non-empty string with real content.
 */
function hasOptionValue(option) {
  if (typeof option !== "string") return false;
  const trimmed = option.trim();
  if (trimmed.length === 0) return false;
  if (PLACEHOLDER_PATTERN.test(trimmed)) return false;
  return true;
}

/**
 * Verify every option carries a value. Returns a list of human-readable errors.
 */
function validateOptionValues(q, requiredCount, minLength) {
  const errors = [];
  const options = q.options || [];
  if (options.length !== requiredCount) {
    return [`${q.type} questions must have exactly ${requiredCount} options`];
  }
  options.forEach((opt, i) => {
    if (!hasOptionValue(opt)) {
      errors.push(`Option ${i + 1} is empty or a placeholder (value must be a complete answer, not "${opt}")`);
    } else if (minLength && opt.trim().length < minLength) {
      errors.push(`Option ${i + 1} is too short to be a meaningful answer`);
    }
  });
  return errors;
}

/**
 * Validate a single question object.
 *
 * @param {object} q - The question object from the LLM
 * @param {number} questionNumber - 1-based question number in the assessment
 * @param {string} expectedDifficulty - "easy" | "medium" | "hard"
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateQuestion(q, questionNumber, expectedDifficulty) {
  const errors = [];

  if (!q || typeof q !== "object") {
    return { valid: false, errors: ["Question is null or not an object"] };
  }

  // ── Required fields ──────────────────────────────────────────────────
  const required = ["type", "question", "correctAnswer", "topic", "difficulty"];
  for (const field of required) {
    if (q[field] == null || (typeof q[field] === "string" && q[field].trim() === "")) {
      errors.push(`Missing or empty required field: "${field}"`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  // ── Type validation ──────────────────────────────────────────────────
  if (!VALID_TYPES.has(q.type)) {
    errors.push(`Invalid type "${q.type}". Must be one of: ${[...VALID_TYPES].join(", ")}`);
  }

  // ── Question text ────────────────────────────────────────────────────
  if (typeof q.question !== "string" || q.question.trim().length < 10) {
    errors.push("Question text must be at least 10 characters");
  } else if (PLACEHOLDER_PATTERN.test(q.question.trim())) {
    errors.push("Question text is a placeholder");
  }

  // ── Options validation by type ────────────────────────────────────────
  if (q.type === "mcq") {
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      errors.push("mcq questions must have exactly 4 options");
    } else {
      const nonStrings = q.options.filter((o) => typeof o !== "string");
      if (nonStrings.length > 0) errors.push("All mcq options must be strings");
      if (new Set(q.options).size !== q.options.length) errors.push("Duplicate options found in mcq");
      errors.push(...validateOptionValues(q, 4, 1));
    }
    if (typeof q.correctAnswer !== "number" || q.correctAnswer < 0 || q.correctAnswer > 3) {
      errors.push("mcq correctAnswer must be a 0-based index (0-3)");
    } else if (Array.isArray(q.options) && !hasOptionValue(q.options[q.correctAnswer])) {
      errors.push(`correctAnswer index ${q.correctAnswer} points to an empty option`);
    }
  } else if (q.type === "multiple") {
    if (!Array.isArray(q.options) || q.options.length !== 5) {
      errors.push("multiple (multi-select) questions must have exactly 5 options");
    } else {
      errors.push(...validateOptionValues(q, 5, 1));
    }
    if (!Array.isArray(q.correctAnswer) || q.correctAnswer.length < 1) {
      errors.push("multiple correctAnswer must be a non-empty array of 0-based indices");
    } else {
      for (const idx of q.correctAnswer) {
        if (typeof idx !== "number" || idx < 0 || idx > 4) {
          errors.push(`Invalid index ${idx} in multiple correctAnswer. Must be 0-4.`);
        }
      }
    }
  } else if (q.type === "numerical") {
    if (q.correctAnswer == null || isNaN(Number(q.correctAnswer))) {
      errors.push("numerical correctAnswer must be a numeric string or number");
    }
  } else if (q.type === "boolean") {
    if (!Array.isArray(q.options) || q.options.length !== 2) {
      errors.push("boolean questions must have exactly 2 options");
    } else {
      errors.push(...validateOptionValues(q, 2, 1));
    }
    if (q.correctAnswer !== "True" && q.correctAnswer !== "False") {
      errors.push('boolean correctAnswer must be "True" or "False"');
    }
  }

  // ── Difficulty ───────────────────────────────────────────────────────
  if (!VALID_DIFFICULTIES.has(q.difficulty)) {
    errors.push(`Invalid difficulty "${q.difficulty}". Must be easy/medium/hard`);
  }
  if (q.difficulty !== expectedDifficulty && q.subDifficulty !== expectedDifficulty) {
    errors.push(`Question difficulty "${q.difficulty}" does not match expected "${expectedDifficulty}"`);
  }

  // ── Topic ────────────────────────────────────────────────────────────
  if (typeof q.topic !== "string" || q.topic.trim().length < 2) {
    errors.push("Topic must be a meaningful string");
  }

  // ── Marks ────────────────────────────────────────────────────────────
  if (q.marks != null && (typeof q.marks !== "number" || q.marks < 1 || q.marks > 10)) {
    errors.push("marks must be a number between 1 and 10");
  }

  // ── Solution / Explanation — cosmetic fields, accept string or structured object ──
  if (q.solution != null && (typeof q.solution !== "string" || q.solution.trim().length < 1)) {
    errors.push("solution must be a non-empty string");
  }
  if (q.explanation != null) {
    if (typeof q.explanation === "string") {
      if (q.explanation.trim().length < 1) errors.push("explanation must be a non-empty string");
    } else if (typeof q.explanation === "object" && !Array.isArray(q.explanation)) {
      if (typeof q.explanation.correct !== "string" || q.explanation.correct.trim().length < 1) {
        errors.push("explanation.correct must be a non-empty string");
      }
      (q.options || []).forEach((_, i) => {
        const opt = q.explanation["option" + i];
        if (opt != null && (typeof opt !== "string" || opt.trim().length < 1)) {
          errors.push(`explanation.option${i} must be a non-empty string`);
        }
      });
    } else {
      errors.push("explanation must be a string or an object with 'correct' and per-option explanations");
    }
  }

  // ── Passage for comprehension type ───────────────────────────────────
  if (q.type === "comprehension" && (!q.passage || typeof q.passage !== "string" || q.passage.trim().length < 20)) {
    errors.push("comprehension questions require a passage field with meaningful text");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if two questions are duplicates (same concept, same structure).
 * @param {object} a - First question
 * @param {object} b - Second question
 * @returns {boolean}
 */
function isDuplicate(a, b) {
  if (!a || !b) return false;
  if (a.topic !== b.topic) return false;
  // Same topic + same type + same difficulty → potential duplicate
  if (a.type !== b.type) return false;
  if (a.difficulty !== b.difficulty) return false;
  // Strip numbers and compare question text similarity
  const normalize = (s) => (s || "").replace(/\d+/g, "N").replace(/\s+/g, " ").trim().toLowerCase();
  const textA = normalize(a.question);
  const textB = normalize(b.question);
  if (textA === textB) return true;
  // Check for high similarity (optional deeper check)
  return false;
}

module.exports = { validateQuestion, isDuplicate, hasOptionValue };
