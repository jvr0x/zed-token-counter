// Token Counter Language Server
//
// Provides CodeLens at line 1 of supported files showing LLM token counts
// for GPT-4 (cl100k_base), GPT-4o (o200k_base), and a Claude estimate.

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
  } catch (e) {
    connection.console.error("Failed to initialize tokenizers: " + e.message);
  }

  return {
    capabilities: {
      textDocumentSync: 1, // Full document sync
      codeLensProvider: { resolveProvider: false },
    },
  };
});

connection.onCodeLens((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  const text = doc.getText();
  if (text.length === 0) return [];

  const counts = getTokenCounts(doc.uri, doc.version, text);

  const parts = [];
  if (counts.cl100k > 0) parts.push(`GPT-4: ${fmt(counts.cl100k)}`);
  if (counts.o200k > 0) parts.push(`GPT-4o: ${fmt(counts.o200k)}`);
  parts.push(`~Claude: ${fmt(counts.claude)}`);
  parts.push(`Chars: ${fmt(counts.chars)}`);

  return [
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      command: {
        title: parts.join(" | "),
        command: "",
      },
    },
  ];
});

// Notify the client to refresh code lenses when a document changes
documents.onDidChangeContent(() => {
  connection.sendNotification("workspace/codeLens/refresh");
});

// Clean up cached counts when a document is closed
documents.onDidClose((e) => {
  cache.delete(e.document.uri);
});

documents.listen(connection);
connection.listen();
