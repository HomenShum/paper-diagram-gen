# Agent tool history

## 2026-10-15 — Let auto persist generated SVGs

- User job: a researcher needs a generated diagram file to review and hand off.
- Before: the shared generate_svg tool produced SVG text but returned only a summary, so CLI auto could claim success with an empty directory.
- Change: a private shared builder accepts an optional SVG writer. createDescribeTools() keeps its existing no-file behavior; createAutoTools() remains callable without a writer. Writer failures reach the agent as tool errors without being mislabeled as invalid JSON.
- Validation: npm test passed all 32 tests, including 26 original tests and six CLI/factory scenarios. The same external two-response synthetic provider fixture produced no file before and one labelled SVG after.
- Limits: scripted transport proves local persistence and status handling. Provider networking, response limits, model quality, paper coverage and the agent step-budget outcome were not changed or certified.
