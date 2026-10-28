import * as T from "three";
import { createCity } from "./City.js";
import { createInfrastructure } from "./Infrastructure.js";
import { createNetwork, EXPLODE, ANCHORS, PART_LABELS, waterTop } from "./Network.js";
import { CameraController } from "./CameraController.js";
import { Atmosphere } from "./Atmosphere.js";
import { Flow, Rain } from "./Water.js";
import { box } from "./primitives.js";
import { waterNormal } from "./textures.js";
const PUMP_COLORS = { on: 0x4fbe8f, blocked: 0xd78c53, unknown: 0xc0aa80, off: 0x71857a };

// What each component is physically connected to (used by "Ver conexões").
export const CONNECTIONS = {
  city: { pipes: ["inlet-11", "inlet-7", "inlet-2"], cables: [] },
  inlet: { pipes: ["inlet-11", "inlet-7", "inlet-2", "entry"], cables: [] },
  gallery: { pipes: ["entry", "p01-in"], cables: ["sig-sensor"] },
  sensor: { pipes: [], cables: ["sig-sensor"] },
  control: { pipes: [], cables: ["sig-sensor", "sig-floats", "cmd-drain", "cmd-reuse", "pwr-drain", "pwr-reuse", "pwr-feed"] },
  drain: { pipes: ["p01-in", "p01-suction", "p01-out", "p01-drop"], cables: ["cmd-drain", "pwr-drain"] },
  reservoir: { pipes: ["p01-drop", "p02-in"], cables: ["sig-floats"] },
  reuse: { pipes: ["p02-in", "p02-suction", "p02-out", "transport"], cables: ["cmd-reuse", "pwr-reuse"] },
  pipes: { pipes: ["p02-out", "transport"], cables: [] },
  dam: { pipes: ["transport"], cables: [] },
};
// Context kept in full colour when a component is isolated.
const RELATED = {
  city: ["city", "inlet"],
  inlet: ["inlet", "city", "gallery"],
  gallery: ["gallery", "inlet", "sensor", "drain"],
  sensor: ["sensor", "gallery", "control"],
  control: ["control", "sensor", "drain", "reuse"],
  drain: ["drain", "gallery", "reservoir", "control"],
  reservoir: ["reservoir", "drain", "reuse"],
  reuse: ["reuse", "reservoir", "pipes", "control"],
  pipes: ["pipes", "reuse", "dam"],
  dam: ["dam", "pipes"],
};
const CUT_STAGES = ["inlet", "gallery", "drain"];

