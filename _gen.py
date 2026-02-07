import os, sys

REPO = os.path.dirname(os.path.abspath(__file__))
BT = chr(96)
DL = chr(36)
NL = chr(10)

def write_file(rel_path, content):
    full = os.path.join(REPO, rel_path)
    d = os.path.dirname(full)
    if not os.path.exists(d):
        os.makedirs(d, exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Wrote {rel_path} ({len(content)} chars)")

print("Generator loaded")


# ============================================================
# src/agent.ts - ReAct Agent Engine
# ============================================================

agent_ts = (
    '/**
'
    ' * ReAct Agent Engine for academic paper diagram generation.
'
    ' *
'
    ' * Implements a multi-step agentic loop:
'
    ' *   Thought -> Action -> Observation -> ... -> Final Answer
'
    ' *
'
    ' * Deep agent pattern inspired by LangChain/Manus AI ReAct agents.
'
    ' */
'
    '
'
    'import { callLlmMultiTurn, detectProvider } from "./provider";
'
    'import type { ChatMessage } from "./provider";
'
    'import { generateDiagram } from "./svg";
'
    '
'
    '// --- Types ---
'
    '
'
    'export interface AgentTool {
'
    '  name: string;
'
    '  description: string;
'
    '  execute: (input: string) => Promise<string>;
'
    '}
'
    '
'
    'export interface AgentStep {
'
    '  thought: string;
'
    '  action: string;
'
    '  actionInput: string;
'
    '  observation: string;
'
    '}
'
    '
'
    'export interface AgentResult {
'
    '  steps: AgentStep[];
'
    '  finalAnswer: string;
'
    '  totalSteps: number;
'
    '  provider: string;
'
    '}
'
    '
'
)

write_file('src/agent.ts', agent_ts)
print('agent.ts types section done')
