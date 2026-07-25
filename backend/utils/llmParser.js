/**
 * @file llmParser.js — Production-grade LLM JSON sanitizer & parser
 *
 * Features:
 * - Strips markdown fences (```json, ```, `inline`)
 * - Removes leading/trailing explanatory text
 * - Balances braces and brackets
 * - Removes trailing commas & invisible Unicode
 * - Validates structural integrity before parsing
 * - Automatic recovery with multiple strategies
 * - Comprehensive logging (raw, sanitized, parse result, recovery method)
 *
 * Usage:
 *   const { parseLLMJSON } = require("../utils/llmParser");
 *   const data = parseLLMJSON(rawResponse);
 *
 * All AI modules MUST use this utility instead of raw JSON.parse().
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Log structured info without leaking sensitive data.
 * @param {string} label
 * @param {*} value
 */
function log(label, value) {
  if (typeof value === "string" && value.length > 2000) {
    console.log(`[llmParser] ${label}: (${value.length} chars)`);
    console.log(`[llmParser] ${label} (first 500): ${value.slice(0, 500)}`);
    console.log(`[llmParser] ${label} (last 200): ${value.slice(-200)}`);
  } else {
    console.log(`[llmParser] ${label}:`, typeof value === "string" ? value : value);
  }
}

/**
 * Check if a string appears to be JSON (starts with { or [).
 * @param {string} text
 * @returns {boolean}
 */
function looksLikeJSON(text) {
  const t = text.trim();
  return t.startsWith("{") || t.startsWith("[");
}

/**
 * Count occurrences of a character in a string.
 */
function countChar(str, ch) {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === ch) count++;
  }
  return count;
}

/**
 * Check if braces are balanced (ignoring braces inside strings).
 * Simple heuristic — sufficient for recovery.
 */
function areBracesBalanced(text) {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === "{" || ch === "[") depth++;
      if (ch === "}" || ch === "]") depth--;
    }
  }
  return depth === 0;
}

/**
 * Find the last matching closing brace/bracket for the first opening one.
 */
function findMatchingClose(text, open, close) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\" && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (!inStr) {
      if (ch === open) depth++;
      if (ch === close) depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

// ─── Cleaning Pipeline ─────────────────────────────────────────────────────

/**
 * Remove markdown code block fences (```json, ```, `inline`).
 * @param {string} text
 * @returns {string}
 */
