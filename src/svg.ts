/**
 * SVG diagram engine — deterministic text-to-SVG generation.
 *
 * Parses arrow-notation descriptions and produces SVG flowcharts,
 * architecture diagrams, and pipeline visualizations.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DiagramNode {
  id: string;
  label: string;
  type: "process" | "decision" | "start" | "end" | "component";
  subComponents?: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DiagramOptions {
  type?: "pipeline" | "architecture" | "flowchart";
  width?: number;
  nodeSpacing?: number;
  layerSpacing?: number;
  fontSize?: number;
  fontFamily?: string;
}

export interface DiagramResult {
  svg: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

// ─── Parsing ────────────────────────────────────────────────────────────────

export function parseDiagramDescription(desc: string): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  // Split by -> to get stages
  const parts = desc.split("->").map((p) => p.trim()).filter((p) => p.length > 0);

  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];

    // Handle decision branches: "Converged? -> Yes: Deploy, No: Tune -> ..."
    const branchMatch = part.match(/^(.+?)\s*->\s*(.+)$/);
    if (branchMatch) {
      // Shouldn't happen after split, but handle gracefully
      part = branchMatch[1];
    }

    // Handle comma-separated branch outcomes: "Yes: Deploy, No: Tune"
    if (part.includes(":") && part.includes(",")) {
      const branches = part.split(",").map((b) => b.trim());
      for (const branch of branches) {
        const [label, target] = branch.split(":").map((s) => s.trim());
        const nodeId = `node_${nodes.length}`;
        nodes.push({
          id: nodeId,
          label: target,
          type: "process",
          x: 0, y: 0, width: 0, height: 0,
        });
        if (i > 0) {
          const prevId = nodes[nodes.length - 2]?.id;
          if (prevId) edges.push({ from: prevId, to: nodeId, label });
        }
      }
      continue;
    }

    // Handle sub-components: "Encoder[CNN,RNN,Transformer]"
    const compMatch = part.match(/^(.+?)\[(.+)\]$/);
    const label = compMatch ? compMatch[1].trim() : part;
    const subs = compMatch ? compMatch[2].split(",").map((s) => s.trim()) : undefined;

    const isDecision = part.endsWith("?");
    const nodeId = `node_${i}`;

    nodes.push({
      id: nodeId,
      label: isDecision ? label : label,
      type: isDecision ? "decision" : i === 0 ? "start" : i === parts.length - 1 ? "end" : "process",
      subComponents: subs,
      x: 0, y: 0, width: 0, height: 0,
    });

    if (i > 0) {
      const prevNode = nodes.find((n) => n.id === `node_${i - 1}`);
      if (prevNode) edges.push({ from: prevNode.id, to: nodeId });
    }
  }

  return { nodes, edges };
}

// ─── Layout ─────────────────────────────────────────────────────────────────

function layoutNodes(
  nodes: DiagramNode[],
  type: string,
  opts: Required<Pick<DiagramOptions, "width" | "nodeSpacing" | "layerSpacing" | "fontSize">>
): void {
  const charWidth = opts.fontSize * 0.6;
  const padding = 30;

  for (const node of nodes) {
    const textWidth = node.label.length * charWidth;
    const subWidth = node.subComponents
      ? node.subComponents.join(", ").length * charWidth * 0.8
      : 0;
    node.width = Math.max(100, textWidth + padding, subWidth + padding);
    node.height = node.subComponents ? 60 : 40;
    if (node.type === "decision") {
      node.width = Math.max(node.width, 120);
      node.height = 50;
    }
  }

  if (type === "architecture") {
    // Layered vertical layout
    let y = 40;
    for (const node of nodes) {
      node.x = (opts.width - node.width) / 2;
      node.y = y;
      y += node.height + opts.layerSpacing;
    }
  } else {
    // Horizontal pipeline / flowchart
    let x = 40;
    const maxHeight = Math.max(...nodes.map((n) => n.height));
    const centerY = 60;
    for (const node of nodes) {
      node.x = x;
      node.y = centerY + (maxHeight - node.height) / 2;
      x += node.width + opts.nodeSpacing;
    }
  }
}

// ─── SVG Generation ─────────────────────────────────────────────────────────

function renderNode(node: DiagramNode, fontSize: number, fontFamily: string): string {
  const lines: string[] = [];
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;

  if (node.type === "decision") {
    // Diamond shape
    const hw = node.width / 2;
    const hh = node.height / 2;
    lines.push(`<polygon points="${cx},${node.y} ${node.x + node.width},${cy} ${cx},${node.y + node.height} ${node.x},${cy}" fill="#FFF3E0" stroke="#E65100" stroke-width="2"/>`);
  } else if (node.type === "start") {
    lines.push(`<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="8" fill="#E8F5E9" stroke="#2E7D32" stroke-width="2"/>`);
  } else if (node.type === "end") {
    lines.push(`<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="8" fill="#FFEBEE" stroke="#C62828" stroke-width="2"/>`);
  } else {
    lines.push(`<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="6" fill="#E3F2FD" stroke="#1565C0" stroke-width="2"/>`);
  }

  // Main label
  const labelY = node.subComponents ? cy - 6 : cy + 4;
  lines.push(`<text x="${cx}" y="${labelY}" text-anchor="middle" font-family="${fontFamily}" font-size="${fontSize}" fill="#212121">${escapeXml(node.label)}</text>`);

  // Sub-components
  if (node.subComponents) {
    const subText = node.subComponents.join(", ");
    lines.push(`<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="${fontFamily}" font-size="${fontSize - 2}" fill="#616161">[${escapeXml(subText)}]</text>`);
  }

  return lines.join("\n  ");
}

function renderEdge(edge: DiagramEdge, nodes: DiagramNode[], vertical: boolean): string {
  const from = nodes.find((n) => n.id === edge.from);
  const to = nodes.find((n) => n.id === edge.to);
  if (!from || !to) return "";

  let x1: number, y1: number, x2: number, y2: number;

  if (vertical) {
    x1 = from.x + from.width / 2;
    y1 = from.y + from.height;
    x2 = to.x + to.width / 2;
    y2 = to.y;
  } else {
    x1 = from.x + from.width;
    y1 = from.y + from.height / 2;
    x2 = to.x;
    y2 = to.y + to.height / 2;
  }

  let svg = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#424242" stroke-width="2" marker-end="url(#arrowhead)"/>`;

  if (edge.label) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 - 8;
    svg += `\n  <text x="${mx}" y="${my}" text-anchor="middle" font-size="11" fill="#757575">${escapeXml(edge.label)}</text>`;
  }

  return svg;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Main API ───────────────────────────────────────────────────────────────

export function generateDiagram(description: string, options: DiagramOptions = {}): DiagramResult {
  const type = options.type || "pipeline";
  const fontSize = options.fontSize || 14;
  const fontFamily = options.fontFamily || "Arial, Helvetica, sans-serif";
  const nodeSpacing = options.nodeSpacing || 60;
  const layerSpacing = options.layerSpacing || 50;
  const targetWidth = options.width || 800;

  const { nodes, edges } = parseDiagramDescription(description);
  layoutNodes(nodes, type, { width: targetWidth, nodeSpacing, layerSpacing, fontSize });

  const vertical = type === "architecture";

  // Compute SVG dimensions
  const maxX = Math.max(...nodes.map((n) => n.x + n.width), 200) + 40;
  const maxY = Math.max(...nodes.map((n) => n.y + n.height), 100) + 40;
  const svgWidth = Math.max(maxX, 200);
  const svgHeight = Math.max(maxY, 100);

  const svgParts: string[] = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`);
  svgParts.push(`  <defs>`);
  svgParts.push(`    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">`);
  svgParts.push(`      <polygon points="0 0, 10 3.5, 0 7" fill="#424242"/>`);
  svgParts.push(`    </marker>`);
  svgParts.push(`  </defs>`);
  svgParts.push(`  <rect width="100%" height="100%" fill="white"/>`);

  for (const edge of edges) {
    svgParts.push(`  ${renderEdge(edge, nodes, vertical)}`);
  }
  for (const node of nodes) {
    svgParts.push(`  ${renderNode(node, fontSize, fontFamily)}`);
  }

  svgParts.push(`</svg>`);

  return { svg: svgParts.join("\n"), nodes, edges };
}
