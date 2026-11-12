export type PalaceMode = 'think' | 'grow' | 'imagine';
export const MODES = {
  think: { label: 'Think', glyph: '◇', prompt: 'What is on your mind?' },
  grow: { label: 'Grow', glyph: '+', prompt: 'What would you like to grow?' },
  imagine: { label: 'Imagine', glyph: '✧', prompt: 'Where does your imagination go?' },
} as const;
export function parseMode(value: string | null): PalaceMode { return value === 'grow' || value === 'imagine' ? value : 'think'; }
export function currentMode(): PalaceMode { try { return parseMode(localStorage.getItem('loci.quest.mode')); } catch { return 'think'; } }
export function palaceKey(mode: PalaceMode): string { return mode === 'think' ? 'loci.palace.v1' : `loci.palace.v1.${mode}`; }
