/**
 * llmUsageMonitor.js
 * Singleton service that tracks every Groq API call, estimates remaining
 * daily capacity, and logs structured usage reports.
 *
 * Designed for both dev-time observability and future admin-dashboard integration.
 */

const DEFAULT_DAILY_LIMIT = 100000;
const QUESTIONS_PER_DIFFICULTY = { easy: 20, medium: 25, hard: 30 };
const DEFAULT_ESTIMATES = { easy: 12000, medium: 16000, hard: 22000 };

class LLMUsageMonitor {
  constructor(options = {}) {
    this.dailyLimit = options.dailyLimit || parseInt(process.env.GROQ_DAILY_LIMIT || String(DEFAULT_DAILY_LIMIT), 10);

    // Session-level accumulators
    this.sessionInputTokens = 0;
    this.sessionOutputTokens = 0;
    this.sessionTotalTokens = 0;
    this.totalCalls = 0;
    this.totalGenTimeMs = 0;

    // Assessment-level (reset per assessment)
    this.currentAssessment = null;
    this.assessmentQuestionCount = 0;
    this.assessmentRepairs = 0;
    this.assessmentRetries = 0;
    this.assessmentFailures = 0;
    this.assessmentTokens = 0;
    this.assessmentTimeMs = 0;

    // Rolling averages by difficulty
    this.diffStats = {
      easy:   { tokenSum: 0, callCount: 0, assessmentCount: 0 },
      medium: { tokenSum: 0, callCount: 0, assessmentCount: 0 },
      hard:   { tokenSum: 0, callCount: 0, assessmentCount: 0 },
    };
  }

  // ── Core recording ──────────────────────────────────────────────

  /**
   * Record a single LLM call.
   * @param {string}  model
   * @param {number}  inputTokens
   * @param {number}  outputTokens
   * @param {number}  totalTokens
   * @param {number}  durationMs
   * @param {number}  [assessmentId]
   * @param {number}  [questionNumber]
   * @param {string}  [difficulty]  easy|medium|hard
   */
  recordCall(model, inputTokens, outputTokens, totalTokens, durationMs, assessmentId, questionNumber, difficulty) {
    this.sessionInputTokens += inputTokens;
    this.sessionOutputTokens += outputTokens;
    this.sessionTotalTokens += totalTokens;
    this.totalCalls++;
    this.totalGenTimeMs += durationMs;

    if (assessmentId != null) {
      this.assessmentTokens += totalTokens;
      this.assessmentTimeMs += durationMs;
    }

    // Rolling averages per difficulty
    if (difficulty && this.diffStats[difficulty]) {
      this.diffStats[difficulty].tokenSum += totalTokens;
      this.diffStats[difficulty].callCount++;
    }
  }

  // ── Assessment lifecycle ────────────────────────────────────────

  startAssessment(assessmentId) {
    this.currentAssessment = assessmentId;
    this.assessmentQuestionCount = 0;
    this.assessmentRepairs = 0;
    this.assessmentRetries = 0;
    this.assessmentFailures = 0;
    this.assessmentTokens = 0;
    this.assessmentTimeMs = 0;
  }

  incrementQuestionCount() {
    this.assessmentQuestionCount++;
  }

  recordRepair() {
    this.assessmentRepairs++;
  }

  recordRetry() {
    this.assessmentRetries++;
  }

  recordFailure() {
    this.assessmentFailures++;
  }

  /**
   * Mark the current assessment as finished and log the summary.
   * @param {string} [difficulty]
   * @returns {object} summary
   */
  endAssessment(difficulty) {
    if (difficulty && this.diffStats[difficulty]) {
      this.diffStats[difficulty].assessmentCount++;
    }

    const summary = this.getAssessmentSummary();
    this._logAssessmentSummary(summary);

    this.currentAssessment = null;
    return summary;
  }

  // ── Computed statistics ─────────────────────────────────────────

