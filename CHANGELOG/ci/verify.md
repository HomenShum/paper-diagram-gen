# CI verification history

## 2026-10-15 — Add an offline verification matrix

- User job: a developer or coding agent needs a pull request check that runs the committed build, tests and CLI before handoff.
- Before: the reviewed functional commit had no GitHub Actions workflow. Local Windows/Node 22 proof did not establish other operating systems or Node majors.
- Change: configure four jobs across Ubuntu 24.04/Windows 2025 and Node 22/24 on pull requests and pushes to master. Each job runs normal npm ci, npm test (build plus 32 offline tests), built CLI help and npm audit --audit-level=low. Jobs have a ten-minute timeout, fail-fast disabled and contents: read permission. Actions are pinned by commit; checkout does not persist credentials and package-manager caching is disabled.
- Validation: inspect the exact pinned official action definitions and review the five-path source diff. Runtime, tests, package and lock bytes remain identical to the independently reviewed functional commit. No duplicate local suite was run for this CI-only addition. Native GitHub matrix results are required after publication before claiming CI green.
- Limits: install/audit use the npm registry; provider transports in the CLI tests are synthetic and block network sockets. No repository secrets or provider keys are required. This workflow verifies the selected OS/Node patches and local artifact behavior; it does not measure real model quality or production deployment.
