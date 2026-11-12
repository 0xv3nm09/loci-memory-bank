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
  SpawnAnimation,
  SuggestionBud,
  TextScaleOrb,
  TypeOrb,
} from './components.js';
import { createTextLabel } from './text-label.js';
import { GLASS, PARTICLE, ORB_COLORS, accentForHue } from './palette.js';

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
  /** Skip the spawn animation (e.g. when restoring a saved palace). */
  skipSpawn = false,
): Entity {
  const group = new Group();
  group.name = `note-${id}`;

  const material = new MeshStandardMaterial({
    color: GLASS.body,
    emissive: new Color(GLASS.rawRim),
    emissiveIntensity: GLASS.rawRimIntensity,
    roughness: 0.38,
    metalness: 0.15,
    transparent: true,
    opacity: 0.94,
  });
  const card = new Mesh(getCardGeometry(), material);
  card.name = 'card';
  card.renderOrder = 2;
  group.add(card);

  // Top accent bar — reveals on cluster assignment with a colored glow.
  const accentBar = new Mesh(
    new BoxGeometry(CARD_W * 0.78, 0.006, 0.002),
    new MeshBasicMaterial({
      color: GLASS.rawRim,
      transparent: true,
      opacity: 0.85,
    }),
  );
  accentBar.name = 'accent-bar';
  accentBar.position.set(0, CARD_H / 2 - 0.010, CARD_D / 2 + 0.002);
  accentBar.renderOrder = 3;
  accentBar.visible = false;
  group.add(accentBar);

  const label = createTextMesh(text, 0.022, GLASS.ink);
  label.position.z = CARD_D / 2 + 0.004;
  label.name = 'label';
  group.add(label);

  group.position.copy(position);
  facePlayer(group);

  if (!skipSpawn) {
    // Start invisible and tiny — SpawnAnimation will ramp up.
    group.scale.setScalar(0.001);
    material.opacity = 0;
    material.transparent = true;
  }

  const entity = world.createTransformEntity(group);
  entity.addComponent(Note, { id, text });
  if (!skipSpawn) {
    entity.addComponent(SpawnAnimation, { elapsed: 0, duration: 0.45 });
  }
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
  const geometry = new CylinderGeometry(0.0022, 0.0022, 1, 6, 1, true);
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

  const label = createTextMesh(title, 0.017, 0xcfe2ff);
  label.position.z = CARD_D / 2 + 0.002;
  group.add(label);

  group.position.copy(position);
  facePlayer(group);

  const entity = world.createTransformEntity(group);
  entity.addComponent(SeedCard, { setKey: key });
  entity.addComponent(RayInteractable);
  return entity;
}

/** Helper to create an orb with consistent style. */
function makeOrb(
  world: World,
  name: string,
  colors: { body: number; emissive: number; label: string },
  labelText: string,
  position: Vector3,
): { entity: Entity; group: Group } {
  const group = new Group();
  group.name = name;

  const orb = new Mesh(
    new SphereGeometry(0.026, 24, 18),
    new MeshStandardMaterial({
      color: colors.body,
      emissive: new Color(colors.emissive),
      emissiveIntensity: 0.8,
      roughness: 0.22,
      metalness: 0.1,
      transparent: true,
      opacity: 0.92,
    }),
  );
  orb.name = 'card';
  orb.renderOrder = 4;
  group.add(orb);

  const label = createTextMesh(labelText, 0.016, colors.label);
  label.position.y = -0.055;
  group.add(label);

  group.position.copy(position);
  facePlayer(group);

  const entity = world.createTransformEntity(group);
  entity.addComponent(RayInteractable);
  return { entity, group };
}

