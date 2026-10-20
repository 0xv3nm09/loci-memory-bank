import { createSystem, Pressed, RayInteractable, type Entity } from '@iwsdk/core';
import { Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { KeyboardKey } from './components.js';
import { createLabel } from './note-factory.js';
import { getLoci } from './globals.js';

const KEY_W = 0.042;
const KEY_H = 0.034;
const STEP = KEY_W + 0.005;
const PANEL_POS = new Vector3(0, 1.32, -0.7);
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
// Row 3 as [label, char, xSteps, widthInSteps]
const BOTTOM_ROW: Array<[string, string, number, number]> = [
  ['.', '.', 1, 1],
  [',', ',', 2, 1],
  ['?', '?', 3, 1],
  ['space', ' ', 4.9, 3.2],
  ['⌫', '⌫', 7.4, 1.6],
  ['✓ done', '✓', 9.2, 2.2],
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
    this.close();
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
    }
  }

  private press(char: string): void {
    if (char === '⌫') {
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
      new RoundedBoxGeometry(0.52, 0.26, 0.012, 2, 0.02),
      new MeshStandardMaterial({
        color: 0x0e1428,
        emissive: new Color(0x1a2440),
        emissiveIntensity: 0.6,
        roughness: 0.7,
        transparent: true,
        opacity: 0.97,
      }),
    );
    group.add(backdrop);

    const fieldPanel = new Mesh(
      new RoundedBoxGeometry(0.46, 0.034, 0.006, 1, 0.008),
      new MeshStandardMaterial({
        color: 0x10162b,
        emissive: new Color(0x2a3557),
        emissiveIntensity: 0.5,
        roughness: 0.6,
      }),
    );
    fieldPanel.position.set(0, 0.09, 0.008);
    group.add(fieldPanel);
    const field = createLabel(
      this.buffer || 'type your thought…',
      0.0125,
      this.buffer ? '#eef1ff' : '#7684ad',
      0.44,
    );
    field.position.set(0, 0.09, 0.014);
    group.add(field);
    this.fieldRedraw = (text: string): void => {
      field.userData.redraw?.(text || 'type your thought…');
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
        color: 0x1c2745,
        emissive: new Color(0x3a4b7a),
        emissiveIntensity: 0.35,
        roughness: 0.5,
      });
      const key = new Mesh(geometry, material);
      key.name = 'card';
      keyGroup.add(key);
      const keyLabel = createLabel(
        label,
        label.length > 2 ? 0.0075 : 0.011,
        '#dfe6ff',
        KEY_W * widthSteps * 0.95,
      );
      keyLabel.position.z = 0.007;
      keyGroup.add(keyLabel);
      keyGroup.position.set((xSteps - 4.9) * STEP, rowY, 0.01);
      const entity = this.world.createTransformEntity(keyGroup, { parent: this.root ?? undefined });
      entity.addComponent(KeyboardKey, { char });
      entity.addComponent(RayInteractable);
    };

    ROWS.forEach((rowLetters, row) => {
      const offset = (10 - rowLetters.length) / 2;
      rowLetters.split('').forEach((letter, col) => {
        addKey(letter, letter, offset + col + 0.5, 1, 0.048 - row * (KEY_H + 0.005));
      });
    });
    BOTTOM_ROW.forEach(([label, char, xSteps, width]) => {
      addKey(label, char, xSteps, width, 0.048 - 3 * (KEY_H + 0.005));
    });
  }
}
