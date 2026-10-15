# Development tooling history

## 2026-10-15 — Use the committed Node test framework

- User job: a developer needs a clean install and one working test command.
- Before: npm test invoked unused Vitest with an excluding pattern. The lock audit reported 10 issues: one low, one moderate, six high and two critical.
- Change: npm test builds then runs the existing Node test entrypoint. Remove test:watch, Vitest and its unused config through ordinary npm uninstall. No replacements, overrides or upgrades. Normal lock generation aligns the root package version from2.1.0 to3.0.0.
- Validation: normal npm ci passed; npm test passed32/32; a separate npm audit --json returned zero vulnerabilities. Exact locked versions/integrities remain TypeScript5.9.3, @types/node25.2.1 and undici-types7.16.0. The audit did not alter the lock.
- Limits: audit results reflect the observed registry response and retained lock; no broad security or CI-green certification.
