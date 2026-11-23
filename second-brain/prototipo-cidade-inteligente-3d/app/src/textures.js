import * as THREE from "three";

let seed = 92713;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

function makeTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function speckle(ctx, width, height, count, colors, min = 1, max = 3) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.fillRect(rand() * width, rand() * height, min + rand() * (max - min), min + rand() * (max - min));
  }
}

const facadeA = makeTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = "#f2ede2";
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 2200, ["rgba(0,0,0,0.035)", "rgba(255,255,255,0.5)", "rgba(150,135,110,0.05)"], 1, 2.5);

  for (let i = 0; i < 2; i += 1) {
    const x = 54 + i * 256;
    const y = 96;
    const ww = 148;
    const wh = 278;
    ctx.fillStyle = "#3a4741";
    ctx.fillRect(x - 10, y - 10, ww + 20, wh + 20);
    const glass = ctx.createLinearGradient(x, y, x + ww, y + wh);
    glass.addColorStop(0, "#c3e4e6");
    glass.addColorStop(0.42, "#7fb8bd");
    glass.addColorStop(1, "#3d7178");
    ctx.fillStyle = glass;
    ctx.fillRect(x, y, ww, wh);
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.beginPath();
    ctx.moveTo(x + ww, y);
    ctx.lineTo(x + ww - 52, y);
    ctx.lineTo(x, y + 132);
    ctx.lineTo(x, y + 42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#eaf0eb";
    ctx.fillRect(x + ww / 2 - 3, y, 6, wh);
    ctx.fillRect(x, y + wh * 0.63, ww, 5);
    ctx.fillStyle = "#c99a5b";
    ctx.fillRect(x - 15, y + wh + 10, ww + 30, 14);
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(x - 15, y + wh + 24, ww + 30, 8);
  }

  ctx.fillStyle = "#e3ddcf";
  ctx.fillRect(0, 404, w, 12);
  ctx.fillStyle = "rgba(0,0,0,0.07)";
  ctx.fillRect(0, 416, w, 9);
});

const facadeB = makeTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = "#f7f4ec";
  ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 27) {
    ctx.fillStyle = "#c6945a";
    ctx.fillRect(x, 0, 9, h);
    ctx.fillStyle = "rgba(90,60,30,0.18)";
    ctx.fillRect(x + 9, 0, 2.5, h);
  }
  speckle(ctx, w, h, 900, ["rgba(255,255,255,0.35)", "rgba(80,60,35,0.06)"], 1, 2);

  for (let i = 0; i < 2; i += 1) {
    const x = 82 + i * 256;
    const y = 98;
    const ww = 118;
    const wh = 282;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 9, y - 9, ww + 18, wh + 18);
    const glass = ctx.createLinearGradient(x, y, x + ww, y + wh);
    glass.addColorStop(0, "#cfe8e6");
    glass.addColorStop(0.5, "#86b9b8");
    glass.addColorStop(1, "#46787a");
    ctx.fillStyle = glass;
    ctx.fillRect(x, y, ww, wh);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(x, y + wh * 0.28, ww, 6);
    ctx.fillRect(x + ww * 0.5 - 3, y, 6, wh);
    ctx.fillStyle = "#b7b1a4";
    ctx.fillRect(x - 14, y + wh + 9, ww + 28, 10);
  }

  ctx.fillStyle = "#e6e0d3";
  ctx.fillRect(0, 408, w, 14);
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(0, 422, w, 8);
});

const glass = makeTexture(512, 512, (ctx, w, h) => {
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "#a9d6da");
  base.addColorStop(1, "#5f9aa2");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const cell = 128;
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      const shade = 0.86 + rand() * 0.24;
      ctx.fillStyle = `rgba(${Math.round(120 * shade)},${Math.round(178 * shade)},${Math.round(184 * shade)},0.55)`;
      ctx.fillRect(x, y, cell, cell);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.moveTo(x + cell, y);
      ctx.lineTo(x + cell - 46, y);
      ctx.lineTo(x, y + cell - 40);
      ctx.lineTo(x, y + cell);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.strokeStyle = "#f2f6f5";
  ctx.lineWidth = 7;
  for (let x = 0; x <= w; x += cell) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
});

const paving = makeTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = "#dcd7cc";
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 3200, ["rgba(0,0,0,0.04)", "rgba(255,255,255,0.5)", "rgba(120,112,95,0.06)"], 1, 2.4);
  ctx.strokeStyle = "rgba(120,112,95,0.35)";
  ctx.lineWidth = 3;
  for (let x = 0; x <= w; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
});

const asphalt = makeTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = "#41464a";
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 9000, ["rgba(255,255,255,0.09)", "rgba(0,0,0,0.22)", "rgba(160,170,175,0.08)"], 1, 2.2);
  ctx.strokeStyle = "rgba(20,24,26,0.5)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 12; i += 1) {
    ctx.beginPath();
    let x = rand() * w;
    let y = rand() * h;
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s += 1) {
      x += (rand() - 0.5) * 60;
      y += (rand() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
});

const grass = makeTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = "#6f9d57";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(86,132,66,0.5)" : "rgba(133,178,100,0.45)";
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, 20 + rand() * 60, 14 + rand() * 44, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, w, h, 12000, ["#5b8747", "#84b366", "#729f58", "#9cc37a"], 1, 1.8);
  for (let i = 0; i < 70; i += 1) {
    ctx.fillStyle = rand() > 0.6 ? "rgba(245,246,225,0.85)" : "rgba(240,214,120,0.85)";
    ctx.fillRect(rand() * w, rand() * h, 2.2, 2.2);
  }
});

