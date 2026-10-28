import { GuidedDemo } from "../demo/GuidedDemo.js";
import { STAGES, SENSOR_REF_CM } from "../scene/Network.js";

export const components = {
  city: ["Bairro urbano", "Telhados, calçadas e ruas conduzem a chuva até a sarjeta da rua em frente às galerias."],
  inlet: ["Bocas de lobo e coletor", "Três grelhas na sarjeta. Cada uma desce por uma caixa de ralo; um coletor por gravidade une as três e atravessa a parede da galeria."],
  gallery: ["Galeria de coleta", "Câmara de 0–30 cm onde a água se acumula. É o nível medido pelo sensor e usado pelo ESP32."],
  sensor: ["Sensor ultrassônico HC-SR04", "Fixado no alto da galeria, transdutores voltados para a água. Mede o tempo do eco; o ESP32 converte em distância e altura."],
  control: ["Quadro de controle", "ESP32 e módulo de 2 relés. Entradas: sensor (sinal) e boias do reservatório. Saídas: IN1 → K1 (P01) e IN2 → K2 (P02). Pinagem não documentada no projeto."],
  drain: ["Bomba de drenagem · P01", "Captação no fundo da galeria, corpo da bomba e saída até o reservatório. Comandada por K1: liga em 20 cm e desliga em 12 cm; bloqueada por falha do sensor ou reservatório cheio."],
  reservoir: ["Reservatório", "Recebe a descarga de P01. As boias informam cheio/vazio; o volume intermediário é estimado."],
  reuse: ["Bomba de reúso · P02", "Retira água do reservatório quando o reúso é solicitado. Comandada por K2; bloqueada com reservatório vazio."],
  pipes: ["Linha de transporte", "Recalque de P02 até a barragem, apoiado em suportes e passando sobre a crista. Percurso ilustrativo do circuito de reúso."],
  dam: ["Barragem de destino", "Recebe a descarga da linha de transporte. O acúmulo é estimado; não há medição da barragem na telemetria."],
};
const views = [
  ["overview", "Visão geral"],
  ["street", "Rua e grelhas"],
  ["inlet", "Entrada da drenagem"],
  ["gallery", "Galeria"],
  ["sensor", "Sensor"],
  ["control", "Quadro de controle"],
  ["drain", "Bomba P01"],
  ["reservoir", "Reservatório"],
  ["reuse", "Bomba P02"],
  ["pipes", "Linha de transporte"],
  ["dam", "Barragem"],
];
const focusView = { city: "city", inlet: "inlet", gallery: "gallery", sensor: "sensor", control: "control", drain: "drain", reservoir: "reservoir", reuse: "reuse", pipes: "pipes", dam: "dam" };

const legend = `<div class="legend" aria-label="Legenda">
<div><svg viewBox="0 0 40 10"><rect x="1" y="2" width="38" height="6" rx="3" fill="#6fd0d3"/></svg>Água acumulada</div>
<div><svg viewBox="0 0 40 10"><line x1="2" y1="5" x2="38" y2="5" stroke="#a9b5a8" stroke-width="6" stroke-linecap="round"/><circle cx="12" cy="5" r="2" fill="#2fb3b0"/><circle cx="26" cy="5" r="2" fill="#2fb3b0"/></svg>Escoamento por gravidade</div>
<div><svg viewBox="0 0 40 10"><line x1="2" y1="5" x2="38" y2="5" stroke="#6d8b98" stroke-width="6" stroke-linecap="round"/><path d="M10 2 15 5 10 8M24 2 29 5 24 8" fill="none" stroke="#9fd4ff" stroke-width="1.6"/></svg>Transporte bombeado</div>
<div><svg viewBox="0 0 40 10"><line x1="2" y1="5" x2="38" y2="5" stroke="#1f9e8f" stroke-width="2.4" stroke-dasharray="6 4"/></svg>Sinal</div>
<div><svg viewBox="0 0 40 10"><line x1="2" y1="5" x2="38" y2="5" stroke="#7a55b8" stroke-width="2.6" stroke-dasharray="0.1 4" stroke-linecap="round"/></svg>Comando</div>
<div><svg viewBox="0 0 40 10"><line x1="2" y1="5" x2="38" y2="5" stroke="#c77426" stroke-width="4"/></svg>Alimentação</div>
</div>`;

