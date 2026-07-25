const { parseLLMJSON, tryParseLLMJSON } = require("./llmParser");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch(e) { console.log("FAIL: " + name + " - " + e.message); failed++; }
}

// 1. Raw JSON object
test("raw JSON object", () => {
  const r = parseLLMJSON('{"a": 1, "b": [2, 3]}');
  if (r.a !== 1) throw new Error("a !== 1");
  if (r.b[1] !== 3) throw new Error("b[1] !== 3");
});

// 2. Markdown-wrapped JSON
test("markdown-wrapped JSON (```json)", () => {
  const r = parseLLMJSON("```json\n{\"a\": 1}\n```");
  if (r.a !== 1) throw new Error("a !== 1");
});

// 3. Markdown-wrapped without json tag
test("markdown-wrapped JSON (```)", () => {
  const r = parseLLMJSON("```\n{\"a\": 1}\n```");
  if (r.a !== 1) throw new Error("a !== 1");
});

// 4. Leading explanatory text
test("leading text", () => {
  const r = parseLLMJSON("Here is your JSON:\n\n{\"a\": 1}");
  if (r.a !== 1) throw new Error("a !== 1");
});

// 5. Trailing text
test("trailing text", () => {
  const r = parseLLMJSON('{"a": 1}\n\nHope this helps!');
  if (r.a !== 1) throw new Error("a !== 1");
});

// 6. Full wrap: text + ```json + json + ``` + text
test("full wrap", () => {
  const r = parseLLMJSON("Here is the data:\n\n```json\n{\"a\": 1}\n```\n\nLet me know if you need anything else.");
  if (r.a !== 1) throw new Error("a !== 1");
});

// 7. Trailing comma
test("trailing comma", () => {
  const r = parseLLMJSON('{"a": 1,}');
  if (r.a !== 1) throw new Error("a !== 1");
});

// 8. Nested trailing comma
test("nested trailing comma", () => {
  const r = parseLLMJSON('{"a": [1, 2,],}');
  if (r.a[1] !== 2) throw new Error("a[1] !== 2");
});

// 9. JSON array
test("JSON array", () => {
  const r = parseLLMJSON("[1, 2, 3]");
  if (r[2] !== 3) throw new Error("r[2] !== 3");
});

// 10. Array with leading text
test("array with leading text", () => {
  const r = parseLLMJSON("Results:\n\n[1, 2, 3]");
  if (r[2] !== 3) throw new Error("r[2] !== 3");
});

// 11. tryParseLLMJSON fallback
test("tryParseLLMJSON returns null on invalid", () => {
  const r = tryParseLLMJSON("not json at all");
  if (r !== null) throw new Error("should be null");
});

// 12. tryParseLLMJSON works on valid JSON
test("tryParseLLMJSON works on valid", () => {
  const r = tryParseLLMJSON('{"x": 10}');
  if (r.x !== 10) throw new Error("x !== 10");
});

// 13. Inline backticks
test("inline backticks", () => {
  const r = parseLLMJSON("`{\"a\": 1}`");
  if (r.a !== 1) throw new Error("a !== 1");
});

// 14. Empty object
test("empty object", () => {
  const r = parseLLMJSON("{}");
  if (Object.keys(r).length !== 0) throw new Error("not empty");
});

// 15. Single quotes
test("single quotes", () => {
  const r = parseLLMJSON("{'a': 1, 'b': 'hello'}");
  if (r.a !== 1) throw new Error("a !== 1");
  if (r.b !== "hello") throw new Error("b !== hello");
});

// 16. Unquoted keys
test("unquoted keys", () => {
  const r = parseLLMJSON("{a: 1, b: 'hello'}");
  if (r.a !== 1) throw new Error("a !== 1");
  if (r.b !== "hello") throw new Error("b !== hello");
});

// 17. Very long text with JSON in middle
test("long text with embedded json", () => {
  const r = parseLLMJSON("Thank you for your request. I have generated the following assessment data for you. ```json\n{\"questions\": [{\"id\": \"q1\", \"type\": \"mcq\"}]}\n``` Please review and let me know if you need any changes.");
  if (!r.questions) throw new Error("no questions");
  if (r.questions[0].id !== "q1") throw new Error("q1 not found");
});

console.log("\nResults: " + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
