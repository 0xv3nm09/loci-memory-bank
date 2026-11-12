const KEY = 'loci.onboarded';
export function shouldOnboard(): boolean { try { return localStorage.getItem(KEY) == null; } catch { return false; } }
export function markOnboarded(): void { try { localStorage.setItem(KEY, '1'); } catch { /* storage unavailable */ } }