const schematic = `<section id="schematic" class="schematic" hidden aria-label="Esquema elétrico ampliado">
<div class="schematic-head"><div><small>VISTA AMPLIADA · ESQUEMA DIDÁTICO, FORA DE ESCALA</small><h2>Sensor → ESP32 → relés → bombas</h2></div><button id="close-schematic" aria-label="Fechar esquema">×</button></div>
<svg viewBox="0 0 520 270" role="img" aria-label="Ligações entre sensor, ESP32, módulo de relés e bombas">
<g class="blk"><rect x="10" y="20" width="110" height="64" rx="6"/><text x="20" y="40" class="t">HC-SR04</text><text x="20" y="56">TRIG · ECHO</text><text id="sch-sensor" x="20" y="74" class="st">—</text></g>
<g class="blk"><rect x="10" y="120" width="110" height="52" rx="6"/><text x="20" y="140" class="t">Boias</text><text id="sch-floats" x="20" y="158">cheio / vazio</text></g>
<g class="blk"><rect x="160" y="30" width="110" height="140" rx="6"/><text x="172" y="52" class="t">ESP32</text><text x="172" y="70">lê o nível</text><text x="172" y="84">liga ≥ 20 cm</text><text x="172" y="98">desliga ≤ 12 cm</text><text x="172" y="156" class="mute">GPIO não documentados</text></g>
<g class="blk"><rect x="310" y="30" width="110" height="140" rx="6"/><text x="320" y="50" class="t">Módulo 2 relés</text><text x="320" y="75">IN1</text><text x="320" y="135">IN2</text><circle id="sch-led1" cx="350" cy="71" r="4"/><circle id="sch-led2" cx="350" cy="131" r="4"/><text x="372" y="62" class="mute">K1</text><text x="372" y="122" class="mute">K2</text></g>
<g class="blk"><rect x="452" y="52" width="60" height="38" rx="6"/><text x="466" y="75" class="t">P01</text></g>
<g class="blk"><rect x="452" y="112" width="60" height="38" rx="6"/><text x="466" y="135" class="t">P02</text></g>
<g class="blk"><rect x="310" y="214" width="200" height="40" rx="6"/><text x="320" y="232" class="t">Alimentação das bombas</text><text x="320" y="246" class="mute">especificação não documentada</text></g>
<path id="l-sig" class="ln sig" d="M120 52 H160"/><path class="ln sig" d="M120 146 H160"/>
<path class="ln cmd" d="M270 71 H310"/><path class="ln cmd" d="M270 131 H310"/>
<path class="ln pwr" d="M400 214 V190 H385 V71 M385 190 V131"/>
<path class="ln pwr" d="M412 71 H452 M412 131 H452"/>
<line id="sch-k1" class="ln pwr blade" x1="385" y1="71" x2="412" y2="71"/>
<line id="sch-k2" class="ln pwr blade" x1="385" y1="131" x2="412" y2="131"/>
<g id="sch-fault" class="fault" hidden><path d="M58 30 82 54M82 30 58 54"/></g>
</svg>
<p id="sch-note" class="sch-note"></p>
${legend}
</section>`;

