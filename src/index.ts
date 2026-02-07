#!/usr/bin/env node

/**
 * paper-diagram-gen — Deep agent for academic paper diagram generation.
 *
 * Deterministic SVG engine (no API key) + ReAct agent for multi-step
 * paper analysis, diagram suggestion, generation, and validation.
 * Inspired by LangChain ReAct, Anthropic agents, Manus AI.
 */

import * as fs from "fs";
import * as path from "path";

// ── Re-exports (programmatic API) ─────────────────────────────────────────

export { generateDiagram, parseDiagramDescription } from "./svg";
export type { DiagramNode, DiagramEdge, DiagramOptions, DiagramResult } from "./svg";

export { DIAGRAM_PROMPT, parseLlmResponse } from "./prompts";
export type { DiagramSuggestion } from "./prompts";

export { callLlm, callLlmMultiTurn, getProvider, detectProvider } from "./provider";
export type { LlmProvider, ProviderName, ChatMessage } from "./provider";

export { runAgent, parseReActResponse, createDescribeTools, createAutoTools } from "./agent";
export type { AgentTool, AgentStep, AgentResult } from "./agent";

// ── Imports for CLI ───────────────────────────────────────────────────────

import { generateDiagram } from "./svg";
import { detectProvider } from "./provider";
import { runAgent, createDescribeTools, createAutoTools } from "./agent";
import type { AgentResult } from "./agent";

const VERSION = "3.0.0";

// ── Demo Examples ─────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────

function getArg(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

function formatAgentResult(result: AgentResult): string {
  const lines: string[] = [];

  if (result.steps.length > 0) {
    lines.push(`\n  Agent Trace (${result.totalSteps} steps):`);
    lines.push(`  ${"=".repeat(50)}`);
    for (let i = 0; i < result.steps.length; i++) {
      const step = result.steps[i];
      lines.push(`  Step ${i + 1}: [${step.action}]`);
      lines.push(`    Thought: ${step.thought}`);
      const preview = step.observation.length > 300
        ? step.observation.slice(0, 300) + "..."
        : step.observation;
      lines.push(`    Result: ${preview}`);
      lines.push("");
    }
  }

  lines.push(`  Final Answer:`);
  lines.push(`  ${"=".repeat(50)}`);
  lines.push(result.finalAnswer);
  lines.push(`\n  ---`);
  lines.push(`  Agent: ${result.totalSteps} steps | Provider: ${result.provider}`);

  return lines.join("\n");
}

function printHelp(): void {
  console.log(`paper-diagram-gen v${VERSION}

Generate academic paper diagrams -- manually or with a deep agent.

ReAct agent: analyze paper -> identify sections -> suggest diagrams ->
generate SVGs -> validate -> refine. Inspired by LangChain ReAct,
Anthropic agents, Manus AI.

Usage:
  paper-diagram-gen generate "<description>" [options]   Generate SVG from arrow notation (no API key)
  paper-diagram-gen describe <file>                      Agent analyzes paper & suggests diagrams
  paper-diagram-gen auto <file> [--output-dir <dir>]     Agent generates complete diagram set
  paper-diagram-gen demo                                 Generate 3 example SVGs (no API key)
  paper-diagram-gen --help                               Show this help

Options:
  --type <type>         Diagram type: pipeline, architecture, flowchart (default: pipeline)
  --output <path>       Save SVG to file (for generate command)
  --output-dir <dir>    Output directory (for auto command, default: ./diagrams)
  --help                Show this help

BYOK (set one for describe/auto):
  GEMINI_API_KEY        Gemini 2.0 Flash (free tier)
  OPENAI_API_KEY        GPT-4o
  ANTHROPIC_API_KEY     Claude Sonnet 4.5

Examples:
  paper-diagram-gen generate "Input -> Process -> Output" --type pipeline
  paper-diagram-gen generate "Encoder[CNN,RNN] -> Latent -> Decoder" --type architecture
  paper-diagram-gen describe paper.txt
  paper-diagram-gen auto paper.md --output-dir ./diagrams
  paper-diagram-gen demo`);
}

// ── Command: generate (deterministic, no API key) ─────────────────────────

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

// ── Command: describe (deep agent) ────────────────────────────────────────

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
        "Set one of: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY"
    );
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const paperText = fs.readFileSync(filePath, "utf-8");
  console.log(`Analyzing ${filePath} with deep agent (${providerName})...\n`);

  const result = await runAgent({
    goal: `Analyze this academic paper and suggest diagrams. Identify the main sections, determine which need visual diagrams, suggest diagram types and arrow notations for each.\n\nPaper:\n${paperText.slice(0, 12000)}`,
    tools: createDescribeTools(),
  });

  console.log(formatAgentResult(result));
}

// ── Command: auto (deep agent + SVG generation) ──────────────────────────

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

  console.log(`Running deep agent on ${filePath} (${providerName})...`);
  console.log(`Output directory: ${outputDir}/\n`);

  const result = await runAgent({
    goal: `Analyze this paper and create a complete set of diagrams. First identify sections, then plan a diagram set with priorities, then generate SVGs for each, and validate them.\n\nPaper:\n${paperText.slice(0, 12000)}`,
    tools: createAutoTools(),
    maxSteps: 12,
  });

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(formatAgentResult(result));
  console.log(`\nDiagrams output directory: ${outputDir}/`);
}

// ── Command: demo (deterministic, no API key) ─────────────────────────────

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
    console.log(
      `    ${example.name} (${example.type}) -- ${result.nodes.length} nodes, ${result.edges.length} edges`
    );
  }

  console.log(`\nDone! Open the SVG files in any browser to view.`);
}

// ── Main ──────────────────────────────────────────────────────────────────

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
