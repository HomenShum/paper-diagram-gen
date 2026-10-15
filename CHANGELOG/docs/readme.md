# README history

## 2026-10-15 — Explain source setup and the actual auto output contract

- User job: a new developer or coding agent needs reproducible local commands and trustworthy output expectations.
- Before: README promised generated SVGs and npm test without explaining the missing persistence or excluded test suite.
- Change: document npm ci, rebuild-and-test, actual UUID/sequence saved paths, repeat/concurrent use, nonzero missing-artifact/write-failure behavior and partial-output handling. Link the per-surface history index and distinguish file creation from content accuracy.
- Validation: the documented npm ci and npm test commands passed; CLI persistence/status scenarios passed and the external fixture produced an actual labelled SVG. History index links all five surface histories and the template.
- Limits: synthetic local evidence only; no model-quality, production, visual-layout or deployment claim.
