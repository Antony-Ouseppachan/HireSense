# HireSense NLP – Text Processing & Fluency Analysis

## Endpoint

`POST /api/nlp/analyze`

Authentication: Firebase Bearer token (same middleware as the existing API).

### Analyze one answer

```json
{
  "text": "I am a computer science student. I enjoy building web applications and solving practical problems."
}
```

The endpoint returns text normalization/tokenization metadata, word and sentence counts, lexical diversity, vocabulary richness, filler words, repeated words, readability, sentence quality, transition usage, a `fluencyScore` from 0–100, and actionable suggestions.

### Analyze all interview responses

```json
{
  "responses": [
    {"answer": "First answer..."},
    {"answer": "Second answer..."}
  ]
}
```

The interview submission endpoint automatically adds the same fluency analysis to each stored feedback item and returns an overall fluency score.

## Scoring signals

The deterministic score combines:
- answer length/completeness
- vocabulary richness
- filler-word usage
- word repetition
- readability
- sentence quality
- transition usage

No external NLP API is required for this feature.
