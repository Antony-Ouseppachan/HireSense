/**
 * Lightweight NLP/Text Processing + Fluency Analysis.
 *
 * This service intentionally uses deterministic local NLP heuristics so the
 * feature works without an external AI/NLP API. It tokenizes text, detects
 * filler/repeated words, estimates readability, lexical richness, sentence
 * quality, and combines those signals into a 0-100 fluency score.
 */

const FILLER_WORDS = new Set([
  "um", "uh", "erm", "hmm", "like", "basically", "actually", "literally",
  "well", "you know", "i mean", "sort of", "kind of", "okay", "ok"
]);

const TRANSITION_WORDS = new Set([
  "first", "second", "third", "finally", "however", "therefore", "because",
  "although", "also", "moreover", "furthermore", "for example", "for",
  "instance", "then", "next", "overall", "while", "instead", "thus"
]);

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function tokenize(text) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter(Boolean);
}

function splitSentences(text) {
  const cleaned = cleanText(text);
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[.!?])\s+|(?<=[.!?])$/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;

  const normalized = w
    .replace(/(?:[^laeiouy]e)$/i, "")
    .replace(/^y/i, "");

  const matches = normalized.match(/[aeiouy]{1,2}/gi);
  return Math.max(1, matches ? matches.length : 1);
}

function fleschReadingEase(wordCount, sentenceCount, syllableCount) {
  if (!wordCount || !sentenceCount) return 0;
  return clamp(
    206.835 -
      1.015 * (wordCount / sentenceCount) -
      84.6 * (syllableCount / wordCount),
    0,
    100
  );
}

function percentage(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 100) : 0;
}

function detectFillers(cleanedText, words) {
  const lower = cleanedText.toLowerCase();
  const found = [];

  for (const filler of FILLER_WORDS) {
    if (filler.includes(" ")) {
      const escaped = filler.replace(/\s+/g, "\\s+");
      const re = new RegExp(`\\b${escaped}\\b`, "gi");
      const matches = lower.match(re);
      if (matches?.length) found.push({ word: filler, count: matches.length });
    } else {
      const count = words.filter((w) => w === filler).length;
      if (count) found.push({ word: filler, count });
    }
  }

  return found.sort((a, b) => b.count - a.count);
}

function detectRepeatedWords(words) {
  const counts = {};
  for (const word of words) {
    if (word.length < 3) continue;
    counts[word] = (counts[word] || 0) + 1;
  }

  return Object.entries(counts)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));
}

