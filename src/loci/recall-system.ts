import { createSystem, Hovered, Pressed, RayInteractable, type Entity } from '@iwsdk/core';
import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { AnswerCard, Note, QuizDone, RecallOrb } from './components.js';
import {
  createLabel,
  createRecallOrb,
  setNoteGlow,
  applyNoteBaseLook,
} from './note-factory.js';
import { playConnectTone, playMissTone, playSnapChord } from './audio.js';
import { getLoci, type LociGlobals } from './globals.js';
import {
  createRecognizer,
  isSpeechSupported,
  type SpeechRecognitionLike,
} from './speech.js';
import type { RecallState } from './palace-store.js';
import { schedulePalaceSave } from './palace-store.js';

interface QuizOption {
  text: string;
  correct: boolean;
}

interface QuizQuestion {
  targetId: string;
  prompt: string;
  options: QuizOption[];
}

const PANEL_POS = new Vector3(0, 1.34, -0.82);
const MAX_QUESTIONS = 5;

const trunc = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Weakest / never-quizzed notes first — the spaced-repetition pick. */
function pickOrder(ids: string[], state: RecallState): string[] {
  return [...ids].sort((a, b) => {
    const strengthA = state[a]?.strength ?? -1;
    const strengthB = state[b]?.strength ?? -1;
    return strengthA - strengthB || a.localeCompare(b);
  });
}

/**
 * Recall — the "remember" half. One clean panel per question (Meta hands-UI
 * guidance: generous targets, high contrast, only the current step visible).
 * The world dims behind it; a second orb press or "done" exits anytime.
 */
