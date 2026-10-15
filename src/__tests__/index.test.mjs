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


// First-run scenarios: a researcher needs actual files, not a model's completion claim.
import * as cliFs from 'node:fs';
import * as cliPath from 'node:path';
import * as cliOs from 'node:os';
import { execFile as cliExecFile } from 'node:child_process';
import { fileURLToPath as cliFileURLToPath } from 'node:url';
import { createHash as cliCreateHash } from 'node:crypto';

const cliEntry = cliFileURLToPath(new URL('../../dist/index.js', import.meta.url));
const cliFixtureSource = "'use strict';\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst net = require('node:net');\nconst crypto = require('node:crypto');\nconst root = fs.realpathSync(process.env.PAPER_TEST_ROOT);\nconst output = path.resolve(process.env.PAPER_TEST_OUTPUT);\nif (!output.startsWith(root + path.sep)) throw new Error('Output fixture escaped its owned root');\nconst trace = path.join(root, 'trace-' + process.pid + '.jsonl');\nconst responses = JSON.parse(fs.readFileSync(path.join(root, 'responses.json'), 'utf8'));\nconst nativeWrite = fs.writeFileSync.bind(fs);\nconst record = event => fs.appendFileSync(trace, JSON.stringify(event) + '\\n');\nlet calls = 0;\nlet writes = 0;\nnet.Socket.prototype.connect = function () {\n  record({event: 'blocked-network'});\n  throw new Error('Network blocked by synthetic provider fixture');\n};\nglobalThis.fetch = async (url, options = {}) => {\n  if (String(url) !== 'https://api.openai.com/v1/chat/completions' || options.method !== 'POST') {\n    record({event: 'blocked-fetch'});\n    throw new Error('Unexpected provider request blocked');\n  }\n  if (calls >= responses.length) throw new Error('Unexpected extra provider request');\n  const response = responses[calls++];\n  record({event: 'scripted-response', call: calls, response});\n  return {ok: true, status: 200, json: async () => ({choices: [{message: {content: response}}]})};\n};\nfs.writeFileSync = function (file, data, options) {\n  if (typeof data !== 'string' || !data.startsWith('<svg')) return nativeWrite(file, data, options);\n  const target = path.resolve(String(file));\n  if (!target.startsWith(output + path.sep)) throw new Error('SVG write escaped owned output');\n  writes++;\n  record({event: 'svg-write-attempt', write: writes, target});\n  if (process.env.PAPER_TEST_COLLISION === 'second' && writes === 2) {\n    nativeWrite(target, 'SYNTHETIC-COLLISION-SENTINEL', {flag: 'wx'});\n    record({event: 'collision-prepared', target});\n  }\n  try {\n    const result = nativeWrite(file, data, options);\n    record({event: 'svg-write-succeeded', target, sha256: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')});\n    return result;\n  } catch (error) {\n    record({event: 'native-write-error', target, code: error.code});\n    throw error;\n  }\n};\nprocess.on('exit', code => record({event: 'exit', code, calls, writes}));\n";
const cliFinal = 'Final Answer: Completed the synthetic workflow diagrams.';
const cliAction = (description) => 'Action: generate_svg\nAction Input: ' + JSON.stringify({description, type: 'pipeline'});
const cliHash = (file) => cliCreateHash('sha256').update(cliFs.readFileSync(file)).digest('hex');