function stripMarkdown(text) {
  return text
    // Remove triple backtick blocks with optional json tag
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    // Remove inline backticks
    .replace(/`([^`]+)`/g, "$1");
}

/**
 * Remove any text before the first `{` or `[`.
 * @param {string} text
 * @returns {string}
 */
function stripLeadingText(text) {
  const trimmed = text.trim();
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  let start = -1;
  if (firstBrace >= 0 && firstBracket >= 0) {
    start = Math.min(firstBrace, firstBracket);
  } else if (firstBrace >= 0) {
    start = firstBrace;
  } else if (firstBracket >= 0) {
    start = firstBracket;
  }
  if (start > 0) {
    // Check if there's a proper opening before — could be a JSON key with colon
    return trimmed.slice(start);
  }
  return trimmed;
}

/**
 * Remove any text after the matching closing brace/bracket.
 * @param {string} text
 * @returns {string}
 */
function stripTrailingText(text) {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const firstChar = trimmed[0];
  if (firstChar === "{") {
    const end = findMatchingClose(trimmed, "{", "}");
    return end > 0 ? trimmed.slice(0, end) : trimmed;
  }
  if (firstChar === "[") {
    const end = findMatchingClose(trimmed, "[", "]");
    return end > 0 ? trimmed.slice(0, end) : trimmed;
  }
  return trimmed;
}

/**
 * Remove trailing commas before `}` or `]`.
 * @param {string} text
 * @returns {string}
 */
function removeTrailingCommas(text) {
  return text
    .replace(/,(\s*[}\]])/g, "$1")
    .replace(/,(\s*)$/g, "");
}

/**
 * Remove invisible/zero-width Unicode characters.
 * @param {string} text
 * @returns {string}
 */
function removeInvisibleChars(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF\uFFFE\uFFFF]/g, "");
}

/**
 * Normalize line endings to `\n`.
 * @param {string} text
 * @returns {string}
 */
function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Full cleaning pipeline: normalize → strip markdown → remove invisible →
 * strip leading/trailing text → trailing commas.
 * @param {string} text
 * @returns {string}
 */
function cleanJSONString(text) {
  if (!text || typeof text !== "string") return "";
  let cleaned = text;
  cleaned = normalizeLineEndings(cleaned);
  cleaned = removeInvisibleChars(cleaned);
  cleaned = stripMarkdown(cleaned);
  cleaned = stripLeadingText(cleaned);
  cleaned = stripTrailingText(cleaned);
  cleaned = removeTrailingCommas(cleaned);
  return cleaned.trim();
}

// ─── Validation ────────────────────────────────────────────────────────────

/**
 * Validate that a string is structurally sound JSON.
 * @param {string} text
 * @returns {{ valid: boolean, error?: string }}
 */
function validateJSON(text) {
  if (!text) return { valid: false, error: "Empty response" };
  if (!looksLikeJSON(text)) return { valid: false, error: "Does not start with { or [" };

  const firstChar = text.trim()[0];

  // Quick structural checks
  if (firstChar === "{") {
    if (!text.trim().endsWith("}") && !text.trim().endsWith("}")) {
      // Might still be valid if we check balanced braces
    }
  }

  if (!areBracesBalanced(text)) {
    return { valid: false, error: "Unbalanced braces/brackets" };
  }

  // Try a real parse
  try {
    JSON.parse(text);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ─── Recovery Strategies ────────────────────────────────────────────────────

/**
 * Try multiple recovery strategies on invalid JSON.
 * @param {string} text
 * @returns {{ recovered: boolean, text: string, method: string }}
 */
function recoverJSON(text) {
  let attempt = text;

  // Strategy 1: Trim whitespace
  attempt = attempt.trim();

  // Try parsing after basic clean
  try { JSON.parse(attempt); return { recovered: true, text: attempt, method: "trim" }; } catch (_) { /* continue */ }

  // Strategy 2: Remove trailing commas more aggressively
  const noTrail = attempt
    .replace(/,(\s*[}\]])/g, "$1")
    .replace(/,(\s*)$/g, "");
  if (noTrail !== attempt) {
    try { JSON.parse(noTrail); return { recovered: true, text: noTrail, method: "trailing-commas" }; } catch (_) { /* continue */ }
    attempt = noTrail;
  }

  // Strategy 3: Try extracting just the JSON object/array with regex extraction
  // Extract {...} or [...] using greedy matching
  const objMatch = attempt.match(/\{(?:[^{}]|(\{[^{}]*\}))*\}/s);
  if (objMatch) {
    try { JSON.parse(objMatch[0]); return { recovered: true, text: objMatch[0], method: "extract-object" }; } catch (_) { /* continue */ }
  }

  const arrMatch = attempt.match(/\[(?:[^\[\]]|(\[[^\[\]]*\]))*\]/s);
  if (arrMatch) {
    try { JSON.parse(arrMatch[0]); return { recovered: true, text: arrMatch[0], method: "extract-array" }; } catch (_) { /* continue */ }
  }

  // Strategy 4: More aggressive extraction — find outermost { or [ and grab to matching close
  const trimmed = attempt.trim();
  if (trimmed.startsWith("{")) {
    const end = findMatchingClose(trimmed, "{", "}");
    if (end > 0) {
      const extracted = trimmed.slice(0, end);
      const cleaned = removeTrailingCommas(extracted);
      try { JSON.parse(cleaned); return { recovered: true, text: cleaned, method: "matched-braces" }; } catch (_) { /* continue */ }
    }
  }
  if (trimmed.startsWith("[")) {
    const end = findMatchingClose(trimmed, "[", "]");
    if (end > 0) {
      const extracted = trimmed.slice(0, end);
      const cleaned = removeTrailingCommas(extracted);
      try { JSON.parse(cleaned); return { recovered: true, text: cleaned, method: "matched-brackets" }; } catch (_) { /* continue */ }
    }
  }

  // Strategy 5: Fix common JSON syntax issues — unquoted keys, single quotes
  const fixed = attempt
    // Replace single quotes with double quotes
    .replace(/'/g, '"')
    // Fix unquoted keys (word before colon not in quotes)
    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    // Remove trailing commas again after fix
    .replace(/,(\s*[}\]])/g, "$1");
  try { JSON.parse(fixed); return { recovered: true, text: fixed, method: "quote-fix" }; } catch (_) { /* continue */ }

  return { recovered: false, text: attempt, method: "none" };
}

// ─── Main Parser ────────────────────────────────────────────────────────────

/**
 * Parse an LLM response string into a JavaScript value.
 *
 * Pipeline:
 *   1. Clean (normalize, strip markdown, remove invisible, strip text)
 *   2. Validate
 *   3. Parse (if valid)
 *   4. Recover (if invalid)
 *   5. Retry parse (if recovered)
 *   6. Return result or throw
 *
 * @param {string} rawText — Raw response from the LLM
 * @param {object} [options]
 * @param {boolean} [options.debug=false] — Log each step for debugging
 * @returns {object|Array} Parsed JSON value
 * @throws {Error} If parsing fails after all recovery attempts
 */
function parseLLMJSON(rawText, options = {}) {
  const debug = options.debug === true;
  const startTime = Date.now();

  if (debug) log("Raw input", rawText);

  // Step 1: Clean
  const cleaned = cleanJSONString(rawText);
  if (debug) log("After clean", cleaned);

  if (!cleaned) {
    throw new Error("LLM returned empty response after cleaning");
  }

  // Step 2: Validate
  const validation = validateJSON(cleaned);
  if (debug) log("Validation", validation);

  // Step 3: Parse (if already valid)
  if (validation.valid) {
    try {
      const parsed = JSON.parse(cleaned);
      const elapsed = Date.now() - startTime;
      console.log(`[llmParser] Parsed OK (${elapsed}ms, no recovery needed)`);
      return parsed;
    } catch (e) {
      // Fall through to recovery
      if (debug) log("Unexpected parse failure", e.message);
    }
  }

  // Step 4: Recover
  if (debug) log("Attempting recovery...", "");
  const recovery = recoverJSON(cleaned);
  if (debug) log("Recovery result", recovery);

  if (recovery.recovered) {
    try {
      const parsed = JSON.parse(recovery.text);
      const elapsed = Date.now() - startTime;
      console.log(`[llmParser] Parsed OK (${elapsed}ms, recovery: ${recovery.method})`);
      return parsed;
    } catch (e) {
      if (debug) log("Recovery parse failed", e.message);
    }
  }

  // Step 5: Total failure
  const elapsed = Date.now() - startTime;
  const errorMsg = `Failed to parse LLM response after all recovery attempts (${elapsed}ms). Recovery method: ${recovery.method}`;
  console.error(`[llmParser] ${errorMsg}`);
  if (debug) log("Raw text that failed", rawText);
  if (debug) log("Cleaned text that failed", cleaned);

  throw new Error(errorMsg);
}

/**
 * Safe wrapper: returns parsed result or null on failure.
 * Never throws — useful when a fallback is acceptable.
 * @param {string} rawText
 * @param {object} [options]
 * @returns {object|Array|null}
 */
function tryParseLLMJSON(rawText, options = {}) {
  try {
    return parseLLMJSON(rawText, options);
  } catch (e) {
    console.error("[llmParser] tryParseLLMJSON failed:", e.message);
    return null;
  }
}

module.exports = {
  parseLLMJSON,
  tryParseLLMJSON,
  // Exposed for unit testing
  cleanJSONString,
  validateJSON,
  recoverJSON,
  stripMarkdown,
  stripLeadingText,
  stripTrailingText,
  removeTrailingCommas,
  removeInvisibleChars,
  normalizeLineEndings,
};
