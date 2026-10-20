/**
 * Single source of truth for onboarding — rendered into the in-headset
 * welcome panel AND the desktop help overlay. Edit here only.
 */
export interface GuideStep {
  title: string;
  body: string;
}

export const GUIDE_TITLE = 'How Loci works';

export const GUIDE_STEPS: GuideStep[] = [
  { title: 'Capture', body: 'Type, speak, or press a seed card to spill a set.' },
  { title: 'Organize', body: 'Touch the glowing orb — your thoughts snap into connected clusters.' },
  { title: 'Arrange', body: 'Grab and drag any card. Your placements are never overwritten.' },
  { title: 'Recall', body: 'The violet orb quizzes your weakest notes — answer by touch or voice.' },
  { title: 'Rewind', body: 'Scrub the dial at the edge of the void to watch your palace grow.' },
  { title: 'Persist', body: 'Everything autosaves. Export a backup from the desktop bar.' },
];
