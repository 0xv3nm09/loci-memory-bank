#!/usr/bin/env node
/**
 * Syncs public/ui/welcome.uikitml's onboarding text from src/loci/guide.ts —
 * the single source of truth. Run after editing GUIDE_STEPS:
 *
 *   npm run sync:welcome
 *
 * The generated block sits between SYNC markers; everything else in the
 * .uikitml is untouched.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const guidePath = join(root, 'src', 'loci', 'guide.ts');
const panelPath = join(root, 'public', 'ui', 'welcome.uikitml');

const guide = readFileSync(guidePath, 'utf8');
const panel = readFileSync(panelPath, 'utf8');

const stepsMatch = guide.match(
  /export const GUIDE_STEPS: GuideStep\[\] = \[([\s\S]*?)\n\];/,
);
if (stepsMatch == null) {
  console.error('sync-welcome: could not find GUIDE_STEPS in guide.ts');
  process.exit(1);
}
const steps = [...stepsMatch[1].matchAll(/\{\s*title:\s*'([^']*)',\s*body:\s*'([^']*)',?\s*\}/g)].map(
  (m) => ({ title: m[1], body: m[2] }),
);
if (steps.length === 0) {
  console.error('sync-welcome: GUIDE_STEPS parsed but empty');
  process.exit(1);
}

const text = steps.map((s) => `${s.title} - ${s.body}`).join('\n      ');
const block = `    <!-- GENERATED from src/loci/guide.ts by scripts/sync-welcome.mjs — do not hand-edit between the markers. -->
    <!-- SYNC:WELCOME START -->
    <div class="sub-heading">
      ${text}
    </div>
    <!-- SYNC:WELCOME END -->`;

const startMarker = '<!-- SYNC:WELCOME START -->';
const endMarker = '<!-- SYNC:WELCOME END -->';
const startIndex = panel.indexOf(startMarker);
const endIndex = panel.indexOf(endMarker);

let next;
if (startIndex >= 0 && endIndex > startIndex) {
  next = panel.slice(0, startIndex) + block + panel.slice(endIndex + endMarker.length);
} else {
  // First run: replace any existing generated/hand-written sub-heading.
  const heading = panel.match(/( *)<div class="sub-heading">[\s\S]*?<\/div>/);
  if (heading == null) {
    console.error('sync-welcome: no sub-heading found in welcome.uikitml');
    process.exit(1);
  }
  next = panel.replace(heading[0], block);
}

writeFileSync(panelPath, next);
console.log(`sync-welcome: wrote ${steps.length} steps into welcome.uikitml`);
