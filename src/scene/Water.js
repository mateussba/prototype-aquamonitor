import * as T from "three";
import { tag } from "./primitives.js";
import { waterNormal } from "./textures.js";
export function waterMaterial(color, opacity = 0.78) {
  const normalMap = waterNormal();
  normalMap.repeat.set(2, 2);
  return new T.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.08,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    normalMap,
    normalScale: new T.Vector2(0.35, 0.35),
  });
}
const pipeMaterials = new Map();
const pipeMaterial = (color) => {
  if (!pipeMaterials.has(color))
    pipeMaterials.set(
      color,
      new T.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.38, roughness: 0.12, clearcoat: 1, depthWrite: false }),
    );
  return pipeMaterials.get(color);
};
// Particles along a curve. They fade in and out instead of popping, and stretch along the flow.
export class Flow {
  constructor(parent, points, key, { color = 0x397d83, pipe = true, count = 22, size = 1, speed = 0.16, dot = 0xa8f0e8, shape = "dot" } = {}) {
    // Accepts a ready curve (e.g. a straight-segment pipe path) or a list of points.
    this.curve = points.isCurve
      ? points
      : new T.CatmullRomCurve3(
          points.map((p) => new T.Vector3(...p)),
          false,
          "centripetal",
        );
    if (pipe) {
      const tube = new T.Mesh(new T.TubeGeometry(this.curve, 48, 0.19, 10, false), pipeMaterial(color));
      parent.add(tube);
      tag(tube, key);
    }
    // "arrow" particles (pumped transport) point along the flow; "dot" particles drift (gravity).
    const geometry =
      shape === "arrow"
        ? new T.ConeGeometry(0.06 * size, 0.2 * size, 7).rotateX(Math.PI / 2)
        : new T.CapsuleGeometry(0.055 * size, 0.16 * size, 2, 6).rotateX(Math.PI / 2);
    this.dots = new T.InstancedMesh(
      geometry,
      new T.MeshStandardMaterial({ color: dot, emissive: dot, emissiveIntensity: 0.35, roughness: 0.3 }),
      count,
    );
    this.dots.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.dots.frustumCulled = false;
    this.dots.raycast = () => {};
    parent.add(this.dots);
    this.count = count;
    this.speed = speed;
    this.phase = 0;
    this.level = 0;
    this.dummy = new T.Object3D();
    this.look = new T.Vector3();
    // Arc-length lookup table: no curve evaluation per frame.
    this.samples = 160;
    this.points = [];
    this.tangents = [];
    for (let i = 0; i <= this.samples; i++) {
      this.points.push(this.curve.getPointAt(i / this.samples));
      this.tangents.push(this.curve.getTangentAt(i / this.samples));
    }
  }
  update(dt, on) {
    this.level += ((on ? 1 : 0) - this.level) * (1 - Math.exp(-dt * 5));
    this.dots.visible = this.level > 0.01;
    if (!this.dots.visible) return;
    this.phase = (this.phase + dt * this.speed * (0.3 + 0.7 * this.level)) % 1;
    for (let i = 0; i < this.count; i++) {
      const u = (i / this.count + this.phase) % 1,
        f = u * this.samples,
        k = Math.floor(f),
        a = f - k;
      this.dummy.position.lerpVectors(this.points[k], this.points[Math.min(k + 1, this.samples)], a);
      this.look.copy(this.dummy.position).add(this.tangents[k]);
      this.dummy.lookAt(this.look);
      this.dummy.scale.setScalar(this.level * Math.min(1, u * 10, (1 - u) * 10));
      this.dummy.updateMatrix();
      this.dots.setMatrixAt(i, this.dummy.matrix);
    }
    this.dots.instanceMatrix.needsUpdate = true;
  }
}
// Rain animated entirely in the vertex shader: no per-frame buffer upload.
export class Rain {
  constructor(scene) {
    this.count = 1600;
    const positions = new Float32Array(this.count * 6),
      tip = new Float32Array(this.count * 2);
    for (let i = 0; i < this.count; i++) {
      const x = -13.5 + Math.random() * 17,
        y = Math.random() * 10.5,
        z = -8 + Math.random() * 12;
      positions.set([x, y, z, x, y, z], i * 6);
      tip[i * 2 + 1] = 1;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    geometry.setAttribute("aTip", new T.BufferAttribute(tip, 1));
    geometry.boundingSphere = new T.Sphere(new T.Vector3(-5, 6, -2), 16);
    this.uniforms = { uTime: { value: 0 }, uWind: { value: 0 } };
    const material = new T.LineBasicMaterial({ color: 0x9dbcc2, transparent: true, opacity: 0.55, depthWrite: false });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uWind;\nattribute float aTip;")
        .replace(
          "#include <begin_vertex>",
          `vec3 transformed = position;
          float fall = mod(position.y - uTime * (9.0 + fract(position.x * 7.31) * 3.0), 10.5);
          transformed.y = 0.45 + fall + aTip * 0.45;
          transformed.x += (fall + aTip * 0.45) * uWind * 0.12;`,
        );
    };
    material.customProgramCacheKey = () => "aqua-rain";
    this.lines = new T.LineSegments(geometry, material);
    this.lines.raycast = () => {};
    scene.add(this.lines);
    this.geometry = geometry;
    this.budget = 900;
  }
  update(dt, intensity, wind = 0) {
    this.lines.visible = intensity > 0.001;
    this.geometry.setDrawRange(0, Math.floor(Math.min(this.count, this.budget) * intensity) * 2);
    this.uniforms.uTime.value += dt;
    this.uniforms.uWind.value = wind;
  }
}
// Rain hitting the ground: rings that expand and fade (additive, so black = invisible).
export class Splashes {
  constructor(parent, sample, count = 110) {
    this.mesh = new T.InstancedMesh(
      new T.RingGeometry(0.025, 0.055, 14).rotateX(-Math.PI / 2),
      new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending }),
      count,
    );
    this.mesh.frustumCulled = false;
    this.mesh.raycast = () => {};
    parent.add(this.mesh);
    this.sample = sample;
    this.drops = Array.from({ length: count }, () => ({ p: sample(), t: Math.random() }));
    this.dummy = new T.Object3D();
    this.color = new T.Color(0, 0, 0);
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, this.color);
    this.budget = 1;
  }
  update(dt, intensity) {
    const active = Math.floor(this.drops.length * intensity * this.budget);
    this.mesh.count = active;
    this.mesh.visible = active > 0;
    for (let i = 0; i < active; i++) {
      const d = this.drops[i];
      d.t += dt * 2.4;
      if (d.t > 1) {
        d.t = 0;
        d.p = this.sample();
      }
      this.dummy.position.copy(d.p);
      this.dummy.scale.setScalar(0.3 + d.t * 1.6);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.color.setScalar((1 - d.t) * 0.55));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
