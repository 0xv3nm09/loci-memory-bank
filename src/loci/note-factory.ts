import {
  AdditiveBlending,
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
  RecallOrb,
  SeedCard,
} from './components.js';
import { createTextLabel } from './text-label.js';

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
): Mesh {
  const color =
    typeof colorValue === 'number' ? `#${colorValue.toString(16).padStart(6, '0')}` : colorValue;
  return createTextLabel(text, fontSize, {
    maxWidth: maxWidth ?? CARD_W * 0.86,
    maxLines: 4,
    color,
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
    color: 0xf2ecdd,
    emissive: new Color(0x86766a),
    emissiveIntensity: 0.18,
    roughness: 0.6,
    metalness: 0.04,
  });
  const card = new Mesh(getCardGeometry(), material);
  card.name = 'card';
  group.add(card);

  const label = createTextMesh(text, 0.0155, 0x241f18);
  label.position.z = CARD_D / 2 + 0.002;
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
  material.emissive.setHSL(hue, 0.62, 0.52);
  material.emissiveIntensity = intensity;
  const surface = new Color(0xf2ecdd);
  surface.lerp(new Color().setHSL(hue, 0.5, 0.8), 0.22);
  material.color.copy(surface);
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
    material.emissive.set(0x86766a);
    material.emissiveIntensity = 0.18;
    material.color.set(0xf2ecdd);
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
    color: 0x46e0ff,
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
  const label = createTextMesh(text, 0.028, new Color().setHSL(hue, 0.65, 0.72).getStyle());
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
