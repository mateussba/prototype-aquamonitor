import * as T from "three";
// Procedural canvas textures: generated at runtime, so the build stays offline and asset-free.
const cache = new Map();
function hash(s) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function make(key, size, draw, { color = true, repeat = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d"), size, rng(hash(key)));
  const t = new T.CanvasTexture(canvas);
  if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
  if (color) t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}
function speckle(g, s, r, n, colors, max) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(r() * colors.length) | 0];
    const w = 0.6 + r() * max;
    g.fillRect(r() * s, r() * s, w, w);
  }
}
export const asphalt = () =>
  make("asphalt", 256, (g, s, r) => {
    g.fillStyle = "#717b79";
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 7; i++) {
      g.fillStyle = `rgba(52,60,60,${0.05 + r() * 0.07})`;
      g.beginPath();
      g.ellipse(r() * s, r() * s, 12 + r() * 40, 6 + r() * 18, r() * 3, 0, 7);
      g.fill();
    }
    speckle(g, s, r, 3200, ["rgba(38,46,46,.35)", "rgba(160,166,160,.32)", "rgba(92,100,98,.45)"], 2.2);
  });
export const paving = () =>
  make("paving", 256, (g, s, r) => {
    g.fillStyle = "#b9bab0";
    g.fillRect(0, 0, s, s);
    const n = 4,
      c = s / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = (212 + r() * 22) | 0;
        g.fillStyle = `rgb(${v},${v},${v - 8})`;
        g.fillRect(x * c + 2, y * c + 2, c - 4, c - 4);
      }
    speckle(g, s, r, 1400, ["rgba(120,122,110,.2)", "rgba(255,255,255,.3)"], 1.6);
  });