export class SceneManager {
  constructor(host, onSelect) {
    this.host = host;
    this.scene = new T.Scene();
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    // Almost everything that casts shadows is static: the shadow map is redrawn only when needed.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.localClippingEnabled = true;
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Maquete 3D interativa AquaMonitor. Use os botões de câmera para navegar.",
    );
    this.camera = new T.PerspectiveCamera(40, 1, 0.1, 180);
    this.cameraController = new CameraController(
      this.camera,
      this.renderer.domElement,
    );
    this.atmosphere = new Atmosphere(this.scene, this.renderer);
    this.sun = this.atmosphere.sun;
    box(this.scene, [200, 0.2, 200], [0, -4.4, 0], 0xe4eae1);
    const grid = new T.GridHelper(90, 60, 0xcdd8cd, 0xdce3d8);
    grid.position.y = -4.28;
    grid.raycast = () => {};
    this.scene.add(grid);
    this.time = 0;
    this.cityLife = createCity(this.scene);
    this.city = this.cityLife.group;
    this.parts = createInfrastructure(this.scene);
    this.network = createNetwork(this.scene);
    this.rain = new Rain(this.scene);
    this.waterNormal = waterNormal();
    this.ripples = [];
    // Rings where each discharge hits a free surface.
    for (const [water, x, z, r, source] of [
      [this.parts.gallery, -7, 2.05, 0.28, "rain"],
      [this.parts.tankWater, -1.9, 3, 0.4, "drain"],
      [this.parts.damWater, 7.55, -1.3, 0.7, "reuse"],
    ])
      for (let i = 0; i < 3; i++) {
        const ring = new T.Mesh(
          new T.RingGeometry(r - 0.03, r, 48),
          new T.MeshBasicMaterial({
            color: 0xd3f3e8,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            side: T.DoubleSide,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0, z);
        ring.raycast = () => {};
        this.scene.add(ring);
        const owner = water === this.parts.gallery ? "gallery" : water === this.parts.tankWater ? "reservoir" : "dam";
        this.ripples.push({ ring, water, source, owner, x, z, phase: i / 3, activity: 0 });
      }
    // Surface runoff along the gutter towards each grate.
    this.streetFlows = this.parts.drains.map(
      (p) =>
        new Flow(
          this.city,
          [
            [p[0] - 1.4, 0.4, -0.4],
            [p[0] - 0.5, 0.4, 0.2],
            [p[0], 0.4, 0.4],
          ],
          "city",
          { pipe: false, count: 12, size: 0.6, speed: 0.35, dot: 0xc4e9ec },
        ),
    );
    this.setupExplode();
    this.setupCut();
    this.setupIsolation();

    this.raycaster = new T.Raycaster();
    this.pointer = new T.Vector2();
    this.select = onSelect;
    this.down = null;
    this.onDown = (e) => (this.down = [e.clientX, e.clientY]);
    this.onUp = (e) => {
      if (
        !this.down ||
        Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 5
      )
        return;
      const r = host.getBoundingClientRect();
      this.pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster
        .intersectObjects(this.scene.children, true)
        .find((h) => {
          let p = h.object;
          while (p) {
            if (!p.visible) return false;
            p = p.parent;
          }
          // Ignore what the functional cut removed.
          if (this.cut > 0.5 && h.object.userData.component === "city" && h.point.z > this.cutZ) return false;
          return h.object.userData.component;
        });
      onSelect(hit ? hit.object.userData.component : null, true);
    };
    this.renderer.domElement.addEventListener("pointerdown", this.onDown);
    this.renderer.domElement.addEventListener("pointerup", this.onUp);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.level = 0.267;
    this.tank = 0.125;
    this.under = 0;
    this.underTarget = 0;
    this.cityVisible = true;
    this.shadowsDirty = true;
    this.quality = "auto";
    this.qualityTier = "medium";
    // Presentation state (set by the UI and the guided demonstration).
    this.view = {
      selected: null,
      connections: null,
      isolate: false,
      cut: false,
      explode: false,
      stage: null,
      pulse: false,
      door: false,
    };
    this.explode = 0;
    this.cut = 0;
    this.setQuality("auto");
    // Compile every shader now, so the first rain or flow does not stutter.
    this.renderer.compile(this.scene, this.camera);
  }
  setupExplode() {
    // Each top-level piece moves rigidly with its group; baked meshes keep their component tag.
    const owners = new Map([
      [this.city, "city"],
      [this.parts.drainGroup, "city"],
      [this.parts.damGroup, "dam"],
    ]);
    for (const child of this.parts.underground.children) {
      let owner = child.userData.component;
      child.traverse((o) => (owner ||= o.userData.component));
      if (owner) owners.set(child, owner);
    }
    this.explodeTargets = [...owners].map(([o, owner]) => ({ o, owner, base: o.position.clone() }));
  }
  setupCut() {
    // Functional cut: removes the front blocks of the city along a vertical plane just past the
    // street gutter, so the street, the inlets, the gallery and the pumps read as one section.
    this.cutZ = 0.75;
    this.cutPlane = new T.Plane(new T.Vector3(0, 0, -1), 1e4);
    const materials = new Set();
    this.city.traverse((o) => o.material && [].concat(o.material).forEach((m) => materials.add(m)));
    this.parts.drainGroup.traverse((o) => o.material && [].concat(o.material).forEach((m) => materials.add(m)));
    for (const m of materials) m.clippingPlanes = [this.cutPlane];
    // Cut face of the street slab, drawn as an architectural section.
    this.cutCap = box(this.scene, [17, 0.46, 0.02], [-5, 0.23, this.cutZ], 0x9a5643);
    this.cutCap.visible = false;
    this.cutCap.raycast = () => {};
  }
  setupIsolation() {
    // Contextual isolation swaps unrelated parts to a flat, opaque "white model" material:
    // the context stays readable without stacking transparent objects over the water.
    this.ghost = new T.MeshLambertMaterial({ color: 0xe1e6df });
    this.ghostCity = new T.MeshLambertMaterial({ color: 0xe6eae3, clippingPlanes: [this.cutPlane] });
    this.solids = [];
    const roots = [this.city, this.parts.underground, this.parts.damGroup, this.parts.drainGroup, this.parts.soil, this.network.root];
    for (const root of roots)
      root.traverse((o) => {
        if (!o.isMesh || o.userData.water || !o.userData.component) return;
        const m = o.material;
        if (Array.isArray(m) || m.transparent || m.isMeshBasicMaterial) return;
        if (this.network.pipes.some((p) => p.shell === o)) return;
        this.solids.push({ o, original: m, city: root === this.city || root === this.parts.drainGroup });
      });
    this.isolated = null;
  }
  applyIsolation() {
    const key = this.view.isolate ? this.view.selected : null;
    if (key === this.isolated) return;
    this.isolated = key;
    const keep = new Set(key ? RELATED[key] || [key] : []);
    for (const s of this.solids)
      s.o.material = key && !keep.has(s.o.userData.component) ? (s.city ? this.ghostCity : this.ghost) : s.original;
    for (const p of this.network.pipes) p.ghost = key && !keep.has(p.component) && !keep.has(p.owner) ? this.ghost : null;
    this.shadowsDirty = true;
  }
  setPresentation(patch) {
    Object.assign(this.view, patch);
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < 700 ? Math.min(75, (40 * h) / w) : 40;
    this.camera.updateProjectionMatrix();
  }
  setQuality(q) {
    this.quality = q;
    const tier = q === "auto" ? "medium" : q;
    this.qualityTier = tier;
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, { low: 1, medium: 1.5, high: 2 }[tier]),
    );
    const shadows = tier !== "low";
    if (shadows !== this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = shadows;
      this.scene.traverse((o) => {
        if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true));
      });
    }
    const size = tier === "high" ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.rain.budget = { low: 500, medium: 1000, high: 1600 }[tier];
    this.cityLife.splashes.budget = { low: 0.4, medium: 0.8, high: 1 }[tier];
    this.shadowsDirty = true;
    this.slow = 0;
    this.samples = 0;
    this.warmup = 120;
    this.resize();
  }
  setUnderground(enabled) {
    this.underTarget = enabled ? 1 : 0;
  }
  // World position of a component label, following the exploded view.
  anchor(key, point = ANCHORS[key]) {
    if (!point) return null;
    const o = EXPLODE[key] || [0, 0, 0];
    return [point[0] + o[0] * this.explode, point[1] + o[1] * this.explode, point[2] + o[2] * this.explode];
  }
  partLabels(key) {
    return (PART_LABELS[key] || []).map(([text, p]) => ({ text, point: this.anchor(key, p) }));
  }
  update(dt, v) {
    this.time += dt;
    this.cameraController.update(dt);
    const active = v.running,
      rain = active ? v.rain : 0;
    const atmosphere = this.atmosphere.update(dt, rain);
    const wind = atmosphere.storm;
    const view = this.view;
    const ease = 1 - Math.exp(-dt * 4);
    // Exploded view and functional cut are eased, and both are reversible.
    const explodeTarget = view.explode ? 1 : 0;
    if (this.explode !== explodeTarget) {
      this.explode += (explodeTarget - this.explode) * ease;
      if (Math.abs(explodeTarget - this.explode) < 0.002) this.explode = explodeTarget;
      for (const t of this.explodeTargets) {
        const o = EXPLODE[t.owner] || [0, 0, 0];
        t.o.position.set(t.base.x + o[0] * this.explode, t.base.y + o[1] * this.explode + (t.owner === "city" ? 2 * this.under : 0), t.base.z + o[2] * this.explode);
      }
      this.shadowsDirty = true;
    }
    const cutTarget = view.cut ? 1 : 0;
    if (this.cut !== cutTarget) {
      this.cut += (cutTarget - this.cut) * ease;
      if (Math.abs(cutTarget - this.cut) < 0.002) this.cut = cutTarget;
      // The plane sweeps from the front of the model to the cut position.
      this.cutPlane.constant = this.cut > 0 ? this.cutZ + (1 - this.cut) * 4 : 1e4;
      this.cutCap.visible = this.cut > 0.98 && this.explode < 0.02;
      this.shadowsDirty = true;
    }
    if (this.under !== this.underTarget) {
      this.under += (this.underTarget - this.under) * (1 - Math.exp(-dt * 5));
      if (Math.abs(this.underTarget - this.under) < 0.002) this.under = this.underTarget;
      this.city.position.y = 2 * this.under + EXPLODE.city[1] * this.explode;
      this.shadowsDirty = true;
    }
    this.parts.setSoilOpacity(1 - Math.max(this.under, this.explode));
    this.applyIsolation();
    if (this.city.visible !== this.cityVisible) {
      this.cityVisible = this.city.visible;
      this.shadowsDirty = true;
    }
    if (this.city.visible)
      this.cityLife.update(dt, { time: this.time, rain, storm: atmosphere.storm, wind, dark: atmosphere.dark });
    this.parts.update(dt, wind, this.time);
    const alpha = 1 - Math.exp(-dt * 3);
    if (v.level !== null) this.level += (v.level - this.level) * alpha;
    this.tank += (v.tank - this.tank) * alpha;
    for (const [mesh, level] of [
      [this.parts.gallery, this.level],
      [this.parts.tankWater, this.tank],
    ]) {
      mesh.scale.y = Math.max(0.025, level * 2.65);
      mesh.position.y = -3.58 + mesh.scale.y / 2;
    }
    const galleryMat = this.parts.gallery.material;
    galleryMat.opacity += ((v.fresh ? 0.78 : 0.27) - galleryMat.opacity) * alpha;
    this.parts.damWater.scale.y = 0.6 + Math.min(0.55, v.dam / 40);
    this.parts.damWater.position.y = -0.92 + this.parts.damWater.scale.y / 2;
    this.waterNormal.offset.set(this.time * 0.025, this.time * 0.017);
    // Hydraulic response comes only from the local simulator. With real telemetry the relay
    // command is shown, but no water movement is drawn: there is no flow measurement.
    const hydraulic = v.hydraulic && active;
    const flowing = {
      rain: hydraulic && rain > 0,
      drain: hydraulic && v.drain === "on",
      reuse: hydraulic && v.reuse === "on",
    };
    for (const r of this.ripples) {
      r.activity += ((flowing[r.source] && this.explode < 0.02 ? 1 : 0) - r.activity) * alpha;
      r.phase = (r.phase + dt * (0.22 + 0.45 * r.activity)) % 1;
      const o = EXPLODE[r.owner];
      r.ring.position.set(r.x + o[0] * this.explode, r.water.position.y + r.water.scale.y / 2 + 0.018 + o[1] * this.explode, r.z + o[2] * this.explode);
      r.ring.scale.setScalar(0.2 + r.phase);
      r.ring.material.opacity = (1 - r.phase) * 0.45 * r.activity;
      r.ring.visible = r.activity > 0.01;
    }
    this.rain.update(dt, rain, wind);
    this.streetFlows.forEach((f) => f.update(dt, flowing.rain && this.city.visible));
    // Highlighted pipes: the current stage of "follow the water", the cut, or the selected connections.
    const cut = new Set([].concat(view.stage || []));
    if (view.cut) CUT_STAGES.forEach((s) => cut.add(s));
    const conn =
      view.connections === "all"
        ? { pipes: this.network.pipes.map((p) => p.id), cables: this.network.cables.map((c) => c.id) }
        : view.connections
          ? CONNECTIONS[view.connections]
          : null;
    this.network.update(dt, {
      time: this.time,
      hydraulic: v.hydraulic,
      flow: flowing,
      cut,
      cutIds: new Set(conn ? conn.pipes : []),
      highlight: new Set(conn ? conn.cables : []),
      explode: this.explode,
      galleryTop: waterTop(this.level),
      reservoirTop: -3.58 + this.parts.tankWater.scale.y,
      damTop: -0.92 + this.parts.damWater.scale.y,
      pulse: view.pulse || view.selected === "sensor",
      sensorState: v.sensorState,
      relays: { drain: v.drain === "on", reuse: v.reuse === "on" },
      esp: v.fresh,
      doorOpen: view.door || view.selected === "control" || view.connections === "control",
    });
    for (const p of this.parts.pumps) {
      const state = v[p.key],
        on = hydraulic && state === "on";
      // Rotors turn only with simulated hydraulic response; a relay command alone does not prove rotation.
      p.speed += ((on ? 1 : 0) - p.speed) * (1 - Math.exp(-dt * 1.8));
      p.rotor.rotation.x += dt * 9 * p.speed;
      const color = PUMP_COLORS[state] ?? PUMP_COLORS.off;
      p.light.material.color.setHex(color);
      p.light.material.emissive.setHex(color);
      p.light.material.emissiveIntensity =
        state === "on" ? 0.8 + 0.35 * Math.sin(this.time * 5) : state === "blocked" ? 0.5 + 0.5 * Math.sin(this.time * 9) : 0.08;
    }
    if (this.shadowsDirty && this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowsDirty = false;
    }
    this.renderer.render(this.scene, this.camera);
    // Auto quality: drop to low if frames stay slow (ignores the first frames, while shaders warm up).
    if (this.quality === "auto" && this.qualityTier !== "low") {
      if (this.warmup > 0) this.warmup--;
      else {
        this.samples++;
        this.slow += dt;
        if (this.samples >= 180) {
          if (this.slow / this.samples > 0.033) {
            this.setQuality("low");
            this.quality = "auto";
          }
          this.samples = 0;
          this.slow = 0;
        }
      }
    }
  }
  project(point) {
    const p = new T.Vector3(...point).project(this.camera);
    return {
      x: ((p.x + 1) / 2) * this.host.clientWidth,
      y: ((1 - p.y) / 2) * this.host.clientHeight,
      visible: p.z < 1 && Math.abs(p.x) < 0.98 && Math.abs(p.y) < 0.95,
    };
  }
  dispose() {
    this.resizeObserver.disconnect();
    this.cameraController.dispose();
    this.renderer.domElement.removeEventListener("pointerdown", this.onDown);
    this.renderer.domElement.removeEventListener("pointerup", this.onUp);
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    this.scene.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material)
        [].concat(o.material).forEach((m) => {
          materials.add(m);
          for (const k of ["map", "emissiveMap", "normalMap"]) if (m[k]) textures.add(m[k]);
        });
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }
}
