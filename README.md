# paper-diagram-gen

Generate academic paper diagrams from text descriptions. Produces SVG flowcharts, architecture diagrams, and pipeline visualizations.

Inspired by [PaperBanana](https://github.com/dwzhu-pku/PaperBanana).

## Features

- **Flowcharts**: Sequential processes with decision nodes
- **Architecture Diagrams**: Layered system components with connections
- **Pipeline Diagrams**: Data flow through processing stages
- **Sub-components**: `Encoder[CNN,RNN,Transformer]` syntax for nested elements
- **Auto-layout**: Automatic positioning and spacing (horizontal for pipelines, vertical for architectures)
- **SVG Output**: Scalable vector graphics, ready for LaTeX/papers

## Install

```bash
npm install -g paper-diagram-gen
```

## Usage

```bash
# Generate from a description
paper-diagram-gen "Input Data -> Preprocessing -> Model -> Output" --type pipeline

# Architecture diagram
paper-diagram-gen "Encoder[CNN,RNN,Transformer] -> Latent Space -> Decoder[MLP]" --type architecture

# Flowchart with decisions
paper-diagram-gen "Start -> Train Model -> Converged? -> Yes: Deploy, No: Tune -> Train Model" --type flowchart

# Save to file
paper-diagram-gen "A -> B -> C" --type pipeline --output diagram.svg
```

## API

```typescript
import { generateDiagram } from "paper-diagram-gen";

const result = generateDiagram("Input -> Process -> Output", { type: "pipeline" });
console.log(result.svg);           // SVG string
console.log(result.nodes.length);  // 3
console.log(result.edges.length);  // 2
```

## Using with AI Agents

### Claude Code / Cursor / Windsurf

Add this to your agent instructions or AGENTS.md:

```markdown
When creating diagrams for papers or documentation, use `paper-diagram-gen`:

1. Describe the architecture/pipeline in arrow notation: "A -> B -> C"
2. Use sub-components for details: "Layer[comp1,comp2]"
3. Use decision nodes with "?": "Check? -> Yes: Pass, No: Retry"
4. Run `npx paper-diagram-gen "<description>" --type <type> --output diagram.svg`
5. Include the SVG in your LaTeX/Markdown document
```

### NodeBench MCP Integration

If you're using [nodebench-mcp](https://www.npmjs.com/package/nodebench-mcp), diagram generation fits into the documentation workflow:

1. **Recon phase**: `run_recon` on the codebase to identify architecture components
2. **Documentation**: Use `generate_report` to compile findings, then generate diagrams for each system layer
3. **Verification**: `start_verification_cycle` to verify diagrams match actual code architecture
4. **UI Capture**: Use `capture_dom_snapshot` to compare generated diagrams against live system state

```bash
# Example: agent generates architecture diagram from codebase analysis
npx paper-diagram-gen "API Gateway -> Auth Middleware -> Route Handler -> Database" --type architecture --output arch.svg
```

### MCP Server Setup (for tool-calling agents)

```json
{
  "mcpServers": {
    "nodebench": {
      "command": "npx",
      "args": ["-y", "nodebench-mcp"]
    }
  }
}
```

Your agent can shell out to `paper-diagram-gen` via `run_tests_cli` for diagram generation, or use the programmatic API directly.

## Diagram Types

| Type | Layout | Best For |
|------|--------|----------|
| `pipeline` | Horizontal, left-to-right | Data processing flows, ML pipelines |
| `architecture` | Vertical, top-to-bottom | System layers, network stacks |
| `flowchart` | Horizontal with decision diamonds | Algorithms, decision processes |

## Tests

```bash
npm test
```

10 tests covering pipeline layout, architecture layout, sub-components, SVG validity, XML escaping, and decision nodes.

## License

MIT
