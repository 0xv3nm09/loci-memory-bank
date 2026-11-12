import { describe, expect, it } from 'vitest';
import { canCapture } from './interaction-state';
const free = { recallActive: false, rewindActive: false, crisActive: false };
describe('capture locks', () => {
  it('blocks notes while crisis resources are open', () => expect(canCapture({ ...free, crisActive: true })).toBe(false));
  it('blocks notes during Recall', () => expect(canCapture({ ...free, recallActive: true })).toBe(false));
  it('blocks notes during Rewind', () => expect(canCapture({ ...free, rewindActive: true })).toBe(false));
  it('blocks notes during the opening story', () => expect(canCapture({ ...free, introActive: true })).toBe(false));
  it('blocks notes while help is open', () => expect(canCapture({ ...free, helpActive: true })).toBe(false));
  it('admits notes in the ordinary palace', () => expect(canCapture(free)).toBe(true));
});