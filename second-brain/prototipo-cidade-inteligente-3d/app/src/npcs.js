import * as THREE from "three";

const BLOCK = 108;
const HALF = BLOCK / 2;
const GROUND = 0.33;
const COL = [-195, -65, 65, 195];
const ROW = [-195, -65, 65, 195];

const SHIRTS = [
  "#e8734a",
  "#2f6fa8",
  "#e6c56a",
  "#f3f2ea",
  "#6b8f71",
  "#c25f7a",
  "#3f5560",
  "#8b6fb0",
  "#3aa5a0",
  "#d0604f",
];
const PANTS = ["#3f4a52", "#2f4a6b", "#6b5a48", "#232b30", "#8a8f86", "#5b4a6b"];
const SKINS = ["#e8c9a8", "#d9a878", "#b97c53", "#8a5a3b", "#f0d6bd"];

const HIP_Y = 0.62;
const SHOULDER_Y = 1.14;
const TORSO_Y = 0.95;
const HEAD_Y = 1.3;

const PERIMETER = (npc) => 8 * npc.half;

function tint(geometry, color) {
  const c = new THREE.Color(color);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

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

const NEXT_STATE = ["walk", "walk", "walk", "walk", "walk", "idle", "idle", "chat", "chat", "wave"];

export function createNpcs(scene, { count = 40 } = {}) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.84,
    metalness: 0.02,
  });

  const torsoGeometry = tint(new THREE.BoxGeometry(0.36, 0.5, 0.23), "#ffffff");
  const headGeometry = tint(new THREE.SphereGeometry(0.135, 8, 6), "#ffffff");
  const hairGeometry = tint(new THREE.SphereGeometry(0.138, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), "#ffffff");
  const armGeometry = tint(new THREE.BoxGeometry(0.1, 0.46, 0.1), "#ffffff");
  armGeometry.translate(0, -0.23, 0);
  const legGeometry = tint(new THREE.BoxGeometry(0.13, 0.58, 0.14), "#ffffff");
  legGeometry.translate(0, -0.29, 0);

  const parts = {
    torso: new THREE.InstancedMesh(torsoGeometry, material, count),
    head: new THREE.InstancedMesh(headGeometry, material, count),
    hair: new THREE.InstancedMesh(hairGeometry, material, count),
    armL: new THREE.InstancedMesh(armGeometry, material, count),
    armR: new THREE.InstancedMesh(armGeometry, material, count),
    legL: new THREE.InstancedMesh(legGeometry, material, count),
    legR: new THREE.InstancedMesh(legGeometry, material, count),
  };

  for (const mesh of Object.values(parts)) {
    mesh.frustumCulled = false;
    mesh.userData.dynamic = true;
    mesh.userData.prop = "npc";
    scene.add(mesh);
  }

  const npcs = [];
  for (let i = 0; i < count; i += 1) {
    const blockIndex = i % 16;
    const cx = COL[blockIndex % 4];
    const cz = ROW[Math.floor(blockIndex / 4)];
    const npc = {
      cx,
      cz,
      half: HALF + 1.4 + Math.random() * 2.0,
      progress: Math.random(),
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: 3.4 + Math.random() * 2.4,
      scale: 0.92 + Math.random() * 0.18,
      gait: Math.random() * 6.28,
      state: "walk",
      stateTime: 2 + Math.random() * 5,
      x: cx,
      z: cz,
      yaw: Math.random() * 6.28,
      armRaise: 0,
      sway: Math.random() * 6.28,
    };
    npcs.push(npc);

    const color = new THREE.Color(pick(SHIRTS));
    parts.torso.setColorAt(i, color);
    parts.armL.setColorAt(i, color);
    parts.armR.setColorAt(i, color);
    parts.head.setColorAt(i, new THREE.Color(pick(SKINS)));
    parts.hair.setColorAt(i, new THREE.Color(pick(["#2e2420", "#4a352a", "#1d1a1b", "#6b4a2f", "#8d8681"])));
    const pants = new THREE.Color(pick(PANTS));
    parts.legL.setColorAt(i, pants);
    parts.legR.setColorAt(i, pants);
  }
  for (const mesh of Object.values(parts)) {
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  const base = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const rotation = new THREE.Matrix4();
  const out = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();

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
    npc.state = NEXT_STATE[Math.floor(Math.random() * NEXT_STATE.length)];
    if (npc.state === "walk") {
      npc.stateTime = 3 + Math.random() * 7;
      if (Math.random() < 0.35) npc.dir *= -1;
    } else if (npc.state === "idle") {
      npc.stateTime = 1.5 + Math.random() * 3.5;
    } else if (npc.state === "chat") {
      npc.stateTime = 2.5 + Math.random() * 4;
    } else {
      npc.stateTime = 1 + Math.random() * 1.4;
    }
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
        npc.gait += step * npc.speed * 2.1;
        npc.armRaise += (0 - npc.armRaise) * Math.min(1, step * 6);
      } else if (npc.state === "idle") {
        const look = npc.yaw + Math.sin(t * 0.5 + npc.sway) * 0.5;
        npc.yaw += (look - npc.yaw) * Math.min(1, step * 2.2);
        npc.gait += (0 - npc.gait) * Math.min(1, step * 4);
        npc.armRaise += (0 - npc.armRaise) * Math.min(1, step * 6);
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
        npc.gait += (0 - npc.gait) * Math.min(1, step * 4);
        npc.armRaise += (0 - npc.armRaise) * Math.min(1, step * 6);
      } else {
        npc.gait += (0 - npc.gait) * Math.min(1, step * 4);
        npc.armRaise += (1 - npc.armRaise) * Math.min(1, step * 5);
      }

      if (npc.stateTime <= 0) nextState(npc);

      const moving = npc.state === "walk";
      const swing = moving ? Math.min(0.62, 0.34 + npc.speed * 0.05) : 0;
      const legL = Math.sin(npc.gait) * swing;
      const legR = -Math.sin(npc.gait) * swing;
      const armL = -Math.sin(npc.gait) * swing * 0.85;
      const waveSwing = npc.armRaise * (2.45 + Math.sin(t * 8 + npc.sway) * 0.32);
      const armR = moving ? Math.sin(npc.gait) * swing * 0.85 : -waveSwing;
      const bob = moving ? Math.abs(Math.sin(npc.gait)) * 0.035 : 0;
      const lean = moving ? 0.06 : 0;

      position.set(npc.x, GROUND + bob, npc.z);
      quaternion.setFromEuler(euler.set(0, npc.yaw, 0));
      scale.setScalar(npc.scale);
      base.compose(position, quaternion, scale);

      local.makeTranslation(0, TORSO_Y, 0);
      local.multiply(rotation.makeRotationX(lean));
      out.multiplyMatrices(base, local);
      parts.torso.setMatrixAt(index, out);

      local.makeTranslation(0, HEAD_Y, 0.005);
      local.multiply(rotation.makeRotationX(lean));
      out.multiplyMatrices(base, local);
      parts.head.setMatrixAt(index, out);

      local.makeTranslation(0, HEAD_Y + 0.012, 0.005);
      local.multiply(rotation.makeRotationX(lean));
      out.multiplyMatrices(base, local);
      parts.hair.setMatrixAt(index, out);

      local.makeTranslation(-0.225, SHOULDER_Y, 0).multiply(rotation.makeRotationX(armL));
      out.multiplyMatrices(base, local);
      parts.armL.setMatrixAt(index, out);

      local.makeTranslation(0.225, SHOULDER_Y, 0).multiply(rotation.makeRotationX(armR));
      out.multiplyMatrices(base, local);
      parts.armR.setMatrixAt(index, out);

      local.makeTranslation(-0.09, HIP_Y, 0).multiply(rotation.makeRotationX(legL));
      out.multiplyMatrices(base, local);
      parts.legL.setMatrixAt(index, out);

      local.makeTranslation(0.09, HIP_Y, 0).multiply(rotation.makeRotationX(legR));
      out.multiplyMatrices(base, local);
      parts.legR.setMatrixAt(index, out);
    }

    for (const mesh of Object.values(parts)) mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    update,
    count: npcs.length,
    setLodLevel(level) {
      for (const mesh of Object.values(parts)) mesh.castShadow = level >= 1;
    },
    snapshot() {
      const states = {};
      for (const npc of npcs) states[npc.state] = (states[npc.state] || 0) + 1;
      return { count: npcs.length, states };
    },
  };
}
