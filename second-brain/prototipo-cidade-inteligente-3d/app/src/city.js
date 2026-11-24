import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const GROUND = 0.33;
const BLOCK = 108;
const HALF = BLOCK / 2;
const COL = [-195, -65, 65, 195];
const ROW = [-195, -65, 65, 195];

const PROGRAMS = [
  ["school", "res", "res", "farm"],
  ["res", "school", "commerce", "res"],
  ["res", "commerce", "plaza", "res"],
  ["res", "res", "farm", "energy"],
];

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

function place(geometry, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  geometry.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1),
    ),
  );
  return geometry;
}

function part(geometry, color, transform) {
  return place(tint(geometry, color), transform);
}

function mergeParts(parts) {
  return mergeGeometries(
    parts.map((geometry) => (geometry.index ? geometry.toNonIndexed() : geometry)),
    false,
  );
}

const RING_CENTER = 269;

function ringPath(u, half, radius) {
  const s = half - radius;
  const straight = 2 * s;
  const arc = (Math.PI / 2) * radius;
  const total = 4 * straight + 4 * arc;
  let d = ((((u % 1) + 1) % 1) * total);
  const segments = [
    { type: "line", x0: -s, z0: half, dx: 1, dz: 0, len: straight },
    { type: "arc", cx: s, cz: s, from: Math.PI / 2, to: 0, len: arc },
    { type: "line", x0: half, z0: s, dx: 0, dz: -1, len: straight },
    { type: "arc", cx: s, cz: -s, from: 0, to: -Math.PI / 2, len: arc },
    { type: "line", x0: s, z0: -half, dx: -1, dz: 0, len: straight },
    { type: "arc", cx: -s, cz: -s, from: -Math.PI / 2, to: -Math.PI, len: arc },
    { type: "line", x0: -half, z0: -s, dx: 0, dz: 1, len: straight },
    { type: "arc", cx: -s, cz: s, from: Math.PI, to: Math.PI / 2, len: arc },
  ];
  for (const segment of segments) {
    if (d <= segment.len) {
      if (segment.type === "line") {
        return { x: segment.x0 + segment.dx * d, z: segment.z0 + segment.dz * d, tx: segment.dx, tz: segment.dz };
      }
      const phi = segment.from + (segment.to - segment.from) * (d / segment.len);
      return {
        x: segment.cx + radius * Math.cos(phi),
        z: segment.cz + radius * Math.sin(phi),
        tx: Math.sin(phi),
        tz: -Math.cos(phi),
      };
    }
    d -= segment.len;
  }
  return { x: 0, z: half, tx: 1, tz: 0 };
}

function tilePlaneUV(geometry, ru, rv) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
  uv.needsUpdate = true;
  return geometry;
}

function facadeUV(geometry, w, h, d, tileW, tileH, tileTop = 9) {
  const uv = geometry.attributes.uv;
  const reps = [
    [d / tileW, h / tileH],
    [d / tileW, h / tileH],
    [w / tileTop, d / tileTop],
    [w / tileTop, d / tileTop],
    [w / tileW, h / tileH],
    [w / tileW, h / tileH],
  ];
  for (let i = 0; i < 24; i += 1) {
    const face = Math.floor(i / 4);
    uv.setXY(i, uv.getX(i) * reps[face][0], uv.getY(i) * reps[face][1]);
  }
  uv.needsUpdate = true;
  return geometry;
}

