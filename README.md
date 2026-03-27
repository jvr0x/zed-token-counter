# Token Counter

A [Zed](https://zed.dev) extension that displays LLM token counts as inline hints in your files.

See at a glance how many tokens your prompts, docs, and config files consume across different models — without leaving the editor.

![Token Counter showing cl100k, o200k, Claude estimate and character count](https://raw.githubusercontent.com/jvr0x/zed-token-counter/master/assets/screenshot.png)

## Features

- **cl100k token count** — exact count using OpenAI's `cl100k_base` tokenizer (GPT-4, GPT-4-turbo)
- **o200k token count** — exact count using OpenAI's `o200k_base` tokenizer (GPT-4o, o1, o3, o4, GPT-5+)
- **Claude estimate** — approximate count (~3.5 chars/token heuristic, since Anthropic's tokenizer is proprietary)
- **Character count** — total characters in the file
- **Viewport-following** — the hint stays visible as you scroll, always showing at the top of your current view
- **Cached** — token counts are cached per document version, so re-encoding only happens when the file changes

## Supported File Types

Markdown, Plain Text, TOML, YAML, JSON

## Installation

### From the Extension Marketplace

1. Open Zed
2. `Cmd+Shift+P` (or `Ctrl+Shift+P` on Linux) → **"zed: extensions"**
3. Search for **"Token Counter"**
4. Click **Install**

### Manual (Dev Extension)

```bash
git clone https://github.com/jvr0x/zed-token-counter.git
```

Then in Zed: `Cmd+Shift+P` → **"zed: install dev extension"** → select the cloned directory.

## Configuration

Make sure inlay hints are enabled in your Zed settings (`settings.json`):

```json
{
  "inlay_hints": {
    "enabled": true,
    "show_other_hints": true
  }
}
```

## How It Works

The extension runs a lightweight Node.js language server (via LSP) that:

1. Receives the file contents from Zed on open/edit
2. Encodes the text with [js-tiktoken](https://github.com/nicktomlin/js-tiktoken) for exact OpenAI token counts
3. Estimates Claude tokens using a character-based heuristic
4. Returns the counts as an [inlay hint](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_inlayHint) positioned at the first visible line

npm dependencies (`vscode-languageserver`, `vscode-languageserver-textdocument`, `js-tiktoken`) are installed automatically on first activation.

## Token Count Accuracy

| Tokenizer | Models | Accuracy |
|-----------|--------|----------|
| `cl100k_base` | GPT-4, GPT-4-turbo | Exact |
| `o200k_base` | GPT-4o, o1, o3, o4, GPT-5+ | Exact |
| ~3.5 chars/token | Claude (all versions) | Approximate (~5-15% variance) |

OpenAI models share tokenizers across versions — `o200k_base` is the latest and is used by all recent models. Claude's tokenizer is proprietary; the estimate is intentionally conservative (may slightly overcount), which is safer for context window budgeting.

## License

[MIT](LICENSE)
