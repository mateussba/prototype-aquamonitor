import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { cleanGeometry } from "./primitives.js";
import { blobShadow } from "./textures.js";
const ROAD_Y = 0.38,
  WALK_Y = 0.44;
// Signal cycle in seconds: green, yellow and an all-red clearance for each road.
const CYCLE = [
  [6, { ew: "green", ns: "red" }],
  [1.2, { ew: "yellow", ns: "red" }],
  [2, { ew: "red", ns: "red" }],
  [6, { ew: "red", ns: "green" }],
  [1.2, { ew: "red", ns: "yellow" }],
  [2, { ew: "red", ns: "red" }],
];
const CYCLE_LENGTH = CYCLE.reduce((s, [d]) => s + d, 0);
function signalAt(time) {
  let t = time % CYCLE_LENGTH;
  for (const [d, state] of CYCLE) {
    if (t < d) return state;
    t -= d;
  }
  return CYCLE[0][1];
}
const smooth = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
function carGeometries() {
  const p = new T.Shape();
  p.moveTo(-0.5, 0.07);
  p.lineTo(0.48, 0.07);
  p.quadraticCurveTo(0.53, 0.07, 0.53, 0.14);
  p.lineTo(0.52, 0.19);
  p.quadraticCurveTo(0.5, 0.23, 0.34, 0.235);
  p.lineTo(-0.38, 0.245);
  p.quadraticCurveTo(-0.52, 0.24, -0.52, 0.17);
  p.lineTo(-0.52, 0.12);
  p.quadraticCurveTo(-0.52, 0.07, -0.5, 0.07);
  const body = new T.ExtrudeGeometry(p, {
    depth: 0.4,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 5,
  }).translate(0, 0, -0.2);
  const c = new T.Shape();
  c.moveTo(-0.33, 0.23);
  c.lineTo(0.2, 0.23);
  c.lineTo(0.06, 0.36);
  c.lineTo(-0.25, 0.37);
  c.closePath();
  const cabin = new T.ExtrudeGeometry(c, {
    depth: 0.36,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.012,
    bevelSegments: 1,
  }).translate(0, 0, -0.18);
  const wheel = (x, z) =>
    cleanGeometry(new T.CylinderGeometry(0.085, 0.085, 0.07, 12).rotateX(Math.PI / 2).translate(x, 0.085, z));
  const lamp = (x, z) => cleanGeometry(new T.BoxGeometry(0.03, 0.04, 0.09).translate(x, 0.17, z));
  return {
    body,
    cabin,
    wheels: mergeGeometries([wheel(0.31, 0.2), wheel(0.31, -0.2), wheel(-0.31, 0.2), wheel(-0.31, -0.2)]),
    front: mergeGeometries([lamp(0.55, 0.13), lamp(0.55, -0.13)]),
    rear: mergeGeometries([lamp(-0.55, 0.13), lamp(-0.55, -0.13)]),
    blob: new T.PlaneGeometry(1.35, 0.78).rotateX(-Math.PI / 2).translate(0, 0.004, 0),
  };
}
export class Traffic {
  constructor(parent, signals) {
    this.signals = signals;
    this.parts = carGeometries();
    this.glass = new T.MeshStandardMaterial({ color: 0x2c464e, roughness: 0.12, metalness: 0.7 });
    this.tire = new T.MeshStandardMaterial({ color: 0x2b302f, roughness: 0.9 });
    this.head = new T.MeshStandardMaterial({ color: 0xf6f3e4, emissive: 0xfff1c9, emissiveIntensity: 0.2 });
    this.shadow = new T.MeshBasicMaterial({
      map: blobShadow(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const lane = (start, dir, length, axis, stop) => ({
      start: new T.Vector3(...start),
      dir: new T.Vector3(...dir),
      yaw: Math.atan2(-dir[2], dir[0]),
      length,
      axis,
      stop,
      cars: [],
    });
    // Right-hand traffic. `stop` is the distance along the lane to the stop line.
    this.lanes = [
      lane([-13.5, ROAD_Y, 0], [1, 0, 0], 17, "ew", 6.3),
      lane([3.5, ROAD_Y, -1], [-1, 0, 0], 17, "ew", 6.3),
      lane([-5.5, ROAD_Y, -8], [0, 0, 1], 12, "ns", 5.3),
      lane([-4.5, ROAD_Y, 4], [0, 0, -1], 12, "ns", 2.3),
    ];
    const colors = [0xe9e7e0, 0xb5463d, 0x3e5d78, 0xaab2b2, 0x2f6f69, 0xd8a443, 0x30373a, 0xe9e7e0, 0x6d8f5c];
    [
      [0, 1.2],
      [0, 8.6],
      [0, 13.5],
      [1, 2.4],
      [1, 10.5],
      [2, 1],
      [2, 8.4],
      [3, 4.4],
      [3, 10],
    ].forEach(([l, s], i) => this.addCar(parent, this.lanes[l], s, colors[i], i));
    this.time = 0;
    this.pedestrians = new Pedestrians(parent);
  }
  addCar(parent, lane, s, color, i) {
    const g = new T.Group();
    const paint = new T.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.1 });
    const tail = new T.MeshStandardMaterial({ color: 0x8c2f2a, emissive: 0xff3b2f, emissiveIntensity: 0.3 });
    for (const [geometry, material] of [
      [this.parts.body, paint],
      [this.parts.cabin, this.glass],
      [this.parts.wheels, this.tire],
      [this.parts.front, this.head],
      [this.parts.rear, tail],
      [this.parts.blob, this.shadow],
    ]) {
      const mesh = new T.Mesh(geometry, material);
      mesh.receiveShadow = material !== this.shadow;
      g.add(mesh);
    }
    parent.add(g);
    lane.cars.push({ group: g, tail, s, v: 0, cruise: 1.35 + ((i * 0.37) % 0.45) });
  }
  update(dt, { dark, rain, time }) {
    this.time += dt;
    const state = signalAt(this.time);
    for (const axis of ["ew", "ns"])
      for (const color of ["red", "yellow", "green"])
        this.signals[axis][color].emissiveIntensity = state[axis] === color ? 2.6 : 0.04;
    this.head.emissiveIntensity = 0.15 + dark * 2.4;
    for (const lane of this.lanes) {
      const light = state[lane.axis],
        cars = lane.cars.sort((a, b) => a.s - b.s),
        n = cars.length;
      cars.forEach((car, i) => {
        let target = car.cruise * (1 - rain * 0.25);
        const toStop = lane.stop - (car.s + 0.56);
        const mustStop = light === "red" || (light === "yellow" && toStop > 0.35);
        if (mustStop && toStop > -0.1 && toStop < 2.6)
          target = Math.min(target, car.cruise * Math.max(0, (toStop - 0.05) / 1.9));
        if (n > 1) {
          const gap = ((cars[(i + 1) % n].s - car.s + lane.length) % lane.length) - 1.2;
          target = Math.min(target, Math.max(0, gap) * 1.5);
        }
        const braking = target < car.v - 0.05;
        car.v += (target - car.v) * Math.min(1, dt * (braking ? 4 : 1.5));
        car.s = (car.s + car.v * dt) % lane.length;
        car.tail.emissiveIntensity = braking || car.v < 0.05 ? 2.4 : 0.25 + dark * 0.9;
        const fade = smooth(car.s / 0.8) * smooth((lane.length - car.s) / 0.8);
        car.group.visible = fade > 0.01;
        car.group.scale.setScalar(fade);
        car.group.position.copy(lane.start).addScaledVector(lane.dir, car.s);
        car.group.rotation.y = lane.yaw;
      });
    }
    this.pedestrians.update(dt, rain, time);
  }
}
class Pedestrians {
  constructor(parent) {
    this.paths = [
      [-13, -1.9, -6.6, -1.9],
      [-3.4, -1.9, 3.1, -1.9],
      [-13, 0.92, -6.6, 0.92],
      [-3.4, 0.92, 3.1, 0.92],
      [-6.38, -7.6, -6.38, -2.2],
      [-3.62, -7.6, -3.62, -2.2],
    ].map(([x0, z0, x1, z1]) => ({ a: new T.Vector3(x0, WALK_Y, z0), b: new T.Vector3(x1, WALK_Y, z1), length: Math.hypot(x1 - x0, z1 - z0) }));
    const body = mergeGeometries([
      cleanGeometry(new T.CapsuleGeometry(0.045, 0.17, 2, 6).translate(0, 0.13, 0)),
      cleanGeometry(new T.SphereGeometry(0.042, 8, 6).translate(0, 0.31, 0)),
    ]);
    const umbrella = mergeGeometries([
      cleanGeometry(new T.ConeGeometry(0.15, 0.06, 8).translate(0, 0.43, 0)),
      cleanGeometry(new T.CylinderGeometry(0.006, 0.006, 0.16, 4).translate(0, 0.33, 0)),
    ]);
    this.people = Array.from({ length: 16 }, (_, i) => ({
      path: this.paths[i % this.paths.length],
      t: (i * 0.37) % 1,
      dir: i % 2 ? 1 : -1,
      speed: 0.22 + ((i * 0.13) % 0.14),
      offset: ((i % 3) - 1) * 0.07,
      step: i,
    }));
    const material = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    this.bodies = new T.InstancedMesh(body, material, this.people.length);
    this.umbrellas = new T.InstancedMesh(umbrella, material, this.people.length);
    const shirts = [0x4f6d8a, 0xc0644f, 0xe0d6bf, 0x5f7f5a, 0x8a5a7a, 0x2f3a3c, 0xd9a443];
    const canopies = [0x2f3a3c, 0x3f6f8f, 0xb5463d, 0x6d8f5c];
    const c = new T.Color();
    this.people.forEach((_, i) => {
      this.bodies.setColorAt(i, c.setHex(shirts[i % shirts.length]));
      this.umbrellas.setColorAt(i, c.setHex(canopies[i % canopies.length]));
    });
    for (const m of [this.bodies, this.umbrellas]) {
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      m.frustumCulled = false;
      m.castShadow = false;
      parent.add(m);
    }
    this.open = 0;
    this.dummy = new T.Object3D();
    this.side = new T.Vector3();
  }
  update(dt, rain, time) {
    this.open += ((rain > 0.12 ? 1 : 0) - this.open) * (1 - Math.exp(-dt * 3));
    this.umbrellas.visible = this.open > 0.02;
    this.people.forEach((p, i) => {
      p.t += (p.dir * p.speed * dt) / p.path.length;
      if (p.t > 1 || p.t < 0) {
        p.dir *= -1;
        p.t = Math.min(1, Math.max(0, p.t));
      }
      const { a, b } = p.path;
      this.side.subVectors(b, a).normalize();
      this.dummy.position.lerpVectors(a, b, p.t);
      this.dummy.position.x += -this.side.z * p.offset;
      this.dummy.position.z += this.side.x * p.offset;
      this.dummy.position.y += Math.abs(Math.sin(time * 7 + p.step)) * 0.012;
      this.dummy.rotation.set(0, Math.atan2(this.side.x * p.dir, this.side.z * p.dir), Math.sin(time * 7 + p.step) * 0.04);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.bodies.setMatrixAt(i, this.dummy.matrix);
      this.dummy.scale.set(this.open, 1, this.open);
      this.dummy.updateMatrix();
      this.umbrellas.setMatrixAt(i, this.dummy.matrix);
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.umbrellas.instanceMatrix.needsUpdate = true;
  }
}
