import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
const materials = new Map();
export const mat = (color, extra = {}) => {
  const key = JSON.stringify([color, extra]);
  if (!materials.has(key))
    materials.set(
      key,
      new T.MeshStandardMaterial({ color, roughness: 0.78, ...extra }),
    );
  return materials.get(key);
};
const resolve = (m) => (m?.isMaterial ? m : mat(m));
const cube = new T.BoxGeometry(1, 1, 1);
export function box(parent, size, pos, color, extra = {}) {
  const m = new T.Mesh(cube, color?.isMaterial ? color : mat(color, extra));
  m.scale.set(...size);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
// Box with UVs in world units (tile = texture repeat size), so textures keep their scale.
export function sizedBox(parent, [w, h, d], pos, material, tile = [1, 1]) {
  const g = new T.BoxGeometry(w, h, d);
  const p = g.attributes.position,
    n = g.attributes.normal,
    uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + w / 2,
      y = p.getY(i) + h / 2,
      z = p.getZ(i) + d / 2;
    if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, z / tile[0], y / tile[1]);
    else if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, x / tile[0], z / tile[1]);
    else uv.setXY(i, x / tile[0], y / tile[1]);
  }
  const m = new T.Mesh(g, resolve(material));
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function cylinder(parent, r, h, pos, color, segments = 12) {
  const m = new T.Mesh(new T.CylinderGeometry(r, r, h, segments), resolve(color));
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function tag(object, key) {
  object.traverse((o) => {
    o.userData.component = key;
  });
  return object;
}
export function group(parent) {
  const g = new T.Group();
  parent.add(g);
  return g;
}
export function cleanGeometry(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const k of Object.keys(g.attributes))
    if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv)
    g.setAttribute("uv", new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.clearGroups();
  return g;
}
// Merges static meshes under root by material: hundreds of draw calls become a few dozen.
// Meshes flagged userData.dynamic (and their children) are kept as they are.
export function bake(root) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const buckets = new Map(),
    merged = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${o.userData.component || ""}`;
    if (!buckets.has(key))
      buckets.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, component: o.userData.component, parts: [] });
    const g = cleanGeometry(o.geometry);
    g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
    buckets.get(key).parts.push(g);
    merged.push(o);
  });
  merged.forEach((o) => o.removeFromParent());
  for (const b of buckets.values()) {
    const mesh = new T.Mesh(mergeGeometries(b.parts), b.material);
    b.parts.forEach((g) => g.dispose());
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    if (b.component) mesh.userData.component = b.component;
    root.add(mesh);
  }
  return root;
}
