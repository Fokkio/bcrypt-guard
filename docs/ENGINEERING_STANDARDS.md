# Engineering Standards

- Keep privileged operations in the Electron main process. The renderer must
  have `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`.
- Expose named IPC functions through the preload bridge; never expose raw
  `ipcRenderer`, `send`, `invoke`, filesystem, shell, or network primitives.
- Validate all IPC payloads again in the main process.
- Scanner modules return serializable evidence and do not know about Electron.
- Network requests are read-only, bounded, cancelable, and same-origin across
  redirects. Do not disable TLS verification.
- Secrets remain in memory only and must be redacted from errors and reports.
- A scanner may report only what its captured evidence supports. Heuristic
  access-control findings cannot use `confirmed` status.
- Prefer small modules with explicit inputs and returned results. Avoid global
  mutable scan state except for the single cancellation coordinator.
- Tests use local synthetic fixtures; they must not contact public targets.
- The Windows release is built from `package-lock.json` with `npm ci`.
