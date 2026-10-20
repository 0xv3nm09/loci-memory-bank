import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Points,
  PointsMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  OneHandGrabbable,
  RayInteractable,
  type Entity,
  type World,
} from '@iwsdk/core';
import {
  ClusterLabel,
  ConnectionLine,
  Note,
  OrganizeOrb,
  MicOrb,
  RecallOrb,
  SeedCard,
  SuggestionBud,
  TypeOrb,
} from './components.js';
import { createTextLabel } from './text-label.js';
import { GLASS, accentForHue } from './palette.js';

export const CARD_W = 0.17;
export const CARD_H = 0.115;
const CARD_D = 0.012;

let cardGeometry: RoundedBoxGeometry | null = null;
function getCardGeometry(): RoundedBoxGeometry {
  if (cardGeometry == null) {
    cardGeometry = new RoundedBoxGeometry(CARD_W, CARD_H, CARD_D, 2, 0.02);
  }
  return cardGeometry;
}

/** Cards face the seated player at the origin. */
function facePlayer(object: Object3D): void {
  object.lookAt(0, object.position.y, 0.001);
}

export function createLabel(
  text: string,
  fontSize: number,
  colorValue: number | string,
  maxWidth?: number,
  fontWeight = 600,
): Mesh {
  const color =
    typeof colorValue === 'number' ? `#${colorValue.toString(16).padStart(6, '0')}` : colorValue;
  return createTextLabel(text, fontSize, {
    maxWidth: maxWidth ?? CARD_W * 0.86,
    maxLines: 4,
    color,
    fontWeight,
  });
}

function createTextMesh(text: string, fontSize: number, colorValue: number | string): Mesh {
  return createLabel(text, fontSize, colorValue);
}

export function createNote(
  world: World,
  id: string,
  text: string,
  position: Vector3,
): Entity {
  const group = new Group();
  group.name = `note-${id}`;

  const material = new MeshStandardMaterial({
    color: GLASS.body,
    emissive: new Color(GLASS.rawRim),
    emissiveIntensity: GLASS.rawRimIntensity,
    roughness: 0.42,
    metalness: 0.12,
  });
  const card = new Mesh(getCardGeometry(), material);
  card.name = 'card';
  group.add(card);

  const accentBar = new Mesh(
    new BoxGeometry(CARD_W * 0.62, 0.005, 0.002),
    new MeshBasicMaterial({ color: GLASS.rawRim }),
  );
  accentBar.name = 'accent-bar';
  accentBar.position.set(0, CARD_H / 2 - 0.011, CARD_D / 2 + 0.002);
  accentBar.visible = false;
  group.add(accentBar);

  const label = createTextMesh(text, 0.0155, GLASS.ink);
  label.position.z = CARD_D / 2 + 0.004;
  label.name = 'label';
  group.add(label);

  group.position.copy(position);
  facePlayer(group);

  const entity = world.createTransformEntity(group);
  entity.addComponent(Note, { id, text });
  entity.addComponent(RayInteractable);
  entity.addComponent(OneHandGrabbable, {
    translate: true,
    translateMin: [-1.4, 0.25, -1.4],
    translateMax: [1.4, 2.2, 1.4],
  });
  return entity;
}

export function setNoteTint(entity: Entity, hue: number, intensity: number): void {
  const card = entity.object3D?.getObjectByName('card') as Mesh | undefined;
  if (card == null) {
    return;
  }
  const material = card.material as MeshStandardMaterial;
  // Cluster color lives in the glow and the accent bar — never the body.
  const accent = accentForHue(hue);
  material.emissive.set(accent);
  material.emissiveIntensity = intensity;
  const bar = entity.object3D?.getObjectByName('accent-bar') as Mesh | undefined;
  if (bar != null) {
    bar.visible = true;
    (bar.material as MeshBasicMaterial).color.set(accent);
  }
}

