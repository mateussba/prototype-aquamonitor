import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { cleanGeometry } from "./primitives.js";
// Outdoor environment map (sky gradient + sun) for reflections. Built once, no HDR download.
function skyEnvironment(renderer) {
  const scene = new T.Scene();
  const geometry = new T.SphereGeometry(50, 32, 16);
  const top = new T.Color(0xcfe0e8),
    horizon = new T.Color(0xf4f4ec),
    ground = new T.Color(0x7d8f80),
    c = new T.Color(),
    colors = [],
    pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 50;
    if (y > 0) c.lerpColors(horizon, top, Math.pow(y, 0.6));
    else c.lerpColors(horizon, ground, Math.min(1, -y * 3));
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  scene.add(new T.Mesh(geometry, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
  const sun = new T.Mesh(new T.SphereGeometry(4, 16, 8), new T.MeshBasicMaterial({ color: new T.Color(0xfff2d8).multiplyScalar(8) }));
  sun.position.set(-12, 26, 16).normalize().multiplyScalar(40);
  scene.add(sun);
  const pmrem = new T.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(scene, 0.03).texture;
  pmrem.dispose();
  scene.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return texture;
}
export class Atmosphere {
  constructor(scene, renderer) {
    this.scene = scene;
    this.clear = new T.Color(0xe9eee7);
    this.stormy = new T.Color(0xa9b4b3);
    this.white = new T.Color(0xffffff);
    scene.background = this.clear.clone();
    scene.fog = new T.Fog(this.clear.clone(), 65, 125);
    scene.environment = skyEnvironment(renderer);
    scene.environmentIntensity = 0.6;
    this.hemi = new T.HemisphereLight(0xf6f8ef, 0x6f8a80, 1.3);
    scene.add(this.hemi);
    this.sun = new T.DirectionalLight(0xfff0d6, 2.9);
    this.sun.position.set(-12, 26, 16);
    this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, { left: -26, right: 26, top: 22, bottom: -22, near: 1, far: 75 });
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 3;
    this.sun.shadow.mapSize.set(1024, 1024);
    scene.add(this.sun);
    // Storm clouds fade in with the rain, above and behind the city.
    this.cloudMat = new T.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      flatShading: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.clouds = new T.Group();
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9; i++) {
      const n = 4 + (i % 3),
        parts = [];
      for (let j = 0; j < n; j++)
        parts.push(
          cleanGeometry(
            new T.IcosahedronGeometry(1 + r() * 0.9, 1).scale(1, 0.6, 1).translate((j - n / 2) * 1.3 + r() * 0.6, r() * 0.5, r() * 1.4 - 0.7),
          ),
        );
      const cloud = new T.Mesh(mergeGeometries(parts), this.cloudMat);
      cloud.position.set(-16 + (i % 3) * 7 + r() * 3, 11.6 + r() * 1.4, -11 + Math.floor(i / 3) * 5 + r() * 2);
      cloud.userData.speed = 0.12 + r() * 0.12;
      cloud.raycast = () => {};
      this.clouds.add(cloud);
    }
    scene.add(this.clouds);
    this.storm = 0;
    this.flash = 0;
    this.flashT = -1;
    this.nextFlash = 2.5;
    this.stormGray = new T.Color(0x8b989a);
  }
  update(dt, rain) {
    this.storm += (rain - this.storm) * (1 - Math.exp(-dt * 0.9));
    const s = this.storm;
    // Lightning only in heavy rain: a double flicker every few seconds.
    if (s > 0.7) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.flashT = 0;
        this.nextFlash = 5 + Math.random() * 6;
      }
    }
    this.flash = 0;
    if (this.flashT >= 0) {
      const t = (this.flashT += dt);
      this.flash = t < 0.06 ? 1 : t < 0.13 ? 0.15 : t < 0.2 ? 0.75 : Math.max(0, 1 - (t - 0.2) / 0.3);
      if (t > 0.5) this.flashT = -1;
    }
    const bg = this.scene.background.lerpColors(this.clear, this.stormy, s * 0.9).lerp(this.white, this.flash * 0.35);
    this.scene.fog.color.copy(bg);
    this.scene.fog.near = 65 - 30 * s;
    this.sun.intensity = 2.9 * (1 - 0.68 * s);
    this.hemi.intensity = 1.3 * (1 - 0.3 * s) + this.flash * 2.5;
    this.scene.environmentIntensity = 0.6 * (1 - 0.35 * s) + this.flash * 0.8;
    const cloud = Math.min(1, Math.max(0, (s - 0.05) / 0.5));
    this.cloudMat.opacity = cloud * 0.88;
    this.cloudMat.color.lerpColors(this.white, this.stormGray, s);
    this.clouds.visible = cloud > 0.005;
    if (this.clouds.visible)
      for (const c of this.clouds.children) {
        c.position.x += dt * c.userData.speed * (0.5 + s);
        if (c.position.x > 8) c.position.x -= 26;
      }
    return { storm: s, dark: Math.max(0, (s - 0.25) / 0.75), flash: this.flash };
  }
}
