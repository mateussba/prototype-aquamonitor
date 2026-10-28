import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { box, group, mat, tag, sizedBox } from "./primitives.js";
import { concrete } from "./textures.js";
import { Flow } from "./Water.js";

// Explicit model of the connections the project defines:
// street → curb inlets → collector → gallery → P01 → reservoir → P02 → transport line → dam,
// plus HC-SR04 → ESP32 (signal), reservoir floats → ESP32 (signal), ESP32 → relay inputs (command),
// relay contacts → pump motors (power). Pin numbers are not documented, so none are drawn.

const UP = new T.Vector3(0, 1, 0);
const v3 = (p) => (p.isVector3 ? p.clone() : new T.Vector3(...p));
export const GALLERY_FLOOR_Y = -3.58;
export const LEVEL_SPAN = 2.65;
export const MAX_CM = 30;
export const SENSOR = { x: -6.3, z: 3, faceY: -0.63 };
// Distance from the transducer face to the gallery floor in this model (didactic reference, not firmware calibration).
export const SENSOR_REF_CM = ((SENSOR.faceY - GALLERY_FLOOR_Y) / LEVEL_SPAN) * MAX_CM;
export const waterTop = (level) => GALLERY_FLOOR_Y + Math.max(0.025, level * LEVEL_SPAN);
export const CAB = { x: -3.6, y: -1.25, z: 1.95 };

// Moderate separation per group in the exploded view. Alignments are preserved (pure translations).
export const EXPLODE = {
  city: [0, 2.8, 0],
  inlet: [0, 1.5, -0.3],
  sensor: [0, 1.2, 0.9],
  gallery: [-1.3, 0, 0],
  control: [0, 0.4, 2.4],
  drain: [0, 0, 1.9],
  reservoir: [0.9, 0, 0],
  reuse: [1.9, 0, 1.9],
  pipes: [2.8, 0, 1.4],
  dam: [3.4, 0, 0],
};

// Order of the water path, as implemented by the simulation engine.
export const STAGES = [
  { id: "rain", component: "city", when: "rain", title: "Chuva", text: "A chuva cai sobre a cidade.", anchor: [-6, 3.2, -1] },
  { id: "street", component: "city", when: "rain", title: "Acúmulo na rua", text: "A água escorre pela sarjeta até as grelhas.", anchor: [-9.5, 0.6, 0.2] },
  { id: "inlet", component: "inlet", when: "rain", title: "Entrada na drenagem", text: "Grelha → caixa de ralo → coletor por gravidade.", anchor: [-11, -0.3, 0.4] },
  { id: "gallery", component: "gallery", when: "rain", title: "Galeria", text: "O coletor atravessa a parede e descarrega na galeria.", anchor: [-7, -0.9, 1.7] },
  { id: "drain", component: "drain", when: "drain", title: "Bombeamento P01", text: "P01 aspira no fundo da galeria e recalca para o reservatório.", anchor: [-3.6, -2, 3.3] },
  { id: "reservoir", component: "reservoir", when: "drain", title: "Reservatório", text: "A descarga de P01 cai no reservatório.", anchor: [-1.9, -0.5, 3] },
  { id: "reuse", component: "reuse", when: "reuse", title: "Reúso P02", text: "P02 retira água do reservatório para a linha de transporte.", anchor: [2.6, -2, 3.3] },
  { id: "dam", component: "dam", when: "reuse", title: "Barragem", text: "A linha passa sobre a crista e descarrega na barragem.", anchor: [7.55, 1.4, -1] },
];

// Labels shown only for the selected component.
export const ANCHORS = {
  city: [-9, 3.2, -3],
  inlet: [-7, 0.7, 0.4],
  gallery: [-8.2, -0.5, 4.4],
  sensor: [SENSOR.x, -0.35, SENSOR.z],
  control: [CAB.x, CAB.y + 0.55, CAB.z],
  drain: [-3.6, -1.8, 3.2],
  reservoir: [-0.5, -0.5, 4.4],
  reuse: [2.6, -1.8, 3.2],
  pipes: [5.4, -0.3, 3],
  dam: [11, 1.4, -3],
};
export const PART_LABELS = {
  inlet: [["Grelha (boca de lobo)", [-2, 0.5, 0.4]], ["Caixa de ralo", [-2, -0.3, 0.75]], ["Coletor por gravidade", [-4.4, -0.65, 1.2]]],
  gallery: [["Entrada do coletor", [-7, -0.75, 1.95]], ["Captação de P01", [-5.6, -3.1, 3]]],
  sensor: [["Transdutores T/R voltados para a água", [SENSOR.x, -0.85, SENSOR.z]], ["Cabo de sinal → ESP32", [-5, -0.1, 1.95]]],
  control: [["ESP32", [CAB.x - 0.22, CAB.y - 0.33, CAB.z + 0.1]], ["Módulo de 2 relés", [CAB.x + 0.18, CAB.y - 0.33, CAB.z + 0.1]]],
  drain: [["Captação", [-5.6, -3.15, 3]], ["Corpo da bomba", [-3.6, -2.95, 3.6]], ["Saída → reservatório", [-1.9, -0.55, 3]]],
  reservoir: [["Boias cheio/vazio", [1.0, -1.6, 2.1]], ["Captação de P02", [0.7, -3.15, 3]]],
  reuse: [["Captação", [0.7, -3.15, 3]], ["Corpo da bomba", [2.6, -2.95, 3.6]], ["Saída → linha", [3.5, -0.5, 3]]],
  pipes: [["Suporte", [4, -2, 3]], ["Travessia da crista", [7.55, 1.45, -0.4]]],
  dam: [["Descarga da linha", [7.55, 0.7, -1.3]]],
};

