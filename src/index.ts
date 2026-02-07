#!/usr/bin/env node

/**
 * paper-diagram-gen — Generate academic paper diagrams from text descriptions.
 *
 * Deterministic SVG engine (no API key) + LLM-powered commands (BYOK).
 * Uses raw fetch() for LLM calls — zero SDK dependencies.
 */

import * as fs from "fs";
import * as path from "path";

// ─── Re-exports (programmatic API) ─────────────────────────────────────────

export { generateDiagram, parseDiagramDescription } from "./svg";
export type { DiagramNode, DiagramEdge, DiagramOptions, DiagramResult } from "./svg";

export { DIAGRAM_PROMPT, parseLlmResponse } from "./prompts";
export type { DiagramSuggestion } from "./prompts";

export { callLlm, getProvider, detectProvider } from "./provider";
export type { LlmProvider, ProviderName } from "./provider";

// ─── Imports for CLI ───────────────────────────────────────────────────────

import { generateDiagram } from "./svg";
import { DIAGRAM_PROMPT, parseLlmResponse } from "./prompts";
import { callLlm, detectProvider } from "./provider";

const VERSION = "2.1.0";

// ─── Demo Examples ─────────────────────────────────────────────────────────

const DEMO_EXAMPLES = [
  {
    name: "ML Training Pipeline",
    type: "pipeline" as const,
    description:
      "Raw Data -> Preprocessing[Tokenize,Normalize,Augment] -> Feature Extraction -> Model Training -> Evaluation -> Deployment",
  },
  {
    name: "Transformer Architecture",
    type: "architecture" as const,
    description:
      "Input Embedding -> Encoder[Self-Attention,Feed-Forward,LayerNorm] -> Latent Representation -> Decoder[Cross-Attention,Feed-Forward,LayerNorm] -> Output Projection -> Softmax",
  },
  {
    name: "Experiment Workflow",
    type: "flowchart" as const,
    description:
      "Hypothesis -> Design Experiment -> Run Trials -> Significant? -> Yes: Publish, No: Revise Hypothesis -> Design Experiment",
  },
];

export { DEMO_EXAMPLES };

// ─── Helpers ───────────────────────────────────────────────────────────────

