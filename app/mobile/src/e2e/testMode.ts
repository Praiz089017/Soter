/**
 * End-to-end test-mode seams (issue #932).
 *
 * The Maestro E2E harness runs the real app against a headless Android
 * emulator, where two inputs a user would normally provide cannot be
 * produced: a physical QR code held up to the camera, and a real photo
 * from the device camera or gallery. Those screens therefore render a
 * single deterministic "simulate" control each, but only when the build
 * was made with `EXPO_PUBLIC_E2E=1`.
 *
 * The controls call the exact same handlers a real interaction does
 * (`ScannerScreen`'s `handleBarCodeScanned`, `EvidenceUploadScreen`'s
 * capture pipeline), so the E2E flows still exercise scan parsing,
 * de-duplication, navigation, image handling, queueing and sync — they
 * only skip the parts of the OS that cannot be automated in an emulator.
 *
 * Production builds never set the flag, so this code path is dead there.
 */
import { config } from '../config';

/**
 * A valid Soter package deep link, in the same format a real QR code
 * encodes. `parseAidIdFromQRCode` resolves this to `E2E-AID-1`.
 */
export const E2E_SCAN_PAYLOAD = 'soter://package/E2E-AID-1';

/**
 * A 1x1 white JPEG, base64-encoded. Small enough to upload in a single
 * chunk during an E2E run, valid enough for `expo-image-manipulator` and
 * the backend's image pipeline to accept.
 */
export const E2E_EVIDENCE_IMAGE_BASE64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////' +
  '2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/' +
  'xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCw' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAf/9k=';

/** Data URI form, suitable for React Native's `<Image source={{ uri }} />`. */
export const E2E_EVIDENCE_IMAGE_DATA_URI = `data:image/jpeg;base64,${E2E_EVIDENCE_IMAGE_BASE64}`;

/**
 * Labels for the E2E-only controls.
 *
 * These live here rather than in `src/i18n/messages` on purpose: the controls
 * never appear in a user-facing build, so adding them to the translation
 * catalogs would ask translators to translate strings no user can see. The
 * screens render them as expressions, which also keeps the i18n
 * hardcoded-string scan (`scripts/check-i18n.mjs`) honest about what is
 * user-facing.
 */
export const E2E_SIMULATE_SCAN_LABEL = 'Simulate scan (E2E)';
export const E2E_SIMULATE_CAPTURE_LABEL = 'Simulate capture (E2E)';

/** Whether this build exposes the E2E-only simulate controls. */
export const isE2ETestModeEnabled = (): boolean => config.e2eEnabled === true;