function cliFixture(t, responses, collision = '') {
  const root = cliFs.realpathSync(cliFs.mkdtempSync(cliPath.join(cliOs.tmpdir(), 'paper-diagram-first-run-')));
  const output = cliPath.join(root, 'nested', 'output');
  const paper = cliPath.join(root, 'synthetic-paper.md');
  const preload = cliPath.join(root, 'provider-fixture.cjs');
  cliFs.writeFileSync(paper, '# Synthetic review\nInput -> Review -> Publish\n');
  cliFs.writeFileSync(preload, cliFixtureSource);
  cliFs.writeFileSync(cliPath.join(root, 'responses.json'), JSON.stringify(responses));
  const env = {
    OPENAI_API_KEY: 'synthetic-offline-key',
    PAPER_TEST_ROOT: root,
    PAPER_TEST_OUTPUT: output,
    PAPER_TEST_COLLISION: collision,
    HOME: root,
    USERPROFILE: root,
    TEMP: root,
    TMP: root,
  };
  t.after(() => {
    const resolved = cliFs.realpathSync(root);
    const parent = cliFs.realpathSync(cliOs.tmpdir());
    assert.ok(resolved.startsWith(parent + cliPath.sep));
    assert.ok(cliPath.basename(resolved).startsWith('paper-diagram-first-run-'));
    assert.equal(cliFs.lstatSync(root).isSymbolicLink(), false);
    cliFs.rmSync(resolved, {recursive: true});
  });
  return {root, output, paper, preload, env};
}

function cliRun(fixture) {
  return new Promise((resolve) => {
    cliExecFile(process.execPath, ['--require', fixture.preload, cliEntry, 'auto', fixture.paper, '--output-dir', fixture.output],
      {cwd: fixture.root, env: fixture.env, timeout: 10000, maxBuffer: 1024 * 1024, windowsHide: true},
      (error, stdout, stderr) => resolve({status: error ? error.code : 0, signal: error?.signal, stdout, stderr}));
  });
}

function cliSvgs(fixture) {
  return cliFs.existsSync(fixture.output)
    ? cliFs.readdirSync(fixture.output).filter((name) => name.endsWith('.svg')).map((name) => cliPath.join(fixture.output, name))
    : [];
}

function cliTrace(fixture) {
  return cliFs.readdirSync(fixture.root).filter((name) => /^trace-\d+\.jsonl$/.test(name))
    .flatMap((name) => cliFs.readFileSync(cliPath.join(fixture.root, name), 'utf8').trim().split('\n').map(JSON.parse));
}

function cliAssertLabels(file, labels) {
  const svg = cliFs.readFileSync(file, 'utf8');
  assert.ok(svg.startsWith('<svg'));
  for (const label of labels) assert.ok(svg.includes('>' + label + '</text>'), label + ' must exist in actual SVG');
}

