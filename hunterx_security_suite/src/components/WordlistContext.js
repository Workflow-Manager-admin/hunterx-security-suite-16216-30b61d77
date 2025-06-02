import React, { useState, useMemo, useCallback, createContext, useContext } from "react";

/**
 * WordlistContext: In-browser JS/HTML keyword extraction
 * Provides TF-IDF-based ranking from user input (pasted, dropped, uploaded JS/HTML).
 */
const WordlistContext = createContext();

export function useWordlist() {
  return useContext(WordlistContext);
}

// Tokenization, normalization and content extractor helpers

/**
 * Extract visible text from HTML.
 * Strips tags/scripts/styles/comments, returns all visible text chunks.
 */
function extractTextFromHTML(html) {
  try {
    // DOMParser fails for raw JS; use only when looks HTML-ish.
    if (!/<\w+/.test(html)) return html;
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    let visible = [];
    const walker = doc.createTreeWalker(
      doc.body || doc,
      window.NodeFilter.SHOW_TEXT,
      {
        acceptNode: node => {
          if (!node.parentElement) return window.NodeFilter.FILTER_SKIP;
          const tag = node.parentElement.tagName;
          // Exclude style/script/noscript/template/svg
          if (
            /^(STYLE|SCRIPT|NOSCRIPT|TEMPLATE|SVG|META|HEAD|TITLE|LINK)$/i.test(
              tag
            )
          )
            return window.NodeFilter.FILTER_SKIP;
          if (!node.nodeValue.trim()) return window.NodeFilter.FILTER_SKIP;
          return window.NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    while (walker.nextNode()) {
      visible.push(walker.currentNode.nodeValue);
    }
    return visible.join(" ");
  } catch {
    // fallback if not html
    return html;
  }
}

/**
 * Remove JS comments and extracts strings and identifiers from JS.
 * Uses a best-effort RegEx approach.
 */
function extractTextFromJS(js) {
  // Remove /* ... */ and //... comments
  let noComments = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  // Extract strings, e.g. "foo" 'bar' `baz`
  const strMatches = [
    ...(noComments.match(/"([^"\\]|\\.)*"/g) || []),
    ...(noComments.match(/'([^'\\]|\\.)*'/g) || []),
    ...(noComments.match(/`([\s\S]*?)`/g) || [])
  ].map(s => s.slice(1, -1));
  // Extract identifiers (avoid short ones)
  const idMatches = noComments.match(/\b[a-zA-Z_][a-zA-Z0-9_]{3,}\b/g) || [];
  return [...strMatches, ...idMatches].join(" ");
}

/**
 * Tokenize and normalize input text.
 * Lowercases, removes obvious stopwords, splits on non-word.
 */
function tokenize(text) {
  // Remove obvious code syntax
  text = text.replace(/[^\w\- ]+/g, " ");
  let tokens = text
    .toLowerCase()
    .split(/[\s\|,;\(\)\[\]\{\}<>'"`=\/\\:]+/)
    .filter(w => w.length > 3);
  // Stopwords - basic English, HTTP junk, JS global tokens, numbers
  const STOPWORDS = new Set([
    "the","and","that","are","this","with","which","for","was","you",
    "not","but","all","your","have","can","from","will","has","get","let",
    "function","return","const","var","let","else","null","true","false",
    "typeof","new","try","catch","cookie","async","then","case","some","each","when","also",
    "while","break","else","case","void","const","var","typeof","length","name",
    "http","https","www","body","data","json","href","host","user","type","html","head","meta","form","input","href",
    "request","response","script","src","value","text","error","list","item",
    "document","window","function","return","console","undefined","object",
    "status","title","class","file","line","call","block","elem","node","prop",
    "push","find","set","get","use","send","read","key","put","set","one",
    "next","open","close","show","hide","read","write","exec","copy","default",
    "main","test","code","page","info","result","results","field","fields","options",
    "found","token","jwt","none","bearer","pass","hash","date","desc","load",
    "save","click","rows","cols","tab","tabs","api","post","get","put","delete","patch",
    // numbers up to 9999
    ...Array(10000).fill(0).map((_,i)=>String(i))
  ]);
  return tokens.filter(w => !STOPWORDS.has(w));
}

/**
 * Calculate word frequency for a single "document" (here: the JS/HTML input).
 * @param {string[]} tokens - array of normalized tokens
 * @returns {Map<string, number>} word -> count
 */
function countFrequencies(tokens) {
  const freq = new Map();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return freq;
}

/**
 * Compute TF-IDF for the document. Since we usually have 1 input doc (offline),
 * fallback to "punished frequency" with normalization - i.e. use log dampening,
 * reward rare/long words, penalize near duplicates.
 *
 * Output: Array of {word, score}
 */
function computeTfidfScores(tokens, docText) {
  if (!tokens.length) return [];
  const freq = countFrequencies(tokens);

  // Heuristic: attempt quasi-IDF by ignoring ultra-common keywords
  // If input contains multiple scripts/blobs, segment by <script> or large line breaks
  let n_docs = 1;
  let doclens = [tokens.length];
  let docs = [tokens];

  // Split doc on <script ...> boundaries or large newlines as "pseudo-documents"
  if (/</.test(docText)) {
    // Try splitting HTML per script/style or big text blocks if possible
    let matches = docText.split(/(<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>)/gi)
      .filter(Boolean)
      .map(extractTextFromHTML)
      .filter(txt => txt.trim().length > 40);
    if (matches.length > 1) {
      docs = matches.map(tk => tokenize(tk));
      n_docs = docs.length;
      doclens = docs.map(a=>a.length);
    }
  }

  // Count in how many docs each word occurs (DF)
  const docFreq = new Map();
  for (const d of docs) {
    const seen = new Set();
    for (const w of d) {
      if (seen.has(w)) continue;
      docFreq.set(w, (docFreq.get(w) || 0) + 1);
      seen.add(w);
    }
  }
  // Compute "IDF"
  const idf = w =>
    Math.log((1 + n_docs) / (1 + (docFreq.get(w) || 0))) + 1; // always > 0

  // Compute TF-IDF: f(w,doc) * idf(w)^shallow
  const list = [];
  for (const [w, c] of freq.entries()) {
    // Penalize super-short/obvious words, reward uncommon and long ones
    let tf = c / tokens.length;
    let tfScore = Math.log(1 + c);
    let idfScore = idf(w);
    let lenBonus = 1 + Math.min(w.length-3, 6) * 0.13;
    let score = tfScore * idfScore * lenBonus;
    list.push({
      word: w,
      score:
        score +
        (idfScore > 1.5 ? 0.07 * Math.pow(w.length, 1.2) : 0) // reward rare+long
    });
  }

  // Penalize repeating similar tokens (edit distance = 1-2)
  // Omitted for offline perf. Sorting by score handles near-dupes adequately.

  // Descending order, top 120 only
  return list
    .sort((a, b) => b.score - a.score)
    .slice(0, 120);
}

// PUBLIC_INTERFACE
export function WordlistProvider({ children }) {
  // State: input text (JS/HTML), extracted TF-IDF results, status, error
  const [input, setInput] = useState("");
  const [words, setWords] = useState([]); // array of keyword strings
  const [status, setStatus] = useState("idle"); // idle | extracting | done | error
  const [error, setError] = useState(null);

  // PUBLIC_INTERFACE
  // Performs in-browser TF-IDF keyword/phrase extraction, normalizes + ranks words, updates state
  const extractWords = useCallback(() => {
    setStatus("extracting");
    setError(null);

    setTimeout(() => {
      try {
        let mainText = input.trim();
        if (!mainText) {
          setError("Input is empty. Paste, drop, or upload JS/HTML.");
          setWords([]);
          setStatus("idle");
          return;
        }

        // Trivial binary detection: if mostly non-printable or >25% nulls, refuse extraction
        if (/[\x00-\x08\x0E-\x1F\x80-\x9F]/.test(mainText) && (mainText.length > 280 && (mainText.match(/[\x00-\x08\x0E-\x1F\x80-\x9F]/g) || []).length > mainText.length * 0.25)) {
          setError("Input appears to be a binary file or unsupported encoding.");
          setWords([]);
          setStatus("idle");
          return;
        }

        // autodetect file - HTML/JS/plain
        let text = mainText;
        if (/<html/i.test(mainText) || /<body/i.test(mainText) || /<\w+/.test(mainText)) {
          text = extractTextFromHTML(mainText);
        } else if (
          /\bfunction\b|\bvar\b|\bconst\b|\blet\b|\bwindow\./.test(mainText) ||
          /;|=>|=\>|{|}/.test(mainText)
        ) {
          text = extractTextFromJS(mainText);
        }
        // If still tiny, likely no useful content
        if (!text || text.trim().split(/\s+/).length < 5) {
          setError("No extractable keywords: input too short or not JS/HTML/text.");
          setWords([]);
          setStatus("done");
          return;
        }

        // Core: tokenize & TF-IDF
        const tokens = tokenize(text);
        if (tokens.length < 3) {
          setWords([]);
          setStatus("done");
          setError("Not enough unique keywords could be extracted.");
          return;
        }
        const scored = computeTfidfScores(tokens, mainText);
        if (!scored.length) {
          setWords([]);
          setStatus("done");
          setError("No useful keywords found. Try a larger JS or HTML file.");
          return;
        }
        // Remove low-score noise, deduplicate
        const THRESH = scored.length > 12 ? scored[Math.floor(scored.length / 2)].score * 0.22 : 0.15;
        const result =
          scored
            .filter(({ score }) => score > THRESH)
            .map(({ word }) => word)
            .filter((w, idx, arr) => arr.indexOf(w) === idx);
        setWords(result);
        setStatus("done");
      } catch (err) {
        setStatus("idle");
        setWords([]);
        setError("Error extracting keywords. Try different input.");
      }
    }, 0);
  }, [input]);

  // PUBLIC_INTERFACE
  // Exporter (CSV/txt)
  const exportWordlist = useCallback(() => {
    if (!words || words.length === 0) return;
    // Output as plain text, one word per line
    const blob = new Blob([words.join("\n")], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "custom-wordlist.txt";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 50);
  }, [words]);

  const value = useMemo(
    () => ({
      input,
      setInput,
      words,
      setWords,
      status,
      setStatus,
      error,
      setError,
      extractWords,
      exportWordlist,
    }),
    [input, words, status, error, extractWords, exportWordlist]
  );

  return <WordlistContext.Provider value={value}>{children}</WordlistContext.Provider>;
}
