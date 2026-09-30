# Add an End-to-End Test Harness for Core Field Flows

## Description

`app/mobile/src/__tests__/` had 30+ unit-test files but nothing drove the
app the way a field worker does. The critical flows — scan a package,
capture evidence, queue while offline, sync when connectivity returns —
span screens, native permissions, `AsyncStorage`, and NetInfo, so no unit
test can cover them: they only exist as a sequence against a running app.

This PR adds that missing layer: a Maestro-based end-to-end harness that
runs the real app on an Android emulator, plus the CI job, artifact
collection, documentation, and unit tests that make it maintainable.

The app is driven through four user journeys. Connectivity is toggled with
`adb`, so the offline → reconnect transition exercises the real NetInfo
path (`useNetworkStatus` → `flushPendingNetworkActions`), not a mock. Two
deterministic test-mode controls stand in for the two inputs a headless
emulator cannot produce — a physical QR code and a native camera/photo-
picker selection — and feed real payloads through the real handlers. Every
other line executed during a flow is production code.

Closes #932

## Type of Change

- [ ] Bug fix
- [x] New feature
- [ ] Breaking change
- [x] Documentation update

## Acceptance Criteria

| Criterion | How it is met |
| :--- | :--- |
| An E2E harness runs against a simulator or emulator in CI | `.github/workflows/mobile-e2e.yml` builds the E2E APK and runs `e2e/run-e2e.js` on an API 27 Android emulator |
| Scan, evidence capture, offline queue, and sync-on-reconnect are covered | `e2e/flows/{scan-valid-qr,evidence-capture-queue,offline-queue,sync-on-reconnect}.yaml` |
| Airplane-mode and reconnect transitions are exercised | Harness toggles `adb` airplane mode; `offline-queue` runs offline, `sync-on-reconnect` observes connectivity returning while the app is running |
| Failures produce screenshots and logs as CI artifacts | Maestro per-flow bundles (`screenshots/`, `logs/device-logcat.txt`, `screen-hierarchy/`) + a full `logcat.txt`, uploaded always |
| Running the suite locally is documented | `app/mobile/E2E_TESTING.md`, linked from the mobile README and CONTRIBUTING |

## Files Added

- `app/mobile/e2e/run-e2e.js` — orchestration CLI: installs the APK, grants
  camera permissions, toggles airplane mode around the offline flows,
  restores connectivity mid-run for the reconnect flow, and writes
  `e2e/report.{json,md}`.
- `app/mobile/e2e/e2eAnalysis.js` — pure, device-free logic (flow order,
  airplane-mode commands, JUnit parsing, pass/fail evaluation, artifact
  classification, Markdown report). Mirrors the `coldStartAnalysis.js`
  split from #931.
- `app/mobile/e2e/mockBackend.js` — dependency-free Node HTTP backend
  implementing exactly the endpoints the flows touch (aid details, evidence
  upload sessions, claim verify/submit), so the online and reconnect flows
  complete deterministically in CI without Postgres or the on-chain adapter.
- `app/mobile/e2e/flows/scan-valid-qr.yaml`
- `app/mobile/e2e/flows/evidence-capture-queue.yaml`
- `app/mobile/e2e/flows/offline-queue.yaml`
- `app/mobile/e2e/flows/sync-on-reconnect.yaml`
- `app/mobile/e2e/__tests__/e2eAnalysis.test.js`
- `app/mobile/e2e/__tests__/mockBackend.test.js`
- `app/mobile/e2e/__tests__/runE2e.test.js`
- `app/mobile/src/e2e/testMode.ts` — E2E-only fixtures, gated by
  `config.e2eEnabled`.
- `app/mobile/E2E_TESTING.md`
- `.github/workflows/mobile-e2e.yml`
- `PR_DESCRIPTION_932.md` (this file)

## Files Modified

- `app/mobile/src/config/index.ts` — add `e2eEnabled` (`EXPO_PUBLIC_E2E === '1'`).
- `app/mobile/src/screens/ScannerScreen.tsx` — E2E `simulate scan` control
  that calls the real `handleBarCodeScanned`.
- `app/mobile/src/screens/EvidenceUploadScreen.tsx` — E2E `simulate capture`
  control + stable `testID`s.
- `app/mobile/src/screens/HomeScreen.tsx`, `AidDetailsScreen.tsx`,
  `SubmissionQueueScreen.tsx` — stable `testID`s for existing controls.
- `app/mobile/App.tsx` — deep-link routes for `EvidenceUpload`
  (`aid/:aidId/evidence`) and `SubmissionQueue` (`queue`), so flows can open
  those screens directly without depending on the biometric-gated aid
  details screen.
