import { Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RayInteractable, type Entity, type World } from '@iwsdk/core';
import { GLASS, SEMANTIC } from './palette.js';
import { createTextLabel } from './text-label.js';

/** All spatial surfaces share a low-emission, legible material. */
export function surface(width: number, height: number, color = GLASS.panelBody): Mesh {
  const mesh = new Mesh(new RoundedBoxGeometry(width, height, 0.012, 2, 0.012), new MeshBasicMaterial({ color, toneMapped: false }));
  mesh.name = 'card';
  return mesh;
}

export function text(value: string, width: number, size = 0.022, color = SEMANTIC.promptText): Mesh {
  return createTextLabel(value, size, { maxWidth: width, maxLines: 4, color, shadow: false, fontWeight: 500 });
}

export function spatialButton(world: World, label: string, position: Vector3, width = 0.18, color = GLASS.buttonBody, parent?: Entity): Entity {
  const group = new Group();
  group.add(surface(width, 0.065, color));
  const caption = text(label, width - 0.018, 0.018);
  caption.position.z = 0.013;
  group.add(caption);
  group.position.copy(position);
  if (!parent) group.lookAt(0, position.y, 0.9);
  const entity = world.createTransformEntity(group, parent ? { parent } : undefined);
  entity.addComponent(RayInteractable);
  return entity;
}