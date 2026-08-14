const Groq = require("groq-sdk");
const { parseLLMJSON } = require("../utils/llmParser");
const monitor = require("./llmUsageMonitor");

let groqClient = null;
let modelName = "llama-3.3-70b-versatile";

function initialize() {
  const apiKey = process.env.GROQ_API_KEY;
  modelName = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  if (!apiKey) {
    console.warn("GROQ_API_KEY is not set. AI features will fail.");
    groqClient = null;
    return;
  }

  groqClient = new Groq({ apiKey, timeout: 60000 });
  console.log("Groq AI initialized");
  console.log("Using model:", modelName);
}

/**
 * Models confirmed to support response_format: { type: "json_object" }.
 * Source: Groq documentation as of 2025.
 */
const JSON_MODE_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
]);

function supportsJsonMode(m) {
  return JSON_MODE_MODELS.has(m);
}

/**
 * Append strict JSON formatting instructions to the last user message.
 * @param {Array} messages
 */
function injectStrictJsonInstruction(messages) {
  const instruction =
    "\n\n---\nSTRICT OUTPUT INSTRUCTION (do not violate):\n" +
    "Return ONLY valid JSON.\n" +
    "Do NOT include markdown.\n" +
    "Do NOT wrap the JSON inside ```.\n" +
    "Do NOT write ```json.\n" +
    "Do NOT include any explanation, introduction, or closing remarks.\n" +
    "Do NOT use bullet points or markdown of any kind.\n" +
    "Your entire response MUST begin with { and end with }.\n" +
    "The response must be directly parsable by JSON.parse().";

  if (messages.length > 0) {
    const last = messages[messages.length - 1];
    if (last.role === "user") {
      last.content += instruction;
    } else {
      messages.push({ role: "user", content: instruction });
    }
  }
}

/**
 * Retry prompt used when the first attempt produced invalid JSON.
 */
const RETRY_PROMPT =
  "The previous response was not valid JSON.\n" +
  "Return ONLY valid JSON.\n" +
  "Do not use markdown.\n" +
  "Do not include explanations.\n" +
  "Your entire response must be a single valid JSON object or array.";

/**
 * Send a chat completion request to Groq and return the PARSED result.
 *
 * Features:
 * - JSON mode (response_format) when the model supports it
 * - Strict JSON instruction appended to the prompt
 * - Automatic recovery from markdown-wrapped / malformed JSON via parseLLMJSON
 * - One automatic retry on parse failure
 * - Graceful fallback if JSON mode is not supported by the model
 *
 * @param {Array} messages - Array of { role, content } objects
 * @param {Object} [options]
 * @param {number} [options.temperature=0.7]
 * @param {number} [options.max_tokens=2048]
 * @param {boolean} [options.jsonMode=true] - Attempt JSON mode (response_format)
 * @returns {Promise<object|Array>} Parsed JSON value
 */