function detectRepeatedBigrams(words) {
  const counts = {};
  for (let i = 0; i < words.length - 1; i++) {
    const key = `${words[i]} ${words[i + 1]}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  return Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase, count]) => ({ phrase, count }));
}

function analyzeText(text) {
  const cleaned = cleanText(text);
  const words = tokenize(cleaned);
  const sentences = splitSentences(cleaned);
  const wordCount = words.length;
  const sentenceCount = sentences.length;

  if (!cleaned || wordCount === 0) {
    return {
      fluencyScore: 0,
      level: "Insufficient text",
      wordCount: 0,
      sentenceCount: 0,
      averageSentenceLength: 0,
      uniqueWordCount: 0,
      vocabularyRichness: 0,
      lexicalDiversity: 0,
      fillerWords: [],
      fillerWordCount: 0,
      repetition: [],
      repeatedPhrases: [],
      readabilityScore: 0,
      transitionUsage: 0,
      sentenceQuality: 0,
      processing: {
        normalizedText: "",
        tokens: [],
        sentences: []
      },
      feedback: ["Provide a complete answer so the system can evaluate your fluency."]
    };
  }

  const uniqueWords = new Set(words);
  const uniqueWordCount = uniqueWords.size;
  const vocabularyRichness = wordCount ? Number((uniqueWordCount / wordCount).toFixed(2)) : 0;

  const fillers = detectFillers(cleaned, words);
  const fillerCount = fillers.reduce((sum, item) => sum + item.count, 0);
  const repeatedWords = detectRepeatedWords(words);
  const repeatedPhrases = detectRepeatedBigrams(words);

  const avgSentenceLength = sentenceCount ? wordCount / sentenceCount : wordCount;
  const syllableCount = words.reduce((sum, word) => sum + countSyllables(word), 0);
  const readability = fleschReadingEase(wordCount, sentenceCount || 1, syllableCount);

  const transitionCount = words.reduce(
    (sum, word, index) => sum + (TRANSITION_WORDS.has(word) ? 1 : 0),
    0
  );
  const transitionUsage = percentage(transitionCount, sentenceCount);

  const incompleteSentences = sentences.filter((s) => {
    const sentenceWords = tokenize(s);
    return sentenceWords.length < 3;
  }).length;

  const longSentences = sentences.filter((s) => tokenize(s).length > 35).length;
  const sentenceQuality = clamp(
    100 -
      incompleteSentences * 12 -
      longSentences * 8 -
      (avgSentenceLength < 5 ? 15 : 0)
  );

  // Component scores are deliberately transparent and deterministic.
  const lengthScore =
    wordCount >= 80 ? 100 :
    wordCount >= 50 ? 92 :
    wordCount >= 30 ? 82 :
    wordCount >= 15 ? 70 :
    wordCount >= 8 ? 55 :
    35;

  const vocabularyScore = clamp(vocabularyRichness * 100);
  const fillerScore = clamp(100 - fillerCount * 12);
  const repetitionPenalty = repeatedWords.reduce(
    (penalty, item) => penalty + Math.max(0, item.count - 2) * 4,
    0
  );
  const repetitionScore = clamp(100 - repetitionPenalty);
  const readabilityScore = readability;
  const transitionScore = sentenceCount <= 1 ? 75 : clamp(55 + transitionUsage * 2);

  const fluencyScore = Math.round(
    clamp(
      lengthScore * 0.10 +
      vocabularyScore * 0.20 +
      fillerScore * 0.20 +
      repetitionScore * 0.15 +
      readabilityScore * 0.15 +
      sentenceQuality * 0.15 +
      transitionScore * 0.05
    )
  );

  const feedback = [];
  if (fillerCount > 0) {
    feedback.push(`Reduce filler words such as "${fillers[0].word}" to sound more confident.`);
  } else {
    feedback.push("No common filler words were detected.");
  }
  if (vocabularyRichness < 0.45) {
    feedback.push("Use a wider range of vocabulary instead of repeating the same terms.");
  } else {
    feedback.push("Vocabulary variety is healthy for a spoken interview answer.");
  }
  if (avgSentenceLength > 28) {
    feedback.push("Break very long sentences into shorter, clearer ideas.");
  } else if (avgSentenceLength < 6) {
    feedback.push("Expand your answers with a little more context and explanation.");
  } else {
    feedback.push("Sentence length is generally easy to follow.");
  }
  if (repeatedWords.length > 0) {
    feedback.push(`Watch repeated terms such as "${repeatedWords[0].word}".`);
  }
  if (transitionCount === 0 && sentenceCount >= 3) {
    feedback.push("Use transitions such as 'however', 'therefore', or 'for example' to improve flow.");
  }

  let level = "Needs Improvement";
  if (fluencyScore >= 85) level = "Excellent";
  else if (fluencyScore >= 70) level = "Good";
  else if (fluencyScore >= 55) level = "Fair";

  return {
    fluencyScore,
    level,
    wordCount,
    sentenceCount,
    averageSentenceLength: Number(avgSentenceLength.toFixed(1)),
    uniqueWordCount,
    vocabularyRichness,
    lexicalDiversity: percentage(uniqueWordCount, wordCount),
    fillerWords: fillers,
    fillerWordCount: fillerCount,
    repetition: repeatedWords,
    repeatedPhrases,
    readabilityScore: Math.round(readability),
    transitionUsage,
    sentenceQuality: Math.round(sentenceQuality),
    processing: {
      normalizedText: cleaned,
      tokens: words,
      sentences
    },
    feedback: feedback.slice(0, 5)
  };
}

function analyzeResponses(responses) {
  const items = (Array.isArray(responses) ? responses : []).map((response, index) => {
    const answer = typeof response === "string" ? response : response?.answer || "";
    return {
      questionIndex: index,
      answer,
      ...analyzeText(answer)
    };
  });

  const nonEmpty = items.filter((item) => item.wordCount > 0);
  const averageFluency = nonEmpty.length
    ? Math.round(nonEmpty.reduce((sum, item) => sum + item.fluencyScore, 0) / nonEmpty.length)
    : 0;

  return {
    overallFluencyScore: averageFluency,
    analyzedResponses: items,
    answeredCount: nonEmpty.length,
    totalQuestions: items.length
  };
}

module.exports = {
  analyzeText,
  analyzeResponses
};
