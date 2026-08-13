# Bcrypt Guard Desktop

Windows desktop software for **authorized, read-only** website assessment and
local bcrypt calibration. The application focuses on evidence that a developer
or security reviewer can verify: BOLA/IDOR, BFLA, enumeration differences,
baseline HTTP controls, and a small rate-limit observation.

> Use this software only on systems you own or have explicit permission to
> assess. It does not make a website “secure,” and a heuristic finding is not a
> substitute for reviewing the server-side authorization policy.

## What the desktop app does

- Checks HTTPS use, common security headers, framing policy, cookie attributes,
  CORS behavior, technology disclosure, and advertised TRACE support.
- Compares two known users and two known objects for suspected BOLA/IDOR.
- Compares low- and high-privilege sessions for suspected BFLA.
- Compares known and unknown values for status, body-shape, size, and timing
  differences that can enable enumeration.
- Makes a bounded rate-limit observation without claiming that a small sample
  proves throttling is absent.
- Benchmarks native bcrypt locally and reports p50/p95 timing, not fake server
  capacity metrics.
- Exports redacted JSON without supplied authorization headers, cookies,
  passwords, full response bodies, or complete password hashes.

The automatic request set is limited to `GET`, `HEAD`, and `OPTIONS`. There is
no crawler, directory brute force, credential attack, XSS execution, or
state-changing request engine.

## Security model

```text
Local packaged renderer (HTML/CSS/JS)
       │ named, validated IPC calls only
       ▼
Electron main process
       ├── bounded HTTP transport ──► authorized target
       ├── BOLA / BFLA / enumeration scanners
       ├── native bcrypt benchmark
       └── redacted JSON export
```

The renderer uses `nodeIntegration: false`, `contextIsolation: true`, and
`sandbox: true`. It never renders the target website. Navigation, new windows,
and permission requests are denied. The transport uses same-origin redirects,
an 8-second timeout, a 256 KB body cap, and fixed request limits.

See [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) for release scope and
[ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md) for implementation
rules.

## BOLA/IDOR and BFLA inputs

BOLA/IDOR needs:

1. A read-only endpoint containing `{id}`, for example `/api/orders/{id}`.
2. Actor A and Actor B session headers.
3. One known object ID owned by each actor.

The app requests both owner baselines and then requests Actor B's object using
Actor A's session. A 2xx response with similar evidence is labeled **suspected**,
not confirmed, because shared/public-resource policy requires human context.

BFLA needs a known read-only privileged endpoint plus low- and high-privilege
session headers. The app does not guess admin URLs and does not try alternate
state-changing methods.

Use header lines such as:

```text
Authorization: Bearer <temporary test token>
Cookie: session=<temporary test session>
```

Values remain in memory for the assessment and are excluded from reports. Use
dedicated synthetic test accounts rather than production customer sessions.

## Bcrypt calibration

The benchmark warms up and measures native bcrypt sequentially for each selected
cost. It returns p50, p95, mean, min, max, and a sequential hash-rate estimate.
The recommended measured cost is the highest cost whose p95 is within the target.

Current OWASP guidance prefers Argon2id for new systems. Where bcrypt remains
necessary for legacy compatibility, use cost 10 or higher, enforce the
implementation's 72-byte input limit, and tune on the actual authentication
servers. Lazy migration must happen only after successful password verification.

Reference: [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Development

Requirements:

- Windows 10/11 x64
- Node.js 22 or newer
- npm with access to the lockfile registry dependencies

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd test
npm.cmd run smoke
npm.cmd start
```

The tests use an ephemeral server bound to `127.0.0.1`; they do not contact a
public website. `src/server.js` and `public/` are retained as historical source
from the previous browser prototype but are not included in the desktop package.

## Canonical Windows build

The canonical build runs on a fresh GitHub-hosted Windows runner through
[windows-build.yml](.github/workflows/windows-build.yml):

1. `npm ci`
2. production dependency audit
3. syntax and project checks
4. unit and local-fixture integration tests
5. hidden Electron smoke test
6. x64 NSIS installer and portable `.exe` build
7. SHA-256 checksum generation

The workflow publishes a temporary `bcrypt-guard-desktop-windows-x64` artifact.
Download and test that CI artifact locally before public release.

For a local diagnostic build only:

```powershell
npm.cmd run build:win
```

Outputs are written under `release/`. Public releases should be code-signed.
This repository does not include a publisher certificate or claim Windows
SmartScreen reputation.

## Release limitations

- No code signing is configured.
- No auto-update channel is configured.
- Findings cover only the supplied target URLs, sessions, and scenarios.
- GraphQL mutation tests, WebSocket manipulation, source-code analysis, and
  browser payload execution are outside version 2.0 scope.
- Absence of a finding does not establish absence of SQL injection, SSRF, XSS,
  authentication flaws, or other vulnerabilities.

## License and disclosure

Add an explicit license before distributing binaries to third parties. For
security issues in the application itself, disclose privately to the repository
owner before publishing details.