  getAverageTokensPerCall(difficulty) {
    if (!difficulty || !this.diffStats[difficulty]) {
      return this.totalCalls > 0 ? Math.round(this.sessionTotalTokens / this.totalCalls) : 0;
    }
    const s = this.diffStats[difficulty];
    return s.callCount > 0 ? Math.round(s.tokenSum / s.callCount) : 0;
  }

  getEstimatedTestTokens(difficulty) {
    const s = this.diffStats[difficulty];
    if (!s || s.callCount === 0 || s.assessmentCount === 0) {
      return DEFAULT_ESTIMATES[difficulty] || DEFAULT_ESTIMATES.medium;
    }
    const avgPerCall = s.tokenSum / s.callCount;
    const qs = QUESTIONS_PER_DIFFICULTY[difficulty] || 25;
    // Each assessment makes roughly totalCount/BATCH_SIZE + some retry calls
    // Estimate: questions + 20% overhead (retries, single re-gens)
    const estimatedCalls = Math.ceil(qs / 5) + 2;
    return Math.round(avgPerCall * estimatedCalls);
  }

  getRemainingTokens() {
    return Math.max(0, this.dailyLimit - this.sessionTotalTokens);
  }

  getEstimatedRemainingAssessments() {
    const remaining = this.getRemainingTokens();
    return {
      easy:   Math.max(0, Math.floor(remaining / this.getEstimatedTestTokens("easy"))),
      medium: Math.max(0, Math.floor(remaining / this.getEstimatedTestTokens("medium"))),
      hard:   Math.max(0, Math.floor(remaining / this.getEstimatedTestTokens("hard"))),
    };
  }

  getStatistics() {
    const avgTime = this.totalCalls > 0 ? Math.round(this.totalGenTimeMs / this.totalCalls) : 0;
    const avgTokens = this.totalCalls > 0 ? Math.round(this.sessionTotalTokens / this.totalCalls) : 0;
    return {
      sessionInputTokens: this.sessionInputTokens,
      sessionOutputTokens: this.sessionOutputTokens,
      sessionTotalTokens: this.sessionTotalTokens,
      totalCalls: this.totalCalls,
      totalGenTimeMs: this.totalGenTimeMs,
      averageTokensPerCall: avgTokens,
      averageGenerationTimeMs: avgTime,
      remainingTokens: this.getRemainingTokens(),
      remainingAssessments: this.getEstimatedRemainingAssessments(),
      dailyLimit: this.dailyLimit,
    };
  }

  getAssessmentSummary() {
    const q = this.assessmentQuestionCount || 1;
    return {
      assessmentId: this.currentAssessment,
      questions: this.assessmentQuestionCount,
      repairs: this.assessmentRepairs,
      retries: this.assessmentRetries,
      failures: this.assessmentFailures,
      totalTokens: this.assessmentTokens,
      averageTokensPerQuestion: Math.round(this.assessmentTokens / q),
      totalGenerationTimeMs: this.assessmentTimeMs,
      averageGenerationTimeMs: Math.round(this.assessmentTimeMs / q),
    };
  }

  reset() {
    this.sessionInputTokens = 0;
    this.sessionOutputTokens = 0;
    this.sessionTotalTokens = 0;
    this.totalCalls = 0;
    this.totalGenTimeMs = 0;
    this.currentAssessment = null;
    this.assessmentQuestionCount = 0;
    this.assessmentRepairs = 0;
    this.assessmentRetries = 0;
    this.assessmentFailures = 0;
    this.assessmentTokens = 0;
    this.assessmentTimeMs = 0;
    this.diffStats = {
      easy:   { tokenSum: 0, callCount: 0, assessmentCount: 0 },
      medium: { tokenSum: 0, callCount: 0, assessmentCount: 0 },
      hard:   { tokenSum: 0, callCount: 0, assessmentCount: 0 },
    };
  }

  // ── Console logging ─────────────────────────────────────────────