async function askAI(messages, options = {}) {
  if (!groqClient) {
    throw new Error("Groq AI is not initialized. Check GROQ_API_KEY.");
  }

  const temperature = options.temperature ?? 0.7;
  const max_tokens = options.max_tokens ?? 2048;
  const jsonMode = options.jsonMode !== false;

  // Clone messages so we don't mutate the caller's array
  let workingMessages = messages.map((m) => ({ ...m }));

  // Append strict JSON instruction
  injectStrictJsonInstruction(workingMessages);

  // ── Prompt size tracing ─────────────────────────────────────────
  const totalChars = workingMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  const estimatedTokens = Math.ceil(totalChars / 3.5);
  console.log(`[Groq] Model: ${modelName} | Input chars: ${totalChars} | Est. input tokens: ~${estimatedTokens} | max_tokens: ${max_tokens} | Est. total: ~${estimatedTokens + max_tokens}`);

  // ── Track last-call info for the usage report ─────────────────
  let lastUsageInfo = null;

  /**
   * Internal: perform one completion call.
   * @param {Array} msgs
   * @param {boolean} useJsonMode
   * @param {boolean} [isRetry=false]
   * @returns {Promise<string>} Raw text from the LLM
   */
  async function doCall(msgs, useJsonMode, isRetry = false) {
    const startMs = Date.now();
    const body = {
      model: modelName,
      messages: isRetry
        ? [...msgs, { role: "user", content: RETRY_PROMPT }]
        : msgs,
      temperature,
      max_tokens,
    };

    if (useJsonMode && supportsJsonMode(modelName) && !isRetry) {
      body.response_format = { type: "json_object" };
    }

    const completion = await groqClient.chat.completions.create(body);
    const durationMs = Date.now() - startMs;
    const rawText = completion?.choices?.[0]?.message?.content;
    if (rawText == null) throw new Error("Groq returned an empty response.");

    // ── Capture usage from API response, fall back to estimation ─
    const usage = completion?.usage;
    let inTok, outTok, totTok;
    if (usage) {
      inTok = usage.prompt_tokens ?? 0;
      outTok = usage.completion_tokens ?? 0;
      totTok = usage.total_tokens ?? (inTok + outTok);
    } else {
      const inputChars = msgs.reduce((s, m) => s + (m.content?.length || 0), 0);
      inTok = Math.ceil(inputChars / 3.5);
      outTok = Math.ceil((rawText.length || 0) / 4);
      totTok = inTok + outTok;
    }

    monitor.recordCall(
      modelName, inTok, outTok, totTok, durationMs,
      options.assessmentId,
      options.questionNumber,
      options.difficulty
    );
    lastUsageInfo = { inTok, outTok, totTok, durationMs };

    return rawText;
  }

  // ── Attempt 1: try with JSON mode ────────────────────────────────────
  let rawText;
  let usedJsonMode = false;

  if (jsonMode && supportsJsonMode(modelName)) {
    try {
      rawText = await doCall(workingMessages, true, false);
      usedJsonMode = true;
    } catch (err) {
      console.warn(`[askAI] JSON mode failed (${err.message}), retrying without JSON mode`);
      rawText = await doCall(workingMessages, false, false);
    }
  } else {
    rawText = await doCall(workingMessages, false, false);
  }

  // ── Parse ────────────────────────────────────────────────────────────
  try {
    const parsed = parseLLMJSON(rawText, { debug: false });
    if (lastUsageInfo) {
      monitor.logUsageReport(
        modelName,
        lastUsageInfo.inTok, lastUsageInfo.outTok, lastUsageInfo.totTok, lastUsageInfo.durationMs,
        options.assessmentId, options.questionNumber, options.difficulty
      );
    }
    return parsed;
  } catch (parseErr) {
    console.warn(`[askAI] Parse failed: ${parseErr.message}`);
  }

  // ── Attempt 2: retry with stronger instruction ───────────────────────
  console.log("[askAI] Retrying with corrected prompt...");
  const retryText = await doCall(workingMessages, usedJsonMode, true);

  try {
    const parsed = parseLLMJSON(retryText, { debug: false });
    if (lastUsageInfo) {
      monitor.logUsageReport(
        modelName,
        lastUsageInfo.inTok, lastUsageInfo.outTok, lastUsageInfo.totTok, lastUsageInfo.durationMs,
        options.assessmentId, options.questionNumber, options.difficulty
      );
    }
    return parsed;
  } catch (retryErr) {
    console.error(`[askAI] Retry also failed: ${retryErr.message}`);
    throw new Error("AI returned an invalid response format after retry.");
  }
}

/**
 * Get raw text from the LLM without JSON parsing.
 * Useful for non-JSON use cases (chat, summarization, etc.).
 * @param {Array} messages
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
async function askAIText(messages, options = {}) {
  if (!groqClient) {
    throw new Error("Groq AI is not initialized. Check GROQ_API_KEY.");
  }

  const temperature = options.temperature ?? 0.7;
  const max_tokens = options.max_tokens ?? 2048;

  const startMs = Date.now();
  const completion = await groqClient.chat.completions.create({
    model: modelName,
    messages,
    temperature,
    max_tokens,
  });
  const durationMs = Date.now() - startMs;

  const text = completion?.choices?.[0]?.message?.content;
  if (text == null) {
    throw new Error("Groq returned an empty response.");
  }

  const usage = completion?.usage;
  const inputChars = messages.reduce((s, m) => s + (m.content?.length || 0), 0);
  const inTok = usage?.prompt_tokens ?? Math.ceil(inputChars / 3.5);
  const outTok = usage?.completion_tokens ?? Math.ceil((text.length || 0) / 4);
  const totTok = usage?.total_tokens ?? (inTok + outTok);

  monitor.recordCall(modelName, inTok, outTok, totTok, durationMs,
    options.assessmentId, options.questionNumber, options.difficulty);

  return text;
}

// Auto-initialize on module load
initialize();

module.exports = { askAI, askAIText };
