import { describe, it } from "node:test";
import assert from "node:assert/strict";

const mod = await import("../../dist/index.js");
const { generateDiagram, parseDiagramDescription, DIAGRAM_PROMPT, parseLlmResponse, DEMO_EXAMPLES, detectProvider, callLlm } = mod;

// ─── Deterministic SVG generation ──────────────────────────────────────────

describe("generateDiagram", () => {
  it("should return valid structure", () => {
    const result = generateDiagram("A -> B -> C");
    assert.ok(typeof result.svg === "string");
    assert.ok(Array.isArray(result.nodes));
    assert.ok(Array.isArray(result.edges));
    assert.ok(result.svg.includes("<svg"));
    assert.ok(result.svg.includes("</svg>"));
  });

  it("should create correct node count for pipeline", () => {
    const result = generateDiagram("Input -> Process -> Output", { type: "pipeline" });
    assert.equal(result.nodes.length, 3);
    assert.equal(result.edges.length, 2);
  });

  it("should handle sub-components", () => {
    const result = generateDiagram("Encoder[CNN,RNN,Transformer] -> Latent -> Decoder[MLP]", { type: "architecture" });
    const encoder = result.nodes.find((n) => n.label === "Encoder");
    assert.ok(encoder, "Should have Encoder node");
    assert.deepEqual(encoder.subComponents, ["CNN", "RNN", "Transformer"]);
  });

  it("should produce valid SVG with arrowhead marker", () => {
    const result = generateDiagram("A -> B");
    assert.ok(result.svg.includes("marker id=\"arrowhead\""), "Should include arrowhead marker");
    assert.ok(result.svg.includes("marker-end=\"url(#arrowhead)\""), "Should reference arrowhead");
  });

  it("should layout architecture vertically", () => {
    const result = generateDiagram("Layer1 -> Layer2 -> Layer3", { type: "architecture" });
    assert.ok(result.nodes[0].y < result.nodes[1].y, "Layer1 should be above Layer2");
    assert.ok(result.nodes[1].y < result.nodes[2].y, "Layer2 should be above Layer3");
  });

  it("should layout pipeline horizontally", () => {
    const result = generateDiagram("A -> B -> C", { type: "pipeline" });
    assert.ok(result.nodes[0].x < result.nodes[1].x, "A should be left of B");
    assert.ok(result.nodes[1].x < result.nodes[2].x, "B should be left of C");
  });

  it("should handle single node", () => {
    const result = generateDiagram("OnlyNode");
    assert.equal(result.nodes.length, 1);
    assert.equal(result.edges.length, 0);
    assert.ok(result.svg.includes("OnlyNode"));
  });

  it("should escape XML special characters", () => {
    const result = generateDiagram("A<B> -> C&D");
    assert.ok(result.svg.includes("&lt;"), "Should escape <");
    assert.ok(result.svg.includes("&amp;"), "Should escape &");
  });

  it("should mark first node as start and last as end", () => {
    const result = generateDiagram("Begin -> Middle -> End");
    assert.equal(result.nodes[0].type, "start");
    assert.equal(result.nodes[1].type, "process");
    assert.equal(result.nodes[2].type, "end");
  });

  it("should detect decision nodes", () => {
    const result = generateDiagram("Train -> Converged? -> Deploy");
    const decision = result.nodes.find((n) => n.type === "decision");
    assert.ok(decision, "Should have a decision node");
    assert.ok(decision.label.includes("Converged"), "Decision should contain question");
  });
});

// ─── Prompt template ───────────────────────────────────────────────────────

describe("DIAGRAM_PROMPT", () => {
  it("should exist and be non-empty", () => {
    assert.ok(typeof DIAGRAM_PROMPT === "string");
    assert.ok(DIAGRAM_PROMPT.length > 100, "Prompt should be substantial");
  });

  it("should mention JSON output format", () => {
    assert.ok(DIAGRAM_PROMPT.includes("JSON"), "Prompt should mention JSON");
  });

  it("should mention arrow notation", () => {
    assert.ok(DIAGRAM_PROMPT.includes("->"), "Prompt should mention arrow notation");
  });
});