- `app/mobile/eslint.config.js` — Node globals for `e2e/**/*.js`.
- `app/mobile/package.json` — `e2e:android` script.
- `app/mobile/.env.example`, `app/mobile/README.md`,
  `app/mobile/CONTRIBUTING.md`, `README.md` — document the harness and
  `EXPO_PUBLIC_E2E`.

## Testing

- [x] Added unit tests
- [x] Ran the harness's own unit tests locally (27 passing across 3 suites)
- [ ] Full harness run on an emulator (requires Android SDK + Maestro; CI
      covers this)

The harness's pure logic and the mock backend are unit tested without a
device:

```
PASS e2e/__tests__/runE2e.test.js
PASS e2e/__tests__/mockBackend.test.js
PASS e2e/__tests__/e2eAnalysis.test.js
Test Suites: 3 passed, 3 total
Tests:       27 passed, 27 total
```

Coverage includes: flow order and offline-before-reconnect sequencing,
airplane-mode command derivation (primary + API-27 fallback), JUnit parsing
with entity decoding and failure/error/skip classification, run evaluation
(fails on any failure, and fails when a flow produced no report), artifact
classification, report rendering, CLI argument parsing, and every mock
backend endpoint (full upload session: create → status → chunk → finalize).

The mobile suite was run before and after the change to confirm no
regressions. The Sentry ESM transform failures present on `main` in this
sandbox are unchanged; the 2 new e2e suites and 27 new tests all pass.

## Code Quality Checks

- `expo lint` on every added/changed file: 0 errors (only pre-existing
  warnings unrelated to this change; `e2e/**` lints clean).
- All four Maestro flows and the workflow parse as valid YAML.
- `node --check` clean on all harness scripts.

## Behavioural Changes

- **Production builds are unchanged.** `e2eEnabled` is false unless the
  build sets `EXPO_PUBLIC_E2E=1`; the simulate controls then render nothing.
- New deep-link routes: `soter://aid/:aidId/evidence` and `soter://queue`.
  These extend the existing notification deep-link targets and are useful
  outside E2E as well.
- New `pnpm e2e:android` script at `app/mobile`.

## Notes for Review

- **Why Maestro over Detox.** Maestro is flow-file based, needs no native
  test target, produces per-flow screenshot/logcat bundles for free, and
  works against a release build. That is the smallest amount of machinery
  that satisfies the artifact requirement, and it does not add a second
  Android build to CI.
- **Why test-mode seams.** No mobile E2E tool can present a QR code to an
  emulator camera or drive the native picker reliably. Rather than water
  down the scan/evidence criteria, two `EXPO_PUBLIC_E2E`-gated controls
  feed real payloads through the real handlers. The permission *state*
  handling remains covered by the existing
  `CameraPermissionDenied.test.tsx` unit test, and the harness pre-grants
  camera permissions so the scanner mounts.
- **E2E-only labels are not translated.** The visible text on those two
  controls lives in `src/e2e/testMode.ts` and is rendered as an expression,
  so it stays out of `src/i18n/messages` (translating a string no user can
  see is noise) while `scripts/check-i18n.mjs` still passes and remains
  honest about what is user-facing.
- **Why a mock backend.** Queueing-then-syncing has to observe a real HTTP
  200 to prove the queue actually drains. The mock server implements only
  the paths the flows call; backend contract correctness stays with the
  backend's own tests. Point the harness at a real backend with
  `--api-url`.
- **Reconnect timing.** The harness restores connectivity after
  `--reconnect-delay-ms` (default 40s), the window the flow spends queueing
  and confirming the offline state; the flow's `extendedWaitUntil`s observe
  the reconnect rather than gate it. Lower it for local iteration; CI uses
  the default.
- **Emulator profile.** API 27 / Nexus 6 / 2 vCPU / 2GB matches the
  cold-start budget job's low-end field profile. Camera hardware is left
  enabled (the scanner mounts a `CameraView`; no frames are read).

## Known Issues

- The harness cannot be executed in this sandbox (no Android SDK/KVM/
  Maestro), so the flow YAMLs are validated by parser and review rather
  than a live run. The CI job is the first live execution; expect to tune
  selector timeouts if the emulator is slower than assumed.
- The 1×1 JPEG fixture in `src/e2e/testMode.ts` is structurally valid and
  never decoded by the simulate path (the mock backend accepts any bytes);
  it only needs to be a JPEG for realism.
- The pre-existing `tsc --noEmit` errors under TypeScript 6 (DTO
  `strictPropertyInitialization`, Sentry/expo-constants type mismatches)
  are untouched; no new type errors are introduced in changed files.
