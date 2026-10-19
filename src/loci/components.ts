import { createComponent, Types } from '@iwsdk/core';

/** A single thought card in the palace. */
export const Note = createComponent('Note', {
  id: { type: Types.String, default: '' },
  text: { type: Types.String, default: '' },
  cluster: { type: Types.Int32, default: -1 },
  hue: { type: Types.Float32, default: 0.13 },
  state: {
    type: Types.Enum,
    enum: { Raw: 'raw', Snapping: 'snapping', Settled: 'settled' },
    default: 'raw',
  },
  userPlaced: { type: Types.Boolean, default: false },
});

/** Eased flight from startPos to targetPos — the snap. */
export const SnapAnimation = createComponent('SnapAnimation', {
  startPos: { type: Types.Vec3, default: [0, 0, 0] },
  targetPos: { type: Types.Vec3, default: [0, 0, 0] },
  elapsed: { type: Types.Float32, default: 0 },
  duration: { type: Types.Float32, default: 0.65 },
  delay: { type: Types.Float32, default: 0 },
});

/** An emissive connection line growing between two notes. */
export const ConnectionLine = createComponent('ConnectionLine', {
  fromId: { type: Types.String, default: '' },
  toId: { type: Types.String, default: '' },
  elapsed: { type: Types.Float32, default: 0 },
  delay: { type: Types.Float32, default: 0 },
  duration: { type: Types.Float32, default: 0.45 },
});

/** A demo dump card: press to spill a curated set of thoughts. */
export const SeedCard = createComponent('SeedCard', {
  setKey: { type: Types.String, default: '' },
});

/** The floating "organize" affordance. */
export const OrganizeOrb = createComponent('OrganizeOrb', {});

/** Floating cluster title text. */
export const ClusterLabel = createComponent('ClusterLabel', {
  text: { type: Types.String, default: '' },
  clusterIndex: { type: Types.Int32, default: -1 },
});

/** The floating "recall" affordance — starts a quiz session. */
export const RecallOrb = createComponent('RecallOrb', {});

/** One multiple-choice answer card during a recall quiz. */
export const AnswerCard = createComponent('AnswerCard', {
  correct: { type: Types.Boolean, default: false },
});

/** The "done" button on the recall panel — ends the session. */
export const QuizDone = createComponent('QuizDone', {});

/** A Sage suggestion bud: expand (green) or challenge (amber) a note. */
export const SuggestionBud = createComponent('SuggestionBud', {
  kind: {
    type: Types.Enum,
    enum: { Expand: 'expand', Challenge: 'challenge' },
    default: 'expand',
  },
  text: { type: Types.String, default: '' },
});