// ─── parseLlmResponse ──────────────────────────────────────────────────────

describe("parseLlmResponse", () => {
  it("should parse valid JSON array", () => {
    const raw = JSON.stringify([
      { type: "pipeline", description: "A -> B -> C", purpose: "Test pipeline" },
      { type: "architecture", description: "X -> Y", purpose: "Test arch" },
    ]);
    const result = parseLlmResponse(raw);
    assert.equal(result.length, 2);
    assert.equal(result[0].type, "pipeline");
    assert.equal(result[0].description, "A -> B -> C");
    assert.equal(result[0].purpose, "Test pipeline");
  });

  it("should strip markdown code fences", () => {
    const raw = '```json\n[{"type":"pipeline","description":"A -> B","purpose":"test"}]\n```';
    const result = parseLlmResponse(raw);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, "pipeline");
  });

  it("should handle trailing commas", () => {
    const raw = '[{"type":"pipeline","description":"A -> B","purpose":"test"},]';
    const result = parseLlmResponse(raw);
    assert.equal(result.length, 1);
  });

  it("should throw on empty response", () => {
    assert.throws(() => parseLlmResponse(""), /No JSON array found/);
  });

  it("should throw on invalid JSON", () => {
    assert.throws(() => parseLlmResponse("not json at all"), /No JSON array found/);
  });

  it("should reject invalid suggestion types", () => {
    const raw = JSON.stringify([
      { type: "invalid_type", description: "A -> B", purpose: "test" },
    ]);
    assert.throws(() => parseLlmResponse(raw), /No valid diagram suggestions/);
  });
});

// ─── Demo descriptions ────────────────────────────────────────────────────

describe("DEMO_EXAMPLES", () => {
  it("should have exactly 3 examples", () => {
    assert.equal(DEMO_EXAMPLES.length, 3);
  });

  it("should cover all three diagram types", () => {
    const types = DEMO_EXAMPLES.map((e) => e.type);
    assert.ok(types.includes("pipeline"), "Should have pipeline demo");
    assert.ok(types.includes("architecture"), "Should have architecture demo");
    assert.ok(types.includes("flowchart"), "Should have flowchart demo");
  });

  it("should produce valid SVGs from each demo description", () => {
    for (const example of DEMO_EXAMPLES) {
      const result = generateDiagram(example.description, { type: example.type });
      assert.ok(result.svg.includes("<svg"), `${example.name} should produce valid SVG`);
      assert.ok(result.svg.includes("</svg>"), `${example.name} should have closing SVG tag`);
      assert.ok(result.nodes.length >= 3, `${example.name} should have at least 3 nodes`);
      assert.ok(result.edges.length >= 2, `${example.name} should have at least 2 edges`);
    }
  });

  it("should have arrow notation in all descriptions", () => {
    for (const example of DEMO_EXAMPLES) {
      assert.ok(example.description.includes("->"), `${example.name} should use arrow notation`);
    }
  });
});

// ─── Provider detection (no API key set) ───────────────────────────────────

describe("detectProvider", () => {
  it("should return null when no API keys are set", () => {
    // Save and clear env vars
    const saved = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    };
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const result = detectProvider();
      assert.equal(result, null);
    } finally {
      // Restore env vars
      for (const [key, val] of Object.entries(saved)) {
        if (val !== undefined) process.env[key] = val;
      }
    }
  });

  it("should be a function", () => {
    assert.equal(typeof detectProvider, "function");
  });
});

// ─── callLlm (no API key) ─────────────────────────────────────────────────

describe("callLlm", () => {
  it("should be exported as a function", () => {
    assert.equal(typeof callLlm, "function");
  });
});
