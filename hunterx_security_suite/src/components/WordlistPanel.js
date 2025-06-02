import React, { useRef, useEffect } from "react";
import { useWordlist } from "./WordlistContext";

// PUBLIC_INTERFACE
export default function WordlistPanel() {
  const {
    input, setInput,
    words,
    status,
    error, setError,
    extractWords,
    exportWordlist,
  } = useWordlist();

  const inputRef = useRef();

  // Paste handler (for accessibility)
  const handlePaste = e => {
    const text = e.clipboardData.getData("text/plain");
    setInput(inp => (inp ? inp + "\n" : "") + (text || ""));
    e.preventDefault();
  };

  // Drag & drop file/text
  const handleDrop = e => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = evt => setInput(i => (i ? i + "\n" : "") + (evt.target.result || ""));
      reader.onerror = () => setError("Failed to read dropped file.");
      reader.readAsText(file);
    } else if (e.dataTransfer.getData("text/plain")) {
      setInput(i => (i ? i + "\n" : "") + e.dataTransfer.getData("text/plain"));
    }
  };

  // File upload
  const handleInputFile = ev => {
    const file = ev.target.files && ev.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => setInput(e.target.result + "");
      reader.onerror = () => setError("Failed to read selected file.");
      reader.readAsText(file);
    }
  };

  // Drag & Drop events for textarea
  useEffect(() => {
    const n = inputRef.current;
    if (!n) return;
    const prevent = e => { e.preventDefault(); e.stopPropagation(); };
    n.addEventListener("dragenter", prevent);
    n.addEventListener("dragover", prevent);
    n.addEventListener("drop", handleDrop);
    return () => {
      n.removeEventListener("dragenter", prevent);
      n.removeEventListener("dragover", prevent);
      n.removeEventListener("drop", handleDrop);
    }
    // eslint-disable-next-line
  }, []);

  return (
    <div style={{ padding: "8px 0 0 0" }}>
      <h3 style={{ color: "var(--accent)", fontWeight: 600, marginTop: 7 }}>
        Wordlist Generator
      </h3>
      <p style={{ color: "#ecf6b3", marginTop: 6 }}>
        Generate custom wordlists from intercepted JS/HTML assets. Uses TF-IDF/entropy (coming soon). Export the result for brute-force/fuzz modules.<br />
        <span style={{ color: "#fff6de" }}>
          All input stays local. Paste, upload, or drop files.</span>
      </p>
      <section
        style={{
          background: "#22322a",
          border: "1.4px solid var(--tab-border)",
          borderRadius: 9,
          marginTop: 14,
          padding: "18px 21px 16px 21px",
          color: "#f7fde7",
          fontSize: "1.09em",
        }}
        tabIndex={0}
        aria-label="Wordlist Generator panel"
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 11,
          marginBottom: 13, flexWrap: "wrap"
        }}>
          <input
            type="file"
            accept=".js,.html,.txt"
            style={{ display: "none" }}
            id="wordlist-upload-infile"
            onChange={handleInputFile}
          />
          <label htmlFor="wordlist-upload-infile"
            style={{
              background: "#51664b",
              color: "#e4ffb0",
              border: "1.1px solid #8abb5c",
              borderRadius: 6,
              padding: "7px 18px",
              fontWeight: 600,
              fontSize: "1em",
              cursor: "pointer"
            }}
            tabIndex={0}
          >Upload</label>
          <button
            type="button"
            onClick={() => { navigator.clipboard.readText().then(txt => setInput(i => i + txt)); }}
            style={{
              background: "#2b4a2d",
              color: "#b1e785",
              border: "1.1px solid #2f7a44",
              borderRadius: 6,
              padding: "7px 14px",
              fontWeight: 500,
              fontSize: "1em",
              marginLeft: 0,
              cursor: "pointer"
            }}
            tabIndex={0}
          >Paste</button>
          <button
            type="button"
            onClick={() => setInput("")}
            style={{
              background: "#232233",
              color: "#ceebab",
              border: "1.1px solid #5d446a",
              borderRadius: 6,
              padding: "7px 14px",
              fontWeight: 500,
              fontSize: "1em"
            }}
            tabIndex={0}
          >Clear</button>
          <button
            type="button"
            onClick={extractWords}
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: 6,
              border: "none",
              padding: "7.5px 21px",
              fontWeight: 700,
              marginLeft: 5,
              fontSize: "1.10em",
              boxShadow: "0 1px 6px 0 #80803a30",
              opacity: status === "extracting" ? 0.63 : 1,
              cursor: status === "extracting" ? "wait" : "pointer"
            }}
            aria-label="Extract words from input"
            disabled={status === "extracting"}
          >{status === "extracting" ? "Extracting…" : "Extract Words"}</button>
          <button
            type="button"
            onClick={exportWordlist}
            aria-label="Export wordlist"
            style={{
              background: "#25272c",
              color: "#bcffd9",
              border: "1.1px solid #17c986",
              borderRadius: 6,
              padding: "7px 18px",
              fontWeight: 700,
              marginLeft: 6,
              fontSize: "1.08em",
              cursor: words.length > 0 ? "pointer" : "not-allowed",
              opacity: words.length > 0 ? 1 : 0.57
            }}
            disabled={words.length === 0}
          >
            Export
          </button>
          <span style={{ marginLeft: 15, color: "#aec9ad", fontSize: "1em" }}>
            {status === "done" && words.length > 0
              ? `${words.length} unique words`
              : status === "done"
                ? "No words extracted"
                : ""}
          </span>
        </div>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onPaste={handlePaste}
          rows={7}
          style={{
            width: "100%",
            minHeight: 105,
            fontSize: "1.01em",
            fontFamily: "JetBrains Mono,Fira Mono,monospace",
            color: "#d6ffc4",
            background: "#181f16",
            border: "1.2px solid #327c08",
            borderRadius: 5,
            marginTop: 3, marginBottom: 13, padding: "8px 12px", resize: "vertical"
          }}
          spellCheck={false}
          aria-label="Paste or upload JS/HTML for wordlist extraction"
          placeholder="Paste, upload, or drag JS/HTML here to extract high-value keywords.\n(Tip: Capture traffic or save asset files to use here.)"
          disabled={status === "extracting"}
          tabIndex={0}
        />
        <div style={{
          color: "#b6ebaa",
          fontSize: "0.98em",
          opacity: 0.83,
          marginTop: -8,
          marginBottom: 10
        }}
          aria-live="polite"
        >
          You can <b>paste</b>, <b>drag &amp; drop</b> JS/HTML/text, or <b>upload</b> a file.
        </div>
        {error && (
          <div style={{
            color: "#ff8aae", background: "#2a121c",
            border: "1.2px solid #ff8aae", padding: "7px 15px",
            borderRadius: 7, fontWeight: 600, marginBottom: 9
          }}>
            {error}
          </div>
        )}
        {/* Results area */}
        <div style={{
          marginTop: 7, background: "#111d10",
          border: "1.11px solid #1c3627", borderRadius: 7,
          overflowX: "auto", maxHeight: 164, minHeight: 36,
          padding: "9px 14px"
        }}>
          {status === "idle" && !words.length && (
            <div style={{ color: "#b8cba6", opacity: 0.7 }}>
              Extracted words will appear here.
            </div>
          )}
          {status === "extracting" && (
            <div style={{ color: "#ecd1a0" }}>
              Extracting keywords...
              <span
                style={{
                  display: "inline-block", marginLeft: 10, width: 16, height: 16,
                  border: "3px solid #5aa95e", borderTop: "3px solid var(--accent)",
                  borderRadius: "50%", animation: "spin 1s linear infinite"
                }}
              />
              <style>{'@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}'}</style>
            </div>
          )}
          {status === "done" && words.length === 0 && (
            <div style={{ color: "#bbfdc4", opacity: 0.84 }}>
              No keywords found in your input.
            </div>
          )}
          {status === "done" && words.length > 0 && (
            <pre style={{
              margin: 0, color: "#d0ffe9", background: "none",
              fontFamily: "monospace", fontSize: "1em", maxHeight: 140, overflowY: "auto"
            }}>
{words.join("\n")}
            </pre>
          )}
        </div>
      </section>
      <div
        style={{
          color: "#c5f3b0",
          background: "#253218",
          borderLeft: "5.5px solid #e94560",
          borderRadius: 0,
          marginTop: 12,
          fontSize: "1.01em",
          padding: "12.5px 18px"
        }}
        tabIndex={0}
      >
        <b>Tip:</b> Use output as input to fuzzers or password/passlist attacks. <b>TF-IDF, context scoring, and import from Recon/Proxy coming soon.</b>
      </div>
    </div>
  );
}