export class RecallSystem extends createSystem({
  orbPressed: { required: [RecallOrb, Pressed] },
  answersPressed: { required: [AnswerCard, Pressed] },
  donePressed: { required: [QuizDone, Pressed] },
}) {
  private questions: QuizQuestion[] = [];
  private questionIndex = 0;
  private correctCount = 0;
  private sessionActive = false;
  private quizEntities: Entity[] = [];
  private trash: Entity[] = [];
  private optionGeometry = new RoundedBoxGeometry(0.72, 0.105, 0.012, 2, 0.02);
  private panelGeometry = new RoundedBoxGeometry(0.84, 0.7, 0.014, 2, 0.035);
  private doneGeometry = new RoundedBoxGeometry(0.24, 0.055, 0.01, 2, 0.018);
  private feedbackTimer = 0;
  private waitingFeedback = false;
  private endEntity: Entity | null = null;
  private endTimer = 0;
  private recognition: SpeechRecognitionLike | null = null;
  private voiceActive = false;

  init(): void {
    createRecallOrb(this.world, new Vector3(0.84, 1.02, -0.72));
    getLoci(this.globals).requestRecall = () => this.start();
    this.queries.orbPressed.subscribe('qualify', () => {
      if (this.sessionActive) {
        this.cancel();
      } else {
        this.start();
      }
    });
    this.queries.answersPressed.subscribe('qualify', (entity) => {
      this.answer(entity);
    });
    this.queries.donePressed.subscribe('qualify', () => {
      if (this.sessionActive) {
        this.cancel();
      }
    });
  }

  update(delta: number): void {
    this.drainTrash();

    if (this.waitingFeedback) {
      this.feedbackTimer -= delta;
      if (this.feedbackTimer <= 0) {
        this.waitingFeedback = false;
        this.nextQuestion();
      }
    }
    if (this.endEntity != null) {
      this.endTimer -= delta;
      if (this.endTimer <= 0) {
        this.trash.push(this.endEntity);
        this.endEntity = null;
      }
    }
    this.updateOptionHighlights();
  }

  /** Entities are never destroyed mid-iteration — parked here, reaped next tick. */
  private drainTrash(): void {
    if (this.trash.length === 0) {
      return;
    }
    const doomed = this.trash;
    this.trash = [];
    for (const entity of doomed) {
      try {
        entity.object3D?.removeFromParent();
      } catch {
        // already detached
      }
      try {
        entity.destroy();
      } catch {
        // already destroyed
      }
    }
  }

  private updateOptionHighlights(): void {
    for (const entity of this.quizEntities) {
      if (!entity.hasComponent(AnswerCard)) {
        continue;
      }
      const card = entity.object3D?.getObjectByName('card') as Mesh | undefined;
      if (card == null) {
        continue;
      }
      const material = card.material as MeshStandardMaterial;
      const hovered = entity.hasComponent(Hovered);
      material.emissiveIntensity = hovered ? 1.1 : 0.3;
    }
  }

  private start(): void {
    const loci = getLoci(this.globals);
    if (this.sessionActive || loci.recallActive || loci.rewindActive || loci.crisActive) {
      return;
    }
    this.questions = this.buildQuestions(loci);
    if (this.questions.length === 0) {
      this.showEndCard('Dump and organize a few thoughts first — then I\'ll quiz you.');
      return;
    }
    this.sessionActive = true;
    loci.recallActive = true;
    this.questionIndex = 0;
    this.correctCount = 0;
    playConnectTone();
    this.showQuestion(this.questions[0]);
    this.startVoiceAnswers();
  }

  /**
   * Voice answering: while the quiz is open, the mic listens (desktop
   * browsers) and a spoken answer selects the closest option bar.
   */
  private startVoiceAnswers(): void {
    if (!isSpeechSupported()) {
      return;
    }
    this.voiceActive = true;
    const listen = (): void => {
      if (!this.sessionActive || !this.voiceActive) {
        return;
      }
      const rec = createRecognizer();
      if (rec == null) {
        this.voiceActive = false;
        return;
      }
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const transcript = result?.[0]?.transcript?.trim() ?? '';
        if (transcript !== '') {
          this.answerByVoice(transcript);
        }
      };
      rec.onend = () => {
        if (this.sessionActive && this.voiceActive) {
          window.setTimeout(listen, 350);
        }
      };
      rec.onerror = () => {
        this.voiceActive = false;
      };
      try {
        rec.start();
        this.recognition = rec;
      } catch {
        this.voiceActive = false;
      }
    };
    listen();
  }

  private stopVoiceAnswers(): void {
    this.voiceActive = false;
    try {
      this.recognition?.stop();
    } catch {
      // already stopped
    }
    this.recognition = null;
  }

  private answerByVoice(transcript: string): void {
    if (!this.sessionActive || this.waitingFeedback) {
      return;
    }
    const question = this.questions[this.questionIndex];
    if (question == null) {
      return;
    }
    const spoken = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    let bestIndex = -1;
    let bestScore = 0;
    question.options.forEach((option, index) => {
      const candidate = option.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      let score = 0;
      if (candidate.includes(spoken) || spoken.includes(candidate.trim())) {
        score = spoken.length + candidate.length;
      } else {
        for (const word of spoken.split(/\s+/)) {
          if (word.length > 2 && candidate.includes(word)) {
            score += word.length;
          }
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestIndex < 0 || bestScore < 4) {
      return;
    }
    // Select the entity whose option text matches the winning index.
    const optionEntities = this.quizEntities.filter((e) => e.hasComponent(AnswerCard));
    const chosen = optionEntities[bestIndex];
    if (chosen != null) {
      this.answer(chosen);
    }
  }

  /** Second press on the orb bails out of the session and restores the palace. */
  private cancel(): void {
    const loci = getLoci(this.globals);
    this.stopVoiceAnswers();
    this.clearQuizEntities();
    for (const entity of loci.noteById.values()) {
      applyNoteBaseLook(entity);
    }
    this.sessionActive = false;
    loci.recallActive = false;
    this.showEndCard('Recall paused — the palace is yours.');
  }

  private buildQuestions(loci: LociGlobals): QuizQuestion[] {
    interface NoteData {
      id: string;
      text: string;
      cluster: number;
    }
    const notes: NoteData[] = [];
    for (const [id, entity] of loci.noteById) {
      notes.push({
        id,
        text: entity.getValue(Note, 'text') ?? '',
        cluster: entity.getValue(Note, 'cluster') ?? -1,
      });
    }
    if (notes.length < 2) {
      return [];
    }

    const neighbors = new Map<string, Set<string>>();
    for (const edge of loci.lastEdges) {
      if (!neighbors.has(edge.a)) {
        neighbors.set(edge.a, new Set());
      }
      if (!neighbors.has(edge.b)) {
        neighbors.set(edge.b, new Set());
      }
      neighbors.get(edge.a)!.add(edge.b);
      neighbors.get(edge.b)!.add(edge.a);
    }

    const labels = loci.lastLabels;
    const questions: QuizQuestion[] = [];
    const used = new Set<string>();
    for (const candidate of pickOrder(notes.map((n) => n.id), loci.recallState)) {
      if (questions.length >= MAX_QUESTIONS) {
        break;
      }
      if (used.has(candidate)) {
        continue;
      }
      const target = notes.find((n) => n.id === candidate)!;

      // Type A — cluster membership: "which thread did it join?"
      let question: QuizQuestion | null = null;
      if (labels.length >= 2 && target.cluster >= 0) {
        const correctLabel = labels.find((l) => l.index === target.cluster)?.label;
        if (correctLabel != null) {
          const others = labels
            .filter((l) => l.index !== target.cluster)
            .map((l) => l.label);
          if (others.length > 0) {
            const options: QuizOption[] = [
              { text: correctLabel, correct: true },
              ...shuffle(others)
                .slice(0, 2)
                .map((text) => ({ text, correct: false })),
            ];
            question = {
              targetId: target.id,
              prompt: `You placed: "${trunc(target.text, 58)}" — which thread did it join?`,
              options: shuffle(options),
            };
          }
        }
      }

      // Type B — association: "which thought was closest to it?"
      if (question == null) {
        const linked = neighbors.get(target.id);
        let peers = notes.filter((n) => n.id !== target.id && (linked?.has(n.id) ?? false));
        if (peers.length === 0 && target.cluster >= 0) {
          peers = notes.filter(
            (n) => n.id !== target.id && n.cluster === target.cluster,
          );
        }
        if (peers.length > 0) {
          const peer = peers[0];
          const peerIds = new Set(peers.map((n) => n.id));
          // Prefer notes from other clusters as distractors; if the palace is
          // one big cluster, any other note still makes the question askable.
          let pool = notes.filter(
            (n) =>
              n.id !== target.id &&
              !peerIds.has(n.id) &&
              (target.cluster < 0 || n.cluster !== target.cluster),
          );
          if (pool.length === 0) {
            pool = notes.filter((n) => n.id !== target.id && !peerIds.has(n.id));
          }
          const distractors = shuffle(pool).slice(0, Math.min(2, pool.length));
          const optionNotes = [peer, ...distractors];
          if (optionNotes.length >= 2) {
            question = {
              targetId: target.id,
              prompt: `"${trunc(target.text, 58)}" — which thought was closest to it?`,
              options: shuffle(
                optionNotes.map((n) => ({
                  text: trunc(n.text, 46),
                  correct: n.id === peer.id,
                })),
              ),
            };
          }
        }
      }

      if (question != null) {
        questions.push(question);
        used.add(candidate);
      }
    }
    return questions;
  }

  private addPanelPiece(
    object: Object3D,
    offsetY: number,
  ): void {
    object.position.set(PANEL_POS.x, PANEL_POS.y + offsetY, PANEL_POS.z);
    object.lookAt(PANEL_POS.x, PANEL_POS.y + offsetY, 0.001);
  }

  private showQuestion(question: QuizQuestion): void {
    this.clearQuizEntities();
    const loci = getLoci(this.globals);

    // Backdrop — one calm dark surface; the world dims behind it.
    const backdrop = new Mesh(
      this.panelGeometry,
      new MeshStandardMaterial({
        color: 0x0e1428,
        emissive: new Color(0x1a2440),
        emissiveIntensity: 0.55,
        roughness: 0.7,
        transparent: true,
        opacity: 0.96,
      }),
    );
    backdrop.name = 'panel';
    this.addPanelPiece(backdrop, 0);
    const backdropEntity = this.world.createTransformEntity(backdrop);
    this.quizEntities.push(backdropEntity);

    const prompt = createLabel(question.prompt, 0.019, '#e8edff', 0.74);
    this.addPanelPiece(prompt, 0.235);
    this.quizEntities.push(this.world.createTransformEntity(prompt));

    if (this.voiceActive) {
      const hint = createLabel('or just say your answer', 0.012, '#8fa3d8', 0.5);
      this.addPanelPiece(hint, 0.155);
      this.quizEntities.push(this.world.createTransformEntity(hint));
    }

    const optionYs = [0.08, -0.045, -0.17];
    question.options.forEach((option, index) => {
      const cardGroup = new Group();
      const material = new MeshStandardMaterial({
        color: 0x1c2745,
        emissive: new Color(0x3a4b7a),
        emissiveIntensity: 0.3,
        roughness: 0.5,
      });
      const card = new Mesh(this.optionGeometry, material);
      card.name = 'card';
      cardGroup.add(card);
      const label = createLabel(option.text, 0.0145, '#dfe6ff', 0.62);
      label.position.set(0, 0, 0.009);
      cardGroup.add(label);
      this.addPanelPiece(cardGroup, optionYs[index]);

      const entity = this.world.createTransformEntity(cardGroup);
      entity.addComponent(AnswerCard, { correct: option.correct });
      entity.addComponent(RayInteractable);
      this.quizEntities.push(entity);
    });

    const doneGroup = new Group();
    const doneMesh = new Mesh(
      this.doneGeometry,
      new MeshStandardMaterial({
        color: 0x232c4d,
        emissive: new Color(0x56639a),
        emissiveIntensity: 0.4,
        roughness: 0.5,
      }),
    );
    doneMesh.name = 'card';
    doneGroup.add(doneMesh);
    const doneLabel = createLabel('done', 0.013, '#9fb0e0', 0.2);
    doneLabel.position.set(0, 0, 0.008);
    doneGroup.add(doneLabel);
    this.addPanelPiece(doneGroup, -0.3);
    const doneEntity = this.world.createTransformEntity(doneGroup);
    doneEntity.addComponent(QuizDone);
    doneEntity.addComponent(RayInteractable);
    this.quizEntities.push(doneEntity);

    // Spotlight: the target glows, everything else rests.
    for (const [id, entity] of loci.noteById) {
      setNoteGlow(entity, id === question.targetId ? 0.9 : 0.07);
    }
  }

  private answer(entity: Entity): void {
    if (!this.sessionActive || this.waitingFeedback) {
      return;
    }
    const question = this.questions[this.questionIndex];
    if (question == null) {
      return;
    }
    const chosenCorrect = entity.getValue(AnswerCard, 'correct') ?? false;
    const record = getLoci(this.globals).recallState[question.targetId] ?? {
      strength: 0,
      seen: 0,
    };
    record.seen += 1;
    record.strength = chosenCorrect ? Math.min(5, record.strength + 1) : 0;
    getLoci(this.globals).recallState[question.targetId] = record;

    // Reveal: correct bars glow green, a wrong pick glows amber.
    for (const quizEntity of this.quizEntities) {
      if (!quizEntity.hasComponent(AnswerCard) || quizEntity.object3D == null) {
        continue;
      }
      const isCorrect = quizEntity.getValue(AnswerCard, 'correct') ?? false;
      const card = quizEntity.object3D.getObjectByName('card') as Mesh | undefined;
      if (card == null) {
        continue;
      }
      const material = card.material as MeshStandardMaterial;
      if (isCorrect) {
        material.color.set(0x1d4a35);
        material.emissive.set(0x2fbf6a);
        material.emissiveIntensity = 1.2;
      } else if (quizEntity === entity && !chosenCorrect) {
        material.color.set(0x4a351d);
        material.emissive.set(0xbf7a2f);
        material.emissiveIntensity = 1.2;
      }
    }

    if (chosenCorrect) {
      this.correctCount += 1;
      playConnectTone();
    } else {
      playMissTone();
    }
    this.waitingFeedback = true;
    this.feedbackTimer = 1.15;
  }

  private nextQuestion(): void {
    this.questionIndex += 1;
    const question = this.questions[this.questionIndex];
    if (question != null) {
      this.showQuestion(question);
    } else {
      this.finish();
    }
  }

  private finish(): void {
    const loci = getLoci(this.globals);
    this.stopVoiceAnswers();
    this.clearQuizEntities();
    for (const entity of loci.noteById.values()) {
      applyNoteBaseLook(entity);
    }
    this.sessionActive = false;
    loci.recallActive = false;
    playSnapChord(0.1);
    schedulePalaceSave(loci, 100);
    this.showEndCard(
      `${this.correctCount} of ${this.questions.length} remembered — come back tomorrow, I'll keep it fresh.`,
    );
  }

  private showEndCard(message: string): void {
    if (this.endEntity != null) {
      this.trash.push(this.endEntity);
    }
    const label = createLabel(message, 0.021, '#bdf5e6', 0.74);
    this.addPanelPiece(label, 0.06);
    this.endEntity = this.world.createTransformEntity(label);
    this.endTimer = 3.2;
    const status = document.getElementById('hud-status');
    if (status != null) {
      status.textContent = message;
    }
  }

  private clearQuizEntities(): void {
    this.trash.push(...this.quizEntities);
    this.quizEntities = [];
  }
}
