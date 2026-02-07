const fs = require("fs");
const BT = String.fromCharCode(96);
const DL = String.fromCharCode(36);
let out = "";

// Header
out += [
  "/**",
  " * ReAct Agent Engine for academic paper diagram generation.",
  " *",
  " * Implements a multi-step agentic loop:",
  " *   Thought -> Action -> Observation -> ... -> Final Answer",
  " *",
  " * Deep agent pattern inspired by LangChain/Manus AI ReAct agents.",
  " */",
  "",
  "import { callLlmMultiTurn, detectProvider } from "./provider";",
  "import type { ChatMessage } from "./provider";",
  "import { generateDiagram } from "./svg";",
  "",
].join("
") + "
";