/** Adjust only the glow strength — used by Recall's spotlight dimming. */
export function setNoteGlow(entity: Entity, intensity: number): void {
  const card = entity.object3D?.getObjectByName('card') as Mesh | undefined;
  if (card == null) {
    return;
  }
  (card.material as MeshStandardMaterial).emissiveIntensity = intensity;
}

/** Back to the note's ordinary look based on its own cluster/hue state. */
export function applyNoteBaseLook(entity: Entity): void {
  const card = entity.object3D?.getObjectByName('card') as Mesh | undefined;
  if (card == null) {
    return;
  }
  const material = card.material as MeshStandardMaterial;
  const cluster = entity.getValue(Note, 'cluster') ?? -1;
  if (cluster >= 0) {
    setNoteTint(entity, entity.getValue(Note, 'hue') ?? 0.13, 0.45);
  } else {
    material.emissive.set(GLASS.rawRim);
    material.emissiveIntensity = GLASS.rawRimIntensity;
    material.color.set(GLASS.body);
    const bar = entity.object3D?.getObjectByName('accent-bar') as Mesh | undefined;
    if (bar != null) {
      bar.visible = false;
    }
  }
}

export function createLine(
  world: World,
  fromId: string,
  toId: string,
  delay: number,
): Entity {
  const geometry = new CylinderGeometry(0.0028, 0.0028, 1, 6, 1, true);
  geometry.translate(0, 0.5, 0);
  const material = new MeshBasicMaterial({
    color: 0x46c8e8,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.scale.set(1, 0.0001, 1);
  const entity = world.createTransformEntity(mesh);
  entity.addComponent(ConnectionLine, { fromId, toId, delay });
  return entity;
}

export function createSeed(
  world: World,
  key: string,
  title: string,
  position: Vector3,
): Entity {
  const group = new Group();
  group.name = `seed-${key}`;

  const material = new MeshStandardMaterial({
    color: 0x2a3050,
    emissive: new Color(0x3d5a8f),
    emissiveIntensity: 0.35,
    roughness: 0.5,
    metalness: 0.1,
  });
  const card = new Mesh(getCardGeometry(), material);
  card.name = 'card';
  card.scale.setScalar(0.72);
  group.add(card);

  const label = createTextMesh(title, 0.0135, 0xcfe2ff);
  label.position.z = CARD_D / 2 + 0.002;
  group.add(label);

  group.position.copy(position);
  facePlayer(group);

  const entity = world.createTransformEntity(group);
  entity.addComponent(SeedCard, { setKey: key });
  entity.addComponent(RayInteractable);
  return entity;
}

export function createOrganizeOrb(world: World, position: Vector3): Entity {
  const group = new Group();
  group.name = 'organize-orb';

  const orb = new Mesh(
    new SphereGeometry(0.026, 20, 14),
    new MeshStandardMaterial({
      color: 0x9fe8d8,
      emissive: new Color(0x2fbf9a),
      emissiveIntensity: 0.8,
      roughness: 0.3,
    }),
  );
  orb.name = 'card';
  group.add(orb);

  const label = createTextMesh('organize', 0.016, 0xbdf5e6);
  label.position.y = -0.055;
  group.add(label);

  group.position.copy(position);
  facePlayer(group);

  const entity = world.createTransformEntity(group);
  entity.addComponent(OrganizeOrb);
  entity.addComponent(RayInteractable);
  return entity;
}

export function createSuggestionBud(
  world: World,
  kind: 'expand' | 'challenge',
  text: string,
  position: Vector3,
): Entity {
  const group = new Group();
  group.name = `bud-${kind}`;

  const isExpand = kind === 'expand';
  const bud = new Mesh(
    new SphereGeometry(0.014, 16, 12),
    new MeshStandardMaterial({
      color: isExpand ? 0x8fe8b0 : 0xf0c98a,
      emissive: new Color(isExpand ? 0x2fbf6a : 0xbf7a2f),
      emissiveIntensity: 0.85,
      roughness: 0.35,
    }),
  );
  bud.name = 'card';
  group.add(bud);

  const glyph = createTextLabel(isExpand ? '+' : '?', 0.016, { maxWidth: 0.03, color: '#06131c' });
  glyph.position.z = 0.013;
  group.add(glyph);

  const bubble = createTextLabel(text, 0.0125, {
    maxWidth: 0.4,
    color: isExpand ? '#c9f5da' : '#ffe4c2',
  });
  bubble.name = 'bud-text';
  bubble.position.set(0, 0.09, 0.01);
  bubble.visible = false;
  group.add(bubble);

  group.position.copy(position);
  facePlayer(group);

  const entity = world.createTransformEntity(group);
  entity.addComponent(SuggestionBud, { kind, text });
  entity.addComponent(RayInteractable);
  return entity;
}

export function createMicOrb(world: World, position: Vector3): Entity {
  const group = new Group();
  group.name = 'mic-orb';

  const orb = new Mesh(
    new SphereGeometry(0.026, 20, 14),
    new MeshStandardMaterial({
      color: 0xffc9c9,
      emissive: new Color(0xd05858),
      emissiveIntensity: 0.7,
      roughness: 0.3,
    }),
  );
  orb.name = 'card';
  group.add(orb);

  const label = createTextMesh('mic', 0.016, '#ffd9d9');
  label.position.y = -0.055;
  group.add(label);

  group.position.copy(position);
  facePlayer(group);

  const entity = world.createTransformEntity(group);
  entity.addComponent(MicOrb);
  entity.addComponent(RayInteractable);
  return entity;
}

export function createTypeOrb(world: World, position: Vector3): Entity {
  const group = new Group();
  group.name = 'type-orb';

  const orb = new Mesh(
    new SphereGeometry(0.026, 20, 14),
    new MeshStandardMaterial({
      color: 0xaac6ff,
      emissive: new Color(0x4a6fd0),
      emissiveIntensity: 0.8,
      roughness: 0.3,
    }),
  );
  orb.name = 'card';
  group.add(orb);

  const label = createTextMesh('type', 0.016, '#c9d8ff');
  label.position.y = -0.055;
  group.add(label);

  group.position.copy(position);
  facePlayer(group);

  const entity = world.createTransformEntity(group);
  entity.addComponent(TypeOrb);
  entity.addComponent(RayInteractable);
  return entity;
}

export function createRecallOrb(world: World, position: Vector3): Entity {
  const group = new Group();
  group.name = 'recall-orb';

  const orb = new Mesh(
    new SphereGeometry(0.026, 20, 14),
    new MeshStandardMaterial({
      color: 0xcfc2ff,
      emissive: new Color(0x7a5fd0),
      emissiveIntensity: 0.8,
      roughness: 0.3,
    }),
  );
  orb.name = 'card';
  group.add(orb);

  const label = createTextMesh('recall', 0.016, 0xe2daff);
  label.position.y = -0.055;
  group.add(label);

  group.position.copy(position);
  facePlayer(group);

  const entity = world.createTransformEntity(group);
  entity.addComponent(RecallOrb);
  entity.addComponent(RayInteractable);
  return entity;
}

export function createClusterLabel(
  world: World,
  text: string,
  hue: number,
  position: Vector3,
  clusterIndex: number,
): Entity {
  const label = createTextMesh(text, 0.028, new Color(accentForHue(hue)).getStyle());
  label.name = 'cluster-label';
  label.position.copy(position);
  facePlayer(label);
  const entity = world.createTransformEntity(label);
  entity.addComponent(ClusterLabel, { text, clusterIndex });
  return entity;
}

export function createStarfield(world: World): Points {
  const count = 520;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radius = 3.5 + Math.random() * 5.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi) * 0.6 + 1.2;
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const material = new PointsMaterial({
    color: 0x8a93c8,
    size: 0.011,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const points = new Points(geometry, material);
  points.name = 'loci-starfield';
  world.createTransformEntity(points, { persistent: true });
  return points;
}
