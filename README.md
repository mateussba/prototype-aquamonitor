# AquaMonitor · Laboratório 3D

Protótipo Three.js real e navegável, isolado do dashboard React. Preparado para a apresentação de **29/10/2026**.

## Abrir para apresentar, inclusive sem internet

Após executar `npm ci` e `npm run build`, o build fica em `dist/`, com JavaScript, Three.js, MQTT e estilos locais, sem CDN, fontes remotas ou modelos externos.

```bash
git clone https://github.com/mateussba/prototype-aquamonitor.git
cd prototype-aquamonitor
npm ci
npm run build
./start-presentation.sh
```

Abra **http://localhost:4174**. O lançador precisa somente de Python 3 e um navegador com WebGL2. Mantenha o terminal aberto; Ctrl+C encerra. Não abra `index.html` com `file://`, pois os módulos precisam de HTTP local.

Para desenvolver (Node 22.18+ ou 24+):

```bash
npm ci
npm run dev -- --port 5174
npm test
npm run build
```

`npm ci` precisa de internet na primeira instalação. Depois, a apresentação local funciona desconectada. Para levar a outro notebook, copie `dist/` e o lançador juntos, mantendo a estrutura. Os módulos de simulação e MQTT usados pelo protótipo estão incluídos em `src/features/`; este repositório pode ser reconstruído de forma independente.

## Roteiro de apresentação

A interface tem três tarefas no topo:

- **Explorar** — simulação (chuva, alerta, reúso, falha do sensor), seleção de peças e o menu recolhido **Perspectivas**. Clicar numa peça abre o inspetor (nome, função, estado, **Ver conexões**, **Focar**); selecionar nunca move a câmera nem envia comandos.
- **Entender o sistema** — **Acompanhar a água** (percorre chuva → rua → grelhas → coletor → galeria → P01 → reservatório → P02 → barragem), **Todas as conexões**, **Corte funcional** (remove a quadra frontal e abre os tubos da entrada até o bombeamento), **Isolar seleção** (o entorno vira maquete branca opaca), **Vista explodida** (grupos afastados, linhas tracejadas nas conexões separadas, sem água entre os vãos) e **Esquema elétrico** ampliado.
- **Demonstrar** — roteiros **Ciclo normal** (9 etapas) e **Falha do sensor** (7 etapas), sempre no modo local. As etapas que dependem de nível ou acionamento esperam a condição no simulador (ex.: 20 cm para ligar P01). **Voltar** restaura o estado salvo ao entrar na etapa; **Pausar**, **Avançar** e **Reiniciar** disponíveis.

Legenda de traçados: tubo claro com pontos = gravidade; tubo azulado com setas = bombeado; cabo tracejado = sinal; pontilhado = comando; contínuo grosso = alimentação.

## Arquitetura encontrada e reutilização

O projeto original usa React 19, TypeScript e Vite. O protótipo usa JavaScript modular e Three.js direto, sem React Three Fiber. Os módulos necessários do projeto original foram incluídos neste repositório independente.

- `src/scene`: cidade procedural, corte do terreno, infraestrutura, volumes de água, chuva, partículas instanciadas e controles OrbitControls.
- `src/simulation/SimulationController.js`: adaptador sobre `src/features/simulation/engine/simulation.ts`, com o mesmo balanço de volumes e proteções.
- `src/mqtt/mqttClient.js`: reexporta o serviço e protocolo existentes em `src/features/esp32`. A aplicação abre uma conexão apenas no modo MQTT e encerra ao voltar à demonstração.
- `src/ui`: controles, inspeção, status e rótulos projetados da cena.
- `tests`: ciclo completo, conservação, proteções e integração MQTT emulada.

## Semântica fiel ao projeto existente

**Chuva → bueiros → galeria monitorada → drenagem P01 → reservatório → reúso P02 → transporte ilustrativo → barragem.**

O nível `level_cm`/`level_pct` representa a **galeria de 30 cm**, não o volume do reservatório. `drain_on` transfere da galeria para o reservatório; `reuse_on` retira água do reservatório. O destino barragem é uma extensão visual didática desse segundo circuito, não uma nova interpretação ou decisão do firmware.