export function layout() {
  document.querySelector("#app").innerHTML = `
<header><a class="brand" href="./" aria-label="AquaMonitor início"><svg viewBox="0 0 32 36" aria-hidden="true"><path d="M16 1C13 8 3 17 3 23a13 13 0 0 0 26 0C29 17 19 8 16 1Z" fill="currentColor"/><path d="M7 24q5-6 10 0t9 0" fill="none" stroke="#d8eee7" stroke-width="2"/></svg><span>Aqua<span class="brand-light">Monitor</span><small>LABORATÓRIO DE INFRAESTRUTURA URBANA</small></span></a>
<nav class="tasks" role="tablist" aria-label="Modo de exploração"><button role="tab" data-task="explore" aria-selected="true">Explorar</button><button role="tab" data-task="understand" aria-selected="false">Entender o sistema</button><button role="tab" data-task="demo" aria-selected="false">Demonstrar</button></nav>
<div class="header-right"><span id="connection" class="connection">● Operação local</span><div class="mode-switch" aria-label="Fonte dos dados"><button id="demo-mode" class="active" aria-pressed="true">Simulação local</button><button id="mqtt-mode" aria-pressed="false">ESP32 · MQTT</button></div><button class="icon" id="fullscreen" title="Tela cheia" aria-label="Tela cheia">⛶</button></div></header>
<main><div id="scene"></div>
<div class="scene-heading"><div class="eyebrow">AQUAMONITOR / PROTÓTIPO 3D</div><h1>O caminho da água.</h1><span id="source-badge" class="source-badge">● CENÁRIO SIMULADO · OFFLINE</span></div>
<div id="labels" aria-live="polite"></div>
<aside class="monitor" id="monitor"><div class="panel-top"><span>ESTAÇÃO DE MONITORAMENTO</span><button id="collapse-monitor" class="mini" aria-label="Recolher painel">–</button></div><div class="monitor-body"><div class="station">Galeria pluvial <span>AM–01</span></div><div class="reading"><strong id="level">26,7</strong><span>%</span></div><div class="level-track"><i id="level-bar"></i><b></b></div><div class="range-label"><span id="cm">8,0 / 30 cm</span><span>Limite</span></div><div id="risk" class="risk">Nível normal</div>
<dl><div><dt>Sensor ultrassônico</dt><dd id="sensor-state">Operacional</dd></div><div><dt>K1 → P01 · Drenagem</dt><dd id="drain-state">Desligada</dd></div><div><dt>K2 → P02 · Reúso</dt><dd id="reuse-state">Desligada</dd></div><div><dt>Boias do reservatório</dt><dd id="float-state">—</dd></div></dl><div class="destination"><span class="destination-icon">↗</span><div><small>DESTINO DO REÚSO</small><strong>Barragem</strong><span>Acúmulo ilustrativo · <b id="dam-value">0,0</b> L</span></div></div><div class="panel-foot" id="data-note">Dados simulados · escala didática</div></div></aside>
<section id="inspector" class="inspector" hidden aria-live="polite"><button id="close-inspector" aria-label="Fechar inspeção">×</button><small>COMPONENTE SELECIONADO</small><h2 id="inspect-title"></h2><p id="inspect-description"></p><div class="inspect-state"><span>Estado</span><strong id="inspect-value"></strong></div><div class="inspect-actions"><button id="inspect-connections" aria-pressed="false">Ver conexões</button><button id="inspect-focus">Focar</button><button id="inspect-schematic" hidden>Esquema ampliado</button></div></section>
${schematic}
<div id="explode-note" class="note" hidden>Vista explodida · conexões separadas só para inspeção (linhas tracejadas). Sem fluxo entre peças afastadas.</div>
<div class="dock">
<div class="panel" data-panel="explore"><div class="row"><button id="play" class="square" title="Iniciar ou pausar simulação" aria-label="Iniciar ou pausar simulação">▶</button><label class="rain-control"><span>☂ Chuva <output id="rain-value">0%</output></span><input id="rain" type="range" min="0" max="100" value="0" aria-label="Intensidade da chuva"></label><button id="storm">Simular alerta</button><button id="reuse">Solicitar reúso</button><button id="fault">Falha do sensor</button><button id="reset" class="square" title="Reiniciar simulação" aria-label="Reiniciar simulação">↺</button></div>
<div class="row sub"><div class="views"><button id="views-toggle" aria-expanded="false">◎ Perspectivas ▾</button><div id="views-menu" class="views-menu" hidden>${views.map(([k, l]) => `<button data-camera="${k}">${l}</button>`).join("")}</div></div><button id="city-toggle" aria-pressed="true">⌂ Cidade</button><label class="quality-label">Qualidade <select id="quality" aria-label="Qualidade gráfica"><option value="auto">Auto</option><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label><span class="hint">Clique numa peça para inspecionar · arraste para orbitar</span></div></div>
<div class="panel" data-panel="understand" hidden><div class="row"><button id="follow" aria-pressed="false">≈ Acompanhar a água</button><button id="all-connections" aria-pressed="false">⇄ Todas as conexões</button><button id="cut" aria-pressed="false">◫ Corte funcional</button><button id="isolate" aria-pressed="false" disabled title="Selecione um componente">◉ Isolar seleção</button><button id="explode" aria-pressed="false">⇱ Vista explodida</button><button id="open-schematic">⌁ Esquema elétrico</button></div>${legend}</div>
<div class="panel" data-panel="demo" hidden><div class="row"><div class="seg" role="radiogroup" aria-label="Roteiro"><button data-scenario="normal" aria-pressed="true">Ciclo normal</button><button data-scenario="fault" aria-pressed="false">Falha do sensor</button></div><button id="demo-start" class="primary">▶ Iniciar</button><button id="demo-back" disabled aria-label="Etapa anterior">◀ Voltar</button><button id="demo-pause" disabled>Ⅱ Pausar</button><button id="demo-next" disabled aria-label="Próxima etapa">Avançar ▶</button><button id="demo-restart" disabled aria-label="Reiniciar demonstração">↺</button></div>
<div class="step"><span id="step-count" class="eyebrow">ROTEIRO GUIADO · MODO LOCAL</span><strong id="step-title">Escolha um roteiro e inicie.</strong><p id="step-text">A demonstração usa só a simulação local; nada é enviado ao ESP32.</p><span id="step-wait" class="wait"></span></div></div>
</div>
</main><div id="error" role="alert" hidden></div>`;
}

