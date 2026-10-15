# Paper Diagram Gen

Generate academic paper diagrams from text or let AI describe them for you.

Deterministic SVG engine works offline with zero dependencies. LLM-powered commands use BYOK (Bring Your Own Key) with raw `fetch()` -- no SDK installs needed.

## Quick Start

```bash
# No API key needed -- generate demo diagrams instantly
npx paper-diagram-gen demo

# Generate from arrow notation (deterministic, no API key)
npx paper-diagram-gen generate "Input -> Process -> Output" --type pipeline --output diagram.svg

# Let AI read a paper and generate diagrams (requires API key)
GEMINI_API_KEY=... npx paper-diagram-gen auto paper.md --output-dir ./diagrams
```

## BYOK Setup

Set one environment variable. Providers are tried in this order:

| Priority | Env Var | Provider | Model |
|----------|---------|----------|-------|
| 1st | `GEMINI_API_KEY` | Google Gemini | gemini-3-flash-preview |
| 2nd | `OPENAI_API_KEY` | OpenAI | gpt-5 |
| 3rd | `ANTHROPIC_API_KEY` | Anthropic | claude-sonnet-4-5 |

```bash
# Pick one:
export GEMINI_API_KEY="your-key-here"
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

No SDKs are installed. All API calls use raw `fetch()`.

## Commands

| Command | API Key? | Description |
|---------|----------|-------------|
| `generate "<desc>"` | No | Generate SVG from arrow notation |
| `describe <file>` | Yes | LLM reads paper text, suggests arrow-notation diagrams |
| `auto <file>` | Yes | Chains describe + parse + generate SVG (end-to-end) |
| `demo` | No | Generates 3 example SVGs to `./demo-diagrams/` |

### generate

```bash
paper-diagram-gen generate "Input -> Process -> Output" --type pipeline
paper-diagram-gen generate "Encoder[CNN,RNN] -> Latent -> Decoder" --type architecture --output arch.svg
```

### describe

Reads a paper/document and uses an LLM to suggest diagram descriptions in arrow notation:

```bash
paper-diagram-gen describe paper.txt
```

Output:
```
Suggested diagrams (3):

  1. [pipeline] Shows the end-to-end training pipeline
     Raw Data -> Preprocessing -> Feature Extraction -> Model Training -> Evaluation

  2. [architecture] Illustrates the model architecture
     Input Layer -> Encoder[Self-Attention,FFN] -> Latent -> Decoder -> Output

  3. [flowchart] Training loop with convergence check
     Initialize -> Train -> Converged? -> Yes: Deploy, No: Tune -> Train
```

### auto

Runs the agent on a paper and saves each SVG produced by its `generate_svg` tool:

```bash
paper-diagram-gen auto paper.md --output-dir ./diagrams
```

Each run uses filenames such as `diagram-<run UUID>-01.svg` and prints the actual saved paths. Repeated and concurrent runs can share the directory without replacing earlier files. Filenames are generated locally; the model does not choose them.

The command exits nonzero if no SVG was saved during this run or any file write failed, even if the model later claims completion. Existing files do not count as results from the current run. A failed run preserves any earlier SVGs it already saved; inspect the error before using partial output.

A saved file confirms artifact creation. Review its content for accuracy and paper coverage.

### demo

Generates 3 built-in example SVGs without any API key:

```bash
paper-diagram-gen demo
```

Creates `./demo-diagrams/demo-pipeline.svg`, `demo-architecture.svg`, and `demo-flowchart.svg`.

## Arrow Notation Syntax

| Syntax | Meaning | Example |
|--------|---------|---------|
| `->` | Connection | `A -> B -> C` |
| `[a,b,c]` | Sub-components | `Encoder[CNN,RNN,Transformer]` |
| `?` | Decision node | `Converged?` |
| `Yes: X, No: Y` | Branch outcomes | `Converged? -> Yes: Deploy, No: Tune` |

## Diagram Types

| Type | Layout | Best For |
|------|--------|----------|
| `pipeline` | Horizontal left-to-right | Data processing, ML pipelines |
| `architecture` | Vertical top-to-bottom | System layers, network stacks |
| `flowchart` | Horizontal with diamonds | Algorithms, decision processes |

## Examples

**Pipeline:**
```bash
paper-diagram-gen generate "Raw Data -> Preprocessing[Tokenize,Normalize] -> Embedding -> Transformer -> Classification" --type pipeline
```

**Architecture:**
```bash
paper-diagram-gen generate "Input Layer -> Encoder[Self-Attention,FFN] -> Latent Space -> Decoder[Cross-Attention,FFN] -> Output" --type architecture
```

**Flowchart:**
```bash
paper-diagram-gen generate "Start -> Train -> Converged? -> Yes: Deploy, No: Adjust LR -> Train" --type flowchart
```

## Programmatic API

```typescript
import { generateDiagram, parseLlmResponse, callLlm, DIAGRAM_PROMPT } from "paper-diagram-gen";

// Deterministic SVG generation
const result = generateDiagram("Input -> Process -> Output", { type: "pipeline" });
console.log(result.svg);    // SVG string
console.log(result.nodes);  // DiagramNode[]
console.log(result.edges);  // DiagramEdge[]

// LLM-powered (requires API key in env)
const raw = await callLlm(DIAGRAM_PROMPT, "Paper text: ...");
const suggestions = parseLlmResponse(raw);
for (const s of suggestions) {
  const diagram = generateDiagram(s.description, { type: s.type });
  // ... save diagram.svg
}
```

## Install

```bash
# Global install
npm install -g paper-diagram-gen

# Or use directly with npx
npx paper-diagram-gen demo
```

## Local development and tests

From a clone of this repository:

```bash
npm ci
npm test
node dist/index.js demo
```

`npm test` builds the TypeScript source, then runs the existing Node test suite and CLI scenarios. The CLI scenarios use synthetic papers and scripted provider responses with networking blocked; they need no API key and make no real provider calls. They check saved SVG labels, repeated and concurrent runs, stale files, and a native write failure after a partial result.

See the [per-surface change histories](CHANGELOG/README.md) for the handoff record and known limits.

## License

MIT

---

Inspired by diagram generation techniques from [awesome-ai-research-writing](https://github.com/HomenShum/awesome-ai-research-writing).

## Automated verification

For a developer opening a pull request, the [Offline verify workflow](.github/workflows/verify.yml) is configured to run four jobs: Ubuntu 24.04 and Windows 2025, each with Node 22 and Node 24. Pushes to `master` use the same checks.

Each job runs `npm ci`, `npm test` (including the build and 32 offline tests), `node dist/index.js --help`, and `npm audit --audit-level=low`. Repository secrets and real provider keys are not required; package installation and audit use the npm registry. The CLI tests supply their own synthetic provider transport with networking blocked.

Use the actual GitHub run results to assess the tested commit and matrix. A green result covers those checks; review generated diagrams separately for content accuracy. See the [CI history](CHANGELOG/ci/verify.md) for the workflow contract and limits.
