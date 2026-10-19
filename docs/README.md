# Surti Bite — System documentation

Version: 1.0 · Baseline date: 19 October 2026 · Timezone: Asia/Kolkata

This pack describes the implementation in this repository. It is a handover baseline, not a signed business approval or a guarantee that every local change is deployed. Changes to Apps Script require a new deployment version; frontend changes require publication to the static host.

## Document register

| Document | Purpose | Primary audience |
|---|---|---|
| [01 — Business requirements](01-BRD.md) | Objectives, scope, rules, acceptance criteria | Owner, operations, delivery team |
| [02 — Functional specification](02-FUNCTIONAL-SPECIFICATION.md) | Screens and end-to-end behavior | Operators, developers, QA |
| [03 — System architecture](03-SYSTEM-ARCHITECTURE.md) | Components, flows, boundaries, scaling | Technical team |
| [04 — Data dictionary](04-DATA-DICTIONARY.md) | Sheets, fields, relationships, derived data | Developers, data administrators |
| [05 — API reference](05-API-REFERENCE.md) | Actions, payloads, responses, retries | Developers, integrations |
| [06 — Deployment and configuration](06-DEPLOYMENT-CONFIGURATION.md) | New installation, upgrades, rollback | Deployment owner |
| [07 — Operations, backup and recovery](07-OPERATIONS-BACKUP-RECOVERY.md) | Daily checks, schedules, incidents, recovery | Owner, support |
| [08 — Test plan and acceptance](08-TEST-PLAN-ACCEPTANCE.md) | Automated coverage, manual tests, release gate | QA, release owner |
| [09 — Security and limitations](09-SECURITY-LIMITATIONS.md) | Access, privacy, integrity, known limits | Owner, technical team |
| [10 — User guide](10-USER-GUIDE.md) | Practical operating instructions | Cashier, owner |
| [11 — Maintenance and traceability](11-MAINTENANCE-TRACEABILITY.md) | Requirement-to-code mapping and change checklist | Maintainers |

## Start here

- Business review: read 01 and 02.
- Technical handover: read 03, 04 and 05.
- Publish an upgrade: follow 06 and the executable checklist in [PERFORMANCE-DEPLOYMENT.md](../PERFORMANCE-DEPLOYMENT.md).
- Operate or recover the system: use 07 and 10.
- Approve a release: complete the checks in 08; keep evidence for the deployed version.

Source locations: `frontend/`, `apps-script/`, and `tests/`. If a document and code disagree, investigate the code and deployed version before changing production. Business decisions and acceptance sign-off remain with the owner; no sign-off is implied by this pack.
