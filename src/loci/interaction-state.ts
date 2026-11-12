/** Shared capture guard: modal experiences never admit another thought. */
export function canCapture(state: { recallActive: boolean; rewindActive: boolean; crisActive: boolean; introActive?: boolean; keyboardActive?: boolean; helpActive?: boolean }): boolean {
  return !state.recallActive && !state.rewindActive && !state.crisActive && !state.introActive && !state.helpActive;
}