export const polyline = (points) => {
  const c = new T.CurvePath();
  for (let i = 1; i < points.length; i++) c.add(new T.LineCurve3(v3(points[i - 1]), v3(points[i])));
  return c;
};
function stick(a, b, r, radial = 10) {
  a = v3(a);
  b = v3(b);
  const d = new T.Vector3().subVectors(b, a),
    len = d.length();
  const g = new T.CylinderGeometry(r, r, len, radial);
  g.applyMatrix4(
    new T.Matrix4().compose(a.add(b).multiplyScalar(0.5), new T.Quaternion().setFromUnitVectors(UP, d.normalize()), new T.Vector3(1, 1, 1)),
  );
  return g;
}
const ball = (p, r, seg = 10) => new T.SphereGeometry(r, seg, Math.max(6, seg >> 1)).translate(...v3(p).toArray());
const merged = (parts) => {
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
};

const KIND = {
  gravity: { shell: 0xa9b5a8, core: 0x6fd0d3, dot: 0xc4f6f0, chase: new T.Color(0x2fb3b0), speed: 0.8, shape: "dot", size: 0.5 },
  pumped: { shell: 0x6d8b98, core: 0x2c7fd0, dot: 0xa8d8ff, chase: new T.Color(0x2a86ea), speed: 1.9, shape: "arrow", size: 0.6 },
};
const kindMats = new Map();
function materialsFor(kind) {
  if (!kindMats.has(kind)) {
    const k = KIND[kind];
    kindMats.set(kind, {
      shell: new T.MeshStandardMaterial({ color: k.shell, roughness: 0.5, metalness: 0.05 }),
      cut: new T.MeshPhysicalMaterial({ color: k.shell, transparent: true, opacity: 0.18, roughness: 0.1, depthWrite: false, side: T.DoubleSide }),
      core: new T.MeshStandardMaterial({ color: k.core, emissive: k.core, emissiveIntensity: 0.3, transparent: true, opacity: 0.8, roughness: 0.2, depthWrite: false }),
    });
  }
  return kindMats.get(kind);
}

// A pipe built from straight runs, elbows and end couplings. Opaque by default; when "cut" the
// shell turns into a localized transparent section that reveals the water core and particles.
class Pipe {
  constructor(parent, def) {
    Object.assign(this, def);
    this.group = group(parent);
    const pts = def.points.map(v3),
      r = def.radius ?? 0.09;
    const shell = [],
      core = [];
    for (let i = 1; i < pts.length; i++) {
      shell.push(stick(pts[i - 1], pts[i], r, 14));
      core.push(stick(pts[i - 1], pts[i], r * 0.6, 8));
    }
    for (let i = 1; i < pts.length - 1; i++) {
      shell.push(ball(pts[i], r * 1.08, 12));
      core.push(ball(pts[i], r * 0.6, 8));
    }
    for (const [p, q] of [
      [pts[0], pts[1]],
      [pts.at(-1), pts.at(-2)],
    ]) {
      const d = new T.Vector3().subVectors(q, p).normalize();
      shell.push(stick(p, p.clone().addScaledVector(d, 0.06), r * 1.45, 14));
    }
    this.mats = materialsFor(def.kind);
    this.shell = new T.Mesh(merged(shell), this.mats.shell);
    this.shell.castShadow = this.shell.receiveShadow = true;
    this.core = new T.Mesh(merged(core), this.mats.core);
    this.core.visible = false;
    this.core.userData.water = true;
    this.core.raycast = () => {};
    this.group.add(this.shell, this.core);
    this.curve = polyline(pts);
    this.length = this.curve.getLength();
    // Direction chevrons on the outside: grey at rest, a travelling light wave when water flows.
    const n = Math.max(2, Math.floor(this.length / 0.4));
    this.arrows = new T.InstancedMesh(
      new T.ConeGeometry(0.045, 0.12, 8).rotateX(Math.PI / 2),
      new T.MeshBasicMaterial({ color: 0xffffff }),
      n,
    );
    this.arrows.raycast = () => {};
    const dummy = new T.Object3D(),
      side = new T.Vector3();
    this.arrowS = [];
    this.idle = new T.Color(0x8d9a92);
    this.color = new T.Color();
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n,
        p = this.curve.getPointAt(u),
        t = this.curve.getTangentAt(u);
      side.set(0, Math.abs(t.y) > 0.8 ? 0 : 1, Math.abs(t.y) > 0.8 ? 1 : 0);
      dummy.position.copy(p).addScaledVector(side, r + 0.035);
      dummy.lookAt(dummy.position.clone().add(t));
      dummy.updateMatrix();
      this.arrows.setMatrixAt(i, dummy.matrix);
      this.arrows.setColorAt(i, this.idle);
      this.arrowS.push(u * this.length);
    }
    this.group.add(this.arrows);
    const k = KIND[def.kind];
    this.flow = new Flow(this.group, this.curve, def.component, {
      pipe: false,
      count: Math.max(4, Math.round(this.length * 6)),
      size: k.size,
      speed: k.speed / this.length,
      dot: k.dot,
      shape: k.shape,
    });
    this.flow.dots.renderOrder = 2;
    this.on = 0;
    this.rest = true;
    tag(this.group, def.component);
  }
  update(dt, flowing, cut, time) {
    this.on += ((flowing ? 1 : 0) - this.on) * (1 - Math.exp(-dt * 4));
    if (!flowing && this.on < 0.004) this.on = 0;
    this.shell.material = this.ghost || (cut ? this.mats.cut : this.mats.shell);
    this.core.visible = cut && this.on > 0.05;
    this.flow.update(dt, flowing && cut);
    if (this.on === 0) {
      if (this.rest) return;
      this.rest = true;
      for (let i = 0; i < this.arrowS.length; i++) this.arrows.setColorAt(i, this.idle);
    } else {
      this.rest = false;
      const k = KIND[this.kind];
      for (let i = 0; i < this.arrowS.length; i++) {
        const wave = 0.5 + 0.5 * Math.sin(((this.arrowS[i] - time * k.speed) / 1.2) * Math.PI * 2);
        this.color.copy(this.idle).lerp(k.chase, this.on * (0.45 + 0.55 * wave));
        this.arrows.setColorAt(i, this.color);
      }
    }
    this.arrows.instanceColor.needsUpdate = true;
  }
}

