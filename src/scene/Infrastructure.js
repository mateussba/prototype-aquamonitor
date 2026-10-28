import * as T from "three";
import { box, cylinder, group, mat, tag, sizedBox, bake } from "./primitives.js";
import { concrete, soilStrata, grass } from "./textures.js";
import { Trees } from "./Vegetation.js";
import { waterMaterial } from "./Water.js";
export function createInfrastructure(scene) {
  const concreteMat = new T.MeshStandardMaterial({ map: concrete(), roughness: 0.9 });
  const darkConcrete = new T.MeshStandardMaterial({ map: concrete(), color: 0xb7c2bd, roughness: 0.9 });
  // Soil cross-section with its own material so it can fade out in the underground view.
  const soilMat = new T.MeshStandardMaterial({ map: soilStrata(), roughness: 0.95 });
  const soil = group(scene);
  sizedBox(soil, [17, 3.8, 7.8], [-5, -2, -4.1], soilMat, [4.25, 3.8]);
  bake(soil);
  sizedBox(scene, [18.1, 0.3, 13], [-5, -4, -2], darkConcrete, [3, 3]);
  const underground = group(scene);
  const dynamic = (o) => {
    o.userData.dynamic = true;
    return o;
  };
  function tank(x, z, w, d, key, color) {
    const g = group(underground);
    sizedBox(g, [w + 0.4, 0.2, d + 0.4], [x, -3.7, z], darkConcrete, [2, 2]);
    sizedBox(g, [w, 3, 0.13], [x, -2.1, z - d / 2], concreteMat, [2, 2]);
    for (const xx of [x - w / 2, x + w / 2]) sizedBox(g, [0.13, 3, d], [xx, -2.1, z], concreteMat, [2, 2]);
    box(g, [w, 0.08, 0.16], [x, -0.6, z - d / 2], 0xc3cbc6);
    box(g, [w, 3, 0.05], [x, -2.1, z + d / 2], 0x9fd3d8, {
      transparent: true,
      opacity: 0.12,
      roughness: 0.05,
      depthWrite: false,
    });
    const water = dynamic(new T.Mesh(new T.BoxGeometry(1, 1, 1), waterMaterial(color)));
    water.userData.water = true;
    water.scale.set(w - 0.2, 1, d - 0.2);
    water.position.set(x, -3.2, z);
    g.add(water);
    for (let i = 0; i <= 5; i++)
      box(g, [i % 5 ? 0.18 : 0.3, 0.025, 0.035], [x + w / 2 - 0.22, -3.6 + i * 0.55, z + d / 2 + 0.04], 0x516d6b);
    tag(g, key);
    return water;
  }
  const gallery = tank(-7, 3, 4, 2.8, "gallery", 0x3f9fa6),
    tankWater = tank(-0.5, 3, 3.6, 2.8, "reservoir", 0x2ba5c2);
  // The ultrasonic sensor, controller, relays and wiring are modelled in Network.js.
  const pumps = [];
  const metal = mat(0x47706a, { roughness: 0.35, metalness: 0.6 });
  for (const [x, key] of [
    [-3.6, "drain"],
    [2.6, "reuse"],
  ]) {
    const g = group(underground);
    sizedBox(g, [1.5, 0.24, 1.4], [x, -3.5, 3], darkConcrete, [2, 2]);
    const body = cylinder(g, 0.48, 0.8, [x, -2.6, 3], metal, 24);
    body.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) {
      const flange = cylinder(g, 0.52, 0.06, [x + s * 0.42, -2.6, 3], 0x5d817a, 24);
      flange.rotation.z = Math.PI / 2;
    }
    box(g, [0.7, 0.5, 0.5], [x, -3.13, 3], metal);
    const rotor = dynamic(new T.Mesh(new T.TorusGeometry(0.33, 0.055, 8, 20), mat(0xc5d6c5, { metalness: 0.4, roughness: 0.3 })));
    rotor.rotation.y = Math.PI / 2;
    rotor.position.set(x + 0.47, -2.6, 3);
    g.add(rotor);
    // Spoke inside the ring makes the rotation readable.
    box(rotor, [0.06, 0.6, 0.06], [0, 0, 0], 0xd2dfd5);
    const light = dynamic(
      box(g, [0.2, 0.16, 0.22], [x, -1.95, 3], new T.MeshStandardMaterial({ color: 0x77877b, emissive: 0x000000, roughness: 0.4 })),
    );
    pumps.push({ rotor, light, key, speed: 0 });
    tag(g, key);
  }
  bake(underground);

  // Destination dam.
  const dam = group(scene);
  const damStatic = group(dam);
  const grassMat = new T.MeshStandardMaterial({ map: grass(), roughness: 1 });
  sizedBox(damStatic, [10, 0.5, 9], [10.5, -1.1, -3.4], grassMat, [2, 2]);
  const damWater = new T.Mesh(new T.BoxGeometry(1, 1, 1), waterMaterial(0x3b98aa, 0.85));
  damWater.userData.water = true;
  damWater.scale.set(7.9, 0.6, 6.5);
  damWater.position.set(11, -0.62, -4);
  dam.add(damWater);
  const rock = [mat(0x97aa8f, { flatShading: true }), mat(0xb3b6a2, { flatShading: true }), mat(0x8c9a86, { flatShading: true })];
  for (let i = 0; i < 13; i++) {
    const m = new T.Mesh(new T.IcosahedronGeometry(1.2 + (i % 4) * 0.3, 1), rock[i % 3]);
    m.position.set(6.7 + i * 0.72, 0.15 + (i % 3) * 0.12, -7.3 - (i % 2) * 0.35);
    m.scale.set(1, 0.9 + ((i * 7) % 5) * 0.18, 0.8);
    m.rotation.set(i, i * 2.1, 0);
    m.castShadow = m.receiveShadow = true;
    damStatic.add(m);
  }
  sizedBox(damStatic, [8.8, 1.8, 0.65], [11, -0.05, -0.55], concreteMat, [2, 2]);
  sizedBox(damStatic, [9.1, 0.2, 0.95], [11, 0.9, -0.55], darkConcrete, [2, 2]);
  for (let x = 7; x < 16; x += 1.1) {
    sizedBox(damStatic, [0.28, 1.4, 0.9], [x, -0.1, -0.25], concreteMat, [2, 2]);
    cylinder(damStatic, 0.03, 0.45, [x, 1.2, -0.55], 0x607c75, 6);
  }
  box(damStatic, [8.8, 0.035, 0.035], [11, 1.4, -0.55], 0x607c75);
  for (let i = 0; i < 4; i++) box(damStatic, [1.4, 0.12, 0.3 + i * 0.25], [11, -0.75 - i * 0.12, -0.05 + i * 0.12], 0xc9cec6);
  bake(damStatic);
  const damTrees = new Trees(
    dam,
    [
      [6, -5, 0.85, "leaf"],
      [6, -6.8, 0.8, "pine"],
      [15, -6.3, 0.9, "pine"],
      [16, -3, 0.85, "leaf"],
      [15.5, -1.5, 0.7, "leaf"],
      [7.2, -6.3, 0.7, "pine"],
      [14, -7.1, 0.75, "pine"],
      [6.2, -2.2, 0.7, "bush"],
    ].map(([x, z, s, kind]) => ({ x, z, s, kind, y: -0.85 })),
    "dam",
  );
  tag(dam, "dam");
  // Curb inlets in the gutter, connected to the collection chamber.
  const drains = [];
  const drainGroup = group(scene);
  for (const x of [-11, -7, -2]) {
    box(drainGroup, [0.8, 0.025, 0.36], [x, 0.39, 0.4], 0x3a514e);
    for (let i = 0; i < 6; i++) box(drainGroup, [0.04, 0.012, 0.3], [x - 0.3 + i * 0.12, 0.405, 0.4], 0x9aa89c);
    drains.push([x, 0.4, 0.4]);
  }
  tag(drainGroup, "inlet");
  bake(drainGroup);
  return {
    soil,
    underground,
    gallery,
    tankWater,
    damWater,
    pumps,
    drains,
    drainGroup,
    damGroup: dam,
    setSoilOpacity(o) {
      soil.visible = o > 0.01;
      soilMat.transparent = o < 0.999;
      soilMat.opacity = o;
    },
    update(dt, wind, time) {
      damTrees.update(dt, wind, time);
    },
  };
}