export const grass = () =>
  make("grass", 256, (g, s, r) => {
    g.fillStyle = "#9cb48d";
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? "120,150,105" : "176,196,150"},${0.12 + r() * 0.12})`;
      g.beginPath();
      g.arc(r() * s, r() * s, 14 + r() * 30, 0, 7);
      g.fill();
    }
    const blades = ["#86a276", "#b2c89f", "#7c9870", "#a5bd93"];
    for (let i = 0; i < 2600; i++) {
      g.strokeStyle = blades[(r() * blades.length) | 0];
      g.lineWidth = 1;
      const x = r() * s,
        y = r() * s;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4);
      g.stroke();
    }
  });
// 4 bays x 4 floors. The wall is near white so the material color tints each building.
function drawFacade(g, s, r, kind, lit) {
  const cells = 4,
    c = s / cells;
  g.fillStyle = lit ? "#000" : "#f7f6f2";
  g.fillRect(0, 0, s, s);
  for (let fy = 0; fy < cells; fy++)
    for (let fx = 0; fx < cells; fx++) {
      const x0 = fx * c,
        y0 = fy * c;
      const [wx, wy, ww, wh] =
        kind === "apt" ? [x0 + 18, y0 + 16, c - 36, c - 42] : [x0 + 34, y0 + 26, c - 68, c - 54];
      if (lit) {
        if (r() < 0.5) {
          g.fillStyle = r() < 0.5 ? "#ffd49a" : "#ffe8c2";
          g.fillRect(wx + 3, wy + 3, ww - 6, wh - 6);
        }
        continue;
      }
      if (kind === "apt") {
        g.fillStyle = "#e0ded5";
        g.fillRect(x0, y0 + c - 9, c, 9);
      }
      if (kind === "house") {
        g.fillStyle = "#cdd3ca";
        g.fillRect(wx - 16, wy - 3, 11, wh + 6);
        g.fillRect(wx + ww + 5, wy - 3, 11, wh + 6);
      }
      g.fillStyle = "#ffffff";
      g.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
      const grad = g.createLinearGradient(wx, wy, wx, wy + wh);
      grad.addColorStop(0, "#86a4aa");
      grad.addColorStop(1, "#3e5a60");
      g.fillStyle = grad;
      g.fillRect(wx + 1, wy + 1, ww - 2, wh - 2);
      g.fillStyle = "rgba(255,255,255,.2)";
      g.beginPath();
      g.moveTo(wx + 1, wy + wh * 0.72);
      g.lineTo(wx + ww * 0.45, wy + 1);
      g.lineTo(wx + ww * 0.7, wy + 1);
      g.lineTo(wx + 1, wy + wh - 1);
      g.fill();
      if (r() < 0.4) {
        g.fillStyle = "rgba(238,232,216,.9)";
        g.fillRect(wx + 1, wy + 1, ww - 2, (wh - 2) * (0.2 + r() * 0.45));
      }
      g.fillStyle = "#f3f3ef";
      g.fillRect(wx + ww / 2 - 2, wy, 4, wh);
      g.fillStyle = "#d4d2c8";
      g.fillRect(wx - 8, wy + wh + 4, ww + 16, 6);
    }
}
export const facade = (kind) => make("facade-" + kind, 512, (g, s, r) => drawFacade(g, s, r, kind, false));
export const facadeLit = (kind) => make("facade-lit-" + kind, 512, (g, s, r) => drawFacade(g, s, r, kind, true));
export const roofTiles = () =>
  make("roof", 256, (g, s, r) => {
    g.fillStyle = "#d8d8d6";
    g.fillRect(0, 0, s, s);
    const rows = 8,
      h = s / rows;
    for (let y = 0; y < rows; y++) {
      const off = (y % 2) * 16;
      for (let x = -32; x < s; x += 32) {
        const v = (208 + r() * 40) | 0;
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x + off + 1, y * h + 1, 30, h - 2);
      }
      g.fillStyle = "rgba(0,0,0,.24)";
      g.fillRect(0, y * h + h - 5, s, 5);
    }
  });
export const concrete = () =>
  make("concrete", 256, (g, s, r) => {
    g.fillStyle = "#d3d6d0";
    g.fillRect(0, 0, s, s);
    speckle(g, s, r, 3000, ["rgba(120,125,118,.18)", "rgba(255,255,255,.25)", "rgba(150,155,148,.2)"], 1.8);
    g.strokeStyle = "rgba(110,115,108,.28)";
    g.lineWidth = 2;
    g.strokeRect(1, 1, s - 2, s - 2);
    g.fillStyle = "rgba(100,105,98,.3)";
    for (const x of [s * 0.25, s * 0.75])
      for (const y of [s * 0.25, s * 0.75]) {
        g.beginPath();
        g.arc(x, y, 2.5, 0, 7);
        g.fill();
      }
  });
// Soil cross-section: top of the canvas is the surface (v = 1).
export const soilStrata = () =>
  make("soil", 256, (g, s, r) => {
    const bands = [
      [0, 0.07, "#6f5b45"],
      [0.07, 0.33, "#a68d6c"],
      [0.33, 0.67, "#bcaa8b"],
      [0.67, 1, "#9b8b72"],
    ];
    for (const [a, b, c] of bands) {
      g.fillStyle = c;
      g.fillRect(0, a * s, s, (b - a) * s + 1);
    }
    for (let i = 1; i < bands.length; i++) {
      g.fillStyle = bands[i - 1][2];
      const y = bands[i][0] * s;
      for (let x = 0; x < s; x += 6) {
        g.beginPath();
        g.ellipse(x, y + Math.sin(x * 0.07 + i) * 2, 5, 2 + r() * 3, 0, 0, 7);
        g.fill();
      }
    }
    for (let i = 0; i < 260; i++) {
      const y = s * (0.34 + r() * 0.66),
        deep = y > s * 0.67;
      if (!deep && r() < 0.6) continue;
      const v = (deep ? 120 : 150) + r() * 50;
      g.fillStyle = `rgb(${v | 0},${(v * 0.95) | 0},${(v * 0.86) | 0})`;
      g.beginPath();
      g.ellipse(r() * s, y, 1.5 + r() * (deep ? 5 : 3), 1 + r() * 3, r() * 3, 0, 7);
      g.fill();
    }
    speckle(g, s, r, 1800, ["rgba(60,45,30,.15)", "rgba(255,245,225,.15)"], 1.5);
  });
// Tileable normal map from integer-frequency waves.
export const waterNormal = () =>
  make(
    "water-normal",
    128,
    (g, s) => {
      const img = g.createImageData(s, s);
      const waves = [
        [1, 2, 3, 0],
        [3, 1, 2, 1.3],
        [2, -3, 1.6, 2.1],
        [5, 4, 0.8, 0.7],
        [-4, 6, 0.7, 2.9],
      ];
      for (let y = 0; y < s; y++)
        for (let x = 0; x < s; x++) {
          let dx = 0,
            dy = 0;
          for (const [kx, ky, a, ph] of waves) {
            const c = Math.cos((2 * Math.PI * (kx * x + ky * y)) / s + ph) * a * ((2 * Math.PI) / s);
            dx += kx * c;
            dy += ky * c;
          }
          const len = Math.hypot(dx, dy, 1),
            i = (y * s + x) * 4;
          img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
          img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
          img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
          img.data[i + 3] = 255;
        }
      g.putImageData(img, 0, 0);
    },
    { color: false },
  );
export const blobShadow = () =>
  make(
    "blob",
    64,
    (g, s) => {
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, "rgba(20,30,28,.55)");
      grad.addColorStop(0.6, "rgba(20,30,28,.25)");
      grad.addColorStop(1, "rgba(20,30,28,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    },
    { repeat: false },
  );