export function bindControls(sim, scene) {
  const $ = (id) => document.getElementById(id);
  const demo = new GuidedDemo(sim);
  const format = (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const stateLabels = { on: "Ligada", off: "Desligada", blocked: "Bloqueada", unknown: "Desconhecida" };
  let task = "explore",
    follow = false,
    followIndex = 0,
    followTime = 0;

  // Selection never moves the camera and never sends anything to the hardware.
  const select = (key) => {
    if (key === "overview") key = null;
    scene.setPresentation({ selected: key, connections: scene.view.connections === "all" ? "all" : null });
    $("inspect-connections").setAttribute("aria-pressed", "false");
    $("isolate").disabled = !key;
    $("isolate").title = key ? "" : "Selecione um componente";
    if (!key) {
      $("inspector").hidden = true;
      scene.setPresentation({ isolate: false });
      $("isolate").setAttribute("aria-pressed", "false");
      return;
    }
    const [title, description] = components[key];
    $("inspect-title").textContent = title;
    $("inspect-description").textContent = description;
    $("inspect-schematic").hidden = key !== "control";
    $("inspector").hidden = false;
  };
  const goCamera = (key) => scene.cameraController.go(key);
  const toggle = (id, on) => $(id).setAttribute("aria-pressed", String(on));
  const pressed = (id) => $(id).getAttribute("aria-pressed") === "true";
  const showSchematic = (focus) => {
    $("schematic").hidden = !focus;
    $("schematic").dataset.focus = focus || "";
  };

  // Three clear tasks.
  const setTask = (next) => {
    task = next;
    document.querySelectorAll("[data-task]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.task === next)));
    document.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== next));
    if (next !== "demo" && demo.active) {
      demo.stop();
      clearPresentation();
    }
    if (next !== "understand") {
      setFollow(false);
      for (const id of ["cut", "explode", "all-connections"]) toggle(id, false);
      scene.setPresentation({ cut: false, explode: false, connections: null });
    }
  };
  const clearPresentation = () => {
    scene.setPresentation({ stage: null, connections: null, pulse: false, door: false, cut: false, explode: false, isolate: false });
    showSchematic(null);
    select(null);
  };
  document.querySelectorAll("[data-task]").forEach((b) => (b.onclick = () => setTask(b.dataset.task)));

  // Explore.
  $("views-toggle").onclick = () => {
    const open = $("views-menu").hidden;
    $("views-menu").hidden = !open;
    $("views-toggle").setAttribute("aria-expanded", String(open));
  };
  document.querySelectorAll("[data-camera]").forEach(
    (b) =>
      (b.onclick = () => {
        goCamera(b.dataset.camera);
        select(b.dataset.camera === "overview" ? null : b.dataset.camera);
        $("views-menu").hidden = true;
        $("views-toggle").setAttribute("aria-expanded", "false");
      }),
  );
  const setMode = (mode) => {
    sim.setMode(mode);
    for (const m of ["demo", "mqtt"]) {
      $(m + "-mode").classList.toggle("active", m === mode);
      $(m + "-mode").setAttribute("aria-pressed", String(m === mode));
    }
    document.querySelectorAll("[data-panel=explore] .row:first-child button,[data-panel=explore] input").forEach((el) => (el.disabled = mode === "mqtt"));
    $("source-badge").textContent = mode === "demo" ? "● CENÁRIO SIMULADO · OFFLINE" : "● TELEMETRIA ESP32 · SOMENTE LEITURA";
  };
  for (const mode of ["demo", "mqtt"])
    $(mode + "-mode").onclick = () => {
      if (mode === "mqtt" && demo.active) {
        demo.stop();
        clearPresentation();
      }
      setMode(mode);
    };
  $("play").onclick = () => sim.dispatch({ type: "running", value: !sim.state.running });
  $("rain").oninput = (e) => {
    sim.tour = false;
    sim.dispatch({ type: "rain", value: Number(e.target.value) });
    sim.dispatch({ type: "running", value: true });
  };
  $("storm").onclick = () => {
    sim.tour = false;
    sim.dispatch({ type: "speed", value: 120 });
    sim.dispatch({ type: "rain", value: 100 });
    sim.dispatch({ type: "running", value: true });
  };
  $("reuse").onclick = () => sim.dispatch({ type: "reuse" });
  $("fault").onclick = () => sim.dispatch({ type: "sensor", value: !sim.state.sensorFault });
  $("reset").onclick = () => sim.reset();
  $("quality").onchange = (e) => scene.setQuality(e.target.value);
  $("city-toggle").onclick = () => {
    scene.city.visible = !scene.city.visible;
    toggle("city-toggle", scene.city.visible);
  };

  // Inspector.
  $("close-inspector").onclick = () => select(null);
  $("inspect-focus").onclick = () => scene.view.selected && goCamera(focusView[scene.view.selected]);
  $("inspect-connections").onclick = () => {
    const on = !pressed("inspect-connections");
    toggle("inspect-connections", on);
    toggle("all-connections", false);
    scene.setPresentation({ connections: on ? scene.view.selected : null });
  };
  $("inspect-schematic").onclick = () => showSchematic("all");
  $("open-schematic").onclick = () => showSchematic($("schematic").hidden ? "all" : null);
  $("close-schematic").onclick = () => showSchematic(null);

  // Understand the system.
  const setFollow = (on) => {
    follow = on;
    toggle("follow", on);
    followIndex = 0;
    followTime = 0;
    if (!on) scene.setPresentation({ stage: null });
  };
  $("follow").onclick = () => {
    setFollow(!follow);
    if (follow) goCamera("overview");
  };
  $("all-connections").onclick = () => {
    const on = !pressed("all-connections");
    toggle("all-connections", on);
    toggle("inspect-connections", false);
    scene.setPresentation({ connections: on ? "all" : null });
  };
  $("cut").onclick = () => {
    const on = !pressed("cut");
    toggle("cut", on);
    if (on) {
      toggle("explode", false);
      scene.setPresentation({ explode: false });
      goCamera("cut");
    }
    scene.setPresentation({ cut: on });
  };
  $("isolate").onclick = () => {
    const on = !pressed("isolate");
    toggle("isolate", on);
    scene.setPresentation({ isolate: on });
  };
  $("explode").onclick = () => {
    const on = !pressed("explode");
    toggle("explode", on);
    if (on) {
      toggle("cut", false);
      scene.setPresentation({ cut: false });
    }
    scene.setPresentation({ explode: on });
    goCamera(on ? "explode" : "overview");
  };

  // Demonstrate.
  document.querySelectorAll("[data-scenario]").forEach(
    (b) =>
      (b.onclick = () => {
        demo.kind = b.dataset.scenario;
        document.querySelectorAll("[data-scenario]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (demo.active) demo.start(demo.kind);
      }),
  );
  demo.onStep = (step) => {
    scene.setPresentation({
      selected: step.focus || null,
      stage: step.stage || null,
      connections: step.connections || null,
      pulse: !!step.pulse,
      door: !!step.door,
      cut: !!step.cut,
      explode: !!step.explode,
      isolate: false,
    });
    $("inspector").hidden = true;
    showSchematic(step.schematic || null);
    goCamera(step.camera);
  };
  $("demo-start").onclick = () => {
    // The guided demonstration always runs on the local simulator.
    if (sim.mode !== "demo") setMode("demo");
    demo.start(demo.kind);
  };
  $("demo-back").onclick = () => demo.back();
  $("demo-next").onclick = () => demo.next();
  $("demo-pause").onclick = () => demo.togglePause();
  $("demo-restart").onclick = () => demo.start(demo.kind);

  $("collapse-monitor").onclick = () => {
    const collapsed = $("monitor").classList.toggle("collapsed");
    $("collapse-monitor").textContent = collapsed ? "+" : "–";
    $("collapse-monitor").setAttribute("aria-label", collapsed ? "Expandir painel" : "Recolher painel");
  };
  $("fullscreen").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      $("error").hidden = false;
      $("error").textContent = "Tela cheia indisponível neste navegador. Use F11 para apresentar.";
    }
  };

  // Contextual labels: only the selected component, the current stage and the sensor readout.
  const pool = [];
  const label = (i, text, point, cls) => {
    if (!pool[i]) {
      pool[i] = document.createElement("div");
      $("labels").append(pool[i]);
    }
    const el = pool[i];
    if (!point) return (el.hidden = true);
    const p = scene.project(point);
    el.hidden = !p.visible;
    el.className = "world-label " + (cls || "");
    if (el.textContent !== text) el.textContent = text;
    el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;
  };
  const flowText = (v, when) => {
    if (v.mode === "mqtt") return "Modo conectado: fluxo não medido";
    if (!v.running) return "Simulação pausada: sem fluxo";
    if (when === "rain") return v.rain > 0 ? "Fluxo ativo" : "Sem fluxo: não está chovendo";
    if (when === "drain") return v.drain === "on" ? "Fluxo ativo" : v.drain === "blocked" ? "Sem fluxo: P01 bloqueada" : "Sem fluxo: P01 aguarda 20 cm";
    return v.reuse === "on" ? "Fluxo ativo" : v.reuse === "blocked" ? "Sem fluxo: reservatório vazio" : "Sem fluxo: reúso não solicitado";
  };
  const sensorText = (v) => {
    if (v.sensorState === "fault") return "Falha: sem eco válido · leitura descartada";
    if (v.sensorState === "unavailable") return "Leitura indisponível · sem telemetria atual";
    if (v.mode === "mqtt")
      return `Distância medida ${format(v.distanceCm)} cm · nível ${format(v.levelCm)} cm (calculado no firmware; referência não publicada)`;
    return `Nível ${format(v.levelCm)} cm = referência ${format(SENSOR_REF_CM)} cm − distância ${format(SENSOR_REF_CM - v.levelCm)} cm · referência didática da maquete`;
  };
  const pumpState = (v, key) => {
    const s = v[key];
    if (v.mode === "mqtt")
      return s === "on" ? "Comando do relé: ligado · funcionamento não confirmado (sem medição de vazão)" : `Comando: ${stateLabels[s].toLowerCase()}`;
    return s === "on" ? (v.running ? "Simulado: em operação" : "Comando ligado · simulação pausada") : `Simulado: ${stateLabels[s].toLowerCase()}`;
  };
  const inspectValue = (key, v) => {
    if (key === "sensor" || key === "gallery") return key === "sensor" ? sensorText(v) : v.level === null ? "Sem leitura válida" : `${format(v.level * 30)} cm de 30 cm${v.fresh ? "" : " · desatualizado"}`;
    if (key === "drain" || key === "reuse") return pumpState(v, key);
    if (key === "reservoir") return `Volume estimado ${format(v.tank * 100)}% · boias: ${v.tankFull ? "cheio" : v.tankEmpty ? "vazio" : v.tankFull === null ? "sem dado" : "intermediário"}`;
    if (key === "control") return `K1 ${stateLabels[v.drain].toLowerCase()} · K2 ${stateLabels[v.reuse].toLowerCase()}${v.mode === "mqtt" ? " · estado informado pelo ESP32" : " · simulado"}`;
    if (key === "dam") return `Acúmulo ilustrativo: ${format(v.dam)} L`;
    if (key === "pipes" || key === "inlet") return flowText(v, key === "inlet" ? "rain" : "reuse");
    return v.rain > 0 && v.running ? `Chuva ${Math.round(v.rain * 100)}%` : "Sem chuva";
  };

  let last = 0;
  return {
    select,
    update(v, time) {
      demo.update(time - (this.t ?? time));
      this.t = time;
      const dt = time - (this.prev ?? time);
      this.prev = time;
      // Follow the water: highlights each stage of the implemented path in sequence.
      if (follow) {
        followTime += dt;
        if (followTime > 3.6) {
          followTime = 0;
          followIndex = (followIndex + 1) % STAGES.length;
        }
        scene.setPresentation({ stage: STAGES[followIndex].id });
      }
      // Labels.
      let i = 0;
      const sel = scene.view.selected;
      label(i++, sel ? components[sel][0] : "", sel ? scene.anchor(sel) : null, "selected");
      const parts = sel && (!demo.active || task !== "demo") ? scene.partLabels(sel) : [];
      for (let k = 0; k < 3; k++) label(i++, parts[k]?.text || "", parts[k]?.point || null, "part");
      const stage = follow ? STAGES[followIndex] : null;
      label(i++, stage ? `${followIndex + 1}/${STAGES.length} · ${stage.title} — ${stage.text} ${flowText(v, stage.when)}` : "", stage ? scene.anchor(stage.component, stage.anchor) : null, "stage");
      const pulse = (scene.view.pulse || sel === "sensor") && scene.explode < 0.02;
      label(i++, pulse ? sensorText(v) : "", pulse ? [-6.3, -1.9, 3.2] : null, "reading " + v.sensorState);
      $("explode-note").hidden = scene.explode < 0.02;

      if (time - last < 0.15) return;
      last = time;
      document.querySelector(".panel-top").dataset.fresh = String(v.fresh);
      $("level").style.opacity = v.fresh ? "1" : ".45";
      $("level").textContent = v.level === null ? "—" : format(v.level * 100);
      $("level-bar").style.width = `${(v.level || 0) * 100}%`;
      $("cm").textContent = v.level === null ? "Leitura indisponível" : `${format(v.level * 30)} / 30 cm`;
      $("sensor-state").textContent = v.sensorState === "unavailable" ? "Indisponível" : v.sensorState === "valid" ? "Leitura válida" : "Falha";
      for (const key of ["drain", "reuse"]) {
        $(key + "-state").textContent = stateLabels[v[key]] + (v.mode === "mqtt" && v[key] === "on" ? " (comando)" : "");
        $(key + "-state").className = v[key] === "on" ? "on" : "";
      }
      $("float-state").textContent = v.tankFull === null ? "Sem dado" : v.tankFull ? "Cheio" : v.tankEmpty ? "Vazio" : "Intermediário";
      $("risk").textContent = v.alarm || (v.level >= 0.6 ? "Nível em atenção" : "Nível normal");
      $("risk").className = "risk " + (v.alarm || v.level >= 0.6 ? "warning" : "");
      $("dam-value").textContent = format(v.dam);
      $("connection").textContent =
        sim.mode === "demo" ? "● Operação local" : v.fresh ? "● ESP32 transmitindo" : v.connection === "connected" ? "◌ Aguardando ESP32" : `◌ MQTT · ${v.connection}`;
      $("data-note").textContent =
        sim.mode === "demo"
          ? "Dados simulados · escala didática"
          : v.error ||
            `${v.fresh ? "Leitura atual" : v.level === null ? "Aguardando leitura válida" : "Última leitura · desatualizada"} · ${v.input}${v.receivedAt ? " · " + new Date(v.receivedAt).toLocaleTimeString("pt-BR") : ""}`;
      $("rain").value = sim.state.rain;
      $("rain-value").textContent = sim.state.rain + "%";
      $("play").textContent = sim.state.running ? "Ⅱ" : "▶";
      $("reuse").textContent = sim.state.reuseRequested ? "Encerrar reúso" : "Solicitar reúso";
      $("fault").textContent = sim.state.sensorFault ? "Restaurar sensor" : "Falha do sensor";
      if (sel) $("inspect-value").textContent = inspectValue(sel, v);

      // Schematic indicators follow the real or simulated state.
      $("sch-sensor").textContent = v.sensorState === "valid" ? `válido · ${v.levelCm === null ? "—" : format(v.levelCm) + " cm"}` : v.sensorState === "fault" ? "falha" : "indisponível";
      $("sch-sensor").setAttribute("class", "st " + v.sensorState);
      $("sch-fault").hidden = v.sensorState !== "fault";
      $("schematic").dataset.sensor = v.sensorState;
      $("sch-floats").textContent = v.tankFull === null ? "sem dado" : v.tankFull ? "cheio" : v.tankEmpty ? "vazio" : "intermediário";
      for (const [n, key] of [
        [1, "drain"],
        [2, "reuse"],
      ]) {
        const on = v[key] === "on";
        $(`sch-led${n}`).setAttribute("class", on ? "led on" : "led");
        $(`sch-k${n}`).setAttribute("y2", on ? (n === 1 ? 71 : 131) : n === 1 ? 58 : 118);
        $(`sch-k${n}`).classList.toggle("live", on);
      }
      $("sch-note").textContent =
        v.mode === "mqtt"
          ? "Estados informados pelo ESP32. Relé fechado indica comando, não vazão confirmada."
          : `Simulação local · K1 ${stateLabels[v.drain].toLowerCase()}, K2 ${stateLabels[v.reuse].toLowerCase()}. Contatos fechados alimentam as bombas; o ESP32 só comanda as entradas IN.`;

      // Demo panel.
      const st = demo.status();
      for (const id of ["demo-back", "demo-pause", "demo-restart"]) $(id).disabled = !st;
      $("demo-next").disabled = !st || !st.ready || st.last;
      $("demo-pause").textContent = st?.paused ? "▶ Continuar" : "Ⅱ Pausar";
      $("demo-start").hidden = !!st;
      if (st) {
        $("step-count").textContent = `ETAPA ${st.index + 1} DE ${st.total} · ${demo.kind === "fault" ? "FALHA DO SENSOR" : "CICLO NORMAL"} · MODO LOCAL`;
        $("step-title").textContent = st.step.title;
        $("step-text").textContent = st.step.text;
        $("step-wait").textContent = st.paused ? "Pausado" : st.wait;
        $("step-wait").className = "wait " + (st.ready ? "ok" : "");
      }
    },
  };
}
