const fs = require("fs");
const path = require("path");

function w(file, content) {
  const full = path.join(__dirname, file);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, content);
  console.log("Wrote " + file + " (" + content.length + " chars)");
}

// Build agent.ts
let agent = "";

agent += "/**
";
agent += " * ReAct Agent Engine for academic paper diagram generation.
";
agent += " *
";
agent += " * Implements a multi-step agentic loop:
";
agent += " *   Thought -> Action -> Observation -> ... -> Final Answer
";
agent += " *
";
agent += " * Deep agent pattern inspired by LangChain/Manus AI ReAct agents.
";
agent += " */

";

agent += "import { callLlmMultiTurn, detectProvider } from "./provider";
";
agent += "import type { ChatMessage } from "./provider";
";
agent += "import { generateDiagram } from "./svg";

";

// Types
agent += "// --- Types ---

";
agent += "export interface AgentTool {
";
agent += "  name: string;
";
agent += "  description: string;
";
agent += "  execute: (input: string) => Promise<string>;
";
agent += "}

";

agent += "export interface AgentStep {
";
agent += "  thought: string;
";
agent += "  action: string;
";
agent += "  actionInput: string;
";
agent += "  observation: string;
";
agent += "}

";

agent += "export interface AgentResult {
";
agent += "  steps: AgentStep[];
";
agent += "  finalAnswer: string;
";
agent += "  totalSteps: number;
";
agent += "  provider: string;
";
agent += "}

";
