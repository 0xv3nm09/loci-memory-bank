import { describe, expect, it, vi, afterEach } from 'vitest';
import { palaceKey, parseMode, currentMode } from './modes';
afterEach(()=>vi.unstubAllGlobals());
describe('Quest modes', () => {
 it('preserves Think storage', () => expect(palaceKey('think')).toBe('loci.palace.v1'));
 it('separates Grow storage', () => expect(palaceKey('grow')).toBe('loci.palace.v1.grow'));
 it('separates Imagine storage', () => expect(palaceKey('imagine')).toBe('loci.palace.v1.imagine'));
 it('defaults invalid modes to Think', () => expect(parseMode('unknown')).toBe('think'));
 for (const mode of ['think','grow','imagine']) it(`restores the selected ${mode} mode`, () => {
   vi.stubGlobal('localStorage',{getItem:()=>mode});
   expect(currentMode()).toBe(mode);
 });
});
