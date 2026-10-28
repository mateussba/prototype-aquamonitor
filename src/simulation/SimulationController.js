import {
  createInitialState,
  simulationReducer,
  alarmLabels,
} from "../features/simulation/engine/simulation.ts";
import { telemetryFresh } from "../features/esp32/mqttService.ts";
export class SimulationController {
  constructor(mqtt) {
    this.mqtt = mqtt;
    this.mode = "demo";
    this.reset();
  }
  reset() {
    this.state = createInitialState();
    this.elapsed = 0;
    this.tour = false;
    this.dam = 0;
    this.liveTank = 0.125;
    this.liveDam = 0;
  }
  dispatch(action) {
    if (this.mode === "demo")
      this.state = simulationReducer(this.state, action);
  }
  // Deterministic save/restore used by the guided demonstration ("Voltar" restores a step).
  snapshot() {
    return { state: this.state, dam: this.dam, elapsed: this.elapsed };
  }
  restore(snap) {
    if (this.mode !== "demo") return;
    this.tour = false;
    this.state = snap.state;
    this.dam = snap.dam;
    this.elapsed = snap.elapsed;
  }
  setMode(mode) {
    this.mode = mode;
    this.tour = false;
    this.liveTank = 0.125;
    this.liveDam = 0;
    if (mode === "mqtt") this.mqtt.start();
    else this.mqtt.stop();
  }
  startTour() {
    if (this.mode !== "demo") return;
    this.reset();
    this.tour = true;
    this.dispatch({ type: "speed", value: 120 });
    this.dispatch({ type: "reuse" });
    this.dispatch({ type: "rain", value: 100 });
    this.dispatch({ type: "running", value: true });
  }
  tick(dt, now = Date.now()) {
    if (this.mode === "demo") {
      if (this.state.running) {
        this.elapsed += dt;
        if (this.tour && this.elapsed > 12 && this.state.rain)
          this.dispatch({ type: "rain", value: 0 });
      }
      this.dispatch({ type: "tick", seconds: dt });
      this.dam = this.state.reusedTotal;
      if (this.tour && this.elapsed > 70) {
        this.tour = false;
        this.dispatch({ type: "running", value: false });
      }
      return this.view(now);
    }
    const snap = this.mqtt.getSnapshot();
    if (telemetryFresh(snap, now)) {
      const t = snap.telemetry;
      // Only illustrative integration. Firmware measures gallery height and tank floats, not tank volume.
      this.liveTank = Math.min(
        1,
        Math.max(
          0,
          this.liveTank +
            (dt * ((t.drain_on ? 2 : 0) - (t.reuse_on ? 1.2 : 0))) / 2400,
        ),
      );
      if (t.tank_full) this.liveTank = 1;
      if (t.tank_empty) this.liveTank = 0;
      if (t.reuse_on) this.liveDam += (dt * 1.2) / 60;
    }
    return this.view(now);
  }
  view(now = Date.now()) {
    if (this.mode === "demo") {
      const s = this.state;
      return {
        level: s.galleryLiters / 30,
        tank: s.tankLiters / s.capacityLiters,
        dam: this.dam,
        rain: s.rain / 100,
        drain: s.drainage,
        reuse: s.reuse,
        sensor: !s.sensorFault,
        fresh: true,
        alarm:
          s.alarms.map((a) => alarmLabels[a]).join(" ") ||
          (s.risk === "critical"
            ? "Risco de alagamento"
            : s.risk === "attention"
              ? "Nível em atenção"
              : ""),
        input: "Demonstração simulada",
        running: s.running,
        mode: "demo",
        hydraulic: true,
        levelCm: s.galleryLiters,
        distanceCm: null,
        sensorState: s.sensorFault ? "fault" : "valid",
        tankFull: s.tankLiters >= s.capacityLiters - 1e-9,
        tankEmpty: s.tankLiters <= 1e-9,
      };
    }
    const snap = this.mqtt.getSnapshot(),
      t = snap.telemetry,
      fresh = telemetryFresh(snap, now);
    return {
      level: t?.sensor_ok ? t.level_pct / 100 : null,
      tank: this.liveTank,
      dam: this.liveDam,
      rain: 0,
      drain: fresh ? (t.drain_on ? "on" : "off") : "unknown",
      reuse: fresh ? (t.reuse_on ? "on" : "off") : "unknown",
      sensor: fresh ? t.sensor_ok : null,
      fresh,
      alarm: fresh ? (t.alarm ? t.alarm_code : "") : "Sem telemetria atual",
      input:
        !t ? "Entrada desconhecida" : t.input_mode === "virtual"
          ? "Entrada virtual do ESP32"
          : "Sensor HC-SR04",
      running: fresh,
      mode: "mqtt",
      // No flow sensor exists: telemetry confirms relay commands, not water movement.
      hydraulic: false,
      levelCm: fresh && t.sensor_ok ? t.level_cm : null,
      distanceCm: fresh && t.sensor_ok ? t.distance_cm : null,
      sensorState: !fresh ? "unavailable" : t.sensor_ok ? "valid" : "fault",
      tankFull: fresh ? t.tank_full : null,
      tankEmpty: fresh ? t.tank_empty : null,
      connection: snap.connection,
      error: snap.error,
      receivedAt: snap.receivedAt,
    };
  }
}