function mergeStaticGeometry(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const collected = [];
  const isDynamic = (object) => {
    let node = object;
    while (node) {
      if (node.userData.dynamic) return true;
      node = node.parent;
    }
    return false;
  };

  root.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh) return;
    if (Array.isArray(object.material)) return;
    if (isDynamic(object)) return;
    const source = object.geometry;
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    if (!object.material.vertexColors && geometry.getAttribute("color")) {
      geometry.deleteAttribute("color");
    }
    geometry.applyMatrix4(object.matrixWorld);
    const signature = Object.keys(geometry.attributes).sort().join(",");
    const key = `${object.material.uuid}|${signature}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material: object.material, geometries: [], objects: [], cast: false, receive: false };
      buckets.set(key, bucket);
    }
    bucket.geometries.push(geometry);
    bucket.objects.push(object);
    bucket.cast = bucket.cast || object.castShadow;
    bucket.receive = bucket.receive || object.receiveShadow;
    collected.push(object);
  });

  let mergedCount = 0;
  let failedCount = 0;
  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.geometries, false);
    if (!merged) {
      failedCount += 1;
      continue;
    }
    mergedCount += 1;
    for (const object of bucket.objects) object.parent.remove(object);
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.receive;
    root.add(mesh);
  }

  let meshCount = 0;
  let instancedCount = 0;
  root.traverse((object) => {
    if (object.isInstancedMesh) instancedCount += 1;
    else if (object.isMesh) meshCount += 1;
  });
  return { buckets: buckets.size, mergedCount, failedCount, meshCount, instancedCount };
}

const TREE_TRUNK = mergeParts([
  part(new THREE.CylinderGeometry(0.26, 0.42, 3.4, 6), "#7c5a3c", { y: 1.7 }),
  part(new THREE.CylinderGeometry(0.12, 0.18, 1.7, 5), "#7c5a3c", { y: 3.6, x: 0.5, rz: 0.55 }),
  part(new THREE.CylinderGeometry(0.1, 0.16, 1.5, 5), "#7c5a3c", { y: 3.5, x: -0.45, rz: -0.6 }),
]);

const TREE_CANOPY = mergeParts([
  part(new THREE.IcosahedronGeometry(1.95, 0), "#6f9f57", { y: 4.7 }),
  part(new THREE.IcosahedronGeometry(1.45, 0), "#7cab60", { y: 6.0, x: 0.95, z: -0.4 }),
  part(new THREE.IcosahedronGeometry(1.25, 0), "#5f8f4a", { y: 5.3, x: -1.05, z: 0.7 }),
  part(new THREE.IcosahedronGeometry(1.15, 0), "#88b469", { y: 5.1, z: 1.15 }),
]);

const PERSON = mergeParts([
  part(new THREE.CapsuleGeometry(0.24, 0.72, 3, 6), "#ffffff", { y: 0.72 }),
  part(new THREE.SphereGeometry(0.18, 8, 6), "#e8c9a8", { y: 1.36 }),
]);

const BENCH = mergeParts([
  part(new THREE.BoxGeometry(2.3, 0.16, 0.62), "#c69256", { y: 0.55 }),
  part(new THREE.BoxGeometry(2.3, 0.5, 0.12), "#c69256", { y: 0.86, z: -0.26 }),
  part(new THREE.BoxGeometry(0.12, 0.55, 0.55), "#5a6260", { x: -0.95, y: 0.27 }),
  part(new THREE.BoxGeometry(0.12, 0.55, 0.55), "#5a6260", { x: 0.95, y: 0.27 }),
]);

const LAMP = mergeParts([
  part(new THREE.CylinderGeometry(0.11, 0.16, 6.4, 6), "#8d9895", { y: 3.2 }),
  part(new THREE.BoxGeometry(1.15, 0.12, 0.16), "#8d9895", { x: 0.5, y: 6.36 }),
  part(new THREE.BoxGeometry(0.95, 0.2, 0.42), "#ffe7b4", { x: 1.0, y: 6.22 }),
]);

const PANEL = new THREE.BoxGeometry(3.2, 0.1, 2.0);

const HEATER = mergeParts([
  part(new THREE.BoxGeometry(2.0, 0.1, 1.4), "#243a4d", { y: 0.62, z: 0.1 }),
  part(new THREE.BoxGeometry(2.2, 0.09, 0.1), "#b8c4c6", { y: 0.72, z: -0.62 }),
  part(new THREE.CylinderGeometry(0.32, 0.32, 1.9, 10), "#d8dcd4", { y: 1.12, z: -0.66, rz: Math.PI / 2 }),
  part(new THREE.CylinderGeometry(0.07, 0.07, 1.05, 6), "#7d8785", { x: -0.9, y: 0.4, z: 0.72 }),
  part(new THREE.CylinderGeometry(0.07, 0.07, 1.05, 6), "#7d8785", { x: 0.9, y: 0.4, z: 0.72 }),
]);

HEATER.scale(1.25, 1.25, 1.25);

const BALCONY = mergeParts([
  part(new THREE.BoxGeometry(5.2, 0.22, 1.7), "#e9e3d4", { y: 0 }),
  part(new THREE.BoxGeometry(5.2, 0.85, 0.09), "#a9cfd2", { y: 0.5, z: 0.8 }),
  part(new THREE.BoxGeometry(5.35, 0.1, 0.16), "#f6f3e9", { y: 0.95, z: 0.8 }),
]);

const CAR = mergeParts([
  part(new THREE.BoxGeometry(4.2, 0.6, 1.86), "#ffffff", { y: 0.74 }),
  part(new THREE.BoxGeometry(2.15, 0.56, 1.68), "#2b3c44", { x: -0.15, y: 1.28 }),
  part(new THREE.BoxGeometry(0.5, 0.18, 1.78), "#f4f1e4", { x: 2.02, y: 0.82 }),
  part(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10), "#22292b", { x: 1.35, y: 0.36, z: 0.92, rx: Math.PI / 2 }),
  part(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10), "#22292b", { x: 1.35, y: 0.36, z: -0.92, rx: Math.PI / 2 }),
  part(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10), "#22292b", { x: -1.4, y: 0.36, z: 0.92, rx: Math.PI / 2 }),
  part(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10), "#22292b", { x: -1.4, y: 0.36, z: -0.92, rx: Math.PI / 2 }),
]);

const CROP = tint(new THREE.IcosahedronGeometry(0.42, 0), "#ffffff");
const SHRUB = tint(new THREE.IcosahedronGeometry(0.62, 0), "#ffffff");

const TREE_TRUNK_LOW = tint(new THREE.CylinderGeometry(0.34, 0.46, 3.4, 4), "#7c5a3c");
TREE_TRUNK_LOW.translate(0, 1.7, 0);
const TREE_CANOPY_LOW = tint(new THREE.IcosahedronGeometry(2.3, 0), "#6f9f57");
TREE_CANOPY_LOW.translate(0, 5.0, 0);
const PERSON_LOW = tint(new THREE.BoxGeometry(0.46, 1.2, 0.38), "#ffffff");
PERSON_LOW.translate(0, 0.62, 0);
const CROP_LOW = tint(new THREE.BoxGeometry(0.58, 0.52, 0.58), "#ffffff");
CROP_LOW.translate(0, 0.29, 0);
const CAR_LOW = mergeParts([
  part(new THREE.BoxGeometry(4.2, 0.62, 1.86), "#ffffff", { y: 0.76 }),
  part(new THREE.BoxGeometry(2.2, 0.54, 1.68), "#2b3c44", { x: -0.2, y: 1.28 }),
  part(new THREE.BoxGeometry(4.0, 0.26, 1.94), "#22292b", { y: 0.36 }),
]);

const PEOPLE_COLORS = ["#e8734a", "#2f6fa8", "#e6c56a", "#f3f2ea", "#6b8f71", "#c25f7a", "#3f5560", "#8b6fb0"];
const CAR_COLORS = ["#f4f2ea", "#dfe4e2", "#8fb6bd", "#e2a24a", "#5a6f7a", "#c46a55", "#9fc5a0"];
const CROP_COLORS = ["#6fae56", "#7fbf63", "#5d9a4b", "#a8c46a", "#c96a4a"];

export function buildCity(scene, tex) {
  const root = new THREE.Group();
  scene.add(root);

  const stdCache = new Map();
  const std = (color, extra = {}) => {
    const key = `${color}|${JSON.stringify(extra)}`;
    if (!stdCache.has(key)) {
      stdCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.03, ...extra }));
    }
    return stdCache.get(key);
  };


  const mats = {
    facadeA: new THREE.MeshStandardMaterial({ map: tex.facadeA, roughness: 0.9 }),
    facadeB: new THREE.MeshStandardMaterial({ map: tex.facadeB, roughness: 0.9 }),
    glassFacade: new THREE.MeshStandardMaterial({ map: tex.glass, roughness: 0.3, metalness: 0.25 }),
    trim: std(0xf8f6ef),
    plinth: std(0xb59b7c),
    wood: std(0xc59457),
    roof: new THREE.MeshStandardMaterial({ map: tex.roof, roughness: 0.96 }),
    paving: new THREE.MeshStandardMaterial({ map: tex.paving, roughness: 1, metalness: 0 }),
    asphalt: new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 1, metalness: 0 }),
    grass: new THREE.MeshStandardMaterial({ map: tex.grass, roughness: 1, metalness: 0 }),
    soil: new THREE.MeshStandardMaterial({ map: tex.soil, roughness: 1, metalness: 0 }),
    field: std(0x6aa055, { roughness: 1, metalness: 0 }),
    track: std(0xb9603f, { roughness: 1, metalness: 0 }),
    bikeLane: std(0x4f8b5e, { roughness: 1, metalness: 0 }),
    pv: new THREE.MeshStandardMaterial({
      map: tex.pv,
      roughness: 0.3,
      metalness: 0.32,
      emissive: 0x081826,
      emissiveIntensity: 0.5,
    }),
    dark: std(0x39474a),
    metal: std(0xa9b3b2, { metalness: 0.6, roughness: 0.4 }),
    glassPanel: new THREE.MeshStandardMaterial({
      color: 0xdff7f6,
      transparent: true,
      opacity: 0.46,
      roughness: 0.14,
      metalness: 0.12,
      emissive: 0xa8e3e2,
      emissiveIntensity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    dome: std(0x4d6b55, { metalness: 0.25, roughness: 0.6 }),
    accent: std(0x12b5a5, { metalness: 0.2, roughness: 0.5 }),
    water: new THREE.MeshStandardMaterial({
      color: 0x5cc7d6,
      roughness: 0.08,
      metalness: 0.15,
      transparent: true,
      opacity: 0.85,
    }),
    glow: new THREE.MeshBasicMaterial({ color: 0x7cf3e6, toneMapped: false }),
    glowSoft: new THREE.MeshBasicMaterial({
      color: 0x2fd8c4,
      transparent: true,
      opacity: 0.65,
      toneMapped: false,
    }),
    foliage: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
    props: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.05 }),
    vehicle: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.28 }),
    storefront: new THREE.MeshStandardMaterial({
      color: 0x2c4a51,
      roughness: 0.18,
      metalness: 0.35,
    }),
    houseWall: new THREE.MeshStandardMaterial({ map: tex.facadeA, vertexColors: true, roughness: 0.92 }),
    telha: new THREE.MeshStandardMaterial({ map: tex.telha, roughness: 0.95 }),
    azulejo: new THREE.MeshStandardMaterial({ map: tex.azulejo, roughness: 0.55 }),
    cobogo: new THREE.MeshStandardMaterial({ map: tex.cobogo, roughness: 0.9 }),
  };

  const labelSprites = [];
  const panels = [];
  const heaters = [];
  const balconies = [];
  const trees = [];
  const treeColors = [];
  const shrubs = [];
  const shrubColors = [];
  const people = [];
  const peopleColors = [];
  const benches = [];
  const lamps = [];
  const cars = [];
  const carColors = [];
  const crops = [];
  const cropColors = [];
  const dashes = [];
  const stripes = [];
  const smartStrips = [];

  function addMesh(parent, geometry, material, x = 0, y = 0, z = 0, cast = true) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function matrix(x, y, z, ry = 0, scale = 1, rx = 0, rz = 0) {
    return new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(scale, scale, scale),
    );
  }

  const lodPairs = [];

  function instancedPair(lowGeometry, highGeometry, material, matrices, colors, cast, prop) {
    const low = instanced(lowGeometry, material, matrices, colors, cast, prop);
    const high = instanced(highGeometry, material, matrices, colors, cast, prop);
    high.visible = false;
    if (prop === "person" || prop === "crop") low.castShadow = false;
    lodPairs.push({ low, high, prop });
    return { low, high };
  }

  function instanced(geometry, material, matrices, colors = null, cast = true, prop = "") {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    mesh.userData.prop = prop;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    if (colors) colors.forEach((c, i) => mesh.setColorAt(i, new THREE.Color(c)));
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    root.add(mesh);
    return mesh;
  }

  function flatPlane(width, depth, material, x, y, z, rotation = 0, tile = 8) {
    const geometry = new THREE.PlaneGeometry(width, depth);
    geometry.rotateX(-Math.PI / 2);
    tilePlaneUV(geometry, width / tile, depth / tile);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }

  function groundCircle(radius, material, x, y, z, segments = 48) {
    const geometry = new THREE.CircleGeometry(radius, segments);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }

  function pipe(points, radius, material) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 6, false), material);
    mesh.castShadow = true;
    root.add(mesh);
    return mesh;
  }

  function addTree(x, z, scale = 1, colorJitter = 1) {
    const ry = Math.random() * Math.PI * 2;
    trees.push(matrix(x, GROUND, z, ry, scale));
    const base = new THREE.Color("#ffffff");
    base.offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
    base.multiplyScalar(colorJitter * (0.9 + Math.random() * 0.2));
    treeColors.push(base);
  }

  function addShrub(x, z, scale = 1) {
    shrubs.push(matrix(x, GROUND + 0.3 * scale, z, Math.random() * 6.28, scale));
    shrubColors.push(CROP_COLORS[Math.floor(Math.random() * CROP_COLORS.length)]);
  }

  function addPerson(x, z, ry) {
    people.push(matrix(x, GROUND, z, ry, 0.95 + Math.random() * 0.14));
    peopleColors.push(PEOPLE_COLORS[Math.floor(Math.random() * PEOPLE_COLORS.length)]);
  }

  function addBench(x, z, ry) {
    benches.push(matrix(x, GROUND, z, ry));
  }

  function addLamp(x, z, ry) {
    lamps.push(matrix(x, GROUND, z, ry));
  }

  function addCar(x, z, ry, scale = 1) {
    cars.push(matrix(x, GROUND, z, ry, scale));
    carColors.push(CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]);
  }

  function addDashes(x, z, ry, length, spacing = 9) {
    for (let d = -length / 2 + 4; d < length / 2; d += spacing) {
      const dx = Math.cos(ry) * d;
      const dz = -Math.sin(ry) * d;
      dashes.push(matrix(x + dx, 0.128, z + dz, ry));
    }
  }

  const nearIntersection = (value) => Math.abs(value) < 19 || Math.abs(Math.abs(value) - 130) < 19;

  function addStripes(cx, cz) {
    for (const sign of [-1, 1]) {
      for (let i = 0; i < 8; i += 1) {
        const offset = -9.4 + i * 2.68;
        stripes.push(matrix(cx + offset, 0.13, cz + sign * 14.6, 0));
        stripes.push(matrix(cx + sign * 14.6, 0.13, cz + offset, Math.PI / 2));
      }
    }
  }

  // ---------- slab, lawn, district paving ----------
  const slab = addMesh(root, new THREE.BoxGeometry(700, 18, 700), mats.soil, 0, -9, 0, false);
  slab.receiveShadow = false;

  for (const [w, d, cx, cz] of [
    [700, 90, 0, -305],
    [700, 90, 0, 305],
    [90, 520, -305, 0],
    [90, 520, 305, 0],
  ]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.grass);
    strip.geometry.rotateX(-Math.PI / 2);
    tilePlaneUV(strip.geometry, w / 11, d / 11);
    strip.position.set(cx, 0.02, cz);
    strip.receiveShadow = true;
    root.add(strip);
  }

  flatPlane(520, 520, mats.paving, 0, 0.07, 0, 0, 9);

  // ---------- roads ----------
  const ringSpan = 2 * RING_CENTER + 26;
  flatPlane(ringSpan, 26, mats.asphalt, 0, 0.09, RING_CENTER, 0, 7);
  flatPlane(ringSpan, 26, mats.asphalt, 0, 0.091, -RING_CENTER, 0, 7);
  flatPlane(26, ringSpan, mats.asphalt, RING_CENTER, 0.092, 0, 0, 7);
  flatPlane(26, ringSpan, mats.asphalt, -RING_CENTER, 0.093, 0, 0, 7);

  const bikeOffset = RING_CENTER + 18;
  flatPlane(ringSpan + 18, 9, mats.bikeLane, 0, 0.095, bikeOffset, 0, 4);
  flatPlane(ringSpan + 18, 9, mats.bikeLane, 0, 0.095, -bikeOffset, 0, 4);
  flatPlane(9, ringSpan + 18, mats.bikeLane, bikeOffset, 0.095, 0, 0, 4);
  flatPlane(9, ringSpan + 18, mats.bikeLane, -bikeOffset, 0.095, 0, 0, 4);

  const RING_CORNER = 22;

  for (const x of [-130, 0, 130]) {
    flatPlane(22, 520, mats.asphalt, x, 0.1, 0, 0, 7);
    flatPlane(2.4, 500, mats.bikeLane, x + 9.2, 0.115, 0, 0, 4);
    flatPlane(2.4, 500, mats.bikeLane, x - 9.2, 0.115, 0, 0, 4);
    addDashes(x, 0, Math.PI / 2, 500, 9);
    for (let z = -244; z <= 244; z += 24) {
      if (nearIntersection(z)) continue;
      addCar(x + 6.6, z, Math.PI / 2);
      addCar(x - 6.6, z, -Math.PI / 2);
    }
  }
  for (const z of [-130, 0, 130]) {
    flatPlane(22, 520, mats.asphalt, 0, 0.104, z, Math.PI / 2, 7);
    flatPlane(500, 2.4, mats.bikeLane, 0, 0.118, z + 9.2, 0, 4);
    flatPlane(500, 2.4, mats.bikeLane, 0, 0.118, z - 9.2, 0, 4);
    addDashes(0, z, 0, 500, 9);
    for (let x = -244; x <= 244; x += 24) {
      if (nearIntersection(x)) continue;
      addCar(x, z + 6.6, 0);
      addCar(x, z - 6.6, Math.PI);
    }
  }
  for (const x of [-130, 0, 130]) for (const z of [-130, 0, 130]) addStripes(x, z);

  // tram rails
  for (const dz of [-0.78, 0.78]) {
    const rail = addMesh(root, new THREE.BoxGeometry(500, 0.1, 0.16), mats.metal, 0, 0.13, dz, false);
    rail.castShadow = false;
  }
  for (const dx of [-0.78, 0.78]) {
    const rail = addMesh(root, new THREE.BoxGeometry(0.16, 0.1, 500), mats.metal, dx, 0.135, 0, false);
    rail.castShadow = false;
  }

  // ---------- street furniture prototypes ----------
  const smartGeo = new THREE.PlaneGeometry(98, 2.4);
  smartGeo.rotateX(-Math.PI / 2);
  tilePlaneUV(smartGeo, 1, 13);

  // ---------- blocks ----------
  function blockBase(cx, cz, kind, program) {
    const plate = addMesh(root, new THREE.BoxGeometry(BLOCK, 0.56, BLOCK), mats.paving, cx, 0, cz);
    plate.castShadow = false;
    const innerMaterial = kind === "res" || kind === "farm" ? mats.grass : mats.paving;
    const pad = addMesh(
      root,
      new THREE.BoxGeometry(BLOCK - 12, 0.1, BLOCK - 12),
      innerMaterial,
      cx,
      GROUND - 0.06,
      cz,
    );
    pad.castShadow = false;

    for (let i = 0; i < 4; i += 1) {
      const ry = (i * Math.PI) / 2;
      const off = 52.6;
      const x = cx + Math.sin(ry) * off;
      const z = cz + Math.cos(ry) * off;
      smartStrips.push(matrix(x, GROUND + 0.02, z, ry));
    }

    for (const edge of [0, 1, 2, 3]) {
      const ry = (edge * Math.PI) / 2;
      const nx = Math.sin(ry);
      const nz = Math.cos(ry);
      for (const along of [-40, -24, -8, 8, 24, 40]) {
        addTree(cx + nx * 49.2 + nz * along, cz + nz * 49.2 - nx * along, 0.92 + Math.random() * 0.3);
      }
      for (const along of [-30, 0, 30]) {
        addLamp(cx + nx * 49.2 + nz * along, cz + nz * 49.2 - nx * along, ry + Math.PI / 2);
      }
      for (const along of [-30, -14, 2, 20, 36]) {
        if (Math.random() > 0.45) {
          addPerson(
            cx + nx * 50.6 + nz * along,
            cz + nz * 50.6 - nx * along,
            Math.random() > 0.5 ? ry : ry + Math.PI,
          );
        }
      }
    }
    if (program === "commerce" || program === "plaza") {
      for (const along of [-20, 18]) {
        addBench(cx + 41 + along * 0.1, cz + 44, 0);
      }
    }
  }

  function building({
    x,
    z,
    w,
    d,
    h,
    ry = 0,
    style = "facadeA",
    roof = "solar",
    shops = false,
    balcony = false,
  }) {
    const group = new THREE.Group();
    group.position.set(x, GROUND, z);
    group.rotation.y = ry;
    root.add(group);

    const baseMatrix = matrix(x, GROUND, z, ry);
    const localMatrix = (lx, ly, lz, lry = 0, tilt = 0) =>
      baseMatrix
        .clone()
        .multiply(
          new THREE.Matrix4().compose(
            new THREE.Vector3(lx, ly, lz),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, lry, tilt)),
            new THREE.Vector3(1, 1, 1),
          ),
        );

    const base = 1.0;
    addMesh(group, new THREE.BoxGeometry(w + 1, base, d + 1), mats.plinth, 0, base / 2, 0, false);
    const bodyH = h - base;
    const bodyGeometry = facadeUV(new THREE.BoxGeometry(w, bodyH, d), w, bodyH, d, 6.4, 3.2);
    const body = addMesh(group, bodyGeometry, mats[style], 0, base + bodyH / 2, 0);

    const parapet = mergeParts([
      place(new THREE.BoxGeometry(w + 0.6, 1.1, 0.7), { y: h + 0.55, z: (d + 0.6) / 2 - 0.35 }),
      place(new THREE.BoxGeometry(w + 0.6, 1.1, 0.7), { y: h + 0.55, z: -(d + 0.6) / 2 + 0.35 }),
      place(new THREE.BoxGeometry(0.7, 1.1, d + 0.6), { x: (w + 0.6) / 2 - 0.35, y: h + 0.55 }),
      place(new THREE.BoxGeometry(0.7, 1.1, d + 0.6), { x: -(w + 0.6) / 2 + 0.35, y: h + 0.55 }),
    ]);
    addMesh(group, parapet, mats.trim, 0, 0, 0);

    const deck = addMesh(
      group,
      new THREE.BoxGeometry(w - 1.4, 0.4, d - 1.4),
      roof === "green" ? mats.grass : mats.roof,
      0,
      h + 0.25,
      0,
      false,
    );
    deck.geometry = tilePlaneUV(deck.geometry, (w - 1.4) / 4, (d - 1.4) / 4);

    if (roof !== "green") {
      const rows = Math.max(1, Math.floor((d - 5.6) / 3.1));
      const cols = Math.max(1, Math.floor((w - 5.2) / 4.2));
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const px = -w / 2 + 3.2 + c * ((w - 6.4) / Math.max(1, cols - 1 || 1));
          const pz = -d / 2 + 3.0 + r * ((d - 6.0) / Math.max(1, rows - 1 || 1));
          panels.push(localMatrix(px, h + 1.25, pz, ry, -0.34));
        }
      }
      if (roof === "solar+heat") {
        const count = Math.max(1, Math.floor(w / 11));
        for (let i = 0; i < count; i += 1) {
          heaters.push(
            localMatrix(
              -w / 2 + 2.8 + (i * (w - 5.6)) / Math.max(1, count - 1 || 1),
              h + 0.5,
              d / 2 - 2.9,
              ry + Math.PI * 0.1,
            ),
          );
        }
      }
    }

    if (balcony) {
      for (let f = 1; f < Math.floor(bodyH / 3.2); f += 1) {
        balconies.push(localMatrix(0, base + f * 3.2 + 1.45, d / 2 + 0.82));
      }
    }

    if (shops) {
      const front = addMesh(group, new THREE.BoxGeometry(w * 0.86, 3.1, 0.24), mats.storefront, 0, base + 1.7, d / 2 + 0.06, false);
      front.receiveShadow = true;
      const awning = addMesh(
        group,
        new THREE.BoxGeometry(w * 0.84, 0.18, 1.9),
        std(["#c96a4a", "#2f7f84", "#c8a24a"][Math.floor(Math.random() * 3)]),
        0,
        base + 3.5,
        d / 2 + 0.95,
      );
      awning.rotation.x = 0.12;
      addMesh(group, new THREE.BoxGeometry(w * 0.34, 0.7, 0.12), mats.trim, 0, base + 4.4, d / 2 + 0.2);

      const side = addMesh(group, new THREE.BoxGeometry(0.24, 3.1, d * 0.86), mats.storefront, w / 2 + 0.06, base + 1.7, 0, false);
      side.receiveShadow = true;
      const sideAwning = addMesh(
        group,
        new THREE.BoxGeometry(1.9, 0.18, d * 0.84),
        std(["#c96a4a", "#2f7f84", "#c8a24a"][Math.floor(Math.random() * 3)]),
        w / 2 + 0.95,
        base + 3.5,
        0,
      );
      sideAwning.rotation.z = -0.12;
    }

    return group;
  }

  function house({ x, z, w = 15, d = 12, h = 8, ry = 0, wall = "#fff3d8", cobogo = false }) {
    const group = new THREE.Group();
    group.position.set(x, GROUND, z);
    group.rotation.y = ry;
    root.add(group);

    const baseMatrix = matrix(x, GROUND, z, ry);
    const base = 0.9;
    addMesh(group, new THREE.BoxGeometry(w + 0.8, base, d + 0.8), mats.plinth, 0, base / 2, 0, false);

    const bodyH = h - base;
    const bodyGeometry = facadeUV(new THREE.BoxGeometry(w, bodyH, d), w, bodyH, d, 6.4, 3.2);
    tint(bodyGeometry, wall);
    addMesh(group, bodyGeometry, mats.houseWall, 0, base + bodyH / 2, 0);

    addMesh(group, new THREE.BoxGeometry(w + 0.16, 0.8, d + 0.16), mats.azulejo, 0, base + bodyH * 0.54, 0, false);

    const vy = base + 3.1;
    addMesh(group, new THREE.BoxGeometry(w * 0.8, 0.22, 2.2), mats.trim, 0, vy, d / 2 + 1.0);
    addMesh(group, new THREE.BoxGeometry(w * 0.8, 0.95, 0.12), mats.wood, 0, vy + 0.55, d / 2 + 2.05);
    for (const px of [-w * 0.34, 0, w * 0.34]) {
      addMesh(group, new THREE.BoxGeometry(0.16, 3.05, 0.16), mats.wood, px, vy - 1.52, d / 2 + 2.05);
    }
    const awning = addMesh(group, new THREE.BoxGeometry(w * 0.92, 0.16, 2.8), mats.telha, 0, vy + 3.0, d / 2 + 1.1);
    awning.rotation.x = 0.15;
    if (cobogo) {
      addMesh(group, new THREE.BoxGeometry(0.18, 2.8, 2.1), mats.cobogo, w * 0.4, vy + 1.4, d / 2 + 1.05);
    }

    const angle = 0.42;
    const halfSpan = w / 2 + 0.9;
    const rise = halfSpan * Math.tan(angle);
    const slopeLen = halfSpan / Math.cos(angle);
    const ridgeLen = d + 1.6;
    for (const side of [-1, 1]) {
      const slabGeometry = facadeUV(new THREE.BoxGeometry(slopeLen, 0.16, ridgeLen), slopeLen, 0.16, ridgeLen, 2.0, 2.0, 2.2);
      const slab = addMesh(group, slabGeometry, mats.telha, side * (halfSpan / 2), h + rise / 2, 0);
      slab.rotation.z = -side * angle;
    }
    addMesh(group, new THREE.BoxGeometry(0.7, 0.26, ridgeLen + 0.2), mats.telha, 0, h + rise + 0.06, 0);

    const shape = new THREE.Shape();
    shape.moveTo(-halfSpan, 0);
    shape.lineTo(halfSpan, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    for (const side of [-1, 1]) {
      const gable = addMesh(group, new THREE.ShapeGeometry(shape), mats.trim, 0, h, side * (ridgeLen / 2 - 0.03));
      gable.rotation.y = side < 0 ? Math.PI : 0;
      gable.castShadow = false;
    }

    const rows = Math.max(1, Math.floor((ridgeLen - 3) / 2.35));
    const across = Math.max(1, Math.floor((slopeLen - 1.6) / 3.35));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < across; c += 1) {
        const down = 1.4 + c * 3.3;
        panels.push(
          baseMatrix.clone().multiply(
            new THREE.Matrix4().compose(
              new THREE.Vector3(down * Math.cos(angle) + 0.12, h + rise - down * Math.sin(angle) + 0.3, -ridgeLen / 2 + 1.5 + r * 2.3),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -angle)),
              new THREE.Vector3(1, 1, 1),
            ),
          ),
        );
      }
    }

    heaters.push(
      baseMatrix.clone().multiply(
        new THREE.Matrix4().compose(
          new THREE.Vector3(-halfSpan * 0.42, h + rise * 0.42 + 0.3, d * 0.2),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, angle)),
          new THREE.Vector3(1.2, 1.2, 1.2),
        ),
      ),
    );

    addShrub(
      x + Math.cos(ry) * (w * 0.42) + Math.sin(ry) * (d / 2 + 1.9),
      z - Math.sin(ry) * (w * 0.42) + Math.cos(ry) * (d / 2 + 1.9),
      0.75,
    );
  }

  function residentialBlock(cx, cz) {
    const walls = ["#fff3d8", "#f9e7c8", "#e9f2ea", "#fbe4dc", "#e6eef8", "#f7efd9"];
    for (let edge = 0; edge < 4; edge += 1) {
      const ry = (edge * Math.PI) / 2;
      const nx = Math.sin(ry);
      const nz = Math.cos(ry);
      for (const along of [-26, 0, 26]) {
        house({
          x: cx + nx * 40 + nz * along,
          z: cz + nz * 40 - nx * along,
          ry,
          wall: walls[Math.floor(Math.random() * walls.length)],
          h: 7.2 + Math.random() * 1.8,
          cobogo: Math.random() > 0.5,
        });
      }
    }

    flatPlane(34, 4.2, mats.paving, cx + 5, GROUND + 0.03, cz - 1.5, 0, 4);

    // pergola with shared PV canopy
    const pergolaY = GROUND + 3.1;
    for (const [px, pz] of [[-3.6, -3.9], [3.6, -3.9], [-3.6, 3.9], [3.6, 3.9]]) {
      addMesh(root, new THREE.BoxGeometry(0.22, 3.1, 0.22), mats.wood, cx + 5 + px, GROUND + 1.55, cz - 13 + pz);
    }
    addMesh(root, new THREE.BoxGeometry(8.6, 0.24, 8.6), mats.wood, cx + 5, pergolaY + 0.12, cz - 13);
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        panels.push(
          matrix(cx + 2.2 + i * 2.8, pergolaY + 1.35, cz - 15.4 + j * 2.6, 0, 1, 0, -0.3),
        );
      }
    }
    addBench(cx + 1.2, cz - 9.2, 0);
    addBench(cx + 9.0, cz - 9.2, 0);

    // raised community beds
    for (const [bx, bz] of [[-2, -2], [12, -2], [-2, 8], [12, 8]]) {
      gardenBed(cx + bx, cz + bz, 10, 3.4, 0);
    }
    addTree(cx - 6, cz + 17, 1.05);
    addTree(cx + 19, cz - 17, 0.95);
    addTree(cx + 17, cz + 14, 0.85);
    addPerson(cx + 4, cz + 4, 0.4);
    addPerson(cx + 10, cz + 5, 2.2);
  }

  function gardenBed(x, z, w, d, ry) {
    addMesh(root, new THREE.BoxGeometry(w, 0.5, d), mats.wood, x, GROUND + 0.25, z);
    const soilTop = addMesh(root, new THREE.BoxGeometry(w - 0.7, 0.14, d - 0.7), mats.soil, x, GROUND + 0.56, z);
    soilTop.castShadow = false;
    const cos = Math.cos(ry);
    const sin = Math.sin(ry);
    const rows = Math.max(2, Math.round(d / 1.2));
    const cols = Math.max(3, Math.round(w / 1.35));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const lx = -w / 2 + 0.95 + c * ((w - 1.9) / Math.max(1, cols - 1));
        const lz = -d / 2 + 0.85 + r * ((d - 1.7) / Math.max(1, rows - 1));
        const scale = 0.7 + Math.random() * 0.5;
        crops.push(matrix(x + lx * cos + lz * sin, GROUND + 0.9, z - lx * sin + lz * cos, Math.random() * 6.28, scale));
        cropColors.push(CROP_COLORS[Math.floor(Math.random() * CROP_COLORS.length)]);
      }
    }
  }

  function greenhouse(cx, cz, len, width, ry = 0) {
    const group = new THREE.Group();
    group.position.set(cx, GROUND, cz);
    group.rotation.y = ry;
    root.add(group);

    addMesh(group, new THREE.BoxGeometry(len, 0.7, width), mats.plinth, 0, 0.35, 0);
    addMesh(group, new THREE.BoxGeometry(len - 1.6, 0.16, width - 1.6), mats.soil, 0, 0.72, 0, false);
    addMesh(group, new THREE.BoxGeometry(len, 0.3, 0.18), mats.trim, 0, 0.85, width / 2 - 0.09);
    addMesh(group, new THREE.BoxGeometry(len, 0.3, 0.18), mats.trim, 0, 0.85, -width / 2 + 0.09);

    const archGeometry = new THREE.CylinderGeometry(width / 2, width / 2, len, 26, 1, true, 0, Math.PI);
    archGeometry.rotateZ(Math.PI / 2);
    const arch = new THREE.Mesh(archGeometry, mats.glassPanel);
    arch.position.y = 0.7;
    arch.castShadow = false;
    group.add(arch);

    for (let i = 0; i <= 5; i += 1) {
      const ribGeometry = new THREE.TorusGeometry(width / 2, 0.07, 5, 16, Math.PI);
      ribGeometry.rotateY(Math.PI / 2);
      const rib = new THREE.Mesh(ribGeometry, mats.metal);
      rib.position.set(-len / 2 + (i * len) / 5, 0.7, 0);
      rib.castShadow = true;
      group.add(rib);
    }
    addMesh(group, new THREE.BoxGeometry(0.16, width * 0.9, 0.16), mats.metal, 0, 0.7, 0, false);
    addMesh(group, new THREE.BoxGeometry(len, 0.14, 0.14), mats.trim, 0, 0.7 + width / 2, 0);
    for (const end of [-1, 1]) {
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 4) * Math.PI;
        addMesh(
          group,
          new THREE.BoxGeometry(0.12, width / 2, 0.12),
          mats.trim,
          end * (len / 2 - 0.09),
          0.7 + Math.sin(angle) * (width / 4),
          Math.cos(angle) * (width / 2),
        );
      }
    }

    const door = addMesh(group, new THREE.BoxGeometry(0.24, 2.4, 2.6), mats.storefront, len / 2 - 0.2, 1.5, 0);
    door.castShadow = false;

    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < Math.floor(len / 2.6); c += 1) {
        const scale = 0.6 + Math.random() * 0.4;
        crops.push(
          matrix(
            cx + Math.cos(ry) * (-len / 2 + 2 + c * 2.5) + Math.sin(ry) * (-width / 4 + r * (width / 4)),
            GROUND + 0.95,
            cz - Math.sin(ry) * (-len / 2 + 2 + c * 2.5) + Math.cos(ry) * (-width / 4 + r * (width / 4)),
            Math.random() * 6.28,
            scale,
          ),
        );
        cropColors.push(CROP_COLORS[Math.floor(Math.random() * CROP_COLORS.length)]);
      }
    }
  }

  function biodigester(cx, cz, radius) {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      mats.dome,
    );
    dome.position.set(cx, GROUND + 0.15, cz);
    dome.scale.y = 0.5;
    dome.castShadow = true;
    dome.receiveShadow = true;
    root.add(dome);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.22, 6, 28), mats.metal);
    rim.geometry.rotateX(-Math.PI / 2);
    rim.position.set(cx, GROUND + 0.2, cz);
    rim.castShadow = true;
    root.add(rim);

    const cap = addMesh(root, new THREE.CylinderGeometry(radius * 0.26, radius * 0.3, 0.9, 10), mats.accent, cx, GROUND + 0.8, cz);
    cap.castShadow = true;

    const gauge = addMesh(root, new THREE.CylinderGeometry(0.14, 0.14, 1.6, 6), mats.metal, cx + radius * 0.5, GROUND + 1.4, cz + radius * 0.5);
    gauge.rotation.z = 0.2;

    pipe(
      [
        [cx + radius * 0.5, GROUND + 0.55, cz + radius * 0.5],
        [cx + radius * 0.9, GROUND + 0.5, cz + radius * 0.9],
        [cx + radius * 1.5, GROUND + 0.45, cz + radius * 1.4],
        [cx + radius * 2.0, GROUND + 0.35, cz + radius * 2.4],
      ],
      0.17,
      mats.accent,
    );
  }

  function schoolBlock(cx, cz) {
    building({
      x: cx - 6,
      z: cz - 30,
      w: 56,
      d: 15,
      h: 9.6,
      style: "facadeB",
      roof: "green",
      shops: false,
    });
    building({ x: cx - 32, z: cz + 14, w: 16, d: 26, h: 8.2, style: "facadeA", roof: "solar" });

    // sports track + field
    const fieldX = cx + 15;
    const fieldZ = cz + 16;
    const track = new THREE.Mesh(new THREE.RingGeometry(20, 25, 48), mats.track);
    track.geometry.rotateX(-Math.PI / 2);
    track.scale.z = 0.62;
    track.position.set(fieldX, GROUND + 0.04, fieldZ);
    track.receiveShadow = true;
    root.add(track);
    const field = flatPlane(36, 20, mats.field, fieldX, GROUND + 0.05, fieldZ, 0, 8);
    field.receiveShadow = true;
    for (const [lw, ld, lx, lz] of [
      [36, 0.3, 0, 9.7],
      [36, 0.3, 0, -9.7],
      [0.3, 19.4, -17.8, 0],
      [0.3, 19.4, 17.8, 0],
      [0.3, 19.4, 0, 0],
    ]) {
      const line = addMesh(root, new THREE.BoxGeometry(lw, 0.04, ld), mats.trim, fieldX + lx, GROUND + 0.09, fieldZ + lz, false);
      line.castShadow = false;
    }
    const circle = new THREE.Mesh(new THREE.RingGeometry(3, 3.25, 32), mats.trim);
    circle.geometry.rotateX(-Math.PI / 2);
    circle.position.set(fieldX, GROUND + 0.1, fieldZ);
    root.add(circle);
    for (const side of [-1, 1]) {
      addMesh(root, new THREE.BoxGeometry(0.16, 1.8, 0.16), mats.trim, fieldX + side * 17.6, GROUND + 0.95, fieldZ + 3.2);
      addMesh(root, new THREE.BoxGeometry(0.16, 1.8, 0.16), mats.trim, fieldX + side * 17.6, GROUND + 0.95, fieldZ - 3.2);
    }

    // solar canopy for bike parking
    for (const [px, pz] of [[-8, -4], [8, -4], [-8, 4], [8, 4]]) {
      addMesh(root, new THREE.BoxGeometry(0.2, 3.2, 0.2), mats.metal, cx - 22 + px, GROUND + 1.6, cz - 10 + pz);
    }
    addMesh(root, new THREE.BoxGeometry(18, 0.2, 9.4), mats.trim, cx - 22, GROUND + 3.3, cz - 10);
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        panels.push(matrix(cx - 29.4 + i * 4.1, GROUND + 4.45, cz - 13.2 + j * 2.9, 0, 1, 0, -0.3));
      }
    }

    addTree(cx + 40, cz - 8, 1);
    addTree(cx + 40, cz + 12, 0.95);
    addTree(cx + 8, cz + 42, 0.9);
    for (const side of [-1, 1]) addBench(cx + 26 + side * 4, cz - 6, Math.PI / 2);
    addPerson(cx + 4, cz - 6, 1.2);
    addPerson(cx + 8, cz - 6, 4.4);
    addPerson(cx + 12, cz + 8, 0.8);
  }

  function commerceBlock(cx, cz) {
    building({ x: cx - 30, z: cz - 30, w: 28, d: 19, h: 24, style: "facadeB", shops: true });
    building({ x: cx + 3, z: cz - 32, w: 24, d: 16, h: 31, style: "glassFacade", shops: true, roof: "green" });
    building({ x: cx + 33, z: cz - 26, w: 18, d: 22, h: 19.5, style: "facadeA", shops: true });
    building({ x: cx - 30, z: cz + 20, w: 20, d: 24, h: 17.5, style: "facadeA", shops: true });
    building({ x: cx + 27, z: cz + 27, w: 25, d: 19, h: 22.5, style: "facadeB", shops: true, balcony: true });
    building({ x: cx + 2, z: cz + 34, w: 22, d: 12, h: 13.5, style: "facadeA", shops: true });

    const px = cx + 1;
    const pz = cz + 3;
    addTree(px - 8, pz, 0.85);
    addTree(px + 12, pz - 4, 0.8);
    addBench(px - 4, pz + 6, 0.2);
    addBench(px + 7, pz + 7, -0.3);
    addShrub(px + 2, pz - 6, 0.9);
    addShrub(px - 10, pz + 4, 0.8);
    addPerson(px - 2, pz + 2, 2.4);
    addPerson(px + 4, pz - 2, 5.1);
    addPerson(px - 8, pz + 9, 1.1);
  }

  function plazaBlock(cx, cz) {
    groundCircle(42, mats.paving, cx, GROUND + 0.02, cz, 56);
    groundCircle(16, mats.grass, cx, GROUND + 0.04, cz, 40);

    const spiral = new THREE.Mesh(new THREE.RingGeometry(28, 30, 64), mats.glowSoft);
    spiral.geometry.rotateX(-Math.PI / 2);
    spiral.position.set(cx, GROUND + 0.06, cz);
    root.add(spiral);
    const innerGlow = new THREE.Mesh(new THREE.RingGeometry(18, 19.4, 64), mats.glowSoft);
    innerGlow.geometry.rotateX(-Math.PI / 2);
    innerGlow.position.set(cx, GROUND + 0.06, cz);
    root.add(innerGlow);

    // fountain
    const basin = addMesh(root, new THREE.CylinderGeometry(7, 7.4, 1.1, 32), mats.trim, cx, GROUND + 0.55, cz);
    basin.castShadow = true;
    const waterMaterial = mats.water.clone();
    waterMaterial.color.set(0x4fc3d5);
    const water = addMesh(root, new THREE.CylinderGeometry(6.4, 6.4, 0.12, 32), waterMaterial, cx, GROUND + 1.12, cz, false);
    addMesh(root, new THREE.CylinderGeometry(0.9, 1.3, 1.5, 12), mats.trim, cx, GROUND + 1.85, cz);
    addMesh(root, new THREE.CylinderGeometry(0.35, 0.35, 2.4, 8), mats.glow, cx, GROUND + 3.4, cz, false);

    const pergolaY = GROUND + 3.2;
    for (const [px, pz] of [[-14, -26], [0, -26], [-14, -16], [0, -16]]) {
      addMesh(root, new THREE.BoxGeometry(0.24, 3.2, 0.24), mats.wood, cx + px, GROUND + 1.6, cz + pz);
    }
    addMesh(root, new THREE.BoxGeometry(15, 0.22, 11), mats.wood, cx - 7, pergolaY + 0.1, cz - 21);
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        panels.push(matrix(cx - 12 + i * 3.4, pergolaY + 1.2, cz - 24.6 + j * 3.2, 0, 1, 0, -0.32));
      }
    }
    for (const [bx, bz] of [[-4, -19], [2, -19], [-9, -23]]) addBench(cx + bx, cz + bz, 0);

    // kiosk
    addMesh(root, new THREE.BoxGeometry(7, 3.4, 6), mats.facadeB, cx + 26, GROUND + 1.7, cz + 12);
    addMesh(root, new THREE.BoxGeometry(8.4, 0.26, 7.4), mats.trim, cx + 26, GROUND + 3.7, cz + 12);
    for (let i = 0; i < 2; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        panels.push(matrix(cx + 24.3 + i * 3.0, GROUND + 4.9, cz + 10.3 + j * 3.2, 0, 1, 0, -0.3));
      }
    }
    addPerson(cx + 22, cz + 16, 3.3);
    addPerson(cx + 30, cz + 15, 4.9);

    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * Math.PI * 2;
      addTree(cx + Math.cos(angle) * 36, cz + Math.sin(angle) * 36, 0.9 + Math.random() * 0.25);
      addShrub(cx + Math.cos(angle + 0.3) * 26, cz + Math.sin(angle + 0.3) * 26, 0.85);
    }
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2 + 0.4;
      addBench(cx + Math.cos(angle) * 21, cz + Math.sin(angle) * 21, -angle);
      addPerson(cx + Math.cos(angle + 0.4) * 24, cz + Math.sin(angle + 0.4) * 24, -angle);
    }
  }

  function farmBlock(cx, cz) {
    greenhouse(cx - 22, cz - 28, 30, 13);
    greenhouse(cx + 20, cz - 28, 24, 12);
    greenhouse(cx - 22, cz + 2, 30, 12);

    for (const row of [21, 29.5, 38]) {
      for (const col of [-34, -19, -4, 11]) {
        gardenBed(cx + col, cz + row, 11, 3.6, 0);
      }
    }

    biodigester(cx + 34, cz + 4, 5.6);
    biodigester(cx + 34, cz - 9, 3.6);

    // tool shed with green roof + PV
    addMesh(root, new THREE.BoxGeometry(13, 4.6, 9), mats.facadeB, cx + 30, GROUND + 2.3, cz + 34);
    addMesh(root, new THREE.BoxGeometry(13.6, 0.4, 9.6), mats.grass, cx + 30, GROUND + 4.75, cz + 34);
    for (let i = 0; i < 2; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        panels.push(matrix(cx + 26.6 + i * 3.6, GROUND + 5.75, cz + 31.4 + j * 3.0, 0, 1, 0, -0.3));
      }
    }

    const tank = addMesh(root, new THREE.CylinderGeometry(3.4, 3.4, 5, 16), mats.metal, cx - 38, GROUND + 2.5, cz + 33);
    tank.castShadow = true;
    addMesh(root, new THREE.ConeGeometry(3.6, 1.4, 16), mats.accent, cx - 38, GROUND + 5.7, cz + 33);
    pipe(
      [
        [cx - 38, GROUND + 1.2, cz + 33],
        [cx - 30, GROUND + 0.5, cz + 26],
        [cx - 18, GROUND + 0.4, cz + 16],
      ],
      0.16,
      mats.metal,
    );

    for (const [tx, tz] of [[cx - 40, cz - 6], [cx + 2, cz - 42], [cx + 40, cz + 44]]) {
      addTree(tx, tz, 0.95);
    }
    addPerson(cx - 4, cz + 12, 1.7);
    addPerson(cx + 24, cz + 18, 3.9);
  }

  function energyBlock(cx, cz) {
    // battery containers
    for (let i = 0; i < 4; i += 1) {
      const bx = cx - 28;
      const bz = cz - 26 + i * 8.4;
      addMesh(root, new THREE.BoxGeometry(6.4, 2.5, 2.6), mats.metal, bx, GROUND + 1.5, bz);
      addMesh(root, new THREE.BoxGeometry(6.5, 0.55, 2.7), std(0x2d4547), bx, GROUND + 2.9, bz);
      addMesh(root, new THREE.BoxGeometry(6.52, 0.16, 2.72), mats.glow, bx, GROUND + 2.45, bz, false);
      for (let f = 0; f < 5; f += 1) {
        addMesh(root, new THREE.BoxGeometry(0.1, 1.1, 2.62), mats.metal, bx - 2.4 + f * 1.2, GROUND + 1.55, bz, false);
      }
    }

    // substation yard
    for (const [tx, tz] of [[cx - 2, cz - 30], [cx + 8, cz - 30]]) {
      addMesh(root, new THREE.BoxGeometry(5.4, 0.3, 4.4), mats.paving, tx, GROUND + 0.15, tz);
      addMesh(root, new THREE.CylinderGeometry(1.35, 1.35, 3.0, 12), mats.metal, tx, GROUND + 1.8, tz);
      for (let f = 0; f < 6; f += 1) {
        addMesh(root, new THREE.BoxGeometry(0.12, 2.4, 2.8), mats.metal, tx - 1.8 + f * 0.72, GROUND + 1.7, tz, false);
      }
      addMesh(root, new THREE.BoxGeometry(3.4, 0.24, 2.2), mats.dark, tx, GROUND + 3.4, tz, false);
    }

    // microgrid control building
    building({ x: cx + 28, z: cz - 26, w: 20, d: 13, h: 8, style: "glassFacade", roof: "green" });

    // solar carport with EV charging
    const carportY = GROUND + 5.6;
    for (const [px, pz] of [[-10, -6], [10, -6], [-10, 6], [10, 6]]) {
      addMesh(root, new THREE.BoxGeometry(0.26, 5.6, 0.26), mats.metal, cx + 14 + px, GROUND + 2.8, cz + 12 + pz);
    }
    addMesh(root, new THREE.BoxGeometry(26, 0.28, 14), mats.trim, cx + 14, carportY, cz + 12);
    for (let i = 0; i < 6; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        panels.push(matrix(cx + 2.6 + i * 4.1, carportY + 1.2, cz + 6.6 + j * 3.2, 0, 1, 0, -0.3));
      }
    }
    for (const [px, pz] of [[4, 8], [10, 8], [16, 8], [22, 8], [4, 16], [16, 16]]) {
      addCar(cx + px, cz + pz, Math.PI / 2);
      const post = addMesh(root, new THREE.BoxGeometry(0.4, 1.7, 0.4), mats.trim, cx + px - 2.6, GROUND + 0.85, cz + pz, false);
      post.castShadow = false;
      addMesh(root, new THREE.BoxGeometry(0.14, 0.6, 0.34), mats.glow, cx + px - 2.6, GROUND + 1.5, cz + pz, false);
    }

    // hub pylon + conduits
    const hubScale = 2.4;
    const hubX = cx + 2;
    const hubZ = cz + 26;
    addMesh(root, new THREE.CylinderGeometry(1.6 * hubScale, 2.0 * hubScale, 0.8 * hubScale, 12), mats.dark, hubX, GROUND + 0.4 * hubScale, hubZ);
    addMesh(root, new THREE.CylinderGeometry(0.5 * hubScale, 0.62 * hubScale, 5.4 * hubScale, 10), mats.metal, hubX, GROUND + 3.1 * hubScale, hubZ);
    for (let i = 0; i < 3; i += 1) {
      const ringMesh = new THREE.Mesh(new THREE.TorusGeometry((1.5 - i * 0.3) * hubScale, 0.09 * hubScale, 5, 20), mats.glow);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.set(hubX, GROUND + (2.4 + i * 1.4) * hubScale, hubZ);
      root.add(ringMesh);
    }
    addMesh(root, new THREE.SphereGeometry(0.45 * hubScale, 10, 8), mats.glow, hubX, GROUND + 6.1 * hubScale, hubZ, false);

    // robot depot
    addMesh(root, new THREE.BoxGeometry(16, 0.3, 12), mats.paving, cx - 16, GROUND + 0.15, cz + 34, false);
    addMesh(root, new THREE.BoxGeometry(16, 0.22, 0.4), mats.accent, cx - 16, GROUND + 0.36, cz + 28.2, false);
    addMesh(root, new THREE.BoxGeometry(0.4, 0.22, 12), mats.accent, cx - 24, GROUND + 0.36, cz + 34, false);

    // conduits to the district
    const conduitPaths = [
      [[cx + 2, GROUND + 0.6, cz + 26], [cx + 2, GROUND + 0.5, cz + 50], [cx + 2, GROUND + 0.5, 195], [-14, GROUND + 0.5, 195]],
      [[cx - 28, GROUND + 0.6, cz - 6], [cx - 40, GROUND + 0.5, cz - 6], [cx - 40, GROUND + 0.5, 130], [-65, GROUND + 0.5, 130]],
      [[cx - 28, GROUND + 0.6, cz - 30], [cx - 40, GROUND + 0.5, cz - 30], [cx - 40, GROUND + 0.5, 65], [-65, GROUND + 0.5, 65]],
      [[cx + 2, GROUND + 0.6, cz + 26], [cx + 2, GROUND + 0.5, 130], [65, GROUND + 0.5, 130]],
    ];
    for (const path of conduitPaths) pipe(path, 0.22, mats.glow);
    for (const [nx, nz] of [[-65, 130], [-65, 65], [65, 130], [2, 195], [-14, 195]]) {
      addMesh(root, new THREE.SphereGeometry(0.7, 10, 8), mats.glow, nx, GROUND + 0.55, nz, false);
    }
  }

  function blockBaseWithProgram(cx, cz, program) {
    blockBase(cx, cz, program, program);
    if (program === "res") residentialBlock(cx, cz);
    else if (program === "school") schoolBlock(cx, cz);
    else if (program === "commerce") commerceBlock(cx, cz);
    else if (program === "plaza") plazaBlock(cx, cz);
    else if (program === "farm") farmBlock(cx, cz);
    else if (program === "energy") energyBlock(cx, cz);
  }

  ROW.forEach((cz, row) => {
    COL.forEach((cx, col) => blockBaseWithProgram(cx, cz, PROGRAMS[row][col]));
  });

  // green belt trees
  for (let i = 0; i < 130; i += 1) {
    let x = 0;
    let z = 0;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      x = (Math.random() * 2 - 1) * 342;
      z = (Math.random() * 2 - 1) * 342;
      if (Math.max(Math.abs(x), Math.abs(z)) > 300) break;
    }
    addTree(x, z, 0.8 + Math.random() * 0.45);
  }
  for (const sign of [-1, 1]) {
    for (let i = -6; i <= 6; i += 1) {
      const along = i * 42;
      addTree(along, sign * 306, 0.95 + Math.random() * 0.15);
      addTree(sign * 306, along, 0.95 + Math.random() * 0.15);
    }
    for (const along of [-168, 0, 168]) {
      addLamp(along, sign * 296, 0);
      addLamp(sign * 296, along, Math.PI / 2);
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) addTree(sx * 308, sz * 308, 1.05);
  addShrub(250, 0, 1.2);
  addShrub(-250, 0, 1.2);

  // ---------- finalize instanced props ----------
  instancedPair(TREE_TRUNK_LOW, TREE_TRUNK, mats.props, trees, null, true, "tree");
  instancedPair(TREE_CANOPY_LOW, TREE_CANOPY, mats.foliage, trees, treeColors, true, "tree");
  instanced(BENCH, mats.props, benches);
  instanced(LAMP, mats.props, lamps);
  instancedPair(PERSON_LOW, PERSON, mats.props, people, peopleColors, true, "person");
  instancedPair(CAR_LOW, CAR, mats.vehicle, cars, carColors, true, "car");
  instancedPair(CROP_LOW, CROP, mats.foliage, crops, cropColors, true, "crop");
  instanced(SHRUB, mats.foliage, shrubs, shrubColors);
  instanced(PANEL, mats.pv, panels, null, true);
  instanced(HEATER, mats.props, heaters);
  instanced(BALCONY, mats.props, balconies);

  const dashGeometry = new THREE.BoxGeometry(0.16, 0.02, 3.0);
  instanced(dashGeometry, mats.trim, dashes, null, false);

  const stripeGeometry = new THREE.BoxGeometry(1.15, 0.02, 2.8);
  instanced(stripeGeometry, mats.trim, stripes, null, false);

  const smartTexture = tex.smartWalk.clone();
  smartTexture.needsUpdate = true;
  const smartMaterial = new THREE.MeshBasicMaterial({
    map: smartTexture,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  instanced(smartGeo, smartMaterial, smartStrips, null, false);

  // ---------- animated transit ----------
  function makeBus(color) {
    const group = new THREE.Group();
    addMesh(group, new THREE.BoxGeometry(11, 2.5, 2.7), std(color, { roughness: 0.4, metalness: 0.3 }), 0, 1.9, 0);
    addMesh(group, new THREE.BoxGeometry(3.6, 2.0, 2.72), std(color, { roughness: 0.4, metalness: 0.3 }), 3.7, 2.1, 0);
    addMesh(group, new THREE.BoxGeometry(10.2, 0.9, 2.74), mats.storefront, 0, 2.65, 0, false);
    addMesh(group, new THREE.BoxGeometry(3.3, 0.7, 2.76), mats.storefront, 3.7, 2.6, 0, false);
    addMesh(group, new THREE.BoxGeometry(10.6, 0.22, 2.8), std(0xd8f0ea), 0, 3.2, 0, false);
    for (const [wx, wz] of [[-3.6, 1.2], [3.6, 1.2], [-3.6, -1.2], [3.6, -1.2]]) {
      const wheel = addMesh(group, new THREE.CylinderGeometry(0.52, 0.52, 0.32, 12), mats.dark, wx, 0.52, wz, false);
      wheel.rotation.x = Math.PI / 2;
    }
    addMesh(group, new THREE.BoxGeometry(0.2, 0.5, 2.2), mats.glow, -5.6, 2.2, 0, false);
    group.userData.dynamic = true;
    root.add(group);
    return group;
  }

  function makeTram() {
    const group = new THREE.Group();
    for (let car = 0; car < 3; car += 1) {
      const offset = car * 8.4;
      addMesh(group, new THREE.BoxGeometry(7.9, 2.9, 2.55), std(0xf7f6ef, { roughness: 0.4, metalness: 0.2 }), offset, 1.85, 0);
      addMesh(group, new THREE.BoxGeometry(7.4, 1.15, 2.58), mats.storefront, offset, 2.5, 0, false);
      addMesh(group, new THREE.BoxGeometry(7.95, 0.4, 2.6), mats.accent, offset, 3.4, 0, false);
      addMesh(group, new THREE.BoxGeometry(7.6, 0.16, 2.4), mats.metal, offset, 3.62, 0, false);
      for (const [wx, wz] of [[-2.4, 1.05], [2.4, 1.05], [-2.4, -1.05], [2.4, -1.05]]) {
        const wheel = addMesh(group, new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), mats.dark, offset + wx, 0.42, wz, false);
        wheel.rotation.x = Math.PI / 2;
      }
    }
    addMesh(group, new THREE.BoxGeometry(0.25, 0.35, 2.2), mats.glow, -3.9, 2.3, 0, false);
    group.userData.dynamic = true;
    root.add(group);
    return group;
  }

  const tramA = makeTram();
  tramA.position.set(-260, 0, 0);
  const tramB = makeTram();
  tramB.rotation.y = -Math.PI / 2;
  tramB.position.set(0, 0, -260);

  const buses = [
    { mesh: makeBus("#f2f4ee"), speed: 0.01, phase: 0 },
    { mesh: makeBus("#2f7f84"), speed: 0.01, phase: 0.5 },
  ];

  function squarePath(cx, cz, half, progress) {
    const t = ((progress % 1) + 1) % 1;
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

  function makeRobot() {
    const group = new THREE.Group();
    addMesh(group, new THREE.BoxGeometry(1.9, 0.32, 1.2), mats.dark, 0, 0.44, 0, false);
    addMesh(group, new THREE.BoxGeometry(1.6, 0.8, 1.05), mats.trim, 0, 1.0, 0);
    addMesh(group, new THREE.BoxGeometry(1.64, 0.16, 1.08), std(0xe8734a), 0, 1.36, 0, false);
    addMesh(group, new THREE.BoxGeometry(0.7, 0.1, 0.6), mats.dark, 0, 1.58, 0.06, false);
    addMesh(group, new THREE.BoxGeometry(0.48, 0.09, 0.06), mats.glow, 0, 1.6, 0.38, false);
    addMesh(group, new THREE.BoxGeometry(0.62, 0.7, 0.5), std(0x2f6fa8), -0.5, 1.0, -0.66, false);
    addMesh(group, new THREE.BoxGeometry(0.62, 0.7, 0.5), std(0xb07a3a), 0.42, 1.0, -0.66, false);
    for (const [wx, wz] of [[-0.62, 0.56], [0.62, 0.56], [-0.62, -0.56], [0.62, -0.56]]) {
      const wheel = addMesh(group, new THREE.CylinderGeometry(0.28, 0.28, 0.22, 10), mats.dark, wx, 0.32, wz, false);
      wheel.rotation.x = Math.PI / 2;
    }
    const arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.92, 1.22, 0.12);
      group.add(shoulder);
      addMesh(shoulder, new THREE.BoxGeometry(0.16, 0.16, 0.82), mats.metal, 0, 0, 0.38, false);
      const elbow = new THREE.Group();
      elbow.position.set(0, 0, 0.78);
      shoulder.add(elbow);
      addMesh(elbow, new THREE.BoxGeometry(0.14, 0.7, 0.14), mats.metal, 0, -0.32, 0, false);
      const claw = new THREE.Group();
      claw.position.set(0, -0.68, 0);
      elbow.add(claw);
      addMesh(claw, new THREE.BoxGeometry(0.3, 0.16, 0.26), std(0xe8734a), 0, 0, 0.06, false);
      arms.push({ shoulder, elbow, side });
    }
    group.scale.setScalar(1.4);
    group.userData.dynamic = true;
    root.add(group);
    return { group, arms };
  }

  const robots = [
    { path: { cx: -65, cz: 65, half: 55.4 }, speed: 0.012, offset: 0.1 },
    { path: { cx: 65, cz: 65, half: 55.4 }, speed: 0.009, offset: 0.55 },
    { path: { cx: 195, cz: 195, half: 55.4 }, speed: 0.011, offset: 0.78 },
    { path: { cx: -195, cz: -65, half: 55.4 }, speed: 0.008, offset: 0.3 },
    { path: { cx: 65, cz: -195, half: 55.4 }, speed: 0.01, offset: 0.62 },
  ].map((config) => ({ ...config, ...makeRobot() }));

  const smartWalkTexture = smartTexture;

  // ---------- floating labels ----------
  function label(text, sub, x, z, height = 34) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(9, 38, 40, 0.82)";
    ctx.beginPath();
    ctx.roundRect(6, 6, 756, 180, 34);
    ctx.fill();
    ctx.strokeStyle = "rgba(124, 243, 230, 0.7)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#f2fffd";
    ctx.font = "600 54px ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 40, 74);
    ctx.fillStyle = "rgba(190, 255, 246, 0.88)";
    ctx.font = "400 34px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(sub, 40, 138);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, GROUND + height, z);
    sprite.scale.set(46, 11.5, 1);
    sprite.visible = false;
    labelSprites.push(sprite);
    root.add(sprite);

    const stemGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, GROUND + 0.4, z),
      new THREE.Vector3(x, GROUND + height - 4, z),
    ]);
    const stem = new THREE.Line(
      stemGeometry,
      new THREE.LineBasicMaterial({ color: 0x2fd8c4, transparent: true, opacity: 0.75 }),
    );
    stem.visible = false;
    stem.userData.dynamic = true;
    labelSprites.push(stem);
    root.add(stem);

    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), mats.glow);
    dot.position.set(x, GROUND + 0.4, z);
    dot.visible = false;
    dot.userData.dynamic = true;
    labelSprites.push(dot);
    root.add(dot);
  }

  label("MICRO-REDE LOCAL", "baterias + solar + recarga", 195, 195, 38);
  label("AGRICULTURA URBANA", "estufas · hortas · biodigestores", 65, 195, 30);
  label("COLETA AUTÔNOMA", "robôs com braços mecânicos", 65, -195, 28);
  label("CALÇADA CINÉTICA", "piso translúcido que gera energia", -130, -130, 22);
  label("BAIRRO RESIDENCIAL", "casas de telha cerâmica, varanda e azulejo", -195, 195, 26);
  label("EIXO COMERCIAL", "torres envidraçadas e comércio de rua", 65, -65, 34);

  window.__cityDebug = { ...mergeStaticGeometry(root), materials: mats && Object.keys(mats).length };

  // ---------- update ----------
  function update(t) {
    tramA.position.x = -238 + ((t * 13) % 476);
    tramB.position.z = -238 + ((t * 11.5) % 476);

    for (const bus of buses) {
      const progress = ((t * bus.speed + bus.phase) % 1 + 1) % 1;
      const point = ringPath(progress, RING_CENTER, RING_CORNER);
      bus.mesh.position.set(point.x, 0, point.z);
      bus.mesh.rotation.y = Math.atan2(-point.tz, point.tx);
    }

    for (const robot of robots) {
      const progress = robot.offset + t * robot.speed;
      const point = squarePath(robot.path.cx, robot.path.cz, robot.path.half, progress);
      robot.group.position.set(point.x, GROUND, point.z);
      robot.group.rotation.y = Math.atan2(point.dx, point.dz);
      const phase = t * 1.6 + robot.offset * 9;
      robot.arms.forEach((arm, index) => {
        arm.shoulder.rotation.x = Math.sin(phase + index * Math.PI) * 0.32 - 0.12;
        arm.elbow.rotation.x = -0.5 + Math.cos(phase * 1.1 + index * Math.PI) * 0.35;
      });
    }

    smartWalkTexture.offset.y = -t * 0.16;
  }

  return {
    update,
    root,
    vehicles: { buses: buses.map((bus) => bus.mesh), trams: [tramA, tramB] },
    setLabelsVisible(visible) {
      for (const sprite of labelSprites) sprite.visible = visible;
    },
    setLodLevel(level) {
      for (const pair of lodPairs) {
        pair.low.visible = level < 1;
        pair.high.visible = level >= 1;
        if (pair.prop === "person" || pair.prop === "crop") {
          pair.high.castShadow = level >= 1;
        }
      }
    },
    lodLevels: lodPairs.length,
  };
}
