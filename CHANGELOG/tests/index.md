# Test history

## 2026-10-15 — Exercise artifact handoff through the actual CLI

- User job: the next developer needs npm test to run the committed tests and catch false artifact-success claims.
- Before: the Vitest include pattern selected .test.ts files, while the 26 committed tests used node:test in index.test.mjs. Unchanged npm test exited1 with no tests found.
- Change: preserve all original test bytes and append six realistic CLI/factory scenarios. Child CLIs receive only synthetic input/key values and scripted responses; network sockets are blocked. The partial-write fixture observes the exact owned machine filename, creates a sentinel there, then lets native exclusive write raise EEXIST. Temporary fixture cleanup checks the resolved owned path first.
- Validation: npm test rebuilt source and passed all 32 tests across seven suites with zero failures/skips. Repeated/concurrent invocations preserved earlier bytes; stale files and later model finals could not turn failed writes or missing artifacts into success.
- Limits: bounded local Windows/Node scenarios; no sustained provider traffic, actual provider availability or cross-platform execution claim.
