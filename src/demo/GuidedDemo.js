// Guided demonstration driven by simulator events. Steps that depend on level or actuation
// wait for the corresponding condition in the local simulation; timers only pace reading time.
// "Voltar" restores the simulator snapshot taken when the step was entered and re-applies the step.
const level = (sim) => sim.state.galleryLiters; // 1 L per cm in the engine
const cm = (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const MIN_DWELL = 7;

const intro = {
  title: "Rua, grelhas e infraestrutura",
  text: "A rua recebe a chuva e a conduz pela sarjeta até três grelhas. Sob ela: galeria, bombas, reservatório e quadro de controle.",
  camera: "cut",
  cut: true,
  focus: "inlet",
  enter: (sim) => sim.dispatch({ type: "running", value: false }),
  ready: () => true,
};
const rain = {
  title: "Chuva e acúmulo",
  text: "A chuva escorre até as grelhas, desce pela caixa de ralo e segue por gravidade para a galeria. Na simulação, a chuva efetiva entra direto na galeria.",
  camera: "street",
  stage: ["street", "inlet"],
  enter: (sim) => {
    sim.dispatch({ type: "speed", value: 30 });
    sim.dispatch({ type: "rain", value: 100 });
    sim.dispatch({ type: "running", value: true });
  },
  ready: (sim) => level(sim) >= 14,
  wait: (sim) => `Aguardando a galeria chegar a 14 cm (agora ${cm(level(sim))} cm)`,
};
const sensor = (target) => ({
  title: "Medição do sensor",
  text: "O HC-SR04 emite um pulso, recebe o eco da superfície e o ESP32 converte o tempo em distância. Altura da água = referência − distância.",
  camera: "sensor",
  focus: "sensor",
  pulse: true,
  stage: "gallery",
  ready: (sim) => level(sim) >= target,
  wait: (sim) => `Aguardando a água subir a ${target} cm (agora ${cm(level(sim))} cm)`,
});

export const SCENARIOS = {
  normal: [
    intro,
    rain,
    sensor(18),
    {
      title: "Processamento e decisão",
      text: "A leitura chega ao ESP32 pelo cabo de sinal. A lógica liga a drenagem em 20 cm e só a desliga abaixo de 12 cm.",
      camera: "control",
      focus: "control",
      door: true,
      connections: "sensor",
      schematic: "signal",
      ready: (sim) => sim.state.drainage === "on",
      wait: (sim) => `Aguardando o nível de acionamento: 20 cm (agora ${cm(level(sim))} cm)`,
    },
    {
      title: "Acionamento do relé",
      text: "O ESP32 comanda a entrada IN1; o contato de K1 fecha o circuito de alimentação de P01. O GPIO não alimenta a bomba.",
      camera: "control",
      focus: "control",
      door: true,
      connections: "drain",
      schematic: "command",
      ready: (sim) => sim.state.drainage === "on",
    },
    {
      title: "Bombeamento P01",
      text: "P01 aspira pela captação no fundo da galeria e recalca ao reservatório. Com chuva forte (3 L/min) ela (2 L/min) não vence a entrada: o nível ainda sobe.",
      camera: "drain",
      focus: "drain",
      stage: "drain",
      enter: (sim, ctx) => (ctx.drained = sim.state.drainedTotal),
      ready: (sim, ctx) => sim.state.drainedTotal - ctx.drained >= 2,
      wait: () => "Acompanhando a transferência de 2 L para o reservatório",
    },
    {
      title: "Chegada ao reservatório",
      text: "A chuva diminui para 20% (0,6 L/min). Agora a saída de P01 supera a entrada: a galeria esvazia e o reservatório enche.",
      camera: "reservoir",
      focus: "reservoir",
      stage: ["drain", "reservoir"],
      enter: (sim) => {
        sim.dispatch({ type: "rain", value: 20 });
        sim.dispatch({ type: "speed", value: 60 });
      },
      ready: (sim) => sim.state.drainage !== "on",
      wait: (sim) => `Aguardando a galeria baixar a 12 cm (agora ${cm(level(sim))} cm)`,
    },
    {
      title: "Reúso até a barragem",
      text: "O reúso é solicitado pelo operador: K2 aciona P02, que retira água do reservatório e a leva pela linha até a barragem (destino ilustrativo).",
      camera: "pipes",
      focus: "reuse",
      connections: "reuse",
      stage: ["reuse", "dam"],
      enter: (sim, ctx) => {
        sim.dispatch({ type: "rain", value: 0 });
        if (!sim.state.reuseRequested) sim.dispatch({ type: "reuse" });
        ctx.reused = sim.state.reusedTotal;
      },
      ready: (sim, ctx) => sim.state.reusedTotal - ctx.reused >= 1,
      wait: (sim) => (sim.state.reuse === "blocked" ? "Reúso bloqueado: reservatório vazio" : "Acompanhando 1 L levado à barragem"),
    },
    {
      title: "Como as partes se relacionam",
      text: "Vista explodida: cada grupo foi afastado só para inspeção. As linhas tracejadas ligam as conexões separadas; não há água atravessando os vãos.",
      camera: "explode",
      explode: true,
      ready: () => true,
    },
  ],
  fault: [
    intro,
    rain,
    sensor(17),
    {
      title: "Falha do sensor",
      text: "Falha simulada: o pulso sai, mas não há eco válido. A leitura é descartada e nenhuma distância é exibida.",
      camera: "sensor",
      focus: "sensor",
      pulse: true,
      enter: (sim) => sim.dispatch({ type: "sensor", value: true }),
      ready: (sim) => sim.state.drainage === "blocked",
    },
    {
      title: "Proteção: drenagem bloqueada",
      text: "Sem leitura confiável, a lógica bloqueia a drenagem: K1 fica aberto e P01 não recebe comando, embora a água continue subindo.",
      camera: "control",
      focus: "control",
      door: true,
      connections: "drain",
      schematic: "command",
      enter: (sim, ctx) => (ctx.h = level(sim)),
      ready: (sim, ctx) => level(sim) >= Math.min(29, ctx.h + 3),
      wait: (sim, ctx) => `Nível subindo sem drenagem: ${cm(level(sim))} cm (aguardando ${cm(Math.min(29, ctx.h + 3))} cm)`,
    },
    {
      title: "Recuperação do sensor",
      text: "O sensor é restaurado, a leitura volta a ser válida e a lógica é reavaliada com o nível atual.",
      camera: "sensor",
      focus: "sensor",
      pulse: true,
      enter: (sim) => sim.dispatch({ type: "sensor", value: false }),
      ready: (sim) => sim.state.drainage === "on",
      wait: (sim) => `Aguardando 20 cm para religar (agora ${cm(level(sim))} cm)`,
    },
    {
      title: "Drenagem retomada",
      text: "K1 volta a acionar P01. Com a chuva reduzida a 20%, a galeria é drenada para o reservatório.",
      camera: "drain",
      focus: "drain",
      stage: ["drain", "reservoir"],
      enter: (sim, ctx) => {
        sim.dispatch({ type: "rain", value: 20 });
        sim.dispatch({ type: "speed", value: 60 });
        ctx.drained = sim.state.drainedTotal;
      },
      ready: (sim, ctx) => sim.state.drainedTotal - ctx.drained >= 3,
      wait: () => "Acompanhando a transferência de 3 L",
    },
  ],
};

export class GuidedDemo {
  constructor(sim) {
    this.sim = sim;
    this.active = false;
    this.paused = false;
    this.kind = "normal";
    this.onStep = null;
  }
  start(kind = this.kind) {
    this.kind = kind;
    this.steps = SCENARIOS[kind];
    this.sim.reset();
    this.history = [];
    this.active = true;
    this.paused = false;
    this.go(0);
  }
  go(i) {
    this.index = i;
    this.step = this.steps[i];
    this.history[i] = this.sim.snapshot();
    this.ctx = {};
    this.step.enter?.(this.sim, this.ctx);
    this.dwell = 0;
    this.ready = false;
    if (this.paused) this.hold();
    this.onStep?.(this.step, i);
  }
  hold() {
    this.resumeRunning = this.sim.state.running;
    this.sim.dispatch({ type: "running", value: false });
  }
  togglePause() {
    if (!this.active) return;
    this.paused = !this.paused;
    if (this.paused) this.hold();
    else this.sim.dispatch({ type: "running", value: this.resumeRunning });
  }
  next() {
    if (this.active && this.ready && this.index < this.steps.length - 1) this.go(this.index + 1);
  }
  back() {
    if (!this.active) return;
    const i = Math.max(0, this.index - 1);
    this.sim.restore(this.history[i]);
    this.go(i);
  }
  stop() {
    this.active = false;
    this.paused = false;
  }
  update(dt) {
    if (!this.active) return;
    this.ready = !!this.step.ready(this.sim, this.ctx);
    if (this.paused) return;
    this.dwell += dt;
    if (this.ready && this.dwell >= MIN_DWELL && this.index < this.steps.length - 1) this.go(this.index + 1);
  }
  status() {
    if (!this.active) return null;
    const last = this.index === this.steps.length - 1;
    return {
      index: this.index,
      total: this.steps.length,
      step: this.step,
      ready: this.ready,
      last,
      paused: this.paused,
      wait: !this.ready && this.step.wait ? this.step.wait(this.sim, this.ctx) : last ? "Fim da demonstração" : this.ready ? "Condição atendida" : "",
    };
  }
}
