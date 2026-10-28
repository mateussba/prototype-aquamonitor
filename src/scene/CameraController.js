import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
export const views = {
  overview: { position: [25, 22, 31], target: [0, -0.3, -1] },
  city: { position: [-19, 15, 18], target: [-5, 0, -2] },
  street: { position: [-3.2, 5.2, 8.6], target: [-7, 0.2, 0.3] },
  inlet: { position: [-4.2, 0.8, 7.6], target: [-7, -0.6, 1] },
  gallery: { position: [-11.5, 1.5, 10.5], target: [-7, -1.8, 2.6] },
  sensor: { position: [-4.4, -0.7, 6.4], target: [-6.3, -1.4, 2.8] },
  control: { position: [-2.7, -0.9, 4.6], target: [-3.6, -1.25, 1.95] },
  reservoir: { position: [3.8, 0.6, 10], target: [-0.6, -2, 3] },
  drain: { position: [-1.2, -1.2, 8.2], target: [-3.8, -2.4, 3] },
  reuse: { position: [5.6, -1.2, 8.4], target: [2.4, -2.3, 3] },
  pipes: { position: [12, 4, 10], target: [5.2, -0.6, 1.4] },
  dam: { position: [15.5, 6.5, 8.5], target: [9, 0, -1.6] },
  cut: { position: [3, 7.5, 17], target: [-4.5, -1.6, 1.4] },
  explode: { position: [28, 19, 33], target: [-0.5, 0.2, 0.5] },
};
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export class CameraController {
  constructor(camera, canvas) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.rotateSpeed = 0.75;
    this.controls.zoomSpeed = 0.9;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 65;
    this.controls.maxPolarAngle = Math.PI * 0.51;
    this.controls.addEventListener("start", () => (this.tween = null));
    this.offset = new T.Vector3();
    this.spherical = new T.Spherical();
    this.go("overview", true);
  }
  // Transitions orbit around a moving target (spherical interpolation) instead of
  // cutting through the model in a straight line.
  go(key, instant = false) {
    const v = views[key] || views.overview;
    const position = new T.Vector3(...v.position),
      target = new T.Vector3(...v.target);
    if (instant) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.tween = null;
      this.controls.update();
      return;
    }
    const from = new T.Spherical().setFromVector3(this.offset.subVectors(this.camera.position, this.controls.target));
    const to = new T.Spherical().setFromVector3(this.offset.subVectors(position, target));
    let d = to.theta - from.theta;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    to.theta = from.theta + d;
    const travel = this.controls.target.distanceTo(target) + Math.abs(to.radius - from.radius) * 0.5 + Math.abs(d) * 8;
    this.tween = {
      t: 0,
      duration: Math.min(2.2, Math.max(1.1, 0.9 + travel / 25)),
      from,
      to,
      fromTarget: this.controls.target.clone(),
      toTarget: target,
      lift: Math.min(6, travel * 0.12),
    };
  }
  update(dt) {
    const tw = this.tween;
    if (tw) {
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      const e = ease(tw.t);
      this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e);
      const s = this.spherical;
      s.radius = T.MathUtils.lerp(tw.from.radius, tw.to.radius, e) + Math.sin(Math.PI * e) * tw.lift;
      s.phi = T.MathUtils.lerp(tw.from.phi, tw.to.phi, e);
      s.theta = T.MathUtils.lerp(tw.from.theta, tw.to.theta, e);
      this.camera.position.setFromSpherical(s).add(this.controls.target);
      if (tw.t >= 1) this.tween = null;
    }
    this.controls.update();
  }
  dispose() {
    this.controls.dispose();
  }
}
