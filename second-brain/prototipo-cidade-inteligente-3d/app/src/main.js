import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createTextures } from "./textures.js";
import { buildCity } from "./city.js";

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

scene.add(new THREE.HemisphereLight(0xecf8ff, 0x62814f, 1.45));

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

resize();
window.addEventListener("resize", resize);

window.__cityApp = { renderer, scene, camera, controls };
window.__cityVehicles = city.vehicles;
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
    const reduced = new Set(["tree", "person", "car", "crop"]);
    scene.traverse((object) => {
      if (object.isInstancedMesh && reduced.has(object.userData.prop)) {
        object.count = Math.max(1, Math.floor(object.count * 0.45));
      }
    });
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

const clock = new THREE.Clock();
let frames = 0;
let fpsFrames = 0;
let costSum = 0;
let fpsStart = performance.now();

function tick() {
  const t = clock.getElapsedTime();
  city.update(t);
  city.setLabelsVisible(camera.zoom > 1.55);
  if (camera.zoom > 1.55 && lodLevel !== 1) {
    lodLevel = 1;
    city.setLodLevel(1);
  } else if (camera.zoom < 1.45 && lodLevel !== 0) {
    lodLevel = 0;
    city.setLodLevel(0);
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