function getArg(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

function printHelp(): void {
  console.log(`paper-diagram-gen v${VERSION}

Generate academic paper diagrams from text -- manually or with AI.

Usage:
  paper-diagram-gen generate "<description>" [options]   Generate SVG from arrow notation
  paper-diagram-gen describe <file>                      Suggest diagrams for a paper (requires API key)
  paper-diagram-gen auto <file> [--output-dir <dir>]     Generate SVGs from paper text (requires API key)
  paper-diagram-gen demo                                 Generate 3 example SVGs (no API key needed)
  paper-diagram-gen --help                               Show this help

Options:
  --type <type>         Diagram type: pipeline, architecture, flowchart (default: pipeline)
  --output <path>       Save SVG to file (for generate command)
  --output-dir <dir>    Output directory (for auto command, default: ./diagrams)
  --help                Show this help

Examples:
  paper-diagram-gen generate "Input -> Process -> Output" --type pipeline
  paper-diagram-gen generate "Encoder[CNN,RNN] -> Latent -> Decoder" --type architecture --output arch.svg
  paper-diagram-gen describe paper.txt
  paper-diagram-gen auto paper.md --output-dir ./diagrams
  paper-diagram-gen demo

Environment (BYOK — set one for describe/auto):
  GEMINI_API_KEY        Google Gemini (tried first)
  OPENAI_API_KEY        OpenAI GPT-4o-mini (tried second)
  ANTHROPIC_API_KEY     Anthropic Claude Haiku (tried third)`);
}

// ─── Command: generate ─────────────────────────────────────────────────────

function cmdGenerate(description: string, args: string[]): void {
  const type = (getArg(args, "--type") || "pipeline") as "pipeline" | "architecture" | "flowchart";
  const outputFile = getArg(args, "--output");

  const result = generateDiagram(description, { type });

  if (outputFile) {
    fs.writeFileSync(outputFile, result.svg);
    console.log(
      `Diagram saved to ${outputFile} (${result.nodes.length} nodes, ${result.edges.length} edges)`
    );
  } else {
    console.log(result.svg);
  }
}

// ─── Command: describe ─────────────────────────────────────────────────────

async function cmdDescribe(args: string[]): Promise<void> {
  const filePath = args[1];
  if (!filePath) {
    console.error("Missing file path. Usage: paper-diagram-gen describe <file>");
    process.exit(1);
  }

  const providerName = detectProvider();
  if (!providerName) {
    console.error(
      "No LLM provider configured.\n" +
        "Set one of: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY\n\n" +
        "Example: GEMINI_API_KEY=... paper-diagram-gen describe paper.txt"
    );
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const paperText = fs.readFileSync(filePath, "utf-8");
  console.log(`Reading ${filePath}... (using ${providerName})`);

  const raw = await callLlm(DIAGRAM_PROMPT, `Paper text:\n\n${paperText}`);
  const suggestions = parseLlmResponse(raw);

  console.log(`\nSuggested diagrams (${suggestions.length}):\n`);
  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    console.log(`  ${i + 1}. [${s.type}] ${s.purpose}`);
    console.log(`     ${s.description}`);
    console.log("");
  }

  console.log("To generate SVGs automatically, run:");
  console.log(`  paper-diagram-gen auto ${filePath} --output-dir ./diagrams`);
}

// ─── Command: auto ─────────────────────────────────────────────────────────

async function cmdAuto(args: string[]): Promise<void> {
  const filePath = args[1];
  if (!filePath) {
    console.error("Missing file path. Usage: paper-diagram-gen auto <file> [--output-dir <dir>]");
    process.exit(1);
  }

  const providerName = detectProvider();
  if (!providerName) {
    console.error(
      "No LLM provider configured.\n" +
        "Set one of: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY"
    );
    process.exit(1);
  }

  const outputDir = getArg(args, "--output-dir") || "./diagrams";

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const paperText = fs.readFileSync(filePath, "utf-8");

  console.log(`Reading ${filePath}... (using ${providerName})`);
  console.log(`Output directory: ${outputDir}/\n`);

  // Step 1: LLM describe
  const raw = await callLlm(DIAGRAM_PROMPT, `Paper text:\n\n${paperText}`);
  const suggestions = parseLlmResponse(raw);

  // Step 2: Generate SVGs
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Generated ${suggestions.length} diagrams:\n`);

  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    const result = generateDiagram(s.description, { type: s.type });

    const slug = s.purpose
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const filename = `${String(i + 1).padStart(2, "0")}-${s.type}-${slug}.svg`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, result.svg);

    console.log(`  ${filename}`);
    console.log(`    Type: ${s.type} | Nodes: ${result.nodes.length} | Edges: ${result.edges.length}`);
    console.log(`    ${s.purpose}`);
    console.log("");
  }
}

// ─── Command: demo ─────────────────────────────────────────────────────────

function cmdDemo(): void {
  const outputDir = "./demo-diagrams";

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Generating demo diagrams to ${outputDir}/\n`);

  for (const example of DEMO_EXAMPLES) {
    const result = generateDiagram(example.description, { type: example.type });
    const filename = `demo-${example.type}.svg`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, result.svg);

    console.log(`  ${filename}`);
    console.log(`    ${example.name} (${example.type}) -- ${result.nodes.length} nodes, ${result.edges.length} edges`);
  }

  console.log(`\nDone! Open the SVG files in any browser to view.`);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    printHelp();
    return;
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    return;
  }

  const command = args[0];

  switch (command) {
    case "generate":
      if (!args[1]) {
        console.error('Missing description. Usage: paper-diagram-gen generate "<description>"');
        process.exit(1);
      }
      cmdGenerate(args[1], args.slice(1));
      break;
    case "describe":
      await cmdDescribe(args);
      break;
    case "auto":
      await cmdAuto(args);
      break;
    case "demo":
      cmdDemo();
      break;
    default:
      // Backward compat: treat first arg as description for direct SVG generation
      if (command.startsWith("--")) {
        console.error(`Unknown option: ${command}. Use --help for usage.`);
        process.exit(1);
      }
      cmdGenerate(command, args);
      break;
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
