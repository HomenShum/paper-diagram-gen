/**
 * ReAct Agent Engine for paper-diagram-gen.
 *
 * Multi-step agentic workflow: analyze paper -> identify sections ->
 * suggest diagrams -> generate SVGs -> validate -> refine.
 * Inspired by LangChain ReAct, Anthropic agents, Manus AI.
 */

import { callLlm, callLlmMultiTurn, detectProvider } from "./provider";
import type { ChatMessage } from "./provider";
import { generateDiagram } from "./svg";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentTool {
  name: string;
  description: string;
  execute: (input: string) => Promise<string>;
}

export interface AgentStep {
  thought: string;
  action: string;
  actionInput: string;
  observation: string;
}

export interface AgentResult {
  steps: AgentStep[];
  finalAnswer: string;
  totalSteps: number;
  provider: string;
}

// ─── ReAct Parser ────────────────────────────────────────────────────────────

export function parseReActResponse(text: string): {
  thought: string;
  action?: string;
  actionInput?: string;
  finalAnswer?: string;
} {
  const lines = text.split("\n");
  let thought = "";
  let action = "";
  let actionInput = "";
  let finalAnswer = "";

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("Thought:")) {
      thought = trimmed.slice(8).trim();
    } else if (trimmed.startsWith("Action:") && !trimmed.startsWith("Action Input:")) {
      action = trimmed.slice(7).trim();
    } else if (trimmed.startsWith("Action Input:")) {
      const rest = trimmed.slice(13).trim();
      const inputLines = [rest];
      for (let j = i + 1; j < lines.length; j++) {
        const nt = lines[j].trim();
        if (nt.startsWith("Thought:") || nt.startsWith("Action:") ||
            nt.startsWith("Final Answer:") || nt.startsWith("Observation:")) break;
        inputLines.push(lines[j]);
      }
      actionInput = inputLines.join("\n").trim();
    } else if (trimmed.startsWith("Final Answer:")) {
      const idx = text.indexOf("Final Answer:");
      finalAnswer = text.slice(idx + 13).trim();
      break;
    }
  }

  return {
    thought,
    action: action || undefined,
    actionInput: actionInput || undefined,
    finalAnswer: finalAnswer || undefined,
  };
}

// ─── System Prompt ───────────────────────────────────────────────────────────

function buildSystemPrompt(tools: AgentTool[]): string {
  const toolDescriptions = tools
    .map((t) => `  ${t.name}: ${t.description}`)
    .join("\n");

  return `You are a ReAct agent specialized in analyzing academic papers and generating diagrams.

Available tools:
${toolDescriptions}

Format (exactly):

Thought: <your reasoning>
Action: <tool_name>
Action Input: <input for the tool>

When done:

Thought: <final reasoning>
Final Answer: <your complete output>

Rules:
- One tool per response
- Think before acting
- Do NOT combine Action and Final Answer`;
}

// ─── Agent Loop ──────────────────────────────────────────────────────────────

export async function runAgent(options: {
  goal: string;
  tools: AgentTool[];
  maxSteps?: number;
}): Promise<AgentResult> {
  const { goal, tools, maxSteps = 8 } = options;
  const systemPrompt = buildSystemPrompt(tools);
  const steps: AgentStep[] = [];
  const messages: ChatMessage[] = [
    { role: "user", content: `Goal: ${goal}\n\nBegin.` },
  ];

  const provider = detectProvider() || "unknown";

  for (let i = 0; i < maxSteps; i++) {
    const responseText = await callLlmMultiTurn(systemPrompt, messages);
    messages.push({ role: "assistant", content: responseText });

    const parsed = parseReActResponse(responseText);

    if (parsed.finalAnswer) {
      return { steps, finalAnswer: parsed.finalAnswer, totalSteps: steps.length, provider };
    }

    if (parsed.action) {
      const tool = tools.find((t) => t.name === parsed.action);
      let observation: string;

      if (tool) {
        try {
          observation = await tool.execute(parsed.actionInput || "");
        } catch (err: any) {
          observation = "Tool error: " + (err.message || String(err));
        }
      } else {
        observation = `Unknown tool: ${parsed.action}. Available: ${tools.map((t) => t.name).join(", ")}`;
      }

      steps.push({
        thought: parsed.thought,
        action: parsed.action,
        actionInput: parsed.actionInput || "",
        observation,
      });

      messages.push({ role: "user", content: `Observation: ${observation}\n\nContinue.` });
    } else {
      messages.push({ role: "user", content: "Use a tool or provide Final Answer." });
    }
  }

  return {
    steps,
    finalAnswer: "Agent reached maximum steps. Partial results in steps above.",
    totalSteps: maxSteps,
    provider,
  };
}

// ─── Tool Factories ──────────────────────────────────────────────────────────

/** Tools for the `describe` command — analyze paper and suggest diagrams. */
export function createDescribeTools(): AgentTool[] {
  return [
    {
      name: "identify_sections",
      description: "Identify main sections and structure of a paper. Returns JSON with section names and summaries.",
      execute: async (text) => {
        const r = await callLlm(
          'Identify the main sections of this paper. Return JSON array: [{"name": "...", "summary": "...", "hasData": true/false, "hasArchitecture": true/false}]',
          text
        );
        return r;
      },
    },
    {
      name: "suggest_diagrams",
      description: "Suggest diagrams for a paper section. Input: section text. Returns diagram suggestions.",
      execute: async (text) => {
        const r = await callLlm(
          'Suggest diagrams. For each: type (pipeline|architecture|flowchart), purpose (one-line), description (arrow notation like "A -> B[sub1,sub2] -> C"). Return JSON array.',
          text
        );
        return r;
      },
    },
    {
      name: "generate_svg",
      description: 'Generate SVG from arrow notation. Input: JSON {"description": "A -> B -> C", "type": "pipeline"}.',
      execute: async (input) => {
        try {
          const parsed = JSON.parse(input);
          const result = generateDiagram(parsed.description, { type: parsed.type || "pipeline" });
          return `SVG generated: ${result.nodes.length} nodes, ${result.edges.length} edges. Description: ${parsed.description}`;
        } catch (e: any) {
          return `Error: ${e.message}. Input must be JSON: {"description": "A -> B", "type": "pipeline"}`;
        }
      },
    },
    {
      name: "validate_diagram",
      description: "Check if a diagram accurately represents paper content. Input: JSON with diagram_description and paper_excerpt.",
      execute: async (input) => {
        const r = await callLlm(
          'Validate diagram accuracy. Return JSON: {"accurate": true/false, "issues": [], "suggestions": []}',
          input
        );
        return r;
      },
    },
    {
      name: "refine_description",
      description: "Refine arrow notation based on feedback. Input: JSON with original and feedback.",
      execute: async (input) => {
        const r = await callLlm(
          'Refine this arrow notation. Return ONLY the improved notation string like "A -> B[sub1,sub2] -> C".',
          input
        );
        return r;
      },
    },
  ];
}

/** Tools for the `auto` command — full pipeline from paper to SVGs. */
export function createAutoTools(): AgentTool[] {
  return [
    ...createDescribeTools(),
    {
      name: "plan_diagram_set",
      description: "Plan a complete set of diagrams for a paper. Returns prioritized list.",
      execute: async (text) => {
        const r = await callLlm(
          'Plan diagrams for this paper. Return JSON array: [{"type": "pipeline|architecture|flowchart", "description": "arrow notation", "purpose": "what it shows", "priority": 1-5}]',
          text
        );
        return r;
      },
    },
  ];
}
