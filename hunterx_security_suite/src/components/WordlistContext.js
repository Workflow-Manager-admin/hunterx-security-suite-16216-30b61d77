import React, { useState, useMemo, useCallback, createContext, useContext } from "react";

/** WordlistContext: holds JS/HTML input, current wordlist, status, and stub for future TF-IDF/keyword extraction. */
const WordlistContext = createContext();

export function useWordlist() {
  return useContext(WordlistContext);
}

// PUBLIC_INTERFACE
export function WordlistProvider({ children }) {
  // State: input text (JS/HTML), results (array of keywords), status, error
  const [input, setInput] = useState("");
  const [words, setWords] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | extracting | done
  const [error, setError] = useState(null);

  // Placeholder for actual word extraction logic (TF-IDF, entropy, etc)
  const extractWords = useCallback(() => {
    setStatus("extracting");
    setError(null);
    // For scaffold, extract all alphanumeric word tokens with length >= 4, unique, lowercase.
    setTimeout(() => {
      if (!input.trim()) {
        setError("Input is empty. Paste, drop, or upload JS/HTML.");
        setWords([]);
        setStatus("idle");
        return;
      }
      // Naive extraction, replace later!
      const tokens = Array.from(
        new Set(
          (input.match(/[A-Za-z0-9_\-]{4,}/g) || [])
            .map(w => w.toLowerCase())
        )
      );
      setWords(tokens);
      setStatus("done");
    }, 0);
  }, [input]);

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

  const value = useMemo(() => ({
    input, setInput,
    words, setWords,
    status, setStatus,
    error, setError,
    extractWords,
    exportWordlist,
  }), [input, words, status, error, extractWords, exportWordlist]);

  return <WordlistContext.Provider value={value}>{children}</WordlistContext.Provider>;
}
