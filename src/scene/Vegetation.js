import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { cleanGeometry } from "./primitives.js";
function broadleaf() {
  return mergeGeometries(
    [
      [0, 1.15, 0, 0.6],
      [0.34, 0.95, 0.12, 0.42],
      [-0.3, 1.0, -0.14, 0.45],
      [0.06, 1.5, 0.05, 0.4],
      [-0.08, 1.05, 0.32, 0.36],
    ].map(([x, y, z, r]) => cleanGeometry(new T.IcosahedronGeometry(r, 1).translate(x, y, z))),
  );
}
function conifer() {
  return mergeGeometries(
    [
      [0.55, 0.9, 0.75],
      [0.43, 0.75, 1.2],
      [0.28, 0.6, 1.62],
    ].map(([r, h, y]) => cleanGeometry(new T.ConeGeometry(r, h, 7).translate(0, y, 0))),
  );
}
const trunkHeight = { leaf: 1, pine: 0.7, bush: 0 };
// Instanced trees with wind sway: two or three draw calls for the whole forest.
// items: { x, z, y = 0, s = 1, kind: "leaf" | "pine" | "bush" }
export class Trees {
  constructor(parent, items, key) {
    const rand = (i) => (Math.sin(i * 91.7 + items.length) * 43758.5453) % 1;
    this.items = items.map((it, i) => ({
      y: 0,
      s: 1,
      kind: "leaf",
      ...it,
      phase: i * 1.7,
      rot: Math.abs(rand(i)) * Math.PI * 2,
    }));
    this.sets = [];
    const canopyMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const trunkGeo = new T.CylinderGeometry(0.05, 0.08, 1, 6).translate(0, 0.5, 0);
    const trunks = this.items.filter((i) => trunkHeight[i.kind] > 0);
    this.add(parent, trunkGeo, new T.MeshStandardMaterial({ color: 0x7a6650, roughness: 0.95 }), trunks, key, true);
    const color = new T.Color();
    const leaf = this.items.filter((i) => i.kind !== "pine"),
      pine = this.items.filter((i) => i.kind === "pine");
    const tint = (list, h, s, l) =>
      list.map((_, i) => color.setHSL(h + rand(i + 3) * 0.04, s + rand(i + 7) * 0.08, l + rand(i + 11) * 0.06).clone());
    this.add(parent, broadleaf(), canopyMat, leaf, key, false, tint(leaf, 0.27, 0.28, 0.44));
    this.add(parent, conifer(), canopyMat, pine, key, false, tint(pine, 0.37, 0.24, 0.33));
    this.q = new T.Quaternion();
    this.tilt = new T.Quaternion();
    this.euler = new T.Euler();
    this.m = new T.Matrix4();
    this.v = new T.Vector3();
    this.sc = new T.Vector3();
    this.update(0, 0, 0);
  }
  add(parent, geometry, material, items, key, trunk, colors) {
    if (!items.length) return;
    const mesh = new T.InstancedMesh(geometry, material, items.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.component = key;
    if (colors) colors.forEach((c, i) => mesh.setColorAt(i, c));
    parent.add(mesh);
    this.sets.push({ mesh, items, trunk });
  }
  update(dt, wind, time) {
    const amp = 0.012 + wind * 0.07;
    for (const { mesh, items, trunk } of this.sets) {
      items.forEach((it, i) => {
        const sx = amp * Math.sin(time * 1.3 + it.phase),
          sz = amp * 0.6 * Math.sin(time * 1.9 + it.phase * 1.3) - wind * 0.05;
        this.tilt.setFromEuler(this.euler.set(sx, 0, sz));
        this.q.setFromAxisAngle(T.Object3D.DEFAULT_UP, it.rot).premultiply(this.tilt);
        const lift = it.kind === "bush" ? -0.75 * it.s * 0.45 : 0;
        const s = it.kind === "bush" ? it.s * 0.45 : it.s;
        if (trunk) this.sc.set(s, s * trunkHeight[it.kind], s);
        else this.sc.setScalar(s);
        this.m.compose(this.v.set(it.x, it.y + lift, it.z), this.q, this.sc);
        mesh.setMatrixAt(i, this.m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
