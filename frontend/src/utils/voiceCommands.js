/**
 * Fuzzy Voice Command Parser
 *
 * Instead of exact regex matching, this module uses:
 *   1. A comprehensive homophone / mishearing map
 *   2. Levenshtein distance for words that don't appear in the map
 *   3. Flexible word-order parsing (action can be before or after the number)
 *
 * This makes commands like "gun 5", "fun 3", "dun 2" correctly resolve
 * to "done 5", "done 3", "done 2".
 */

// ── Levenshtein distance ────────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

// ── Phonetic helpers ────────────────────────────────────────────────
// Simple Soundex-inspired grouping for first-pass similarity
function phoneticKey(word) {
  return word
    .toLowerCase()
    .replace(/[aeiou]/g, "0")   // vowels → 0
    .replace(/[bfpv]/g, "1")    // labials
    .replace(/[cgjkqsxz]/g, "2")// gutturals/sibilants
    .replace(/[dt]/g, "3")      // dentals
    .replace(/l/g, "4")
    .replace(/[mn]/g, "5")
    .replace(/r/g, "6")
    .replace(/[hwy]/g, "")      // drop weak consonants
    .replace(/(.)\1+/g, "$1");  // collapse repeats
}

// ── Canonical command words ─────────────────────────────────────────
// Each key is the CANONICAL action, values are known homophones /
// common misrecognitions for that word.

const COOK_START_SYNONYMS = {
  start:    ["start", "started", "shart", "stat", "tart", "chart", "smart"],
  prepare:  ["prepare", "prepared", "repair", "prepair", "prepeare", "prayer", "repare"],
  accept:   ["accept", "accepted", "except", "axcept", "accent", "upset"],
  making:   ["making", "mocking", "marking", "baking", "faking", "taking", "raking", "waking"],
  cooking:  ["cooking", "looking", "booking", "hooking", "cookie", "coking"],
  make:     ["make", "may", "mace", "lake", "bake", "fake", "take", "wake", "rake"],
  cook:     ["cook", "hook", "look", "book", "took", "coke", "kook"],
};

const COOK_FINISH_SYNONYMS = {
  ready:    ["ready", "reddy", "steady", "already", "redy", "freddy", "reddit", "red"],
  done:     ["done", "gun", "fun", "bun", "dun", "run", "sun", "ton", "nun", "won", "dan", "den", "don"],
  finish:   ["finish", "finished", "finnish", "finesse", "vanish"],
};

const SERVER_SERVE_SYNONYMS = {
  serve:    ["serve", "served", "surf", "swerve", "curve", "nerve", "search", "surge", "sir", "server"],
  deliver:  ["deliver", "delivered", "liver", "river", "giver"],
  give:     ["give", "gave", "gift", "live", "jive"],
  take:     ["take", "taken", "cake", "fake", "lake", "make", "sake", "steak"],
  finish:   ["finish", "finished", "finnish", "finesse", "vanish"],
  done:     ["done", "gun", "fun", "bun", "dun", "run", "sun", "ton", "nun", "won", "dan", "den", "don"],
  ready:    ["ready", "reddy", "steady", "already", "redy", "freddy"],
};

// ── Word → Number map (expanded) ───────────────────────────────────
const WORD_TO_NUM = {
  "zero": "0",
  "one": "1", "won": "1", "wan": "1", "on": "1",
  "two": "2", "to": "2", "too": "2", "tu": "2", "do": "2",
  "three": "3", "tree": "3", "free": "3", "fee": "3",
  "four": "4", "for": "4", "fore": "4", "or": "4", "ford": "4",
  "five": "5", "hive": "5", "jive": "5", "dive": "5", "fife": "5",
  "six": "6", "sex": "6", "sick": "6", "mix": "6", "fix": "6",
  "seven": "7", "heaven": "7", "eleven": "7", "sven": "7",
  "eight": "8", "ate": "8", "hate": "8", "late": "8", "wait": "8", "gate": "8",
  "nine": "9", "mine": "9", "wine": "9", "fine": "9", "line": "9", "dine": "9", "vine": "9",
  "ten": "10", "then": "10", "den": "10", "hen": "10", "ben": "10",
  "eleven": "11", "twelve": "12", "thirteen": "13", "fourteen": "14",
  "fifteen": "15", "sixteen": "16", "seventeen": "17", "eighteen": "18",
  "nineteen": "19", "twenty": "20",
};

// ── Core matching logic ─────────────────────────────────────────────

