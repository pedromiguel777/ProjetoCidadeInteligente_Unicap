import * as THREE from "three";

const MAX_PARTICLES = 420;
const LIFT = 24;
const STOPS = [-130, 0, 130].flatMap((x) => [-130, 0, 130].map((z) => ({ x, z })));

const COLORS = {
  kinetic: 0x63ffc8,
  solar: 0xffdf8a,
  brake: 0xff9a5c,
  biogas: 0xc9ff86,
  reuse: 0x8fd8ff,
};

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.32, "rgba(255,255,255,0.62)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function bezier(from, to, lift) {
  const start = new THREE.Vector3(from.x, from.y, from.z);
  const end = new THREE.Vector3(to.x, to.y, to.z);
  const control = new THREE.Vector3(
    (start.x + end.x) / 2,
    Math.max(start.y, end.y) + lift,
    (start.z + end.z) / 2,
  );
  return new THREE.QuadraticBezierCurve3(start, control, end).getPoints(26);
}

function lineSegments(paths) {
  const positions = [];
  for (const path of paths) {
    for (let i = 1; i < path.length; i += 1) {
      positions.push(path[i - 1].x, path[i - 1].y, path[i - 1].z);
      positions.push(path[i].x, path[i].y, path[i].z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x4fe8d2,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  return new THREE.LineSegments(geometry, material);
}

export function createEnergyView(scene, { city, npcs }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const data = city.energy;
  const hub = new THREE.Vector3(data.hub.x, data.hub.y, data.hub.z);
  const nodes = data.nodes.map((node) => new THREE.Vector3(node.x, 0.44, node.z));
  const nodesByBlock = new Map();
  data.nodes.forEach((node, index) => nodesByBlock.set(`${node.cx},${node.cz}`, nodes[index]));
  const roofs = data.roofs.map((roof) => new THREE.Vector3(roof.x, roof.y, roof.z));
  const digesters = data.digesters.map((digester) => new THREE.Vector3(digester.x, digester.y, digester.z));
  const arcs = nodes.map((node) => bezier(node, hub, LIFT));
  const reuseTargets = roofs.filter((_, index) => index % 4 === 0);
  const reuseArcs = reuseTargets.map((target) => bezier(hub, target, LIFT * 0.7));
  const vehicles = [...(city.dynamics?.buses ?? []), ...(city.dynamics?.trams ?? [])];
  const robots = city.dynamics?.robots ?? [];

  group.add(lineSegments([...arcs, ...reuseArcs]));

  const ringGeometry = new THREE.RingGeometry(1.5, 2.4, 24);
  ringGeometry.rotateX(-Math.PI / 2);
  const nodeMaterial = new THREE.MeshBasicMaterial({
    color: 0x4fffd0,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const nodeRings = new THREE.InstancedMesh(ringGeometry, nodeMaterial, nodes.length);
  nodes.forEach((node, index) => {
    nodeRings.setMatrixAt(
      index,
      new THREE.Matrix4().compose(
        new THREE.Vector3(node.x, 0.34, node.z),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1),
      ),
    );
  });
  nodeRings.instanceMatrix.needsUpdate = true;
  group.add(nodeRings);

  const hubRings = [7, 10.5, 14].map((radius) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.3, 6, 44),
      new THREE.MeshBasicMaterial({
        color: 0x7cf3e6,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(hub.x, hub.y - 2.2, hub.z);
    group.add(ring);
    return ring;
  });

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 2.6, 46, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x7cf3e6,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  beam.position.set(hub.x, hub.y + 20, hub.z);
  group.add(beam);

  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setDrawRange(0, 0);
  const material = new THREE.PointsMaterial({
    size: 4.2,
    map: glowTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  group.add(points);

  const particles = [];
  const sample = new THREE.Vector3();

  function spawn(path, color, speed) {
    const lengths = [];
    let total = 0;
    for (let i = 1; i < path.length; i += 1) {
      const length = path[i].distanceTo(path[i - 1]);
      lengths.push(length);
      total += length;
    }
    if (total < 0.5) return;
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({ path, lengths, total, distance: 0, speed, color: new THREE.Color(color) });
  }

  function positionAt(particle) {
    let distance = particle.distance;
    for (let i = 0; i < particle.lengths.length; i += 1) {
      const length = particle.lengths[i];
      if (distance <= length || i === particle.lengths.length - 1) {
        const t = length > 0 ? Math.min(1, distance / length) : 1;
        return sample.copy(particle.path[i]).lerp(particle.path[i + 1], t);
      }
      distance -= length;
    }
    return sample.copy(particle.path[particle.path.length - 1]);
  }

  function nodeForBlock(cx, cz) {
    return nodesByBlock.get(`${cx},${cz}`) ?? nodes[0];
  }

  function brakingAt(position) {
    let best = Infinity;
    for (const stop of STOPS) {
      const distance = Math.hypot(position.x - stop.x, position.z - stop.z);
      if (distance < best) best = distance;
    }
    return Math.max(0, 1 - best / 45);
  }

  const stats = {
    kineticKW: 0,
    solarKW: 0,
    brakeKW: 0,
    biogasKW: 0,
    reuseKW: 0,
    soc: 0.76,
    walkers: 0,
    capturedKWh: 0,
    reusedKWh: 0,
  };

  let footClock = 0;
  let arcClock = 0;
  let solarClock = 0;
  let brakeClock = 0;
  let bioClock = 0;
  let reuseClock = 0;
  let statsClock = 0;
  let brakeFactor = 0;

  const el = (id) => document.getElementById(id);
  const kineticEl = el("energy-kinetic");
  const solarEl = el("energy-solar");
  const brakeEl = el("energy-brake");
  const biogasEl = el("energy-biogas");
  const reuseEl = el("energy-reuse");
  const socEl = el("energy-soc");
  const socBarEl = el("energy-soc-bar");
  const capturedEl = el("energy-captured");
  const reusedEl = el("energy-reused");
  const walkersEl = el("energy-walkers");

  function writeStats() {
    const fmt = (value, digits = 1) =>
      value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (kineticEl) kineticEl.textContent = `${fmt(stats.kineticKW)} kW`;
    if (solarEl) solarEl.textContent = `${fmt(stats.solarKW, 0)} kW`;
    if (brakeEl) brakeEl.textContent = `${fmt(stats.brakeKW)} kW`;
    if (biogasEl) biogasEl.textContent = `${fmt(stats.biogasKW)} kW`;
    if (reuseEl) reuseEl.textContent = `${fmt(stats.reuseKW, 0)} kW`;
    if (socEl) socEl.textContent = `${Math.round(stats.soc * 100)} %`;
    if (socBarEl) socBarEl.style.width = `${Math.round(stats.soc * 100)}%`;
    if (capturedEl) capturedEl.textContent = `${fmt(stats.capturedKWh, 2)} kWh`;
    if (reusedEl) reusedEl.textContent = `${fmt(stats.reusedKWh, 2)} kWh`;
    if (walkersEl) walkersEl.textContent = String(stats.walkers);
  }

  function update(dt, t) {
    if (!group.visible) return;

    const activity = npcs.activity();
    const walkers = activity.positions;
    stats.walkers = activity.walking;

    footClock += dt * activity.walking * 0.7;
    while (footClock >= 1 && walkers.length) {
      footClock -= 1;
      const walker = walkers[Math.floor(Math.random() * walkers.length)];
      const node = nodeForBlock(walker.cx, walker.cz);
      spawn(
        [new THREE.Vector3(walker.x, 0.42, walker.z), node.clone()],
        COLORS.kinetic,
        26,
      );
    }

    arcClock += dt * 2.8;
    while (arcClock >= 1) {
      arcClock -= 1;
      spawn(arcs[Math.floor(Math.random() * arcs.length)], COLORS.kinetic, 30);
    }

    solarClock += dt * 2.8;
    while (solarClock >= 1) {
      solarClock -= 1;
      const target = roofs[Math.floor(Math.random() * roofs.length)];
      if (target) spawn(bezier(target, hub, LIFT * 0.8), COLORS.solar, 34);
    }

    brakeFactor = 0;
    for (const vehicle of vehicles) {
      brakeFactor = Math.max(brakeFactor, brakingAt(vehicle.position));
    }
    brakeClock += dt * (1.1 + brakeFactor * 3);
    while (brakeClock >= 1) {
      brakeClock -= 1;
      const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
      if (!vehicle) break;
      const from = new THREE.Vector3(vehicle.position.x, 2.6, vehicle.position.z);
      spawn(bezier(from, hub, LIFT), COLORS.brake, 30);
    }

    bioClock += dt * 1.6;
    while (bioClock >= 1) {
      bioClock -= 1;
      const useRobot = robots.length > 0 && Math.random() < 0.55;
      const source = useRobot
        ? robots[Math.floor(Math.random() * robots.length)].position
        : digesters[Math.floor(Math.random() * digesters.length)];
      if (!source) continue;
      const from = new THREE.Vector3(source.x, useRobot ? 1.2 : 1.4, source.z);
      spawn(bezier(from, hub, 16), COLORS.biogas, 26);
    }

    reuseClock += dt * 2.6;
    while (reuseClock >= 1) {
      reuseClock -= 1;
      const target = reuseTargets[Math.floor(Math.random() * reuseTargets.length)];
      if (target) spawn(bezier(hub, target, LIFT * 0.7), COLORS.reuse, 34);
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.distance += particle.speed * dt;
      if (particle.distance >= particle.total) particles.splice(i, 1);
    }

    let count = 0;
    for (const particle of particles) {
      const position = positionAt(particle);
      positions[count * 3] = position.x;
      positions[count * 3 + 1] = position.y;
      positions[count * 3 + 2] = position.z;
      colors[count * 3] = particle.color.r;
      colors[count * 3 + 1] = particle.color.g;
      colors[count * 3 + 2] = particle.color.b;
      count += 1;
    }
    geometry.setDrawRange(0, count);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;

    hubRings.forEach((ring, index) => {
      const phase = (t * 0.32 + index * 0.34) % 1;
      ring.scale.setScalar(0.7 + phase * 0.6);
      ring.material.opacity = 0.36 * (1 - phase);
    });
    beam.material.opacity = 0.1 + Math.sin(t * 1.4) * 0.03;

    stats.kineticKW = activity.walking * 0.024;
    stats.solarKW = 386 + Math.sin(t * 0.13) * 22;
    stats.brakeKW = 7 + brakeFactor * 26;
    stats.biogasKW = 30 + robots.length * 3.2;
    const total = stats.kineticKW + stats.solarKW + stats.brakeKW + stats.biogasKW;
    stats.reuseKW = total * 0.74;
    stats.soc = Math.min(0.94, 0.7 + Math.sin(t * 0.06) * 0.07 + (activity.walking / 96) * 0.05);
    stats.capturedKWh += (total * dt) / 3600;
    stats.reusedKWh += (stats.reuseKW * dt) / 3600;

    statsClock += dt;
    if (statsClock > 0.2) {
      statsClock = 0;
      writeStats();
    }
  }

  return {
    group,
    setActive(value) {
      group.visible = value;
      if (value) writeStats();
    },
    get active() {
      return group.visible;
    },
    update,
    snapshot() {
      return {
        active: group.visible,
        particles: particles.length,
        nodes: nodes.length,
        roofs: roofs.length,
        arcs: arcs.length,
        stats: { ...stats },
      };
    },
  };
}
