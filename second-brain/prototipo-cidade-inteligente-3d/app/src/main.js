import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createTextures } from "./textures.js";
import { buildCity } from "./city.js";
import { createNpcs } from "./npcs.js";
import { createEnergyView } from "./energy.js";

const canvas = document.querySelector("#scene");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
let pixelCap = Math.min(window.devicePixelRatio, 1);
renderer.setPixelRatio(pixelCap);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -4000, 8000);
camera.position.copy(new THREE.Vector3(1, 1.14, 1).normalize().multiplyScalar(1500));
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 4, 0);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minPolarAngle = 0.55;
controls.maxPolarAngle = 1.2;
controls.minZoom = 0.7;
controls.maxZoom = 6;
controls.rotateSpeed = 0.55;

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;
  const viewHeight = Math.max(700, 1130 / aspect);
  camera.left = (-viewHeight * aspect) / 2;
  camera.right = (viewHeight * aspect) / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelCap);
  renderer.setSize(width, height, false);
}

const hemi = new THREE.HemisphereLight(0xecf8ff, 0x62814f, 1.45);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2d8, 2.65);
sun.position.set(560, 800, 340);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.5;
Object.assign(sun.shadow.camera, {
  left: -430,
  right: 430,
  top: 430,
  bottom: -430,
  near: 300,
  far: 2200,
});
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun);

const fill = new THREE.DirectionalLight(0xd6ecff, 0.5);
fill.position.set(-620, 420, -620);
scene.add(fill);

const textures = createTextures();
const city = buildCity(scene, textures);
const npcs = createNpcs(scene, { count: 96 });
const energy = createEnergyView(scene, { city, npcs });

resize();
window.addEventListener("resize", resize);

window.__cityApp = { renderer, scene, camera, controls };
window.__cityVehicles = city.vehicles;
window.__cityNpcs = npcs;
window.__cityEnergy = energy;
window.__cityLod = { get level() { return lodLevel; }, count: city.lodLevels };

let qualityLevel = 0;
let lowFpsStreak = 0;
let lodLevel = 0;
const allowDegrade = new URLSearchParams(window.location.search).get("quality") !== "full";

function degradeQuality(level) {
  qualityLevel = level;
  if (level === 1) {
    renderer.shadowMap.enabled = false;
    pixelCap = Math.min(pixelCap, 1);
  } else {
    pixelCap = 0.85;
    const reduced = new Set(["tree", "person", "car", "crop", "npc"]);
    scene.traverse((object) => {
      if (object.isInstancedMesh && reduced.has(object.userData.prop)) {
        object.count = Math.max(1, Math.floor(object.count * 0.45));
      }
    });
    npcs.degrade();
  }
  scene.traverse((object) => {
    if (!object.material) return;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    list.forEach((material) => {
      material.needsUpdate = true;
    });
  });
  resize();
  window.__cityQuality = level;
}

window.__cityDegrade = degradeQuality;

const baseLights = {
  sun: sun.intensity,
  hemi: hemi.intensity,
  fill: fill.intensity,
  exposure: renderer.toneMappingExposure,
};
const energyToggle = document.getElementById("energy-toggle");
const energyLabel = document.getElementById("energy-toggle-label");
const energyPanel = document.getElementById("energy-panel");

function setEnergyMode(active) {
  energy.setActive(active);
  document.body.classList.toggle("energy-mode", active);
  scene.background = active ? new THREE.Color(0x06161c) : null;
  sun.intensity = active ? 0.85 : baseLights.sun;
  hemi.intensity = active ? 0.55 : baseLights.hemi;
  fill.intensity = active ? 0.22 : baseLights.fill;
  renderer.toneMappingExposure = active ? 1.12 : baseLights.exposure;
  if (energyToggle) energyToggle.setAttribute("aria-pressed", String(active));
  if (energyLabel) energyLabel.textContent = active ? "Voltar ao protótipo" : "Ver fluxo de energia";
  if (energyPanel) energyPanel.hidden = !active;
  window.__cityEnergyMode = active;
}

if (energyToggle) energyToggle.addEventListener("click", () => setEnergyMode(!energy.active));
window.addEventListener("keydown", (event) => {
  if (event.key === "e" || event.key === "E") setEnergyMode(!energy.active);
});
window.__citySetEnergyMode = setEnergyMode;

const SIM_HZ = 165;
const SIM_STEP = 1 / SIM_HZ;
const MAX_STEPS = 42;
window.__citySim = { hz: SIM_HZ };

const clock = new THREE.Clock();
let frames = 0;
let fpsFrames = 0;
let costSum = 0;
let fpsStart = performance.now();
let simTime = 0;
let accumulator = 0;

let previousTime = 0;

function tick() {
  const elapsed = clock.getElapsedTime();
  const frameDt = Math.min(Math.max(0, elapsed - previousTime), 0.25);
  previousTime = elapsed;
  accumulator += frameDt;
  let steps = 0;
  while (accumulator >= SIM_STEP && steps < MAX_STEPS) {
    simTime += SIM_STEP;
    npcs.update(SIM_STEP, simTime);
    accumulator -= SIM_STEP;
    steps += 1;
  }
  if (steps === MAX_STEPS) accumulator = 0;
  city.update(simTime);
  const halfWidth = (camera.right - camera.left) / (2 * camera.zoom);
  const halfHeight = (camera.top - camera.bottom) / (2 * camera.zoom);
  npcs.animate(frameDt, {
    x: controls.target.x,
    z: controls.target.z,
    radius: Math.hypot(halfWidth, halfHeight) + 6,
  });
  energy.update(frameDt, simTime);
  city.setLabelsVisible(camera.zoom > 1.55);
  if (camera.zoom > 1.55 && lodLevel !== 1) {
    lodLevel = 1;
    city.setLodLevel(1);
    npcs.setLodLevel(1);
  } else if (camera.zoom < 1.45 && lodLevel !== 0) {
    lodLevel = 0;
    city.setLodLevel(0);
    npcs.setLodLevel(0);
  }
  controls.update();
  const costStart = performance.now();
  renderer.render(scene, camera);
  costSum += performance.now() - costStart;

  frames += 1;
  fpsFrames += 1;
  const now = performance.now();
  if (now - fpsStart > 500) {
    const fps = Math.round((fpsFrames * 1000) / (now - fpsStart));
    const cost = costSum / fpsFrames;
    const readout = document.getElementById("fps");
    if (readout) readout.textContent = String(fps);
    const costReadout = document.getElementById("cost");
    if (costReadout) costReadout.textContent = cost.toFixed(1);
    fpsFrames = 0;
    costSum = 0;
    fpsStart = now;
    if (allowDegrade && qualityLevel < 2 && clock.getElapsedTime() > 2.5) {
      lowFpsStreak = fps < 34 && cost > 18 ? lowFpsStreak + 1 : 0;
      if (lowFpsStreak >= 2) {
        lowFpsStreak = 0;
        degradeQuality(qualityLevel + 1);
      }
    }
  }
  if (frames === 2) {
    window.__cityReady = true;
    window.__cityStats = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    };
  }
  requestAnimationFrame(tick);
}

tick();
