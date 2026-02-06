# paper-diagram-gen

Generate academic paper diagrams from text descriptions. Produces SVG flowcharts, architecture diagrams, and pipeline visualizations.

Inspired by [PaperBanana](https://github.com/dwzhu-pku/PaperBanana).

## Features

- **Flowcharts**: Sequential processes with decision nodes
- **Architecture Diagrams**: Layered system components with connections
- **Pipeline Diagrams**: Data flow through processing stages
- **Auto-layout**: Automatic positioning and spacing
- **SVG Output**: Scalable vector graphics, ready for papers

## Install

```bash
npm install -g paper-diagram-gen
```

## Usage

```bash
# Generate from a description
paper-diagram-gen "Input Data -> Preprocessing -> Model -> Output" --type pipeline

# Architecture diagram
paper-diagram-gen "Encoder[CNN,RNN,Transformer] -> Latent Space -> Decoder[MLP]" --type architecture

# Flowchart with decisions
paper-diagram-gen "Start -> Train Model -> Converged? -> Yes: Deploy, No: Tune -> Train Model" --type flowchart

# Save to file
paper-diagram-gen "A -> B -> C" --type pipeline --output diagram.svg
```

## API

```typescript
import { generateDiagram } from "paper-diagram-gen";

const svg = generateDiagram("Input -> Process -> Output", { type: "pipeline" });
// Returns SVG string
```

## License

MIT
