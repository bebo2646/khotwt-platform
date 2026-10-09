/**
 * PWA Screen Orientation Controller
 * Ensures installed PWA on Android tablets and phones maintains portrait orientation,
 * while allowing video fullscreen rotation and preventing repeated lock loops.
 */

// Tracks whether Screen Orientation Lock API is supported in the current runtime
let isLockSupported = true;
// Guard to prevent concurrent / re-entrant lock calls
let isLockingInProgress = false;

/**
 * Checks if the application is currently running in standalone PWA mode.
 */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as any).standalone === true ||
    (typeof document !== 'undefined' && document.referrer.includes('android-app://'))
  );
}

/**
 * Checks if a video or document is currently active in fullscreen mode.
 */
export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement ||
    document.querySelector('.fixed.inset-0.z-\\[99999999\\]') // LessonViewer pseudo-fullscreen
  );
}

/**
 * Safely requests portrait orientation lock for the PWA.
 * Safe against unhandled promise rejections, unsupported platforms (iOS/desktop),
 * and active video fullscreen.
 */
export async function safeLockPortraitOrientation(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  // Never lock to portrait while user is watching fullscreen video
  if (isFullscreenActive()) {
    return false;
  }

  // If the browser previously rejected orientation lock with NotSupportedError, skip
  if (!isLockSupported) {
    return false;
  }

  const orientation = window.screen?.orientation as any;
  if (!orientation || typeof orientation.lock !== 'function') {
    isLockSupported = false;
    return false;
  }

  // If already in portrait-primary, avoid duplicate lock calls
  const current = orientation.type || '';
  if (current === 'portrait-primary') {
    return true;
  }

  if (isLockingInProgress) {
    return false;
  }

  isLockingInProgress = true;

  try {
    // Attempt portrait-primary first (strict upright), fallback to portrait
    try {
      await orientation.lock('portrait-primary');
    } catch {
      await orientation.lock('portrait');
    }
    return true;
  } catch (err: any) {
    // If not supported in the current environment (e.g. desktop tab outside fullscreen),
    // mark as unsupported to prevent repeated loops
    if (err && (err.name === 'NotSupportedError' || err.name === 'SecurityError')) {
      isLockSupported = false;
    }
    return false;
  } finally {
    isLockingInProgress = false;
  }
}

/**
 * Safely unlocks screen orientation (e.g. when entering video fullscreen).
 */
export function safeUnlockOrientation(): void {
  if (typeof window === 'undefined') return;
  try {
    const orientation = window.screen?.orientation as any;
    if (orientation && typeof orientation.unlock === 'function') {
      orientation.unlock();
    }
  } catch {}
}