export function createOrganizeOrb(world: World, position: Vector3): Entity {
  const { entity } = makeOrb(world, 'organize-orb', ORB_COLORS.organize, 'organize', position);
  entity.addComponent(OrganizeOrb);
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
  // 20mm radius → 40mm diameter, above Meta's 48dp min at ray distance.
  const bud = new Mesh(
    new SphereGeometry(0.020, 20, 14),
    new MeshStandardMaterial({
      color: isExpand ? 0x8fe8b0 : 0xf0c98a,
      emissive: new Color(isExpand ? 0x2fbf6a : 0xbf7a2f),
      emissiveIntensity: 0.85,
      roughness: 0.28,
      metalness: 0.08,
      transparent: true,
      opacity: 0.9,
    }),
  );
  bud.name = 'card';
  bud.renderOrder = 4;
  group.add(bud);

  const glyph = createTextLabel(isExpand ? '+' : '?', 0.016, { maxWidth: 0.03, color: '#06131c' });
  glyph.position.z = 0.013;
  group.add(glyph);

  const bubble = createTextLabel(text, 0.0125, {
    maxWidth: 0.25,
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

export function createTextScaleOrb(world: World, position: Vector3): Entity {
  const { entity } = makeOrb(world, 'text-scale-orb', ORB_COLORS.textScale, 'Aa', position);
  entity.addComponent(TextScaleOrb);
  return entity;
}

export function createMicOrb(world: World, position: Vector3): Entity {
  const { entity } = makeOrb(world, 'mic-orb', ORB_COLORS.mic, 'mic', position);
  entity.addComponent(MicOrb);
  return entity;
}

export function createTypeOrb(world: World, position: Vector3): Entity {
  const { entity } = makeOrb(world, 'type-orb', ORB_COLORS.type, 'type', position);
  entity.addComponent(TypeOrb);
  return entity;
}

export function createRecallOrb(world: World, position: Vector3): Entity {
  const { entity } = makeOrb(world, 'recall-orb', ORB_COLORS.recall, 'recall', position);
  entity.addComponent(RecallOrb);
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

/**
 * Starfield v2 — enhanced with per-particle color variation and
 * two size layers for depth. The nebula tint cycling is handled
 * by ambient-system reading palette.nebulaTint() each frame.
 */
export function createStarfield(world: World): { near: Points; far: Points } {
  // Far layer: many small dim stars
  const farCount = 600;
  const farPositions = new Float32Array(farCount * 3);
  const farColors = new Float32Array(farCount * 3);
  for (let i = 0; i < farCount; i += 1) {
    const radius = 4.5 + Math.pow(Math.random(), 0.6) * 7.0;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    farPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    farPositions[i * 3 + 1] = radius * Math.cos(phi) * 0.6 + 1.2;
    farPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    // Slight per-star color variation: cool blues to warm lavenders
    const warmth = Math.random();
    farColors[i * 3] = 0.55 + warmth * 0.2;     // R
    farColors[i * 3 + 1] = 0.6 + warmth * 0.12;  // G
    farColors[i * 3 + 2] = 0.78 + warmth * 0.15;  // B
  }
  const farGeometry = new BufferGeometry();
  farGeometry.setAttribute('position', new Float32BufferAttribute(farPositions, 3));
  farGeometry.setAttribute('color', new Float32BufferAttribute(farColors, 3));
  const farMaterial = new PointsMaterial({
    size: 0.008,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexColors: true,
  });
  const farPoints = new Points(farGeometry, farMaterial);
  farPoints.name = 'loci-starfield-far';
  farPoints.renderOrder = 0;
  world.createTransformEntity(farPoints, { persistent: true });

  // Near layer: fewer, larger, brighter stars — sparkle points
  const nearCount = 120;
  const nearPositions = new Float32Array(nearCount * 3);
  const nearColors = new Float32Array(nearCount * 3);
  for (let i = 0; i < nearCount; i += 1) {
    const radius = 3.0 + Math.random() * 4.0;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    nearPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    nearPositions[i * 3 + 1] = radius * Math.cos(phi) * 0.6 + 1.2;
    nearPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    // Brighter warm-to-cool variation
    const tint = Math.random();
    nearColors[i * 3] = 0.7 + tint * 0.25;
    nearColors[i * 3 + 1] = 0.72 + tint * 0.15;
    nearColors[i * 3 + 2] = 0.85 + tint * 0.15;
  }
  const nearGeometry = new BufferGeometry();
  nearGeometry.setAttribute('position', new Float32BufferAttribute(nearPositions, 3));
  nearGeometry.setAttribute('color', new Float32BufferAttribute(nearColors, 3));
  const nearMaterial = new PointsMaterial({
    size: 0.016,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexColors: true,
  });
  const nearPoints = new Points(nearGeometry, nearMaterial);
  nearPoints.name = 'loci-starfield-near';
  nearPoints.renderOrder = 1;
  world.createTransformEntity(nearPoints, { persistent: true });

  return { near: nearPoints, far: farPoints };
}

/**
 * Particle burst — spawns a ring of AdditiveBlending particles at a position.
 * Used for organize and snap events. Returns the Points object (auto-cleaned
 * by ambient-system after lifetime expires).
 */
export function createParticleBurst(
  world: World,
  position: Vector3,
  color: number,
  count = 24,
): Points {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = position.z;
    // Radial burst with slight upward bias
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 0.3 + Math.random() * 0.4;
    velocities[i * 3] = Math.cos(angle) * speed;
    velocities[i * 3 + 1] = 0.1 + Math.random() * 0.3;
    velocities[i * 3 + 2] = Math.sin(angle) * speed;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.userData.velocities = velocities;
  geometry.userData.lifetime = 0;
  geometry.userData.maxLife = 1.2;
  const material = new PointsMaterial({
    color,
    size: 0.014,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const points = new Points(geometry, material);
  points.name = 'particle-burst';
  points.renderOrder = 9;
  points.frustumCulled = false;
  world.scene.add(points);
  return points;
}