O ESP32 informa `tank_full` e `tank_empty`, mas não volume contínuo do reservatório. No MQTT, o volume intermediário é uma estimativa inicial de 12,5%, integrada a taxas ilustrativas (2 L/min de entrada, 1,2 L/min de saída, capacidade didática de 40 L); as boias fixam vazio/cheio. A barragem também é estimada, nunca uma medição. Chuva não é medida pelo payload e fica desativada no MQTT.

Na demonstração, o motor original liga a drenagem em 20 cm e desliga em 12 cm; falha de sensor e reservatório cheio bloqueiam drenagem. Reservatório vazio bloqueia reúso. O modelo tem escala didática, não dimensionamento hidráulico de uma cidade.

## MQTT e Wokwi

- Broker: `wss://broker.emqx.io:8084/mqtt`.
- Telemetria: `aquamonitor/demo-29out-b741d2/telemetria`.
- Status: `aquamonitor/demo-29out-b741d2/status`.
- Wokwi documentado no projeto: https://wokwi.com/projects/478540696015596545.

Inicie o Wokwi e escolha **ESP32 · MQTT** no protótipo. O protótipo é **somente leitura**: não publica comandos, não muda `input_mode` e não disputa o controle do dashboard. O modo sensor/virtual exibido vem do ESP32. O parser original exige também `tank_full`/`tank_empty`, ausentes no exemplo simplificado do briefing.

Pacotes retidos não comprovam atualização e são descartados. Leituras válidas expiram em **6 segundos**. Desconexão, status offline ou expiração interrompem os fluxos e mostram bombas desconhecidas. O último nível pode permanecer desenhado, esmaecido e identificado como desatualizado. Sensor inválido não apresenta leitura numérica no MQTT. Alarmes e erros de validação aparecem em texto.

## Verificação e limites

- Modelagem explícita (`src/scene/Network.js`): caixas de ralo com corte local, coletor por gravidade com tirantes, travessias de parede com luva, captações com crivo, saída de P01 sobre a parede do reservatório, linha de P02 com suporte e travessia da crista, boias, HC-SR04 em suporte, quadro com ESP32 e módulo de 2 relés, cabos de sinal/comando/alimentação.
- O motor não modela acúmulo na rua nem atraso no coletor: a chuva efetiva entra direto na galeria. O acúmulo na rua é visual.
- A distância do sensor no modo local usa a referência didática da maquete (face do sensor ao fundo da galeria ≈ 33,7 cm). No MQTT são exibidos `distance_cm` e `level_cm` do firmware; a referência do firmware não é publicada.
- Pinagem do ESP32 e alimentação das bombas não estão documentadas: aparecem como “não documentadas”.
- No MQTT, relé ligado é mostrado como **comando**; não há partículas de água, rotação de rotor nem confirmação de funcionamento (não há sensor de vazão).
- A barragem como destino do reúso continua ilustrativa. O retorno por gravidade do protótipo físico (lousa) não existe no código e não foi modelado.
- Nesta rodada foram executados apenas `node --check` e `vite build` (Node limitado a 2 GB). Testes e navegador não foram executados.

- `npm test` executa os 7 testes do protótipo. Os testes do dashboard pertencem ao projeto original.
- Build de produção passou. Three.js gera um aviso de tamanho de chunk (~503 kB antes de gzip); isso não impede execução local.
- Inspeção no navegador: cena 3D, câmeras, corte subterrâneo, demonstração e bloqueio dos controles no MQTT.
- Conexão ao broker confirmada no navegador. Não havia telemetria atual do ESP32 durante a verificação; a validação ponta a ponta com Wokwi ativo permanece pendente. Testes emulados não substituem esse ensaio.
- A geometria e as taxas de fluxo são didáticas. Sem referência visual anexada além do texto, a composição foi construída proceduralmente.
- Sem benchmark de FPS em outro notebook. Use qualidade baixa caso necessário.

Antes da apresentação, inicie Wokwi, faça o nível ultrapassar 20 cm e cair abaixo de 12 cm, confira ambas as bombas e interrompa Wokwi para verificar a expiração. O modo demonstração está disponível independentemente desse ensaio.