// Water falling from an open pipe end onto a free surface.
class Stream {
  constructor(parent, x, z, top, component, color) {
    this.mesh = new T.Mesh(
      new T.CylinderGeometry(0.035, 0.05, 1, 10, 1, true),
      new T.MeshStandardMaterial({ color, transparent: true, opacity: 0, roughness: 0.1, depthWrite: false, emissive: color, emissiveIntensity: 0.2 }),
    );
    this.mesh.userData.water = true;
    this.mesh.raycast = () => {};
    this.mesh.position.set(x, 0, z);
    this.top = top;
    this.level = 0;
    tag(this.mesh, component);
    // The root stays at the origin so the exploded view can translate it without losing x/z.
    this.root = new T.Group();
    this.root.add(this.mesh);
    parent.add(this.root);
  }
  update(dt, flowing, bottom) {
    this.level += ((flowing ? 1 : 0) - this.level) * (1 - Math.exp(-dt * 5));
    const h = Math.max(0.02, this.top - bottom);
    this.mesh.visible = this.level > 0.02;
    this.mesh.scale.set(1, h, 1);
    this.mesh.position.y = this.top - h / 2;
    this.mesh.material.opacity = 0.75 * this.level;
  }
}

const CABLE = {
  signal: { color: 0x1f9e8f, label: "Sinal" },
  command: { color: 0x7a55b8, label: "Comando" },
  power: { color: 0xc77426, label: "Alimentação" },
};
// Cables differ by trace, not only by colour: signal = dashes, command = dots, power = thick continuous.
function cableGeometry(points, style) {
  const path = polyline(points),
    L = path.getLength(),
    parts = [];
  if (style === "power") {
    for (let i = 1; i < points.length; i++) parts.push(stick(points[i - 1], points[i], 0.026, 8));
    for (let i = 1; i < points.length - 1; i++) parts.push(ball(points[i], 0.026, 8));
  } else if (style === "signal") {
    for (let s = 0; s < L - 0.02; s += 0.12) parts.push(stick(path.getPointAt(s / L), path.getPointAt(Math.min(L, s + 0.075) / L), 0.016, 6));
  } else {
    for (let s = 0; s <= L; s += 0.05) parts.push(ball(path.getPointAt(Math.min(1, s / L)), 0.012, 6));
  }
  return { geometry: merged(parts), path, length: L };
}
class Cable {
  constructor(parent, def) {
    Object.assign(this, def);
    const { geometry, path, length } = cableGeometry(def.points.map(v3), def.style);
    this.material = new T.MeshStandardMaterial({ color: CABLE[def.style].color, emissive: CABLE[def.style].color, emissiveIntensity: 0.05, roughness: 0.5 });
    this.mesh = new T.Mesh(geometry, this.material);
    this.mesh.castShadow = true;
    parent.add(this.mesh);
    tag(this.mesh, def.component);
    this.path = path;
    this.length = length;
    this.bead = new T.Mesh(
      new T.SphereGeometry(def.style === "power" ? 0.05 : 0.04, 10, 8),
      new T.MeshBasicMaterial({ color: new T.Color(CABLE[def.style].color).lerp(new T.Color(0xffffff), 0.45) }),
    );
    this.bead.raycast = () => {};
    this.bead.visible = false;
    parent.add(this.bead);
    this.phase = Math.random();
  }
  update(dt, active, highlight) {
    this.material.emissiveIntensity += ((highlight ? 0.9 : 0.05) - this.material.emissiveIntensity) * Math.min(1, dt * 6);
    this.bead.visible = active;
    if (!active) return;
    this.phase = (this.phase + (dt * 1.3) / Math.max(1, this.length)) % 1;
    this.bead.position.copy(this.path.getPointAt(this.phase));
  }
}

