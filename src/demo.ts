/**
 * Demo examples.
 * @deprecated DEMO_EXAMPLES is now exported directly from index.ts.
 * Kept for backward compatibility.
 */

import { generateDiagram } from "./svg";

export interface DemoExample {
  name: string;
  type: "pipeline" | "architecture" | "flowchart";
  description: string;
  purpose?: string;
}

export const DEMO_EXAMPLES: DemoExample[] = [
  {
    name: "ML Training Pipeline",
    type: "pipeline",
    description:
      "Raw Data -> Preprocessing[Tokenize,Normalize,Augment] -> Feature Extraction -> Model Training -> Evaluation -> Deployment",
    purpose: "End-to-end machine learning training pipeline",
  },
  {
    name: "Transformer Architecture",
    type: "architecture",
    description:
      "Input Embedding -> Encoder[Self-Attention,Feed-Forward,LayerNorm] -> Latent Representation -> Decoder[Cross-Attention,Feed-Forward,LayerNorm] -> Output Projection -> Softmax",
    purpose: "Transformer encoder-decoder architecture with key components",
  },
  {
    name: "Experiment Workflow",
    type: "flowchart",
    description:
      "Hypothesis -> Design Experiment -> Run Trials -> Significant? -> Yes: Publish, No: Revise Hypothesis -> Design Experiment",
    purpose: "Scientific experiment workflow with significance decision",
  },
];

export interface DemoResult {
  files: Array<{
    filename: string;
    type: string;
    name: string;
    nodeCount: number;
    edgeCount: number;
  }>;
  outputDir: string;
}

export async function runDemo(outputDir: string): Promise<DemoResult> {
  const fs = await import("fs");
  const path = await import("path");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files: DemoResult["files"] = [];

  for (const example of DEMO_EXAMPLES) {
    const result = generateDiagram(example.description, { type: example.type });
    const filename = `demo-${example.type}.svg`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, result.svg);

    files.push({
      filename,
      type: example.type,
      name: example.name,
      nodeCount: result.nodes.length,
      edgeCount: result.edges.length,
    });
  }

  return { files, outputDir };
}
