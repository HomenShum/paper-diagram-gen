/**
 * Prompt templates for LLM-powered diagram generation.
 */

export const DIAGRAM_PROMPT = `You are an expert at creating academic paper diagrams. Given the paper text below, suggest arrow-notation descriptions for the key diagrams this paper needs. For each diagram, output:
1. Type: pipeline | architecture | flowchart
2. Description: one-line arrow notation using -> for connections, [] for sub-components, ? for decisions
3. Purpose: what this diagram communicates

Rules:
- Use Sub-components for nested elements: Encoder[CNN,RNN,Transformer]
- Use ? for decisions: Converged? -> Yes: Deploy, No: Tune -> Train Model
- Keep diagrams to 3-8 nodes for readability
- Suggest 2-4 diagrams per paper

Output as JSON array: [{type, description, purpose}]

Example output:
[
  {"type": "pipeline", "description": "Raw Data -> Preprocessing[Tokenize,Normalize] -> Embedding -> Transformer -> Classification", "purpose": "Shows the end-to-end training pipeline"},
  {"type": "architecture", "description": "Input Layer -> Encoder[Self-Attention,FFN] -> Latent Space -> Decoder[Cross-Attention,FFN] -> Output Layer", "purpose": "Illustrates the model architecture"},
  {"type": "flowchart", "description": "Initialize -> Train -> Converged? -> Yes: Evaluate, No: Adjust LR -> Train", "purpose": "Training loop with convergence check"}
]

IMPORTANT: Return ONLY the JSON array, no markdown fences, no extra text.`;

export interface DiagramSuggestion {
  type: "pipeline" | "architecture" | "flowchart";
  description: string;
  purpose: string;
}

/**
 * Parse LLM response into structured diagram suggestions.
 * Handles common LLM quirks: markdown fences, trailing commas, extra text.
 */
export function parseLlmResponse(raw: string): DiagramSuggestion[] {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  // Try to find JSON array in the response
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error("No JSON array found in LLM response");
  }

  let jsonStr = arrayMatch[0];

  // Fix trailing commas before ] (common LLM mistake)
  jsonStr = jsonStr.replace(/,\s*]/g, "]");

  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed)) {
    throw new Error("LLM response is not an array");
  }

  // Validate each suggestion
  const valid: DiagramSuggestion[] = [];
  for (const item of parsed) {
    if (
      item &&
      typeof item.type === "string" &&
      typeof item.description === "string" &&
      typeof item.purpose === "string" &&
      ["pipeline", "architecture", "flowchart"].includes(item.type)
    ) {
      valid.push({
        type: item.type as DiagramSuggestion["type"],
        description: item.description,
        purpose: item.purpose,
      });
    }
  }

  if (valid.length === 0) {
    throw new Error("No valid diagram suggestions found in LLM response");
  }

  return valid;
}
