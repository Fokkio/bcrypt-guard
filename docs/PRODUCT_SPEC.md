# Bcrypt Guard Desktop - Product Specification

## Purpose

Bcrypt Guard Desktop is a Windows desktop application for authorized, read-only
web and API security assessment. It combines the existing bcrypt calibration
work with focused checks for BOLA/IDOR, BFLA, account or resource enumeration,
and closely related HTTP security controls.

The application is an assessment assistant, not an exploitation framework. A
result is evidence for a human reviewer; it is not proof that an entire website
is secure or vulnerable.

## Release scope

### Desktop shell

- Electron application packaged as Windows NSIS and portable `.exe` artifacts.
- Local packaged UI only. Target websites are never rendered in Electron.
- Sandboxed renderer, context isolation, no renderer Node.js integration.
- Narrow, validated IPC methods for scanning, cancellation, bcrypt benchmarking,
  system information, and report export.
- GitHub Actions performs the canonical Windows build before local acceptance.

### Authorized website assessment

- Require an explicit authorization confirmation before any network request.
- Restrict automatic requests to `GET`, `HEAD`, and `OPTIONS`.
- Enforce request timeout, response-size cap, redirect cap, and bounded request
  counts. Do not crawl, brute-force, or execute browser payloads.
- Never persist session headers, cookies, bearer tokens, passwords, full response
  bodies, or complete password hashes in reports.

Checks:

1. Baseline HTTP controls: HTTPS use, security headers, framing protection,
   cookie flags, information-disclosure headers, CORS behavior, and dangerous
   advertised methods.
2. BOLA/IDOR scenario: compare Actor A access to Actor A's object, Actor B access
   to Actor B's object, and Actor A access to Actor B's object.
3. BFLA scenario: compare a high-privilege baseline with a low-privilege request
   to the same read-only privileged endpoint.
4. Enumeration scenario: compare known and unknown identifiers using bounded
   samples of response status, normalized body shape, size, and timing.
5. Rate-limit observation: run a small, user-enabled sample and report only the
   evidence observed. Absence of a 429 response is not reported as a confirmed
   vulnerability.

All heuristic authorization and enumeration results must be labeled
`suspected` or `needs-verification`, never `confirmed`.

### Bcrypt calibration

- Run native bcrypt sequentially in the Electron main process.
- Configurable cost range, sample count, and target latency with safe limits.
- Report p50, p95, minimum, maximum, mean, and sequential hash-rate estimate.
- Recommend the highest measured cost within the latency target.
- Warn when the recommendation is below bcrypt cost 10.
- State that current OWASP guidance prefers Argon2id for new systems and treats
  bcrypt as a legacy-compatible option.
- Never request or benchmark a real user password; use an internal synthetic
  benchmark value.

### UX and accessibility

- Clear three-step scan flow: target and authorization, optional scenarios,
  review findings and export.
- Plain language, visible labels, meaningful headings, keyboard navigation,
  visible focus, live progress announcements, and non-color status labels.
- No decorative gradients, fake metrics, generic marketing copy, or unexplained
  severity scores.
- Responsive down to a narrow desktop window and respects reduced motion.

## Out of scope for this release

- Automated exploitation, credential attacks, password spraying, or brute force.
- State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- Automatic endpoint discovery, directory brute force, or unrestricted crawling.
- Browser payload execution for XSS, CSRF exploitation, or clickjacking actions.
- GraphQL mutation testing, WebSocket manipulation, and LLM prompt attacks.
- Claims that a target is vulnerability-free.
- Code signing and trusted publisher reputation; these require a publisher
  certificate and owner-controlled release process.

## Release gates

- Unit and integration tests pass on a local fixture server.
- Static syntax and security-configuration checks pass.
- Accessibility scan has no critical finding; keyboard and focus checklist is
  manually reviewed.
- Packaged application launches, loads the local UI, runs bcrypt, and completes
  a loopback fixture scan without uncaught errors. GitHub Actions runs this
  acceptance against the portable executable after packaging.
- GitHub Actions Windows build succeeds and publishes both `.exe` artifacts plus
  SHA-256 checksums.
- The downloaded CI artifact is tested locally before copying to the separate
  delivery folder on `D:\`.
