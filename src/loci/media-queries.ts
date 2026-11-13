/**
 * Cached media queries — `window.matchMedia()` parses a query string and
 * allocates a new MediaQueryList on every call, so these are created once
 * at module load and read via `.matches` (cheap) in hot paths.
 */

const reducedMotionQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

/** True when the visitor asked the OS/browser to reduce motion. */
export function prefersReducedMotion(): boolean {
  return reducedMotionQuery?.matches ?? false;
}
