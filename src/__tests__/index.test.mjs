import { describe, it } from "node:test";
import assert from "node:assert/strict";

const mod = await import("../../dist/index.js");
const { generateDiagram } = mod;

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
    // In architecture mode, y increases downward
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
