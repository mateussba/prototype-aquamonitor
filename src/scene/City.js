import * as T from "three";
import { box, cylinder, group, mat, tag, sizedBox, bake } from "./primitives.js";
import * as tex from "./textures.js";
import { Trees } from "./Vegetation.js";
import { Traffic } from "./Traffic.js";
import { Splashes } from "./Water.js";
const FLOOR = 0.7,
  ROAD_Y = 0.38,
  LOT_Y = 0.46;
const memo = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = args.join("|");
    if (!cache.has(key)) cache.set(key, fn(...args));
    return cache.get(key);
  };
};
export function createCity(scene) {
  const city = group(scene);
  const statics = group(city);
  const asphalt = new T.MeshStandardMaterial({ map: tex.asphalt(), roughness: 0.92 });
  const paving = new T.MeshStandardMaterial({ map: tex.paving(), roughness: 0.85 });
  const grass = new T.MeshStandardMaterial({ map: tex.grass(), roughness: 1 });
  const paint = mat(0xf3f1e6, { roughness: 0.6 });
  const puddle = new T.MeshStandardMaterial({
    color: 0x52605f,
    roughness: 0.04,
    metalness: 0.2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const lamp = new T.MeshStandardMaterial({ color: 0xf4f0dc, emissive: 0xffd9a0, emissiveIntensity: 0 });
  const glow = new T.MeshBasicMaterial({
    color: 0xffdca8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: T.AdditiveBlending,
    side: T.DoubleSide,
  });
  const facades = [];
  const facadeMat = memo((color, kind) => {
    const m = new T.MeshStandardMaterial({
      color,
      map: tex.facade(kind),
      emissiveMap: tex.facadeLit(kind),
      emissive: 0xffffff,
      emissiveIntensity: 0,
      roughness: 0.82,
    });
    facades.push(m);
    return m;
  });
  const roofMat = memo((color) => new T.MeshStandardMaterial({ color, map: tex.roofTiles(), roughness: 0.75 }));

  // Ground slab, roads and markings.
  sizedBox(statics, [17, 0.3, 12], [-5, 0.15, -2], 0x9c8a6e);
  sizedBox(statics, [17, 0.08, 2.2], [-5, 0.34, -0.5], asphalt, [2.5, 2.5]);
  sizedBox(statics, [2.1, 0.08, 6.4], [-5, 0.34, -4.8], asphalt, [2.5, 2.5]);
  sizedBox(statics, [2.1, 0.08, 3.4], [-5, 0.34, 2.3], asphalt, [2.5, 2.5]);
  const mark = (size, pos) => box(statics, size, pos, paint);
  for (let x = -13; x < 3.2; x += 0.9) if (x < -7.6 || x > -2.6) mark([0.45, 0.01, 0.05], [x, 0.385, -0.5]);
  for (let z = -7.6; z < 3.8; z += 0.9) if (z < -2.9 || z > 1.9) mark([0.05, 0.01, 0.45], [-5, 0.385, z]);
  for (let i = 0; i < 7; i++) {
    for (const x of [-6.75, -3.25]) mark([0.6, 0.01, 0.15], [x, 0.385, -1.4 + i * 0.3]);
    for (const z of [-2.25, 1.25]) mark([0.15, 0.01, 0.6], [-5.85 + i * 0.28, 0.385, z]);
  }
  mark([0.08, 0.01, 1], [-7.2, 0.385, 0]);
  mark([0.08, 0.01, 1], [-2.8, 0.385, -1]);
  mark([1, 0.01, 0.08], [-5.5, 0.385, -2.7]);
  mark([1, 0.01, 0.08], [-4.5, 0.385, 1.7]);
  for (const [x, z, sx, sz] of [
    [-11.6, -0.9, 1.1, 0.6],
    [-9.4, 0.2, 0.8, 0.45],
    [-1.2, -1.1, 1.3, 0.55],
    [1.8, 0.1, 0.7, 0.4],
    [-5.3, -5.6, 0.5, 0.9],
  ]) {
    const p = new T.Mesh(new T.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2), puddle);
    p.scale.set(sx, 1, sz);
    p.position.set(x, ROAD_Y + 0.002, z);
    p.receiveShadow = true;
    statics.add(p);
  }

  // Blocks: sidewalk ring with a grass lot inside.
  for (const [x0, x1, z0, z1] of [
    [-13.5, -6.05, -8, -1.6],
    [-3.95, 3.5, -8, -1.6],
    [-13.5, -6.05, 0.6, 4],
    [-3.95, 3.5, 0.6, 4],
  ]) {
    const w = x1 - x0,
      d = z1 - z0,
      cx = (x0 + x1) / 2,
      cz = (z0 + z1) / 2;
    sizedBox(statics, [w, 0.14, d], [cx, 0.37, cz], paving, [1.2, 1.2]);
    sizedBox(statics, [w - 0.9, 0.02, d - 0.9], [cx, 0.45, cz], grass, [2, 2]);
  }

  // Buildings. Each one is built in a local group (front faces +z) and baked afterwards.
  const at = (x, z, rot = 0) => {
    const g = group(statics);
    g.position.set(x, LOT_Y, z);
    g.rotation.y = rot;
    return g;
  };
  const waterTank = (g, x, y, z) => {
    cylinder(g, 0.2, 0.26, [x, y + 0.13, z], 0x5d86a6, 14);
    cylinder(g, 0.22, 0.04, [x, y + 0.28, z], 0x6f96b3, 14);
  };
  function gableRoof(g, w, d, h, rise, color, wall) {
    const slope = Math.atan2(rise, d / 2),
      len = Math.hypot(d / 2, rise) + 0.16;
    for (const s of [-1, 1]) {
      const slab = sizedBox(g, [w + 0.24, 0.06, len], [0, h + rise / 2 + 0.03, (s * d) / 4], roofMat(color), [0.6, 0.45]);
      slab.rotation.x = s * slope;
    }
    const tri = new T.Shape([new T.Vector2(-d / 2, 0), new T.Vector2(d / 2, 0), new T.Vector2(0, rise)]);
    const gable = new T.Mesh(
      new T.ExtrudeGeometry(tri, { depth: w, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-w / 2, h, 0),
      mat(wall),
    );
    gable.castShadow = gable.receiveShadow = true;
    g.add(gable);
  }
  function house(x, z, { w = 1.6, d = 1.6, floors = 1, color = 0xefe6d2, roof = 0xc0765a, rot = 0, tank = true }) {
    const g = at(x, z, rot);
    const h = floors * FLOOR + 0.12;
    box(g, [w + 0.06, 0.12, d + 0.06], [0, 0.06, 0], 0xb9b4a6);
    sizedBox(g, [w, h - 0.12, d], [0, 0.12 + (h - 0.12) / 2, 0], facadeMat(color, "house"), [3.2, 2.8]);
    gableRoof(g, w, d, h, 0.5, roof, color);
    box(g, [0.32, 0.5, 0.05], [w * 0.22, 0.37, d / 2 + 0.02], 0x8a6f55);
    box(g, [0.5, 0.04, 0.32], [w * 0.22, 0.66, d / 2 + 0.15], 0xd9d6cc);
    box(g, [0.18, 0.4, 0.18], [-w * 0.28, h + 0.45, -d * 0.18], 0xa29a8c);
    if (tank) waterTank(g, w * 0.25, h + 0.05, -d * 0.3);
  }
  function apartment(x, z, { w = 2.4, d = 2.4, floors = 6, color = 0xe4e6e0, rot = 0 }) {
    const g = at(x, z, rot);
    const h = floors * FLOOR;
    sizedBox(g, [w, h, d], [0, h / 2, 0], facadeMat(color, "apt"), [2.4, 2.8]);
    box(g, [w + 0.1, 0.1, d + 0.1], [0, h + 0.05, 0], 0xcfd2cb);
    box(g, [w * 0.4, 0.45, d * 0.35], [w * 0.15, h + 0.32, -d * 0.15], 0xd9dbd4);
    waterTank(g, -w * 0.25, h + 0.1, d * 0.2);
    waterTank(g, -w * 0.25, h + 0.1, -d * 0.2);
    cylinder(g, 0.015, 0.7, [w * 0.35, h + 0.45, d * 0.3], 0x56625f, 4);
    box(g, [w * 0.45, 0.06, 0.45], [0, 0.62, d / 2 + 0.22], 0xdedfd8);
    box(g, [w * 0.3, 0.5, 0.04], [0, 0.25, d / 2 + 0.01], 0x48646a, { roughness: 0.15, metalness: 0.5 });
    for (let f = 1; f < floors; f += 2)
      for (const s of [-1, 1]) box(g, [0.2, 0.13, 0.12], [s * w * 0.3, f * FLOOR + 0.08, d / 2 + 0.06], 0xeceee9);
  }
  function shop(x, z, { w = 2.4, d = 1.4, color = 0xe9dcc6, awning = 0x3f7d6f, upper = 0, rot = 0 }) {
    const g = at(x, z, rot);
    const h = 0.75;
    box(g, [w, h, d], [0, h / 2, 0], color);
    box(g, [w - 0.3, 0.48, 0.04], [0, 0.3, d / 2 + 0.01], 0x55747a, { roughness: 0.12, metalness: 0.5 });
    const a = box(g, [w - 0.1, 0.04, 0.45], [0, 0.63, d / 2 + 0.2], awning);
    a.rotation.x = 0.35;
    box(g, [w * 0.5, 0.14, 0.04], [0, 0.78 + 0.02, d / 2 + 0.02], 0xf3efe2);
    if (upper) {
      sizedBox(g, [w, upper * FLOOR, d], [0, h + (upper * FLOOR) / 2, 0], facadeMat(color, "apt"), [2.4, 2.8]);
      box(g, [w + 0.08, 0.08, d + 0.08], [0, h + upper * FLOOR + 0.04, 0], 0xcfd2cb);
      waterTank(g, w * 0.25, h + upper * FLOOR + 0.08, 0);
    } else {
      box(g, [w + 0.06, 0.1, d + 0.06], [0, h + 0.05, 0], 0xcfd2cb);
      box(g, [0.4, 0.22, 0.3], [-w * 0.25, h + 0.21, -0.1], 0xdadcd5);
    }
  }
  // NW: residential.
  house(-12.1, -3, { w: 1.8, floors: 1, color: 0xf0e4cc });
  house(-10.2, -3, { w: 1.6, floors: 2, color: 0xdfe6dc, roof: 0x6f8580 });
  house(-8, -3, { w: 1.8, floors: 1, color: 0xf2dcc6, roof: 0xb46d55 });
  apartment(-11.6, -6.4, { w: 2.4, d: 1.8, floors: 3, color: 0xe9e2d2 });
  house(-8.4, -6.5, { w: 1.6, floors: 2, color: 0xe6e9e2, roof: 0xa8664f, tank: false });
  // NE: towers and shops facing the avenue.
  apartment(-1.7, -5.6, { w: 2.4, d: 2.4, floors: 8, color: 0xe4e6e0 });
  apartment(1.7, -6.2, { w: 1.8, d: 1.8, floors: 6, color: 0xd9e2e3 });
  shop(-1.7, -2.95, { w: 2.4, color: 0xeadfca, awning: 0x3f7d6f });
  shop(1.6, -3.1, { w: 2.2, d: 1.6, color: 0xe2d6c8, awning: 0xb5574a, upper: 1 });
  // South blocks face the avenue (north).
  house(-12.2, 2.5, { w: 1.6, floors: 2, color: 0xeee6d6, roof: 0xb9745b, rot: Math.PI });
  house(-10.2, 2.5, { w: 1.6, floors: 1, color: 0xdde5e0, roof: 0x6f8580, rot: Math.PI });
  shop(-2.3, 2.35, { w: 2.4, d: 1.8, color: 0xf0e3cc, awning: 0xc9893f, upper: 1, rot: Math.PI });
  house(0.6, 2.5, { w: 1.6, floors: 1, color: 0xf1e1cf, roof: 0xb46d55, rot: Math.PI });
  // Small square over the collection gallery.
  sizedBox(statics, [2.2, 0.02, 0.5], [-7.7, 0.47, 2.3], paving, [1.2, 1.2]);
  sizedBox(statics, [0.5, 0.02, 2.4], [-7.7, 0.47, 2.3], paving, [1.2, 1.2]);
  for (const [x, z, r] of [
    [-8.5, 1.7, 0],
    [-6.9, 2.9, Math.PI],
  ]) {
    const g = at(x, z, r);
    box(g, [0.6, 0.04, 0.18], [0, 0.16, 0], 0x9a7b5c);
    box(g, [0.6, 0.16, 0.04], [0, 0.26, -0.08], 0x9a7b5c);
    for (const s of [-1, 1]) box(g, [0.04, 0.16, 0.16], [s * 0.26, 0.08, 0], 0x4f5856);
  }

  // Street lamps and traffic signals.
  const lamps = [
    [-12.4, -1.72, 1],
    [-8.8, -1.72, 1],
    [-1.4, -1.72, 1],
    [2.2, -1.72, 1],
    [-11, 0.72, -1],
    [-8.1, 0.72, -1],
    [0.4, 0.72, -1],
    [2.9, 0.72, -1],
  ];
  for (const [x, z, s] of lamps) {
    cylinder(statics, 0.03, 1.7, [x, 0.44 + 0.85, z], 0x55625f, 6);
    box(statics, [0.05, 0.04, 0.5], [x, 2.12, z + s * 0.22], 0x55625f);
    box(statics, [0.16, 0.05, 0.22], [x, 2.09, z + s * 0.45], lamp);
    const cone = new T.Mesh(new T.ConeGeometry(0.55, 1.6, 16, 1, true), glow);
    cone.position.set(x, 1.27, z + s * 0.45);
    cone.raycast = () => {};
    statics.add(cone);
  }
  const signal = (c) => new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0, roughness: 0.4 });
  const signals = {};
  for (const axis of ["ew", "ns"]) signals[axis] = { red: signal(0xff4a3a), yellow: signal(0xffc23a), green: signal(0x47e08a) };
  for (const [x, z, axis, rot] of [
    [-6.15, 0.72, "ew", -Math.PI / 2],
    [-3.85, -1.72, "ew", Math.PI / 2],
    [-6.15, -1.72, "ns", Math.PI],
    [-3.85, 0.72, "ns", 0],
  ]) {
    const g = at(x, z, rot);
    g.position.y = 0.44;
    cylinder(g, 0.03, 1.3, [0, 0.65, 0], 0x3f4a48, 6);
    box(g, [0.14, 0.38, 0.1], [0, 1.25, 0.05], 0x2f3836);
    ["red", "yellow", "green"].forEach((c, i) => box(g, [0.07, 0.07, 0.03], [0, 1.37 - i * 0.12, 0.11], signals[axis][c]));
  }

  // Bake the static part, then add everything that moves.
  bake(statics);
  const trees = new Trees(
    city,
    [
      [-12.9, -5.1, 0.85],
      [-9.6, -5.2, 0.8],
      [-7.1, -7.3, 0.9],
      [-6.9, -4.6, 0.75],
      [-13, -7.5, 0.7, "pine"],
      [0.3, -4.2, 0.8],
      [2.9, -4.4, 0.75],
      [-3.3, -7.4, 0.7, "pine"],
      [3, -7.5, 0.8],
      [-8.6, 3.3, 0.8],
      [-6.8, 1.5, 0.85],
      [-7.6, 3.6, 0.6, "pine"],
      [2.6, 1.6, 0.8],
      [2.8, 3.4, 0.7],
      [-13, 3.5, 0.65, "pine"],
      [-11.2, -2.2, 0.8, "bush"],
      [-9.1, -2.2, 0.8, "bush"],
      [-12.9, -2.2, 0.9, "bush"],
      [-7.1, -2.2, 0.7, "bush"],
      [-11.1, 1.2, 0.8, "bush"],
      [-0.5, 1.2, 0.8, "bush"],
      [-0.2, -2.2, 0.7, "bush"],
    ].map(([x, z, s, kind = "leaf"]) => ({ x, z, s, kind, y: LOT_Y })),
    "city",
  );
  const traffic = new Traffic(city, signals);
  const splashes = new Splashes(city, () => {
    const r = Math.random();
    if (r < 0.6) return new T.Vector3(-13.3 + Math.random() * 16.6, ROAD_Y + 0.006, -1.5 + Math.random() * 2);
    if (r < 0.8) return new T.Vector3(-5.9 + Math.random() * 1.8, ROAD_Y + 0.006, -7.8 + Math.random() * 11.6);
    return new T.Vector3(-13.3 + Math.random() * 16.6, 0.446, Math.random() < 0.5 ? -1.82 : 0.82);
  });
  tag(city, "city");
  let wet = 0;
  return {
    group: city,
    splashes,
    update(dt, { time, rain, storm, wind, dark }) {
      wet += ((rain > 0 ? Math.min(1, 0.4 + rain) : 0) - wet) * Math.min(1, dt * (rain > 0 ? 0.35 : 0.05));
      asphalt.color.setScalar(1 - 0.38 * wet);
      asphalt.roughness = 0.92 - 0.62 * wet;
      paving.color.setScalar(1 - 0.2 * wet);
      paving.roughness = 0.85 - 0.45 * wet;
      puddle.opacity = wet * 0.8;
      lamp.emissiveIntensity = dark * 3;
      glow.opacity = dark * 0.16;
      for (const m of facades) m.emissiveIntensity = dark * 0.85;
      trees.update(dt, wind, time);
      traffic.update(dt, { dark, rain, time });
      splashes.update(dt, rain);
    },
  };
}