  /**
   * Per-call usage report (logged after every Groq response).
   */
  logUsageReport(model, inputTokens, outputTokens, totalTokens, durationMs, assessmentId, questionNumber, difficulty) {
    const remaining = this.getRemainingTokens();
    const remAssess = this.getEstimatedRemainingAssessments();
    const s = "=".repeat(57);

    console.log("");
    console.log(s);
    console.log("       Groq Usage Report");
    console.log(s);
    console.log(`  Model:                         ${model}`);
    console.log(`  Assessment ID:                 ${assessmentId || "-"}`);
    console.log(`  Question:                      ${questionNumber != null ? questionNumber : "-"}`);
    console.log(`  Difficulty:                    ${difficulty || "-"}`);
    console.log("");
    console.log(`  Input Tokens:                  ${inputTokens}`);
    console.log(`  Output Tokens:                 ${outputTokens}`);
    console.log(`  Total Tokens:                  ${totalTokens}`);
    console.log(`  Session Tokens Used:           ${this.sessionTotalTokens}`);
    console.log("");
    console.log(`  Estimated Daily Limit:         ${this.dailyLimit}`);
    console.log(`  Remaining Tokens:              ${remaining}`);
    console.log("");
    console.log(`  Estimated Remaining Assessments:`);
    console.log(`    Easy (≈${this.getEstimatedTestTokens("easy")}/test):    ${remAssess.easy}`);
    console.log(`    Medium (≈${this.getEstimatedTestTokens("medium")}/test): ${remAssess.medium}`);
    console.log(`    Hard (≈${this.getEstimatedTestTokens("hard")}/test):   ${remAssess.hard}`);
    console.log("");
    console.log(`  Generation Time:               ${durationMs} ms`);
    console.log(s);
    console.log("");
  }

  /**
   * Per-assessment summary (logged when an assessment finishes).
   */
  _logAssessmentSummary(summary) {
    const remaining = this.getRemainingTokens();
    const remAssess = this.getEstimatedRemainingAssessments();
    const avgAssessTokens = this.assessmentQuestionCount > 0
      ? Math.round(this.assessmentTokens / this.assessmentQuestionCount)
      : 0;
    const s = "=".repeat(57);

    console.log("");
    console.log(s);
    console.log("       Assessment Complete - Token Summary");
    console.log(s);
    console.log(`  Questions Generated:           ${summary.questions}`);
    console.log(`  Questions Repaired:            ${summary.repairs}`);
    console.log(`  Questions Regenerated:         ${summary.retries}`);
    console.log(`  Generation Failures:           ${summary.failures}`);
    console.log("");
    console.log(`  Total Tokens (this assessment): ${summary.totalTokens}`);
    console.log(`  Average Tokens / Question:     ${avgAssessTokens}`);
    console.log(`  Average Generation Time:       ${summary.averageGenerationTimeMs} ms`);
    console.log("");
    console.log(`  Session Tokens Used:           ${this.sessionTotalTokens}`);
    console.log(`  Session Avg Tokens / Assessment: ${Math.round(this.sessionTotalTokens / Math.max(1, this.diffStats.easy.assessmentCount + this.diffStats.medium.assessmentCount + this.diffStats.hard.assessmentCount))}`);
    console.log("");
    console.log(`  Remaining Tokens:              ${remaining}`);
    console.log(`  Remaining Assessments:`);
    console.log(`    Easy (≈${this.getEstimatedTestTokens("easy")}/test):    ${remAssess.easy}`);
    console.log(`    Medium (≈${this.getEstimatedTestTokens("medium")}/test): ${remAssess.medium}`);
    console.log(`    Hard (≈${this.getEstimatedTestTokens("hard")}/test):   ${remAssess.hard}`);
    console.log(s);
    console.log("");
  }
}

// Singleton
const monitor = new LLMUsageMonitor({
  dailyLimit: parseInt(process.env.GROQ_DAILY_LIMIT || String(DEFAULT_DAILY_LIMIT), 10),
});

module.exports = monitor;
