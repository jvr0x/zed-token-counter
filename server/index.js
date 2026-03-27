// Token Counter Language Server
//
// Provides inlay hints showing LLM token counts that follow the viewport.
// The hint is placed at the end of the first visible line, so it stays
// visible as you scroll through the document.

const { createConnection, TextDocuments } = require("vscode-languageserver/node");
const { TextDocument } = require("vscode-languageserver-textdocument");
const { getEncoding } = require("js-tiktoken");

const connection = createConnection();
const documents = new TextDocuments(TextDocument);

// Tokenizer instances (initialized once, reused)
let cl100k = null;
let o200k = null;

// Cache: uri -> { version, counts }
const cache = new Map();

/** Formats a number with locale-aware thousand separators. */
function fmt(n) {
  return n.toLocaleString("en-US");
}

/**
 * Computes token counts for a document, using a cache to skip re-encoding
 * when the document version hasn't changed.
 */
function getTokenCounts(uri, version, text) {
  const cached = cache.get(uri);
  if (cached && cached.version === version) {
    return cached.counts;
  }

  const counts = {
    cl100k: cl100k ? cl100k.encode(text).length : 0,
    o200k: o200k ? o200k.encode(text).length : 0,
    chars: text.length,
    // Claude uses a proprietary tokenizer; ~3.5 chars/token is a reasonable
    // approximation for English text based on empirical observations.
    claude: Math.ceil(text.length / 3.5),
  };

  cache.set(uri, { version, counts });
  return counts;
}

connection.onInitialize(() => {
  try {
    cl100k = getEncoding("cl100k_base");
    o200k = getEncoding("o200k_base");
    connection.console.log("Token Counter: tokenizers initialized");
  } catch (e) {
    connection.console.error("Token Counter: failed to init tokenizers: " + e.message);
  }

  return {
    capabilities: {
      textDocumentSync: 1, // Full document sync
      inlayHintProvider: true,
    },
  };
});

connection.onRequest("textDocument/inlayHint", (params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  const text = doc.getText();
  if (text.length === 0) return [];

  const counts = getTokenCounts(doc.uri, doc.version, text);

  const parts = [];
  if (counts.cl100k > 0) parts.push(`cl100k: ${fmt(counts.cl100k)}`);
  if (counts.o200k > 0) parts.push(`o200k: ${fmt(counts.o200k)}`);
  parts.push(`~Claude: ${fmt(counts.claude)}`);
  parts.push(`Chars: ${fmt(counts.chars)}`);

  // Reason: The inlayHint request includes the visible range. By placing
  // the hint on the first visible line, it "follows" the viewport as you scroll.
  const targetLine = params.range ? params.range.start.line : 0;

  // Find the end of the target line to position the hint after the text
  const lines = text.split("\n");
  const lineText = lines[targetLine] || "";

  return [
    {
      position: { line: targetLine, character: lineText.length },
      label: "  " + parts.join(" | "),
      kind: 1, // Type hint
      paddingLeft: true,
      paddingRight: false,
    },
  ];
});

// Clean up cached counts when a document is closed
documents.onDidClose((e) => {
  cache.delete(e.document.uri);
});

documents.listen(connection);
connection.listen();
