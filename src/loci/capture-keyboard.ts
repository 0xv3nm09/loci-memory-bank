import { createSystem, Pressed, RayInteractable, type Entity } from '@iwsdk/core';
import { Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { KeyboardKey } from './components.js';
import { createLabel } from './note-factory.js';
import { getLoci } from './globals.js';
import { GLASS, SEMANTIC } from './palette.js';
import { frame } from './spatial-ui.js';

const KEY_W = 0.052;
const KEY_H = 0.047;
const STEP = KEY_W + 0.005;
const PANEL_POS = new Vector3(0, 1.42, -0.78);
const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
// Row 3 as [label, char, xSteps, widthInSteps]
const BOTTOM_ROW: Array<[string, string, number, number]> = [
  ['.', '.', 1, 1],
  [',', ',', 2, 1],
  ['?', '?', 3, 1],
  ['space', ' ', 4.9, 3.2],
  ['⌫', '⌫', 7.4, 1.6],
  ['Add', '✓', 9.2, 2.2],
];

/**
 * In-headset text capture — a spatial QWERTY panel. Quest browsers have no
 * speech recognition, so this is the hands-first typed path: gaze/pinch the
 * keys (or click on desktop), press done, and the thought lands like any
 * other capture.
 */
export class KeyboardSystem extends createSystem({
  keysPressed: { required: [KeyboardKey, Pressed] },
}) {
  private root: Entity | null = null;
  private fieldRedraw: ((text: string) => void) | null = null;
  private buffer = '';
  private commit: ((text: string) => void) | null = null;
  private keyGeometry = new RoundedBoxGeometry(KEY_W, KEY_H, 0.008, 1, 0.008);

  init(): void {
    getLoci(this.globals).requestKeyboard = (initial, commit) => {
      this.open(initial, commit);
    };
    this.queries.keysPressed.subscribe('qualify', (entity) => {
      this.press(entity.getValue(KeyboardKey, 'char') ?? '');
    });
  }

  private open(initial: string, commit: (text: string) => void): void {
    const loci = getLoci(this.globals);
    if (loci.crisActive || loci.introActive || loci.recallActive || loci.rewindActive || loci.helpActive) return;
    this.close();
    loci.keyboardActive = true;
    this.buffer = initial;
    this.commit = commit;
    this.build();
  }

  private close(): void {
    if (this.root != null) {
      try {
        this.root.dispose();
      } catch {
        // already gone
      }
      this.root = null;
      this.fieldRedraw = null;
      getLoci(this.globals).keyboardActive = false;
    }
  }

  private press(char: string): void {
    if (char === '×') {
      this.close(); return;
    } else if (char === '⌫') {
      this.buffer = this.buffer.slice(0, -1);
    } else if (char === '✓') {
      const text = this.buffer.trim();
      const commit = this.commit;
      this.close();
      if (text !== '' && commit != null) {
        commit(text);
      }
      return;
    } else if (this.buffer.length < 120) {
      this.buffer += char;
    }
    this.fieldRedraw?.(this.buffer);
  }

  private build(): void {
    const group = new Group();
    group.name = 'capture-keyboard';

    const backdrop = new Mesh(
      new RoundedBoxGeometry(0.65, 0.44, 0.012, 2, 0.02),
      new MeshStandardMaterial({
        color: GLASS.panelBody,
        emissive: new Color(GLASS.panelEmissive),
        emissiveIntensity: GLASS.panelEmissiveIntensity,
        roughness: 0.65,
        transparent: true,
        opacity: GLASS.panelOpacity,
      }),
    );
    group.add(backdrop);
    group.add(frame(.65,.44,SEMANTIC.connection));

    const fieldPanel = new Mesh(
      new RoundedBoxGeometry(0.57, 0.060, 0.006, 1, 0.008),
      new MeshStandardMaterial({
        color: GLASS.panelBody,
        emissive: new Color(GLASS.panelEmissive),
        emissiveIntensity: GLASS.panelEmissiveIntensity,
        toneMapped: false,
        roughness: 0.6,
      }),
    );
    fieldPanel.position.set(0, 0.14, 0.008);
    group.add(fieldPanel);
    // Start with content color — the redraw closure captures the color at
    // creation time, so we always use the content color and swap visually
    // between placeholder text and real input in the redraw callback.
    const field = createLabel(
      this.buffer || 'type your thought…',
      0.018,
      SEMANTIC.promptText,
      0.55,
    );
    field.position.set(0, 0.14, 0.017);
    group.add(field);
    this.fieldRedraw = (text: string): void => {
      // When buffer is empty show placeholder in dim color; createLabel's
      // redraw uses the captured color, so we modulate opacity instead.
      const mat = (field as Mesh).material as { opacity: number };
      if (text) {
        mat.opacity = 1;
        field.userData.redraw?.(text);
      } else {
        mat.opacity = 0.45;
        field.userData.redraw?.('type your thought…');
      }
    };

    this.root = this.world.createTransformEntity(group);
    const rootObject = this.root.object3D;
    if (rootObject == null) {
      return;
    }
    rootObject.position.copy(PANEL_POS);
    rootObject.lookAt(PANEL_POS.x, PANEL_POS.y, 0.001);

    const addKey = (
      label: string,
      char: string,
      xSteps: number,
      widthSteps: number,
      rowY: number,
    ): void => {
      const keyGroup = new Group();
      const geometry =
        widthSteps === 1
          ? this.keyGeometry
          : new RoundedBoxGeometry(KEY_W * widthSteps, KEY_H, 0.008, 1, 0.008);
      const material = new MeshStandardMaterial({
        color: char==='✓' ? GLASS.correctBody : GLASS.buttonBody,
        emissive: new Color(GLASS.buttonEmissive),
        emissiveIntensity: GLASS.buttonEmissiveIntensity,
        roughness: 0.42,
        toneMapped: false,
      });
      const key = new Mesh(geometry, material);
      key.name = 'card';
      keyGroup.add(key);
      keyGroup.add(frame(KEY_W*widthSteps,KEY_H,char==='✓' ? SEMANTIC.expand : GLASS.border));
      const keyLabel = createLabel(
        label,
        label.length > 2 ? 0.012 : 0.020,
        SEMANTIC.promptText,
        KEY_W * widthSteps * 0.95,
      );
      keyLabel.position.z = 0.007;
      keyGroup.add(keyLabel);
      keyGroup.position.set((xSteps - 4.9) * STEP, rowY, 0.01);
      const entity = this.world.createTransformEntity(keyGroup, { parent: this.root ?? undefined });
      entity.addComponent(KeyboardKey, { char });
      entity.addComponent(RayInteractable);
    };

    addKey('×', '×', 10, 1, 0.19);
    ROWS.forEach((rowLetters, row) => {
      const offset = (10 - rowLetters.length) / 2;
      rowLetters.split('').forEach((letter, col) => {
        addKey(letter, letter, offset + col + 0.5, 1, 0.065 - row * (KEY_H + 0.009));
      });
    });
    BOTTOM_ROW.forEach(([label, char, xSteps, width]) => {
      addKey(label, char, xSteps, width, 0.065 - ROWS.length * (KEY_H + 0.009));
    });
  }
}