describe('auto CLI artifact handoff', () => {
  it('saves a real labelled SVG in a fresh nested output directory', async (t) => {
    const fixture = cliFixture(t, [cliAction('Input -> Review -> Publish'), cliFinal]);
    assert.equal(cliFs.existsSync(fixture.output), false);
    const result = await cliRun(fixture);
    assert.equal(result.status, 0, result.stderr);
    const files = cliSvgs(fixture);
    assert.equal(files.length, 1);
    cliAssertLabels(files[0], ['Input', 'Review', 'Publish']);
    assert.match(cliPath.basename(files[0]), /^diagram-[0-9a-f-]{36}-01\.svg$/);
    assert.ok(result.stdout.includes(files[0]));
    assert.ok(result.stdout.includes('Saved 1 SVG file(s):'));
    assert.equal(cliTrace(fixture).filter((event) => event.event.startsWith('blocked-')).length, 0);
  });

  it('saves multiple diagrams and allows repeat runs without changing earlier bytes', async (t) => {
    const fixture = cliFixture(t, [cliAction('Input -> Review -> Publish'), cliAction('Collect -> Verify -> Archive'), cliFinal]);
    const first = await cliRun(fixture);
    assert.equal(first.status, 0, first.stderr);
    const previous = cliSvgs(fixture).map((file) => ({file, hash: cliHash(file)}));
    assert.equal(previous.length, 2);
    const second = await cliRun(fixture);
    assert.equal(second.status, 0, second.stderr);
    const files = cliSvgs(fixture);
    assert.equal(files.length, 4);
    for (const old of previous) assert.equal(cliHash(old.file), old.hash);
    const runs = new Set(files.map((file) => cliPath.basename(file).slice(8, 44)));
    assert.equal(runs.size, 2);
    for (const sequence of ['-01.svg', '-02.svg']) assert.equal(files.filter((file) => file.endsWith(sequence)).length, 2);
  });

  it('lets concurrent researchers share an output folder without overwriting', async (t) => {
    const fixture = cliFixture(t, [cliAction('Input -> Review -> Publish'), cliFinal]);
    const results = await Promise.all([cliRun(fixture), cliRun(fixture)]);
    for (const result of results) assert.equal(result.status, 0, result.stderr);
    const files = cliSvgs(fixture);
    assert.equal(files.length, 2);
    assert.equal(new Set(files.map((file) => cliPath.basename(file))).size, 2);
    for (const file of files) cliAssertLabels(file, ['Input', 'Review', 'Publish']);
    const writes = cliTrace(fixture).filter((event) => event.event === 'svg-write-succeeded');
    assert.equal(writes.length, 2);
    for (const write of writes) assert.equal(cliHash(write.target), write.sha256);
  });

  it('rejects final-only and invalid-tool claims even with stale SVGs present', async (t) => {
    const fixture = cliFixture(t, [cliFinal]);
    cliFs.mkdirSync(fixture.output, {recursive: true});
    const prior = cliPath.join(fixture.output, 'prior.svg');
    cliFs.writeFileSync(prior, '<svg><text>Earlier result</text></svg>');
    const priorHash = cliHash(prior);
    const finalOnly = await cliRun(fixture);
    assert.notEqual(finalOnly.status, 0);
    assert.match(finalOnly.stderr, /No SVG files were saved in this run/);
    cliFs.writeFileSync(cliPath.join(fixture.root, 'responses.json'), JSON.stringify(['Action: generate_svg\nAction Input: invalid JSON', cliFinal]));
    const invalid = await cliRun(fixture);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /No SVG files were saved in this run/);
    assert.deepEqual(cliSvgs(fixture), [prior]);
    assert.equal(cliHash(prior), priorHash);
  });

  it('keeps a native second-write failure fatal after a later model final', async (t) => {
    const fixture = cliFixture(t, [cliAction('Input -> Review -> Publish'), cliAction('Second -> Review -> Publish'), cliAction('Third -> Review -> Publish'), cliFinal], 'second');
    const result = await cliRun(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EEXIST/);
    assert.equal(result.stdout.includes('Saved '), false);
    const trace = cliTrace(fixture);
    const attempts = trace.filter((event) => event.event === 'svg-write-attempt');
    assert.equal(attempts.length, 2, 'sticky failure must prevent a third filesystem write');
    const collision = trace.find((event) => event.event === 'collision-prepared');
    const nativeError = trace.find((event) => event.event === 'native-write-error');
    assert.equal(nativeError.code, 'EEXIST');
    assert.equal(nativeError.target, collision.target);
    assert.equal(cliFs.readFileSync(collision.target, 'utf8'), 'SYNTHETIC-COLLISION-SENTINEL');
    const saved = trace.filter((event) => event.event === 'svg-write-succeeded');
    assert.equal(saved.length, 1);
    assert.equal(cliHash(saved[0].target), saved[0].sha256);
    cliAssertLabels(saved[0].target, ['Input', 'Review', 'Publish']);
    assert.equal(cliSvgs(fixture).length, 2, 'earlier SVG and colliding sentinel must both remain');
    assert.ok(trace.some((event) => event.event === 'scripted-response' && event.response === cliFinal));
    assert.equal(trace.filter((event) => event.event.startsWith('blocked-')).length, 0);
  });

  it('preserves describe and default auto factory observations without a writer', async () => {
    const input = JSON.stringify({description: 'Input -> Review -> Publish', type: 'pipeline'});
    const expected = 'SVG generated: 3 nodes, 2 edges. Description: Input -> Review -> Publish';
    for (const tools of [mod.createDescribeTools(), mod.createAutoTools()]) {
      const generate = tools.find((tool) => tool.name === 'generate_svg');
      assert.equal(await generate.execute(input), expected);
    }
  });
});
