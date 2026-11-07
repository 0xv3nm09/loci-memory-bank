import { createSystem, Pressed, RayInteractable, type Entity } from '@iwsdk/core';
import { Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CrisisDismiss } from './components.js';
import { getLoci } from './globals.js';
import { createLabel } from './note-factory.js';
import { playCalmTone } from './audio.js';
import { GLASS, SEMANTIC } from './palette.js';

/**
 * The 3D crisis surface — the one feature that must exist in-headset.
 * When the distress gate fires, normal flow stops and this calm panel is
 * the only thing on screen: real resources, a dismiss button, no product
 * voice. While it is open, organize/recall/capture are blocked.
 */
export class CrisisPanelSystem extends createSystem({
  dismissPressed: { required: [CrisisDismiss, Pressed] },
}) {
  private panelEntity: Entity | null = null;
  private panelGeometry = new RoundedBoxGeometry(0.92, 0.72, 0.014, 2, 0.03);
  private buttonGeometry = new RoundedBoxGeometry(0.3, 0.06, 0.012, 2, 0.018);

  init(): void {
    getLoci(this.globals).crisActive = false;
    this.queries.dismissPressed.subscribe('qualify', () => this.dismiss());
  }

  show(): void {
    if (this.panelEntity != null) {
      return;
    }
    const loci = getLoci(this.globals);
    loci.crisActive = true;

    // Calm audio cue — presence and care, never an alarm.
    playCalmTone();

    const group = new Group();
    group.name = 'crisis-panel';

    const backdrop = new Mesh(
      this.panelGeometry,
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

    const place = (object: import('three').Object3D, y: number): void => {
      object.position.set(0, y, 0.012);
      group.add(object);
    };

    place(createLabel('That sounds really heavy.', 0.022, SEMANTIC.promptText, 0.8), 0.27);
    place(
      createLabel(
        'You do not have to carry this alone, and nothing here needs to be organized right now. Please reach out to a real person:',
        0.014,
        SEMANTIC.hintText,
        0.8,
      ),
      0.19,
    );
    place(createLabel('findahelpline.com - free, confidential helplines in your country', 0.014, SEMANTIC.promptText, 0.8), 0.09);
    place(createLabel('US & Canada: call or text 988 (Suicide & Crisis Lifeline)', 0.018, '#ffffff', 0.8), 0.045);
    place(createLabel('In immediate danger? Contact your local emergency services.', 0.014, SEMANTIC.promptText, 0.8), 0.0);
    place(createLabel('Tell someone you trust. You matter.', 0.014, SEMANTIC.calmAccent, 0.8), -0.045);

    const dismissGroup = new Group();
    const button = new Mesh(
      this.buttonGeometry,
      new MeshStandardMaterial({
        color: GLASS.buttonBody,
        emissive: new Color(GLASS.buttonEmissive),
        emissiveIntensity: GLASS.buttonEmissiveIntensity + 0.15,
        roughness: 0.45,
      }),
    );
    button.name = 'card';
    dismissGroup.add(button);
    const buttonLabel = createLabel("I'm okay — continue", 0.0135, '#dfe6ff', 0.27);
    buttonLabel.position.z = 0.008;
    dismissGroup.add(buttonLabel);
    place(dismissGroup, -0.27);

    group.position.set(0, 1.42, -0.8);
    group.lookAt(0, 1.42, 0.001);
    this.panelEntity = this.world.createTransformEntity(group);
    // Dismiss via the button only — not the whole panel.
    const dismissEntity = this.world.createTransformEntity(dismissGroup, { parent: this.panelEntity });
    dismissEntity.addComponent(CrisisDismiss);
    dismissEntity.addComponent(RayInteractable);
  }

  private dismiss(): void {
    if (this.panelEntity != null) {
      try {
        this.panelEntity.dispose();
      } catch {
        // already gone
      }
      this.panelEntity = null;
    }
    getLoci(this.globals).crisActive = false;
  }
}

