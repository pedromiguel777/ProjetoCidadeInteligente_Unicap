import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { WALK_OFFSET, WALK_SURFACE } from "./city.js";

const COL = [-195, -65, 65, 195];
const ROW = [-195, -65, 65, 195];

const MODEL_COUNT = 5;
const MODEL_URL = (index) => `${import.meta.env.BASE_URL}npcs/npc_${index}.glb`;
const FALLBACK_STRIDE = 1.45;
const FADE = 0.22;

const PERIMETER = (npc) => 8 * npc.half;

function squarePoint(cx, cz, half, u) {
  const t = ((u % 1) + 1) % 1;
  const side = 2 * half;
  let d = t * 4 * side;
  if (d < side) return { x: cx - half + d, z: cz - half, dx: 1, dz: 0 };
  d -= side;
  if (d < side) return { x: cx + half, z: cz - half + d, dx: 0, dz: 1 };
  d -= side;
  if (d < side) return { x: cx + half - d, z: cz + half, dx: -1, dz: 0 };
  d -= side;
  return { x: cx - half, z: cz + half - d, dx: 0, dz: -1 };
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const NEXT_STATE = ["walk", "walk", "walk", "walk", "walk", "walk", "idle", "idle", "chat", "chat", "wave"];

function withoutRootMotion(clip) {
  const tracks = clip.tracks.filter((track) => !track.name.startsWith("Root."));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function measureStride(template, clip) {
  if (clip.duration <= 0) return 0;
  const probe = cloneSkinned(template);
  probe.updateMatrixWorld(true);
  const mixer = new THREE.AnimationMixer(probe);
  mixer.clipAction(clip).play();
  const feet = [];
  probe.traverse((object) => {
    if (object.isBone && /^(foot|toe)/i.test(object.name)) feet.push(object);
  });
  if (!feet.length) return 0;

  const frames = 48;
  const step = clip.duration / frames;
  const track = new Float32Array(feet.length * (frames + 1) * 4);
  const point = new THREE.Vector3();
  for (let frame = 0; frame <= frames; frame += 1) {
    mixer.setTime(frame * step);
    probe.updateMatrixWorld(true);
    feet.forEach((foot, index) => {
      foot.getWorldPosition(point);
      const base = (index * (frames + 1) + frame) * 4;
      track[base] = frame * step;
      track[base + 1] = point.x;
      track[base + 2] = point.y;
      track[base + 3] = point.z;
    });
  }

  const travelSpeeds = [];
  for (let foot = 0; foot < feet.length; foot += 1) {
    let travel = 0;
    for (let frame = 1; frame <= frames; frame += 1) {
      const base = (foot * (frames + 1) + frame) * 4;
      travel += Math.hypot(track[base + 1] - track[base - 3], track[base + 3] - track[base - 1]);
    }
    if (clip.duration > 0) travelSpeeds.push(travel / clip.duration);
  }
  travelSpeeds.sort((a, b) => a - b);
  return travelSpeeds.length ? travelSpeeds[Math.floor(travelSpeeds.length / 2)] : 0;
}

export function createNpcs(scene, { count = 40 } = {}) {
  const npcs = [];
  const models = [];
  const strideByClip = new Map();
  let clips = [];
  let lodLevel = 0;
  let loadedModels = 0;

  for (let i = 0; i < count; i += 1) {
    const blockIndex = i % 16;
    const cx = COL[blockIndex % 4];
    const cz = ROW[Math.floor(blockIndex / 4)];
    npcs.push({
      cx,
      cz,
      half: WALK_OFFSET,
      progress: Math.random(),
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: 1.2,
      stride: 0,
      walkRate: 1,
      scale: 0.8 + Math.random() * 0.1,
      state: "walk",
      stateTime: 2 + Math.random() * 5,
      x: cx,
      z: cz,
      yaw: Math.random() * 6.28,
      sway: Math.random() * 6.28,
      variant: i % MODEL_COUNT,
      model: null,
      mixer: null,
      actions: null,
      action: null,
      walkKey: "walk001",
    });
  }

  function actionFor(npc, state) {
    if (!npc.actions) return null;
    if (state === "walk") return npc.actions.get(npc.walkKey) || npc.actions.get("walk") || null;
    if (state === "wave") return npc.actions.get("dance") || npc.actions.get("sad") || null;
    return npc.actions.get("idle") || npc.actions.get("sad") || null;
  }

  function play(npc, state) {
    const next = actionFor(npc, state);
    if (!next) return;
    const rate = state === "walk" ? npc.walkRate : 1;
    if (npc.action === next) {
      next.setEffectiveTimeScale(rate);
      return;
    }
    next.reset();
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(rate);
    if (state !== "walk") next.time = Math.random() * next.getClip().duration;
    next.fadeIn(FADE).play();
    if (npc.action) npc.action.fadeOut(FADE);
    npc.action = next;
  }

  function attach(npc) {
    const template = models[npc.variant];
    if (!template || npc.model || !clips.length) return;
    const model = cloneSkinned(template);
    model.scale.setScalar(npc.scale);
    model.position.set(npc.x, WALK_SURFACE, npc.z);
    model.rotation.y = npc.yaw;
    model.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = lodLevel >= 1;
        object.receiveShadow = false;
      }
    });
    scene.add(model);

    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map();
    for (const clip of clips) {
      const key = normalizeName(clip.name);
      if (!actions.has(key)) actions.set(key, mixer.clipAction(clip));
    }
    npc.model = model;
    npc.mixer = mixer;
    npc.actions = actions;
    npc.walkKey = npc.variant % 2 === 0 ? "walk001" : "walk002";
    if (!actions.has(npc.walkKey)) npc.walkKey = "walk001";
    const templateScale = template.scale.x || 1;
    const measured = strideByClip.get(npc.walkKey) ?? FALLBACK_STRIDE;
    npc.stride = measured * (npc.scale / templateScale);
    npc.speed = npc.stride * (0.86 + Math.random() * 0.12);
    npc.walkRate = npc.stride > 0.05 ? npc.speed / npc.stride : 1;
    play(npc, npc.state);
  }

  async function loadModels() {
    const loader = new GLTFLoader();
    const gltfs = await Promise.all(
      Array.from({ length: MODEL_COUNT }, (_, index) => loader.loadAsync(MODEL_URL(index + 1))),
    );
    const animated = (gltf) => gltf.animations.some((clip) => clip.tracks.some((track) => track.times.length > 2));
    const source = gltfs.find(animated) ?? gltfs[0];
    clips = source.animations.map(withoutRootMotion);
    for (const clip of clips) {
      const key = normalizeName(clip.name);
      if (!key.startsWith("walk") || strideByClip.has(key)) continue;
      const measured = measureStride(source.scene, clip);
      if (measured > 0.2 && measured < 12) strideByClip.set(key, measured);
    }

    gltfs.forEach((gltf, index) => {
      const template = gltf.scene;
      template.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = false;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material) material.roughness = Math.min(1, (material.roughness ?? 0.6) + 0.2);
        }
      });
      models[index] = template;
      loadedModels += 1;
    });

    for (const npc of npcs) attach(npc);
  }

  function nearestPartner(npc, index) {
    let best = -1;
    let bestDistance = 15;
    for (let i = 0; i < npcs.length; i += 1) {
      if (i === index) continue;
      const other = npcs[i];
      const d = Math.hypot(other.x - npc.x, other.z - npc.z);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    return best;
  }

  function nextState(npc) {
    npc.state = pick(NEXT_STATE);
    if (npc.state === "walk") {
      npc.stateTime = 3 + Math.random() * 7;
      if (Math.random() < 0.35) npc.dir *= -1;
    } else if (npc.state === "idle") {
      npc.stateTime = 2 + Math.random() * 4;
    } else if (npc.state === "chat") {
      npc.stateTime = 2.5 + Math.random() * 4;
    } else {
      npc.stateTime = 1.6 + Math.random() * 2.2;
    }
    play(npc, npc.state);
  }

  function update(dt, t) {
    const step = Math.min(dt, 0.25);

    for (let index = 0; index < npcs.length; index += 1) {
      const npc = npcs[index];
      npc.stateTime -= step;

      if (npc.state === "walk") {
        npc.progress += (npc.dir * npc.speed * step) / PERIMETER(npc);
        const point = squarePoint(npc.cx, npc.cz, npc.half, npc.progress);
        npc.x = point.x;
        npc.z = point.z;
        npc.yaw = Math.atan2(point.dx * npc.dir, point.dz * npc.dir);
      } else if (npc.state === "idle") {
        const look = npc.yaw + Math.sin(t * 0.5 + npc.sway) * 0.5;
        npc.yaw += (look - npc.yaw) * Math.min(1, step * 2.2);
      } else if (npc.state === "chat") {
        const partner = nearestPartner(npc, index);
        if (partner >= 0) {
          const other = npcs[partner];
          const target = Math.atan2(other.x - npc.x, other.z - npc.z);
          let delta = target - npc.yaw;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          npc.yaw += delta * Math.min(1, step * 3);
        }
      }

      if (npc.stateTime <= 0) nextState(npc);

      if (!npc.model) continue;
      npc.model.position.set(npc.x, WALK_SURFACE, npc.z);
      npc.model.rotation.y = npc.yaw;
      if (npc.mixer && lodLevel >= 1) npc.mixer.update(step);
    }
  }

  loadModels().catch((error) => console.warn("npcs: falha ao carregar personagens", error));

  return {
    update,
    count: npcs.length,
    setLodLevel(level) {
      lodLevel = level;
      for (const npc of npcs) {
        if (!npc.model) continue;
        npc.model.traverse((object) => {
          if (object.isMesh) object.castShadow = level >= 1;
        });
      }
    },
    degrade() {
      for (let i = 0; i < npcs.length; i += 1) {
        if (i % 2 === 0 && npcs[i].model) npcs[i].model.visible = false;
      }
    },
    activity() {
      const positions = [];
      let walking = 0;
      for (const npc of npcs) {
        if (npc.state !== "walk") continue;
        walking += 1;
        positions.push({ x: npc.x, z: npc.z, cx: npc.cx, cz: npc.cz });
      }
      return { walking, positions };
    },
    snapshot() {
      const states = {};
      for (const npc of npcs) states[npc.state] = (states[npc.state] || 0) + 1;
      const attached = npcs.filter((npc) => npc.model);
      const scales = attached.map((npc) => npc.scale);
      return {
        count: npcs.length,
        states,
        models: loadedModels,
        attached: attached.length,
        playing: attached.filter((npc) => npc.action && npc.action.isRunning()).length,
        clips: [...(npcs.find((npc) => npc.actions)?.actions.keys() ?? [])],
        scale: scales.length ? { min: Math.min(...scales), max: Math.max(...scales) } : null,
        stride: [...strideByClip.entries()].map(([key, value]) => ({ clip: key, unitsPerSecond: value })),
        walk: attached.slice(0, 5).map((npc) => ({
          clip: npc.walkKey,
          scale: npc.scale,
          stride: npc.stride,
          speed: npc.speed,
          rate: npc.walkRate,
        })),
        walking: npcs.filter((npc) => npc.state === "walk").length,
      };
    },
  };
}