/**
 * Find the best matching canonical action for a given word,
 * using the provided synonym map.
 *
 * Returns { canonical, confidence } or null if no match.
 * confidence: 1 = exact/homophone hit, 0.5+ = fuzzy match
 */
function matchAction(word, synonymMap) {
  const w = word.toLowerCase().trim();
  if (!w || w.length < 2) return null;

  // Pass 1 — exact / homophone lookup
  for (const [canonical, variants] of Object.entries(synonymMap)) {
    if (variants.includes(w)) {
      return { canonical, confidence: 1 };
    }
  }

  // Pass 2 — phonetic key match
  const wKey = phoneticKey(w);
  for (const [canonical, variants] of Object.entries(synonymMap)) {
    for (const v of variants) {
      if (phoneticKey(v) === wKey && wKey.length >= 2) {
        return { canonical, confidence: 0.85 };
      }
    }
  }

  // Pass 3 — Levenshtein distance (max distance = 2 for short words, 3 for longer)
  const maxDist = w.length <= 4 ? 2 : 3;
  let bestMatch = null;
  let bestDist = Infinity;

  for (const [canonical, variants] of Object.entries(synonymMap)) {
    for (const v of variants) {
      const dist = levenshtein(w, v);
      if (dist < bestDist && dist <= maxDist) {
        bestDist = dist;
        bestMatch = { canonical, confidence: Math.max(0.5, 1 - dist * 0.2) };
      }
    }
  }

  return bestMatch;
}

/**
 * Extract a number from a word (digit string or word-number).
 */
function extractNumber(word) {
  const w = word.toLowerCase().trim();
  // Already a digit string
  if (/^\d+$/.test(w)) return w;
  // Known word → number
  if (WORD_TO_NUM[w]) return WORD_TO_NUM[w];
  // Fuzzy match word numbers (e.g. "fiv" → "five" → "5")
  for (const [numWord, numVal] of Object.entries(WORD_TO_NUM)) {
    if (levenshtein(w, numWord) <= 1) return numVal;
  }
  return null;
}

/**
 * Parse a raw speech transcript into { action, tokenNumber } using
 * fuzzy matching against the given synonym map.
 *
 * @param {string}  transcript  — raw text from speech recognition
 * @param {Object}  synonymMap  — e.g. COOK_START_SYNONYMS merged with COOK_FINISH_SYNONYMS
 * @returns {{ action: string, tokenNumber: string, confidence: number } | null}
 */
export function parseVoiceCommand(transcript, synonymMap) {
  // Normalise: lowercase, strip punctuation, collapse whitespace
  const cleaned = transcript
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ");

  // Try every word as a potential action keyword
  let bestAction = null;
  let bestActionIdx = -1;
  let bestConfidence = 0;

  for (let i = 0; i < words.length; i++) {
    const m = matchAction(words[i], synonymMap);
    if (m && m.confidence > bestConfidence) {
      bestAction = m.canonical;
      bestActionIdx = i;
      bestConfidence = m.confidence;
    }
  }

  if (!bestAction) return null;

  // Find the closest number to the action word
  let bestNumber = null;
  let bestNumberDist = Infinity;

  for (let i = 0; i < words.length; i++) {
    if (i === bestActionIdx) continue;
    // Skip filler words
    if (["order", "number", "token", "the", "a", "an", "is", "my", "please", "can", "you"].includes(words[i])) continue;
    const num = extractNumber(words[i]);
    if (num !== null) {
      const dist = Math.abs(i - bestActionIdx);
      if (dist < bestNumberDist) {
        bestNumber = num;
        bestNumberDist = dist;
      }
    }
  }

  if (!bestNumber) return null;

  return {
    action: bestAction,
    tokenNumber: bestNumber,
    confidence: bestConfidence,
  };
}

// ── Pre-built synonym maps for each role ────────────────────────────

/** All cook actions merged into one map */
export const COOK_ACTIONS = { ...COOK_START_SYNONYMS, ...COOK_FINISH_SYNONYMS };

/** All server actions merged into one map */
export const SERVER_ACTIONS = { ...SERVER_SERVE_SYNONYMS };

/** Which canonical actions mean "start cooking" */
export const COOK_START_ACTIONS = new Set(Object.keys(COOK_START_SYNONYMS));

/** Which canonical actions mean "mark ready / finished" */
export const COOK_FINISH_ACTIONS = new Set(Object.keys(COOK_FINISH_SYNONYMS));

/** Which canonical actions mean "mark served" */
export const SERVER_SERVE_ACTIONS = new Set(Object.keys(SERVER_SERVE_SYNONYMS));