const soil = makeTexture(512, 512, (ctx, w, h) => {
  const bands = [
    ["#6f5540", 0.0, 0.18],
    ["#7d6046", 0.18, 0.34],
    ["#5f4736", 0.34, 0.52],
    ["#86674a", 0.52, 0.7],
    ["#6a4e3a", 0.7, 0.86],
    ["#59422f", 0.86, 1.0],
  ];
  bands.forEach(([color, from, to]) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, h * from, w, h * (to - from) + 1);
  });
  for (let i = 0; i < 700; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.14)";
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, 2 + rand() * 9, 1.5 + rand() * 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
});

const roof = makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = "#cfd2ca";
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 4200, ["rgba(90,96,90,0.25)", "rgba(255,255,255,0.5)", "rgba(120,126,118,0.2)"], 1, 2.2);
});

const pv = makeTexture(512, 384, (ctx, w, h) => {
  ctx.fillStyle = "#0f2036";
  ctx.fillRect(0, 0, w, h);
  const cols = 8;
  const rows = 4;
  const cw = w / cols;
  const ch = h / rows;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const shade = 0.82 + rand() * 0.3;
      ctx.fillStyle = `rgb(${Math.round(24 * shade)},${Math.round(50 * shade)},${Math.round(84 * shade)})`;
      ctx.fillRect(x * cw + 2, y * ch + 2, cw - 4, ch - 4);
    }
  }
  ctx.strokeStyle = "#3e608c";
  ctx.lineWidth = 3;
  for (let x = 0; x <= cols; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * cw, 0);
    ctx.lineTo(x * cw, h);
    ctx.stroke();
  }
  for (let y = 0; y <= rows; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * ch);
    ctx.lineTo(w, y * ch);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(214,226,238,0.55)";
  ctx.lineWidth = 1.4;
  for (let y = 0; y < rows; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * ch + ch / 2);
    ctx.lineTo(w, y * ch + ch / 2);
    ctx.stroke();
  }
  const sheen = ctx.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, "rgba(255,255,255,0.16)");
  sheen.addColorStop(0.35, "rgba(255,255,255,0.02)");
  sheen.addColorStop(1, "rgba(255,255,255,0.1)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);
});

const smartWalk = makeTexture(256, 512, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(186,240,246,0.26)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= w; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.lineWidth = 13;
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(120,255,240,0.95)";
  ctx.shadowBlur = 22;
  ctx.strokeStyle = "rgba(226,255,252,0.92)";
  for (let i = 0; i < 2; i += 1) {
    const y = 64 + i * 256;
    ctx.beginPath();
    ctx.moveTo(46, y + 74);
    ctx.lineTo(128, y);
    ctx.lineTo(210, y + 74);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
});

const telha = makeTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = "#9c5333";
  ctx.fillRect(0, 0, w, h);
  const cols = 8;
  const colW = w / cols;
  for (let i = 0; i < cols; i += 1) {
    const x = i * colW;
    const grad = ctx.createLinearGradient(x, 0, x + colW, 0);
    grad.addColorStop(0, "#7e3d24");
    grad.addColorStop(0.22, "#b26343");
    grad.addColorStop(0.55, "#cc8460");
    grad.addColorStop(0.85, "#a85a3a");
    grad.addColorStop(1, "#7e3d24");
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, colW, h);
    ctx.fillStyle = "rgba(62,26,12,0.35)";
    ctx.fillRect(x, 0, 2.5, h);
  }
  for (let y = 0; y < h; y += 64) {
    ctx.fillStyle = "rgba(58,24,10,0.16)";
    ctx.fillRect(0, y, w, 3);
    ctx.fillStyle = "rgba(255,214,180,0.12)";
    ctx.fillRect(0, y + 3, w, 2);
  }
  speckle(ctx, w, h, 1400, ["rgba(60,25,12,0.15)", "rgba(255,220,190,0.12)"], 1, 2.5);
});

const azulejo = makeTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = "#f1f5f4";
  ctx.fillRect(0, 0, w, h);
  const tile = 32;
  for (let y = 0; y < h; y += tile) {
    for (let x = 0; x < w; x += tile) {
      ctx.strokeStyle = "#c7d6dd";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
      ctx.fillStyle = "#2f5f9e";
      ctx.beginPath();
      ctx.moveTo(x + tile / 2, y + 6);
      ctx.lineTo(x + tile - 6, y + tile / 2);
      ctx.lineTo(x + tile / 2, y + tile - 6);
      ctx.lineTo(x + 6, y + tile / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#7fa8cf";
      ctx.fillRect(x + tile / 2 - 4, y + tile / 2 - 4, 8, 8);
    }
  }
});

const cobogo = makeTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = "#d9d4c6";
  ctx.fillRect(0, 0, w, h);
  for (let y = 8; y < h; y += 32) {
    for (let x = 8; x < w; x += 32) {
      ctx.fillStyle = "#3d4440";
      ctx.beginPath();
      ctx.roundRect(x, y, 16, 16, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x - 1, y - 1, 18, 2);
    }
  }
  speckle(ctx, w, h, 600, ["rgba(0,0,0,0.06)", "rgba(255,255,255,0.35)"], 1, 2);
});

export function createTextures() {
  return { facadeA, facadeB, glass, paving, asphalt, grass, soil, roof, pv, smartWalk, telha, azulejo, cobogo };
}