export function createNetwork(scene) {
  const root = group(scene);
  const concreteMat = new T.MeshStandardMaterial({ map: concrete(), roughness: 0.9 });
  const section = mat(0x9a5643, { roughness: 0.8 }); // colour of cut faces (architectural section)
  const steel = mat(0x6b7b77, { roughness: 0.45, metalness: 0.5 });
  const owners = new Map(); // object → explode owner
  const components = new Map(); // object → selection key (tagged once everything is built)
  const own = (o, owner, component = owner) => {
    owners.set(o, owner);
    components.set(o, component);
    return o;
  };
  const part = (owner, component = owner) => own(group(root), owner, component);

  // Curb inlets: each grate drops into a concrete box (front wall cut to show the inside).
  const INLETS = [-11, -7, -2];
  const shafts = part("inlet");
  for (const x of INLETS) {
    const t = 0.06,
      w = 0.62,
      d = 0.5,
      z = 0.4;
    sizedBox(shafts, [w, 0.56, t], [x, -0.24, z - d / 2 + t / 2], concreteMat, [1, 1]);
    for (const s of [-1, 1]) {
      sizedBox(shafts, [t, 0.56, d], [x + s * (w / 2 - t / 2), -0.24, z], concreteMat, [1, 1]);
      box(shafts, [t + 0.004, 0.56, 0.012], [x + s * (w / 2 - t / 2), -0.24, z + d / 2], section);
    }
    sizedBox(shafts, [w, t, d], [x, -0.5, z], concreteMat, [1, 1]);
    box(shafts, [w, t + 0.004, 0.012], [x, -0.5, z + d / 2], section);
    // Outlet opening in the floor.
    box(shafts, [0.2, 0.004, 0.2], [x, -0.468, z], 0x1d2624);
  }
  // Hangers holding the collector to the underside of the street slab.
  const hangers = part("inlet");
  for (const x of [-10, -8.5, -5.6, -4.3, -2.9]) {
    const y = -0.8 + (Math.abs(x + 7) / 4) * 0.1;
    box(hangers, [0.02, -y, 0.02], [x, y / 2, 1.2], steel);
    box(hangers, [0.06, 0.03, 0.26], [x, y - 0.1, 1.2], steel);
  }

  const pipes = [
    ...INLETS.filter((x) => x !== -7).map((x) => ({
      id: `inlet${x}`,
      owner: "inlet",
      component: "inlet",
      stage: "inlet",
      kind: "gravity",
      when: "rain",
      radius: 0.08,
      points: [
        [x, -0.47, 0.4],
        [x, -0.68, 0.4],
        [x, -0.74, 1.2],
        [x < -7 ? -7.12 : -6.88, -0.86, 1.2],
      ],
    })),
    { id: "inlet-7", owner: "inlet", component: "inlet", stage: "inlet", kind: "gravity", when: "rain", radius: 0.08, points: [[-7, -0.47, 0.4], [-7, -0.68, 0.4], [-7, -0.84, 1.15]] },
    { id: "entry", owner: "gallery", component: "inlet", stage: "gallery", kind: "gravity", when: "rain", radius: 0.1, points: [[-7, -0.86, 1.25], [-7, -0.9, 1.98]] },
    { id: "p01-in", owner: "gallery", component: "drain", stage: "drain", kind: "pumped", when: "drain", points: [[-5.55, -3.38, 3], [-5, -3.38, 3]] },
    { id: "p01-suction", owner: "drain", component: "drain", stage: "drain", kind: "pumped", when: "drain", points: [[-5, -3.38, 3], [-4.55, -3.38, 3], [-4.55, -2.6, 3], [-4.04, -2.6, 3]] },
    { id: "p01-out", owner: "drain", component: "drain", stage: "drain", kind: "pumped", when: "drain", points: [[-3.3, -2.14, 3], [-3.3, -0.35, 3], [-2.3, -0.35, 3]] },
    { id: "p01-drop", owner: "reservoir", component: "drain", stage: "reservoir", kind: "pumped", when: "drain", points: [[-2.3, -0.35, 3], [-1.9, -0.35, 3], [-1.9, -0.82, 3]] },
    { id: "p02-in", owner: "reservoir", component: "reuse", stage: "reuse", kind: "pumped", when: "reuse", points: [[0.75, -3.38, 3], [1.3, -3.38, 3]] },
    { id: "p02-suction", owner: "reuse", component: "reuse", stage: "reuse", kind: "pumped", when: "reuse", points: [[1.3, -3.38, 3], [1.8, -3.38, 3], [1.8, -2.6, 3], [2.16, -2.6, 3]] },
    { id: "p02-out", owner: "reuse", component: "reuse", stage: "reuse", kind: "pumped", when: "reuse", points: [[2.9, -2.14, 3], [2.9, -0.7, 3], [4.6, -0.7, 3]] },
    {
      id: "transport",
      owner: "pipes",
      component: "pipes",
      stage: "dam",
      kind: "pumped",
      when: "reuse",
      points: [[4.6, -0.7, 3], [6.2, -0.7, 3], [6.2, -0.7, 0.6], [7.55, -0.7, 0.6], [7.55, 1.15, 0.6], [7.55, 1.15, -1.3], [7.55, 0.55, -1.3]],
    },
  ].map((def) => {
    const p = new Pipe(root, def);
    owners.set(p.group, def.owner);
    return p;
  });
  // Tee where the three inlet lines meet before crossing the gallery wall.
  const tee = part("inlet");
  const teeBall = new T.Mesh(new T.SphereGeometry(0.12, 14, 10), materialsFor("gravity").shell);
  teeBall.position.set(-7, -0.86, 1.2);
  tee.add(teeBall);

  // Wall sleeves: the pipe crosses the wall through a visible opening with a collar.
  const sleeves = part("gallery");
  const sleeve = (g, p, axis, r) => {
    const m = new T.Mesh(new T.CylinderGeometry(r, r, 0.22, 16), steel);
    m.position.set(...p);
    if (axis === "x") m.rotation.z = Math.PI / 2;
    else m.rotation.x = Math.PI / 2;
    m.castShadow = true;
    g.add(m);
    const ring = new T.Mesh(new T.TorusGeometry(r + 0.02, 0.018, 6, 20), section);
    ring.position.set(...p);
    if (axis === "x") ring.rotation.y = Math.PI / 2;
    g.add(ring);
  };
  sleeve(sleeves, [-7, -0.88, 1.6], "z", 0.14);
  sleeve(sleeves, [-5, -3.38, 3], "x", 0.13);
  const resSleeves = part("reservoir");
  sleeve(resSleeves, [1.3, -3.38, 3], "x", 0.13);

  // Suction strainers at the bottom of each chamber.
  for (const [x, owner, comp] of [
    [-5.65, "gallery", "drain"],
    [0.65, "reservoir", "reuse"],
  ]) {
    const g = part(owner, comp);
    const s = new T.Mesh(new T.CylinderGeometry(0.13, 0.13, 0.22, 14), mat(0x3c4b48, { roughness: 0.6 }));
    s.rotation.z = Math.PI / 2;
    s.position.set(x, -3.38, 3);
    g.add(s);
    for (let i = 0; i < 4; i++) box(g, [0.024, 0.27, 0.27], [x - 0.08 + i * 0.054, -3.38, 3], 0x8fa39d);
    own(g, owner, comp);
  }

  // Supports for the transport line.
  const supports = part("pipes");
  box(supports, [0.08, 3.06, 0.08], [4.0, -2.32, 3], steel);
  box(supports, [0.3, 0.05, 0.3], [4.0, -3.83, 3], steel);
  box(supports, [0.24, 0.05, 0.1], [4.0, -0.79, 3], steel);
  for (const [x, z, w, d] of [
    [6.2, 2, 0.26, 0.2],
    [6.9, 0.6, 0.2, 0.26],
  ])
    box(supports, [w, 0.08, d], [x, -0.82, z], concreteMat);
  box(supports, [0.3, 0.06, 0.24], [7.55, 1.03, -0.55], steel); // saddle on the dam crest

  // Float switches inside the reservoir (tank_full / tank_empty in the telemetry).
  const floats = part("reservoir");
  box(floats, [0.025, 2.9, 0.025], [1.0, -2.05, 2.1], steel);
  box(floats, [0.25, 0.04, 0.06], [1.12, -0.62, 2.1], steel);
  for (const y of [-1.05, -3.3]) {
    const f = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.12, 12), mat(0xe2a636, { roughness: 0.5 }));
    f.position.set(1.0, y, 2.1);
    floats.add(f);
  }

  // Ultrasonic sensor HC-SR04 on a bracket fixed to the top of the gallery back wall, facing the water.
  const sensor = part("sensor");
  box(sensor, [0.12, 0.05, 0.12], [SENSOR.x, -0.57, 1.66], steel);
  box(sensor, [0.04, 0.04, SENSOR.z - 1.62], [SENSOR.x, -0.5, (SENSOR.z + 1.62) / 2], steel);
  box(sensor, [0.46, 0.03, 0.24], [SENSOR.x, -0.535, SENSOR.z], steel);
  box(sensor, [0.42, 0.02, 0.2], [SENSOR.x, -0.56, SENSOR.z], 0x1f5f9e);
  box(sensor, [0.12, 0.03, 0.03], [SENSOR.x, -0.535, SENSOR.z - 0.1], 0x222222);
  for (const dx of [-0.13, 0.13]) {
    const can = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.06, 18), mat(0xc9d2d4, { metalness: 0.6, roughness: 0.3 }));
    can.position.set(SENSOR.x + dx, -0.6, SENSOR.z);
    sensor.add(can);
    const mesh = new T.Mesh(new T.CircleGeometry(0.06, 18).rotateX(Math.PI / 2), mat(0x3a3f40, { roughness: 0.9 }));
    mesh.position.set(SENSOR.x + dx, SENSOR.faceY - 0.001, SENSOR.z);
    sensor.add(mesh);
  }

  // Control panel: enclosure on a frame between the gallery and the reservoir (technical area).
  const cabinet = part("control");
  const { x: cx, y: cy, z: cz } = CAB;
  for (const px of [cx - 0.4, cx + 0.4]) box(cabinet, [0.05, 3.6, 0.05], [px, -1.8, cz - 0.15], steel);
  box(cabinet, [0.95, 0.75, 0.02], [cx, cy, cz - 0.1], 0xd9ddd6);
  for (const s of [-1, 1]) box(cabinet, [0.02, 0.75, 0.22], [cx + s * 0.465, cy, cz], 0xd9ddd6);
  for (const s of [-1, 1]) box(cabinet, [0.95, 0.02, 0.22], [cx, cy + s * 0.365, cz], 0xd9ddd6);
  box(cabinet, [0.9, 0.68, 0.01], [cx, cy, cz - 0.085], 0xb9c0b6); // mounting plate
  // ESP32 DevKit (didactic proportions): PCB, RF shield, antenna, USB and pin headers.
  const ex = cx - 0.22;
  box(cabinet, [0.24, 0.5, 0.02], [ex, cy, cz - 0.07], 0x1d262f);
  box(cabinet, [0.17, 0.2, 0.015], [ex, cy + 0.11, cz - 0.055], mat(0xc4c9cc, { metalness: 0.7, roughness: 0.3 }));
  box(cabinet, [0.17, 0.05, 0.012], [ex, cy + 0.235, cz - 0.055], 0x2b3b33);
  box(cabinet, [0.08, 0.04, 0.03], [ex, cy - 0.245, cz - 0.055], mat(0xb8bcbf, { metalness: 0.7 }));
  for (const s of [-1, 1]) box(cabinet, [0.025, 0.42, 0.03], [ex + s * 0.105, cy - 0.02, cz - 0.05], 0x111111);
  // Two-channel relay module: PCB, relays, screw terminals (COM/NO) and input header.
  const rx = cx + 0.18;
  box(cabinet, [0.34, 0.44, 0.02], [rx, cy, cz - 0.07], 0x24569c);
  for (const dx of [-0.08, 0.08]) {
    box(cabinet, [0.13, 0.16, 0.1], [rx + dx, cy + 0.03, cz - 0.01], 0x2c74d6);
    box(cabinet, [0.13, 0.06, 0.06], [rx + dx, cy + 0.17, cz - 0.03], 0x2e8a4f);
  }
  box(cabinet, [0.16, 0.03, 0.03], [rx, cy - 0.19, cz - 0.05], 0x111111);
  // Cable glands at the bottom and top.
  for (const gx of [cx - 0.15, cx + 0.25, cx + 0.35]) box(cabinet, [0.05, 0.04, 0.05], [gx, cy - 0.385, cz], 0x30403c);
  for (const gx of [cx - 0.15, cx + 0.05, cx + 0.4]) box(cabinet, [0.05, 0.04, 0.05], [gx, cy + 0.385, cz], 0x30403c);
  const led = (x, y, off) => {
    const m = new T.Mesh(new T.SphereGeometry(0.016, 8, 6), new T.MeshStandardMaterial({ color: off, emissive: 0x000000 }));
    m.position.set(x, y, cz - 0.05);
    cabinet.add(m);
    return m;
  };
  const leds = { esp: led(ex + 0.07, cy - 0.2, 0x3a2222), drain: led(rx - 0.08, cy - 0.12, 0x2a3a2a), reuse: led(rx + 0.08, cy - 0.12, 0x2a3a2a) };
  const door = new T.Group();
  door.position.set(cx - 0.475, cy, cz + 0.11);
  const doorPanel = box(door, [0.95, 0.75, 0.02], [0.475, 0, 0], 0xe4e7e0);
  box(door, [0.03, 0.12, 0.03], [0.88, 0, 0.02], 0x55625f);
  box(door, [0.5, 0.12, 0.004], [0.475, 0.22, 0.012], 0x2c5e51);
  cabinet.add(door);
  doorPanel.userData.dynamic = true;

  // Access shaft with manhole and ladder down to the pump platform.
  const access = part("drain");
  const lid = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 0.02, 24), mat(0x3e4745, { metalness: 0.4, roughness: 0.6 }));
  lid.position.set(-4.55, 0.39, 3.9);
  access.add(lid);
  for (const s of [-1, 1]) box(access, [0.03, 3.7, 0.03], [-4.55 + s * 0.17, -1.75, 4.15], steel);
  for (let y = -3.4; y < 0; y += 0.3) box(access, [0.34, 0.02, 0.02], [-4.55, y, 4.15], steel);

  // Cables. Endpoints say which group each side belongs to (used by the exploded view).
  const cables = [
    { id: "sig-sensor", style: "signal", component: "sensor", from: "sensor", to: "control", points: [[SENSOR.x, -0.535, SENSOR.z - 0.12], [SENSOR.x, -0.15, SENSOR.z - 0.12], [SENSOR.x, -0.15, 1.95], [cx - 0.15, -0.15, 1.95], [cx - 0.15, cy + 0.38, cz]] },
    { id: "sig-floats", style: "signal", component: "reservoir", from: "reservoir", to: "control", points: [[1.0, -0.62, 2.1], [1.0, -0.22, 2.1], [1.0, -0.22, 1.95], [cx + 0.05, -0.22, 1.95], [cx + 0.05, cy + 0.38, cz]] },
    { id: "cmd-drain", style: "command", component: "control", from: "control", to: "control", points: [[ex + 0.12, cy - 0.06, cz - 0.045], [rx - 0.04, cy - 0.06, cz - 0.045], [rx - 0.04, cy - 0.18, cz - 0.045]] },
    { id: "cmd-reuse", style: "command", component: "control", from: "control", to: "control", points: [[ex + 0.12, cy - 0.1, cz - 0.04], [ex + 0.16, cy - 0.1, cz - 0.04], [ex + 0.16, cy - 0.26, cz - 0.04], [rx + 0.04, cy - 0.26, cz - 0.04], [rx + 0.04, cy - 0.19, cz - 0.04]] },
    { id: "pwr-drain", style: "power", component: "drain", from: "control", to: "drain", points: [[cx + 0.25, cy - 0.4, cz], [cx + 0.25, -3.0, cz], [cx + 0.25, -3.0, 2.6], [-3.45, -3.05, 2.74]] },
    { id: "pwr-reuse", style: "power", component: "reuse", from: "control", to: "reuse", points: [[cx + 0.35, cy - 0.4, cz], [cx + 0.35, -1.8, cz], [cx + 0.35, -1.8, 1.4], [2.45, -1.8, 1.4], [2.45, -3.0, 1.4], [2.45, -3.05, 2.74]] },
    { id: "pwr-feed", style: "power", component: "control", from: "control", to: "control", points: [[cx + 0.4, cy + 0.38, cz], [cx + 0.4, -0.02, cz]] },
  ].map((def) => {
    const c = new Cable(root, def);
    return c;
  });
  const cableGroup = cables.map((c) => c.mesh);

  // Falling water at every open discharge.
  const streams = {
    shafts: INLETS.map((x) => new Stream(root, x, 0.4, 0.38, "inlet", 0x9fd7da)),
    gallery: new Stream(root, -7, 1.98, -0.92, "inlet", 0x8fd2d6),
    reservoir: new Stream(root, -1.9, 3, -0.84, "drain", 0x4c9be0),
    dam: new Stream(root, 7.55, -1.3, 0.52, "pipes", 0x4c9be0),
  };
  owners.set(streams.gallery.root, "gallery");
  owners.set(streams.reservoir.root, "reservoir");
  owners.set(streams.dam.root, "dam");
  streams.shafts.forEach((s) => owners.set(s.root, "inlet"));

  // Didactic sensor pulse: outgoing wave, echo and the surface point being measured.
  const pulse = group(root);
  owners.set(pulse, "sensor");
  const ringGeo = new T.TorusGeometry(0.16, 0.012, 6, 32).rotateX(Math.PI / 2);
  const out = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0x29b3a3, transparent: true, depthWrite: false }));
  const echo = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xe0a33a, transparent: true, depthWrite: false }));
  const marker = new T.Group();
  marker.add(new T.Mesh(new T.RingGeometry(0.14, 0.18, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xe0a33a, side: T.DoubleSide, depthWrite: false, transparent: true, opacity: 0.95 })));
  for (const r of [0, Math.PI / 2]) {
    const bar = new T.Mesh(new T.BoxGeometry(0.42, 0.004, 0.012), new T.MeshBasicMaterial({ color: 0xe0a33a }));
    bar.rotation.y = r;
    marker.add(bar);
  }
  const lineGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(0, -1, 0)]);
  const distance = new T.Line(lineGeo, new T.LineDashedMaterial({ color: 0x1d5b52, dashSize: 0.06, gapSize: 0.05 }));
  distance.computeLineDistances();
  const fault = new T.Group();
  for (const r of [Math.PI / 4, -Math.PI / 4]) {
    const bar = new T.Mesh(new T.BoxGeometry(0.34, 0.035, 0.035), new T.MeshBasicMaterial({ color: 0xd2453a }));
    bar.rotation.z = r;
    fault.add(bar);
  }
  fault.position.set(SENSOR.x, SENSOR.faceY - 0.15, SENSOR.z + 0.15);
  for (const o of [out, echo, marker, distance, fault]) {
    o.raycast = () => {};
    o.traverse((c) => (c.raycast = () => {}));
    pulse.add(o);
  }
  out.position.set(SENSOR.x, 0, SENSOR.z);
  echo.position.set(SENSOR.x, 0, SENSOR.z);
  marker.position.set(SENSOR.x, 0, SENSOR.z);
  distance.position.set(SENSOR.x + 0.32, SENSOR.faceY, SENSOR.z);
  pulse.visible = false;
  let pulsePhase = 0;
  let doorAngle = 0;

  // Explode guides: dashed lines between connection points that were separated for inspection.
  const links = [];
  const key = (p) => p.map((n) => n.toFixed(2)).join(",");
  for (const a of pipes)
    for (const b of pipes)
      if (a !== b && a.owner !== b.owner && key(a.points.at(-1)) === key(b.points[0])) links.push({ a: a.points.at(-1), ao: a.owner, b: b.points[0], bo: b.owner, color: 0x2c7fd0 });
  links.push({ a: [-7, -0.86, 1.2], ao: "inlet", b: [-7, -0.86, 1.25], bo: "gallery", color: 0x2fb3b0 });
  for (const c of cables) if (c.from !== c.to) links.push({ a: c.points[0], ao: c.from, b: c.points.at(-1), bo: c.to, color: CABLE[c.style].color });
  const guidePositions = new Float32Array(links.length * 6),
    guideColors = new Float32Array(links.length * 6);
  links.forEach((l, i) => {
    const c = new T.Color(l.color);
    guideColors.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
  });
  const guideGeo = new T.BufferGeometry();
  guideGeo.setAttribute("position", new T.BufferAttribute(guidePositions, 3));
  guideGeo.setAttribute("color", new T.BufferAttribute(guideColors, 3));
  const guides = new T.LineSegments(guideGeo, new T.LineDashedMaterial({ vertexColors: true, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.9 }));
  guides.raycast = () => {};
  guides.frustumCulled = false;
  guides.visible = false;
  root.add(guides);

  for (const [o, component] of components) tag(o, component);
  const offset = (owner, e, out = new T.Vector3()) => out.set(...(EXPLODE[owner] || [0, 0, 0])).multiplyScalar(e);
  const tmp = new T.Vector3();
  let lastExplode = -1;

  return {
    root,
    owners,
    pipes,
    cables,
    cableGroup,
    links,
    offset,
    update(dt, s) {
      const e = s.explode;
      const separated = e > 0.02;
      // Particles, streams, cables and beads are hidden while groups are apart: no water across gaps.
      for (const p of pipes) {
        const flowing = s.hydraulic && !separated && s.flow[p.when];
        p.update(dt, flowing, s.cut.has(p.stage) || s.cutIds.has(p.id), s.time);
      }
      streams.shafts.forEach((st) => st.update(dt, s.hydraulic && !separated && s.flow.rain, -0.46));
      streams.gallery.update(dt, s.hydraulic && !separated && s.flow.rain, s.galleryTop);
      streams.reservoir.update(dt, s.hydraulic && !separated && s.flow.drain, s.reservoirTop);
      streams.dam.update(dt, s.hydraulic && !separated && s.flow.reuse, s.damTop);
      for (const c of cables) {
        const active =
          !separated &&
          (c.style === "signal"
            ? c.id === "sig-sensor"
              ? s.sensorState === "valid"
              : s.esp
            : c.id === "pwr-feed"
              ? false
              : c.id.endsWith("drain")
                ? s.relays.drain
                : s.relays.reuse);
        c.mesh.visible = !separated || c.from === c.to;
        c.update(dt, active, s.highlight.has(c.id) || s.highlight.has(c.style));
      }
      // Panel indicators follow the commanded state (real telemetry or simulation).
      const setLed = (m, on, color) => {
        m.material.emissive.setHex(on ? color : 0x000000);
        m.material.emissiveIntensity = on ? 1.6 : 0;
      };
      setLed(leds.esp, s.esp, 0xff4b3a);
      setLed(leds.drain, s.relays.drain, 0x48ff7a);
      setLed(leds.reuse, s.relays.reuse, 0x48ff7a);
      doorAngle += ((s.doorOpen ? -1.95 : 0) - doorAngle) * Math.min(1, dt * 5);
      door.rotation.y = doorAngle;

      // Sensor pulse. In fault: the wave leaves but no echo, no marker and no distance are drawn.
      pulse.visible = s.pulse && !separated;
      if (pulse.visible) {
        pulsePhase = (pulsePhase + dt * 0.55) % 1;
        const y0 = SENSOR.faceY,
          y1 = s.galleryTop + 0.005,
          state = s.sensorState;
        const goingDown = pulsePhase < 0.5,
          k = goingDown ? pulsePhase * 2 : (pulsePhase - 0.5) * 2;
        out.visible = state !== "unavailable" && goingDown;
        out.position.y = state === "fault" ? y0 - k * 0.8 : y0 + (y1 - y0) * k;
        out.material.opacity = state === "fault" ? 0.8 * (1 - k) : 0.9;
        out.scale.setScalar(0.6 + k * 0.8);
        echo.visible = state === "valid" && !goingDown;
        echo.position.y = y1 + (y0 - y1) * k;
        echo.material.opacity = 0.9 - 0.4 * k;
        echo.scale.setScalar(1.4 - k * 0.6);
        marker.visible = state === "valid";
        marker.position.y = y1;
        distance.visible = state === "valid";
        distance.scale.y = Math.max(0.01, y0 - y1);
        fault.visible = state === "fault";
      }

      // Exploded view: rigid translation of each group, with guide lines between separated connections.
      if (e !== lastExplode) {
        lastExplode = e;
        for (const [o, owner] of owners) offset(owner, e, o.position);
        for (const c of cables) offset(c.from === c.to ? c.from : "control", e, c.mesh.position);
        links.forEach((l, i) => {
          tmp.set(...l.a).add(offset(l.ao, e));
          guidePositions.set([tmp.x, tmp.y, tmp.z], i * 6);
          tmp.set(...l.b).add(offset(l.bo, e));
          guidePositions.set([tmp.x, tmp.y, tmp.z], i * 6 + 3);
        });
        guideGeo.attributes.position.needsUpdate = true;
        guides.computeLineDistances();
        guides.visible = separated;
      }
    },
  };
}
