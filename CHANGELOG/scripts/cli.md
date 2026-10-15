# CLI history

## 2026-10-15 — Report actual auto artifacts and preserve write failures

- User job: a researcher runs auto and needs usable files rather than a model completion claim.
- Before: auto created and printed an output directory after the agent finished, without saving its generated SVGs.
- Change: each run gets a standard-library random UUID and numbered machine filenames. Exclusive writes preserve existing files; repeat and concurrent runs use distinct paths. Only current-run saved paths count. The first write error stays fatal and prevents later writes, even if the model later reports completion. Zero saved SVGs is also nonzero. Partial artifacts remain available for inspection.
- Validation: npm test passed 32/32. Actual CLI scenarios covered fresh labelled output, multiple/repeat/concurrent runs, stale artifacts, invalid tool input, and a native second-write EEXIST with a later scripted final. An unchanged external provider fixture changed from exit0/zero files to exit0/one labelled SVG.
- Limits: no real provider or production run was used. Saving files does not certify diagram accuracy, complete paper coverage or successful validation.
