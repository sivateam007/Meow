import * as THREE from "three";
import { makeCatRig, type CatRig } from "./cat";
import { poseAt } from "./track";
import {
  ballPose,
  barGap,
  crusherBottom,
  hammerPose,
  laserOn,
  pusherEdge,
  rotorAngle,
  sawLat,
  spinnerAngle,
} from "./hazards";

const HALF = 2.7;
const _up = new THREE.Vector3(0, 1, 0);
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _lookL = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _camBase = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _dir = new THREE.Vector3();

const PALETTES = [
  { deck: "#ffd23f", alt: "#ffffff", side: "#e0871a", rail: "#fffaf0" },
  { deck: "#4cc9f0", alt: "#ffffff", side: "#1d84b8", rail: "#ffffff" },
  { deck: "#ff7a59", alt: "#fff1e8", side: "#c94b2c", rail: "#fff6ef" },
  { deck: "#8ce99a", alt: "#ffffff", side: "#3fa35a", rail: "#ffffff" },
  { deck: "#b197fc", alt: "#ffffff", side: "#6f4fd6", rail: "#fffaff" },
  { deck: "#ffa8cc", alt: "#ffffff", side: "#d4567f", rail: "#ffffff" },
  { deck: "#63e6be", alt: "#ffffff", side: "#1f9c81", rail: "#ffffff" },
  { deck: "#ffd8a8", alt: "#fff6ea", side: "#d98324", rail: "#fffaf3" },
];;

type Palette = (typeof PALETTES)[number];

type Particle = {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  gravity: number;
  kind: "dust" | "spark" | "star" | "confetti";
};

function basisOf(yaw: number) {
  const tx = -Math.sin(yaw);
  const tz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  return { tx, tz, rx, rz };
}

function orient(group: THREE.Object3D, yaw: number) {
  const { tx, tz } = basisOf(yaw);
  _z.set(tx, 0, tz);
  if (_z.lengthSq() < 1e-8) _z.set(0, 0, -1);
  _z.normalize();
  _x.crossVectors(_up, _z).normalize();
  _m.makeBasis(_x, _up, _z);
  group.quaternion.setFromRotationMatrix(_m);
}

function gradientTexture(stops: [number, string][]) {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function checkerTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 32;
  const g = c.getContext("2d");
  if (!g) return null;
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? "#142033" : "#fff4e0";
    g.fillRect(i * 8, 0, 8, 16);
    g.fillStyle = i % 2 ? "#fff4e0" : "#142033";
    g.fillRect(i * 8, 16, 8, 16);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hazardStripeTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#ffcf33";
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = "#142033";
  g.save();
  for (let i = -128; i < 256; i += 32) {
    g.beginPath();
    g.moveTo(i, 64);
    g.lineTo(i + 16, 64);
    g.lineTo(i + 16 + 32, 0);
    g.lineTo(i + 32, 0);
    g.closePath();
    g.fill();
  }
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function labelTexture(text: string, bg: string, fg: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.font = "700 76px Fredoka, Nunito, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeCat(index: number, build: string = "medium", kind: "cat" | "humanoid" = "cat"): CatRig {
  return makeCatRig(index, build, kind);
}

function trackGeometry(samples: any[], pal: Palette) {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const col = new THREE.Color();

  const add = (x: number, y: number, z: number, nx: number, ny: number, nz: number, c: THREE.Color) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    colors.push(c.r, c.g, c.b);
    return positions.length / 3 - 1;
  };

  const quad = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
    c: THREE.Color,
  ) => {
    _dir.set(bx - ax, by - ay, bz - az);
    _x.set(dx - ax, dy - ay, dz - az);
    _y.crossVectors(_dir, _x);
    if (_y.lengthSq() < 1e-8) _y.set(0, 1, 0);
    _y.normalize();
    const a = add(ax, ay, az, _y.x, _y.y, _y.z, c);
    const b = add(bx, by, bz, _y.x, _y.y, _y.z, c);
    const cI = add(cx, cy, cz, _y.x, _y.y, _y.z, c);
    const d = add(dx, dy, dz, _y.x, _y.y, _y.z, c);
    indices.push(a, b, cI, a, cI, d);
  };

  const corner = (s: any, lat: number, lift: number) => {
    const { rx, rz } = basisOf(s.yaw);
    return [s.x + rx * lat, s.y + lift, s.z + rz * lat] as const;
  };

  const deckCol = new THREE.Color(pal.deck);
  const altCol = new THREE.Color(pal.alt);
  const sideCol = new THREE.Color(pal.side);
  const railCol = new THREE.Color(pal.rail);
  const curbCol = new THREE.Color("#fffaf0");

  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (!a.deck || !b.deck) continue;

    // 4.5m bands alternate the level palette so the course reads as a race track.
    const band = Math.floor(a.s / 4.5) % 2 === 0 ? deckCol : altCol;
    const aL = corner(a, -HALF, 0);
    const aR = corner(a, HALF, 0);
    const bR = corner(b, HALF, 0);
    const bL = corner(b, -HALF, 0);
    quad(aL[0], aL[1], aL[2], aR[0], aR[1], aR[2], bR[0], bR[1], bR[2], bL[0], bL[1], bL[2], band);

    // Dashed centre line.
    if (Math.floor(a.s / 1.9) % 2 === 0) {
      const lift = 0.03;
      const asL = corner(a, -0.14, lift);
      const asR = corner(a, 0.14, lift);
      const bsR = corner(b, 0.14, lift);
      const bsL = corner(b, -0.14, lift);
      quad(asL[0], asL[1], asL[2], asR[0], asR[1], asR[2], bsR[0], bsR[1], bsR[2], bsL[0], bsL[1], bsL[2], col.set("#ffffff"));
    }

    for (const side of [-1, 1] as const) {
      const o = side * HALF;
      const i0 = side * (HALF - 0.24);
      const c0 = corner(a, o, 0.12);
      const c1 = corner(a, i0, 0.12);
      const c2 = corner(b, i0, 0.12);
      const c3 = corner(b, o, 0.12);
      // Winding must flip per side or the +side curb gets a downward normal.
      if (side < 0) quad(c0[0], c0[1], c0[2], c1[0], c1[1], c1[2], c2[0], c2[1], c2[2], c3[0], c3[1], c3[2], curbCol);
      else quad(c0[0], c0[1], c0[2], c3[0], c3[1], c3[2], c2[0], c2[1], c2[2], c1[0], c1[1], c1[2], curbCol);

      // Outer wall down to the deck underside.
      const w0 = corner(a, o, 0);
      const w1 = corner(a, o, -0.72);
      const w2 = corner(b, o, -0.72);
      const w3 = corner(b, o, 0);
      if (side < 0) quad(w0[0], w0[1], w0[2], w1[0], w1[1], w1[2], w2[0], w2[1], w2[2], w3[0], w3[1], w3[2], sideCol);
      else quad(w0[0], w0[1], w0[2], w3[0], w3[1], w3[2], w2[0], w2[1], w2[2], w1[0], w1[1], w1[2], sideCol);

      // Floating safety rail above the curb.
      const r0 = corner(a, o, 0.72);
      const r1 = corner(a, o, 0.9);
      const r2 = corner(b, o, 0.9);
      const r3 = corner(b, o, 0.72);
      if (side < 0) quad(r0[0], r0[1], r0[2], r1[0], r1[1], r1[2], r2[0], r2[1], r2[2], r3[0], r3[1], r3[2], railCol);
      else quad(r0[0], r0[1], r0[2], r3[0], r3[1], r3[2], r2[0], r2[1], r2[2], r1[0], r1[1], r1[2], railCol);
      const s0 = corner(a, o, 0.42);
      const s1 = corner(a, o, 0.54);
      const s2 = corner(b, o, 0.54);
      const s3 = corner(b, o, 0.42);
      if (side < 0) quad(s0[0], s0[1], s0[2], s1[0], s1[1], s1[2], s2[0], s2[1], s2[2], s3[0], s3[1], s3[2], railCol);
      else quad(s0[0], s0[1], s0[2], s3[0], s3[1], s3[2], s2[0], s2[1], s2[2], s1[0], s1[1], s1[2], railCol);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return geo;
}

/**
 * Drop an object onto the track at arc-length `s`, offset `lat` sideways.
 *
 * The local frame is the one every builder assumes: +Z runs down the track,
 * +Y is up, and local X is the *negated* lateral (so `x = -lat` lands on
 * world lateral `lat`). That comes out of `orient`, whose X axis is
 * `cross(up, forward)`.
 */
function placeOn(obj: THREE.Object3D, track: any, s: number, lat = 0, lift = 0) {
  const p = poseAt(track, s);
  obj.position.set(p.x + p.rx * lat, p.y + lift, p.z + p.rz * lat);
  orient(obj, p.yaw);
  return p;
}

export function createWorld(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#9ad7f6");
  scene.fog = new THREE.Fog("#cfeeff", 30, 110);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 620);
  camera.position.set(0, 6, 12);

  const hemi = new THREE.HemisphereLight("#eaf7ff", "#f2c98a", 0.72);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff6e4", 1.5);
  sun.position.set(18, 28, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.045;
  const cam = sun.shadow.camera;
  cam.near = 1;
  cam.far = 80;
  cam.left = -18;
  cam.right = 18;
  cam.top = 18;
  cam.bottom = -18;
  scene.add(sun);
  scene.add(sun.target);
  const rim = new THREE.DirectionalLight("#cfe6ff", 0.35);
  rim.position.set(-14, 10, -18);
  scene.add(rim);

  // Sky dome — a vertical gradient instead of a flat clear colour.
  const skyTex = gradientTexture([
    [0, "#2f8fe0"],
    [0.42, "#7cc6f2"],
    [0.72, "#cfeeff"],
    [1, "#ffeacb"],
  ]);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 24, 16),
    new THREE.MeshBasicMaterial({
      map: skyTex ?? undefined,
      color: skyTex ? "#ffffff" : "#9ad7f6",
      side: THREE.BackSide,
      fog: false,
    }),
  );
  scene.add(sky);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(260, 48),
    new THREE.MeshStandardMaterial({ color: "#39b3e6", roughness: 0.16, metalness: 0.18 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -3.4;
  water.receiveShadow = true;
  scene.add(water);

  const skyGroup = new THREE.Group();
  scene.add(skyGroup);

  // The sun used to be an unpositioned white sphere sitting on the start line.
  // Put it high in the sky, give it a glow and proper cartoon rays.
  const sunGroup = new THREE.Group();
  sunGroup.position.set(-58, 52, -120);
  skyGroup.add(sunGroup);

  const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(5.4, 28, 20),
    new THREE.MeshBasicMaterial({ color: "#ffe27a", fog: false }),
  );
  sunGroup.add(sunBall);

  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  const glowCtx = glowCanvas.getContext("2d");
  if (glowCtx) {
    const g = glowCtx.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, "rgba(255,246,190,0.95)");
    g.addColorStop(0.38, "rgba(255,226,122,0.55)");
    g.addColorStop(1, "rgba(255,226,122,0)");
    glowCtx.fillStyle = g;
    glowCtx.fillRect(0, 0, 128, 128);
  }
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  glow.scale.set(30, 30, 1);
  sunGroup.add(glow);

  const rayMat = new THREE.MeshBasicMaterial({
    color: "#ffe9a8",
    transparent: true,
    opacity: 0.9,
    fog: false,
  });
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const ray = new THREE.Mesh(new THREE.ConeGeometry(0.62, i % 2 === 0 ? 4.4 : 2.8, 5), rayMat);
    ray.position.set(Math.cos(angle) * 8.6, Math.sin(angle) * 8.6, 0);
    ray.rotation.z = angle - Math.PI / 2;
    sunGroup.add(ray);
  }
  const sunRing = new THREE.Mesh(
    new THREE.TorusGeometry(7.4, 0.28, 8, 40),
    new THREE.MeshBasicMaterial({ color: "#fff0b0", transparent: true, opacity: 0.55, fog: false }),
  );
  sunGroup.add(sunRing);

  const cloudMat = new THREE.MeshStandardMaterial({ color: "#fffaf2", roughness: 0.95 });
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.5 + (k % 2) * 0.7, 10, 8), cloudMat);
      puff.position.set(k * 1.6 - 2, Math.sin(k * 1.7) * 0.3, (k % 2) * 0.8);
      puff.scale.y = 0.62;
      cloud.add(puff);
    }
    cloud.position.set(-56 + i * 13, 22 + (i % 4) * 3.4, -34 - (i % 5) * 12);
    skyGroup.add(cloud);
  }

  const CATS = [makeCat(0, "medium", "cat"), makeCat(1, "slim", "cat"), makeCat(2, "chubby", "cat"), makeCat(3, "superhero", "cat")];
  const rigs = CATS;
  for (const rig of rigs) scene.add(rig.group);

  function hatMaterial(color: string, metalness = 0.08) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness });
  }

  function clearHat(rig: CatRig) {
    const root = rig.hatRoot;
    if (!root) return;
    for (const child of [...root.children]) {
      root.remove(child);
      child.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
    }
  }

  function buildHat(rig: CatRig, id: string) {
    const root = rig.hatRoot;
    if (!root) return;
    clearHat(rig);
    if (id === "none") return;

    const gold = hatMaterial("#ffb020", 0.45);
    const ink = hatMaterial("#142033", 0.1);
    const cream = hatMaterial("#fff4e0", 0.02);
    const coral = hatMaterial("#ff4d6d", 0.08);
    const violet = hatMaterial("#7b5cff", 0.08);
    const sky = hatMaterial("#3db7ff", 0.08);
  const mint = hatMaterial("#1fce93", 0.08);
    const add = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x = 0,
      y = 0,
      z = 0,
      rot?: [number, number, number],
      scale?: [number, number, number],
    ) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
      if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
      mesh.castShadow = true;
      root.add(mesh);
      return mesh;
    };

    if (id === "cap") {
      add(new THREE.SphereGeometry(0.315, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), coral, 0, 0.02, 0, undefined, [1.04, 0.92, 1.04]);
      add(new THREE.BoxGeometry(0.64, 0.055, 0.42), coral, 0, 0.03, 0.14);
      add(new THREE.SphereGeometry(0.045, 8, 6), cream, 0, 0.3, 0);
    } else if (id === "crown") {
      add(new THREE.CylinderGeometry(0.27, 0.29, 0.16, 16), gold, 0, 0.1, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(new THREE.ConeGeometry(0.065, 0.22, 5), gold, Math.cos(a) * 0.235, 0.28, Math.sin(a) * 0.235);
        add(new THREE.SphereGeometry(0.032, 6, 5), coral, Math.cos(a) * 0.235, 0.4, Math.sin(a) * 0.235);
      }
    } else if (id === "wizard") {
      add(new THREE.CylinderGeometry(0.44, 0.46, 0.05, 20), violet, 0, 0.03, 0);
      add(new THREE.ConeGeometry(0.31, 0.72, 16), violet, 0, 0.41, 0);
      add(new THREE.TorusGeometry(0.23, 0.03, 6, 18), gold, 0, 0.22, 0, [Math.PI / 2, 0, 0]);
      add(new THREE.SphereGeometry(0.055, 8, 6), gold, 0, 0.79, 0);
    } else if (id === "headphones") {
      add(new THREE.TorusGeometry(0.34, 0.045, 8, 22, Math.PI), ink, 0, 0.1, 0);
      for (const side of [-1, 1]) {
        add(new THREE.CylinderGeometry(0.1, 0.1, 0.09, 14), ink, side * 0.35, 0.08, 0, [0, 0, Math.PI / 2]);
        add(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), coral, side * 0.39, 0.08, 0, [0, 0, Math.PI / 2]);
      }
    } else if (id === "flower") {
      add(new THREE.SphereGeometry(0.075, 10, 8), gold, 0, 0.3, 0);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        add(new THREE.SphereGeometry(0.078, 9, 7), cream, Math.cos(a) * 0.14, 0.3, Math.sin(a) * 0.14, undefined, [1, 0.45, 1]);
      }
    } else if (id === "halo") {
      add(new THREE.TorusGeometry(0.29, 0.035, 8, 24), gold, 0, 0.56, 0, [Math.PI / 2, 0, 0]);
      const glow = new THREE.MeshStandardMaterial({
        color: "#ffe066",
        emissive: "#ffb020",
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.35,
        roughness: 0.3,
      });
      const ring = add(new THREE.TorusGeometry(0.29, 0.075, 8, 24), glow, 0, 0.56, 0, [Math.PI / 2, 0, 0]);
      ring.name = "hatHalo";
    } else if (id === "propeller") {
      add(new THREE.SphereGeometry(0.315, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), sky, 0, 0.02, 0, undefined, [1.03, 0.9, 1.03]);
      add(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6), ink, 0, 0.34, 0);
      const prop = new THREE.Group();
      prop.name = "hatProp";
      prop.position.y = 0.43;
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.018, 0.085), gold);
        blade.position.x = Math.cos((i / 3) * Math.PI * 2) * 0.16;
        blade.position.z = Math.sin((i / 3) * Math.PI * 2) * 0.16;
        blade.rotation.y = -(i / 3) * Math.PI * 2;
        blade.castShadow = true;
        prop.add(blade);
      }
      root.add(prop);
    } else if (id === "bow") {
      // Ribbon bow
      add(new THREE.SphereGeometry(0.12, 10, 8), coral, 0, 0.32, 0, undefined, [1.4, 0.6, 1.0]);
      add(new THREE.SphereGeometry(0.12, 10, 8), coral, -0.18, 0.32, 0, undefined, [1.0, 0.6, 1.4]);
      add(new THREE.SphereGeometry(0.12, 10, 8), coral, 0.18, 0.32, 0, undefined, [1.0, 0.6, 1.4]);
      add(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8), gold, 0, 0.32, 0);
    } else if (id === "antenna") {
      // Alien antenna
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), ink, 0, 0.22, 0);
      add(new THREE.SphereGeometry(0.06, 8, 6), mint, 0, 0.45, 0);
      add(new THREE.SphereGeometry(0.03, 6, 5), cream, 0, 0.45, 0.04);
    } else if (id === "horns") {
      // Devil horns
      for (const side of [-1, 1]) {
        add(new THREE.ConeGeometry(0.07, 0.25, 6), coral, side * 0.18, 0.32, -0.05, [0, 0, -side * 0.3]);
        add(new THREE.SphereGeometry(0.04, 6, 5), gold, side * 0.18, 0.45, -0.05);
      }
    } else if (id === "tiara") {
      // Princess tiara
      add(new THREE.TorusGeometry(0.26, 0.025, 6, 20), gold, 0, 0.12, 0, [Math.PI / 2, 0, 0]);
      add(new THREE.SphereGeometry(0.06, 8, 6), coral, 0, 0.2, 0.22);
      add(new THREE.SphereGeometry(0.04, 6, 5), cream, -0.15, 0.15, 0.15);
      add(new THREE.SphereGeometry(0.04, 6, 5), cream, 0.15, 0.15, 0.15);
    } else if (id === "helmet") {
      // Space helmet
      add(new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), sky, 0, 0.02, 0, undefined, [1.0, 0.95, 1.0]);
      add(new THREE.SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), cream, 0, 0.06, 0.08, undefined, [1.0, 0.85, 0.9]);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6), gold, 0.28, 0.15, 0, [0, 0, Math.PI / 2]);
    } else if (id === "tophat") {
      // Top hat
      add(new THREE.CylinderGeometry(0.28, 0.3, 0.12, 16), ink, 0, 0.08, 0);
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.45, 16), ink, 0, 0.35, 0);
      add(new THREE.TorusGeometry(0.26, 0.025, 6, 20), gold, 0, 0.08, 0, [Math.PI / 2, 0, 0]);
    }
  }

  let currentHat = "none";
  let currentColor = "#8fb0dd";

  function setHat(id: string) {
    currentHat = id;
    buildHat(CATS[0], id);
  }

  function setBuild(build: string) {
    const oldRig = CATS[0];
    scene.remove(oldRig.group);
    oldRig.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    const newRig = makeCatRig(0, build, "cat");
    newRig.fur?.color.set(currentColor);
    newRig.furColor = currentColor;
    for (const m of newRig.stripes ?? []) m.color.copy(new THREE.Color(currentColor).multiplyScalar(0.52));
    buildHat(newRig, currentHat);
    scene.add(newRig.group);
    CATS[0] = newRig;
    rigs[0] = newRig;
  }

  const pools: Particle[] = [];
  const makePool = (
    kind: Particle["kind"],
    count: number,
    geo: THREE.BufferGeometry,
    factory: (i: number) => THREE.Material,
  ) => {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, factory(i));
      mesh.visible = false;
      scene.add(mesh);
      pools.push({ mesh, life: 0, max: 1, vel: new THREE.Vector3(), spin: new THREE.Vector3(), gravity: 0, kind });
    }
  };

  const dustGeo = new THREE.SphereGeometry(0.13, 6, 5);
  makePool("dust", 26, dustGeo, () => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6, depthWrite: false }));
  const sparkGeo = new THREE.OctahedronGeometry(0.12, 0);
  makePool("spark", 26, sparkGeo, () => new THREE.MeshBasicMaterial({ color: "#ffd23f", transparent: true, opacity: 1, depthWrite: false }));
  const starGeo = new THREE.TetrahedronGeometry(0.16, 0);
  makePool("star", 16, starGeo, () => new THREE.MeshBasicMaterial({ color: "#ffe066", transparent: true, opacity: 1, depthWrite: false }));
  const confettiGeo = new THREE.PlaneGeometry(0.17, 0.26);
  const confettiColors = ["#ff4d6d", "#ffd23f", "#4cc9f0", "#8ce99a", "#b197fc", "#ffffff"];
  makePool("confetti", 90, confettiGeo, (i) => new THREE.MeshBasicMaterial({ color: confettiColors[i % confettiColors.length], side: THREE.DoubleSide, depthWrite: false }));

  const trackMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05 });
  const pillarGeo = new THREE.CylinderGeometry(0.34, 0.44, 1, 8);
  const pillarMat = new THREE.MeshStandardMaterial({ color: "#e2a05a", roughness: 0.65 });
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.78, 6);
  const postMat = new THREE.MeshStandardMaterial({ color: "#fffaf0", roughness: 0.5 });
  const coinGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 14);
  coinGeo.rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshStandardMaterial({
    color: "#ffb020",
    emissive: "#ffb020",
    emissiveIntensity: 0.4,
    metalness: 0.6,
    roughness: 0.25,
    side: THREE.DoubleSide,
  });
  const archMat = new THREE.MeshStandardMaterial({
    color: "#1fce93",
    emissive: "#1fce93",
    emissiveIntensity: 0.35,
    roughness: 0.32,
  });
  const coralMat = new THREE.MeshStandardMaterial({ color: "#ff4d6d", roughness: 0.35, metalness: 0.08 });
  const creamMat = new THREE.MeshStandardMaterial({ color: "#fff4e0", roughness: 0.4 });
  const inkMat = new THREE.MeshStandardMaterial({ color: "#142033", roughness: 0.45 });
  const tealMat = new THREE.MeshStandardMaterial({
    color: "#14c4b4",
    emissive: "#0d8f86",
    emissiveIntensity: 0.2,
    roughness: 0.32,
    metalness: 0.2,
  });
  const metalMat = new THREE.MeshStandardMaterial({ color: "#d5dde6", roughness: 0.25, metalness: 0.55 });
  const chainMat = new THREE.MeshStandardMaterial({ color: "#8fa3b8", roughness: 0.4, metalness: 0.5 });
  const checker = checkerTexture();
  const stripes = hazardStripeTexture();
  const finishTex = labelTexture("FINISH", "#142033", "#ffd23f");
  const startTex = labelTexture("START", "#1fce93", "#ffffff");
  const cutTex = labelTexture("CUT", "#ff4d6d", "#fff4e0");
  const bannerMat = new THREE.MeshStandardMaterial({ map: checker ?? undefined, roughness: 0.7, side: THREE.DoubleSide });
  const stripeMat = new THREE.MeshStandardMaterial({ map: stripes ?? undefined, roughness: 0.5, metalness: 0.1 });
  const finishMat = new THREE.MeshBasicMaterial({ map: finishTex ?? undefined, side: THREE.DoubleSide, transparent: !!finishTex });
  const startMat = new THREE.MeshBasicMaterial({ map: startTex ?? undefined, side: THREE.DoubleSide, transparent: !!startTex });
  const cutMat = new THREE.MeshBasicMaterial({ map: cutTex ?? undefined, side: THREE.DoubleSide, transparent: !!cutTex });

  const sharedGeo = new Set<THREE.BufferGeometry>([pillarGeo, postGeo, coinGeo, confettiGeo, sparkGeo, starGeo, dustGeo]);
  const sharedMat = new Set<THREE.Material>([
    pillarMat, postMat, coinMat, archMat, coralMat, creamMat, inkMat, tealMat, metalMat, chainMat,
    bannerMat, stripeMat, finishMat, startMat, cutMat, trackMat, cloudMat,
  ]);

  let levelRoot = new THREE.Group();
  scene.add(levelRoot);
  let builtGen = -1;
  let coinsMesh: THREE.InstancedMesh | null = null;
  let hazardRoots: THREE.Group[] = [];
  let archMats: THREE.MeshStandardMaterial[] = [];
  let cutRoots: THREE.Group[] = [];
  let snapCam = true;
  let dustT = 0;
  let prevTaken: boolean[] = [];
  let prevState: any = "run";
  let prevEliminated = false;
  let prevCountdown = 0;
  let coinPop: { i: number; t: number }[] = [];

  function clearLevel() {
    scene.remove(levelRoot);
    levelRoot.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry && !sharedGeo.has(mesh.geometry)) mesh.geometry.dispose();
      const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => !sharedMat.has(m) && m.dispose());
      else if (mat && !sharedMat.has(mat)) mat.dispose();
    });
    levelRoot = new THREE.Group();
    scene.add(levelRoot);
    coinsMesh = null;
    hazardRoots = [];
    archMats = [];
    cutRoots = [];
  }

  /** Buildings and balloons scatter along the course, not just near the origin. */
  function addScenery(track: any) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const palette = ["#f6d7a8", "#f7c1cc", "#c7ebdd", "#b7def3", "#f0e4cf", "#ffd8a8"];
    const count = 56;
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 }), count);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    let n = 0;
    for (let i = 6; i < track.samples.length && n < count; i += 9) {
      const s = track.samples[i];
      if (!s.deck) continue;
      const side = (i / 9) % 2 === 0 ? 1 : -1;
      const dist = 17 + ((i * 7) % 30);
      const { rx, rz } = basisOf(s.yaw);
      const x = s.x + rx * side * dist;
      const z = s.z + rz * side * dist;
      const h = 4 + ((i * 13) % 11);
      _pos.set(x, h / 2 - 3.2, z);
      _scale.set(3 + ((i * 5) % 4), h, 3 + ((i * 3) % 4));
      _q.identity();
      _m.compose(_pos, _q, _scale);
      mesh.setMatrixAt(n, _m);
      mesh.setColorAt(n, new THREE.Color(palette[n % palette.length]));
      n++;
    }
    mesh.count = n;
    mesh.receiveShadow = true;
    levelRoot.add(mesh);

    // Balloons drifting above the course.
    const balloonGeo = new THREE.SphereGeometry(0.7, 12, 10);
    balloonGeo.scale(1, 1.2, 1);
    const balloonMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35 });
    const balloons = new THREE.InstancedMesh(balloonGeo, balloonMat, 26);
    balloons.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(26 * 3), 3);
    const bright = ["#ff4d6d", "#ffd23f", "#4cc9f0", "#8ce99a", "#b197fc", "#ffa8cc"];
    let b = 0;
    for (let i = 8; i < track.samples.length && b < 26; i += 17) {
      const s = track.samples[i];
      const side = b % 2 === 0 ? 1 : -1;
      const { rx, rz } = basisOf(s.yaw);
      const x = s.x + rx * side * (5 + (b % 4));
      const z = s.z + rz * side * (5 + (b % 4));
      const y = s.y + 6 + (b % 5) * 1.6;
      _pos.set(x, y, z);
      _q.identity();
      _scale.set(1, 1, 1);
      _m.compose(_pos, _q, _scale);
      balloons.setMatrixAt(b, _m);
      balloons.setColorAt(b, new THREE.Color(bright[b % bright.length]));
      b++;
    }
    balloons.count = b;
    levelRoot.add(balloons);
    // Balloons only move with their transform, so keep them out of the shadow pass.
    balloons.castShadow = false;
  }

  function addPillars(track: any) {
    const spots: any[] = [];
    for (let i = 0; i < track.samples.length; i += 6) {
      const s = track.samples[i];
      if (s.deck && s.y > 0.4) spots.push(s);
    }
    if (spots.length === 0) return;
    const mesh = new THREE.InstancedMesh(pillarGeo, pillarMat, spots.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    spots.forEach((s, i) => {
      const h = Math.max(0.6, s.y + 3.4);
      _pos.set(s.x, s.y - h / 2, s.z);
      _q.identity();
      _scale.set(1, h, 1);
      _m.compose(_pos, _q, _scale);
      mesh.setMatrixAt(i, _m);
    });
    levelRoot.add(mesh);
  }

  function addPosts(track: any) {
    const spots: any[] = [];
    for (let i = 0; i < track.samples.length; i += 11) {
      const s = track.samples[i];
      if (s.deck) spots.push(s);
    }
    if (spots.length === 0) return;
    const mesh = new THREE.InstancedMesh(postGeo, postMat, spots.length * 2);
    mesh.castShadow = true;
    let n = 0;
    for (const s of spots) {
      const { rx, rz } = basisOf(s.yaw);
      for (const side of [-1, 1] as const) {
        _pos.set(s.x + rx * side * (HALF - 0.03), s.y + 0.42, s.z + rz * side * (HALF - 0.03));
        _q.identity();
        _scale.set(1, 1, 1);
        _m.compose(_pos, _q, _scale);
        mesh.setMatrixAt(n++, _m);
      }
    }
    mesh.count = n;
    levelRoot.add(mesh);
  }

  function addGates(track: any) {
    // Finish gate with a real banner, plus the start arch behind the line.
    const finish = new THREE.Group();
    placeOn(finish, track, Math.max(0, track.length - 0.8), 0, 0);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 3.4, 10), inkMat);
      post.position.set(side * 2.6, 1.7, 0);
      post.castShadow = true;
      finish.add(post);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.34, 0.34), coralMat);
    top.position.y = 3.35;
    top.castShadow = true;
    finish.add(top);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), finishMat);
    banner.position.set(0, 2.7, 0.05);
    // Local +Z is the direction of travel, so a runner approaching the line
    // sees the plane's back face — without this the FINISH text reads mirrored.
    banner.rotation.y = Math.PI;
    finish.add(banner);
    for (let i = -2; i <= 2; i++) {
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34), bannerMat);
      flag.position.set(i * 0.86, 1.95, 0.06);
      finish.add(flag);
    }
    levelRoot.add(finish);

    const pad = new THREE.Group();
    placeOn(pad, track, Math.max(0, track.length - 1.6), 0, 0.05);
    const padMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 1.6), bannerMat);
    padMesh.rotation.x = -Math.PI / 2;
    pad.add(padMesh);
    levelRoot.add(pad);

    const start = new THREE.Group();
    placeOn(start, track, 1.4, 0, 0);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.9, 10), inkMat);
      post.position.set(side * 2.5, 1.45, 0);
      post.castShadow = true;
      start.add(post);
    }
    const startBanner = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.0), startMat);
    startBanner.position.y = 2.5;
    startBanner.rotation.y = Math.PI;
    start.add(startBanner);
    const startBar = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.24, 0.24), archMat);
    startBar.position.y = 3.05;
    start.add(startBar);
    levelRoot.add(start);

    const stripe = new THREE.Group();
    placeOn(stripe, track, 3.4, 0, 0.04);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.32), bannerMat);
    line.rotation.x = -Math.PI / 2;
    stripe.add(line);
    levelRoot.add(stripe);
  }

  function addCheckpoint(track: any, s: number) {
    if (s < 2) return;
    const group = new THREE.Group();
    placeOn(group, track, s, 0, 0);
    const mat = archMat.clone();
    archMats.push(mat);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.4, 8), mat);
      post.position.set(side * 2.15, 1.2, 0);
      post.castShadow = true;
      group.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.14, 0.14), mat);
    beam.position.y = 2.4;
    group.add(beam);
    const pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), bannerMat);
    pennant.position.set(1.6, 2.75, 0);
    group.add(pennant);
    levelRoot.add(group);
  }

  function addCutGate(track: any, s: number) {
    const group = new THREE.Group();
    placeOn(group, track, s, 0, 0);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.3, 10), coralMat);
      post.position.set(side * 2.45, 1.65, 0);
      post.castShadow = true;
      group.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.28, 0.28), coralMat);
    beam.position.y = 3.3;
    beam.castShadow = true;
    group.add(beam);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.95), cutMat);
    banner.position.set(0, 2.6, 0.05);
    banner.rotation.y = Math.PI;
    group.add(banner);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 0.72), stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.y = 0.045;
    group.add(stripe);
    levelRoot.add(group);
    cutRoots.push(group);
  }

  function buildHazard(track: any, h: any) {
    const root = new THREE.Group();
    placeOn(root, track, h.at, 0, 0);
    if (h.kind === "hammer") {
      const pose = hammerPose(h, 0);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1, 8), metalMat);
      pole.scale.y = pose.pivotY;
      pole.position.set(-pose.pivotLat, pose.pivotY / 2, 0);
      pole.castShadow = true;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6), creamMat);
      arm.castShadow = true;
      arm.name = "arm";
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.76, 14), coralMat);
      head.rotation.x = Math.PI / 2;
      head.castShadow = true;
      head.name = "head";
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.06, 6, 16), inkMat);
      band.name = "band";
      root.add(pole, arm, head, band);
    } else if (h.kind === "ball") {
      // A-frame gantry with a giant ball on a chain.
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 5.3, 8), metalMat);
        leg.position.set(-side * 1.3, 2.15, 0);
        leg.rotation.z = side * 0.42;
        leg.castShadow = true;
        root.add(leg);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 0.2), metalMat);
      beam.position.y = 4.5;
      beam.castShadow = true;
      root.add(beam);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), chainMat);
      chain.name = "chain";
      root.add(chain);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.82, 18, 14), tealMat);
      orb.castShadow = true;
      orb.name = "orb";
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.83, 0.07, 6, 20), creamMat);
      band.rotation.x = Math.PI / 2;
      orb.add(band);
      root.add(orb);
    } else if (h.kind === "pusher") {
      const block = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 1.15), stripeMat);
      block.name = "block";
      block.castShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(6.05, 0.16, 1.25), inkMat);
      cap.position.y = 0.72;
      block.add(cap);
      const base = new THREE.Mesh(new THREE.BoxGeometry(6.05, 0.16, 1.25), inkMat);
      base.position.y = -0.72;
      block.add(base);
      root.add(block);
      for (const side of [-1, 1]) {
        const housing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.9, 1.5), metalMat);
        housing.position.set(-side * 3.35, 0.7, 0);
        housing.castShadow = true;
        root.add(housing);
      }
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1, 8), metalMat);
      rod.rotation.z = Math.PI / 2;
      rod.name = "rod";
      root.add(rod);
    } else if (h.kind === "rotor") {
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.46, 12), metalMat);
      hub.position.y = 1.05;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.26, 0.32), coralMat);
      bar.position.y = 1.05;
      bar.castShadow = true;
      bar.name = "bar";
      const knobA = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), inkMat);
      knobA.position.set(-2.55, 1.05, 0);
      const knobB = knobA.clone();
      knobB.position.x = 2.55;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.22, 12), inkMat);
      base.position.y = 0.11;
      root.add(hub, bar, knobA, knobB, base);
    } else if (h.kind === "saw") {
      const spin = new THREE.Group();
      spin.name = "spin";
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.18, 18), tealMat);
      disc.rotation.z = Math.PI / 2;
      disc.castShadow = true;
      spin.add(disc);
      for (let i = 0; i < 10; i++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.18), creamMat);
        const a = (i / 10) * Math.PI * 2;
        tooth.position.set(0, Math.cos(a) * 1.05, Math.sin(a) * 1.05);
        tooth.rotation.x = -a;
        spin.add(tooth);
      }
      const hubcap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.24, 10), inkMat);
      hubcap.rotation.z = Math.PI / 2;
      spin.add(hubcap);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 8), metalMat);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.1, 0.1), inkMat);
      rail.position.y = 0.06;
      root.add(spin, post, rail);
    } else if (h.kind === "bar") {
      const left = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 0.3), coralMat);
      const right = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 0.3), coralMat);
      left.name = "left";
      right.name = "right";
      left.castShadow = true;
      right.castShadow = true;
      left.position.y = 0.74;
      right.position.y = 0.74;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.1, 0.1), inkMat);
      rail.position.y = 1.2;
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.5, 8), metalMat);
        post.position.set(-side * 2.7, 0.75, 0);
        post.castShadow = true;
        root.add(post);
      }
      root.add(left, right, rail);
    } else if (h.kind === "laser") {
      // Two posts + a glowing horizontal beam across the track.
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.4, 8), metalMat);
        post.position.set(-side * 2.6, 0.7, 0);
        post.castShadow = true;
        root.add(post);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.12, 0.12), coralMat);
      beam.position.y = 1.2;
      beam.castShadow = true;
      beam.name = "beam";
      root.add(beam);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.35, 0.35), new THREE.MeshBasicMaterial({ color: "#ff4d6d", transparent: true, opacity: 0.35, fog: false }));
      glow.position.y = 1.2;
      glow.name = "glow";
      root.add(glow);
    } else if (h.kind === "spinner") {
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.3, 12), metalMat);
      hub.position.y = 0.15;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 0.3), coralMat);
      bar.position.y = 0.22;
      bar.castShadow = true;
      bar.name = "bar";
      const knobA = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), inkMat);
      knobA.position.set(-2.2, 0.22, 0);
      const knobB = knobA.clone();
      knobB.position.x = 2.2;
      root.add(hub, bar, knobA, knobB);
    } else if (h.kind === "bounce") {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.15, 20), new THREE.MeshStandardMaterial({ color: "#1fce93", roughness: 0.4, metalness: 0.1, emissive: "#1fce93", emissiveIntensity: 0.3 }));
      pad.position.y = 0.075;
      pad.castShadow = true;
      pad.name = "pad";
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 8, 24), new THREE.MeshBasicMaterial({ color: "#ffe066", transparent: true, opacity: 0.7, fog: false }));
      ring.position.y = 0.15;
      ring.rotation.x = Math.PI / 2;
      ring.name = "ring";
      root.add(pad, ring);
    } else {
      const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 0.2), inkMat);
      const frameR = frameL.clone();
      frameL.position.set(-2.55, 1.8, 0);
      frameR.position.set(2.55, 1.8, 0);
      const girdle = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.18, 0.18), inkMat);
      girdle.position.y = 3.5;
      const block = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.15, 1.4), stripeMat);
      block.name = "block";
      block.castShadow = true;
      root.add(block, frameL, frameR, girdle);
    }
    levelRoot.add(root);
    hazardRoots.push(root);
  }

  function build(sim: any) {
    clearLevel();
    const track = sim.level.track;
    const pal = PALETTES[sim.level.id % PALETTES.length];
    const geo = trackGeometry(track.samples, pal);
    const mesh = new THREE.Mesh(geo, trackMat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    levelRoot.add(mesh);
    addPillars(track);
    addPosts(track);
    addScenery(track);
    addGates(track);
    for (const c of sim.level.checkpoints) addCheckpoint(track, c);
    if (sim.mode === "elimination") {
      for (const g of sim.gates) addCutGate(track, g);
    }
    for (const h of sim.level.hazards) buildHazard(track, h);

    coinsMesh = new THREE.InstancedMesh(coinGeo, coinMat, Math.max(1, sim.coins.length));
    coinsMesh.count = sim.coins.length;
    coinsMesh.castShadow = true;
    levelRoot.add(coinsMesh);
    builtGen = sim.gen;
    snapCam = true;
    prevTaken = sim.coins.map((c: any) => c.taken);
    prevState = sim.player.state;
    prevEliminated = sim.player.eliminated;
    prevCountdown = sim.countdown;
    coinPop = [];
  }

  function updateHazards(hazards: any, time: number, playerS: number, racing: boolean) {
    hazards.forEach((h: any, i: number) => {
      const root = hazardRoots[i];
      if (!root) return;
      // A chase cam drives straight through the trap it just cleared: drop the
      // ones well behind the runner instead of letting their posts fill the
      // screen. The cut-off has to sit *behind the camera*, not just behind the
      // runner — otherwise a trap still on screen pops out of existence.
      root.visible = !(racing && h.at < playerS - 14);
      if (!root.visible) return;
      if (h.kind === "hammer") {
        const pose = hammerPose(h, time);
        const arm = root.getObjectByName("arm") as THREE.Mesh;
        const head = root.getObjectByName("head") as THREE.Mesh;
        const band = root.getObjectByName("band") as THREE.Mesh;
        const len = Math.hypot(pose.headLat - pose.pivotLat, pose.headY - pose.pivotY) || 1;
        arm.position.set(-(pose.pivotLat + pose.headLat) / 2, (pose.pivotY + pose.headY) / 2, 0);
        arm.scale.y = len;
        _dir.set(-(pose.headLat - pose.pivotLat), pose.headY - pose.pivotY, 0);
        if (_dir.lengthSq() > 1e-6) {
          _dir.normalize();
          arm.quaternion.setFromUnitVectors(_up, _dir);
        }
        // The barrel stays parallel to the track (local +Z) while the arm swings.
        head.position.set(-pose.headLat, pose.headY, 0);
        band.position.copy(head.position);
      } else if (h.kind === "ball") {
        const pose = ballPose(h, time);
        const chain = root.getObjectByName("chain") as THREE.Mesh;
        const orb = root.getObjectByName("orb") as THREE.Mesh;
        const midY = (pose.pivotY + pose.y) / 2;
        const midX = -pose.lat / 2;
        const len = Math.hypot(pose.lat, pose.pivotY - pose.y) || 1;
        chain.position.set(midX, midY, 0);
        chain.scale.y = len;
        _dir.set(-pose.lat, pose.y - pose.pivotY, 0);
        if (_dir.lengthSq() > 1e-6) {
          _dir.normalize();
          chain.quaternion.setFromUnitVectors(_up, _dir);
        }
        orb.position.set(-pose.lat, pose.y, 0);
        orb.rotation.z = -pose.phi * 0.6;
      } else if (h.kind === "pusher") {
        const edge = pusherEdge(h, time);
        const e = 1 - Math.min(1, Math.abs(edge) / 3.55);
        const block = root.getObjectByName("block") as THREE.Mesh;
        const rod = root.getObjectByName("rod") as THREE.Mesh;
        const center = edge + h.side * 3.0;
        const blockX = -center;
        const housingX = -h.side * 3.35;
        block.position.set(blockX, 0.78, 0);
        const len = Math.abs(blockX - housingX);
        rod.position.set((blockX + housingX) / 2, 0.78, 0);
        rod.scale.set(1, Math.max(0.02, len), 1);
        rod.visible = len > 0.5;
        void e;
      } else if (h.kind === "rotor") {
        const bar = root.getObjectByName("bar");
        if (bar) bar.rotation.y = rotorAngle(h, time);
      } else if (h.kind === "saw") {
        const spin = root.getObjectByName("spin");
        if (spin) {
          spin.position.x = sawLat(h, time);
          spin.rotation.x = time * 7;
        }
      } else if (h.kind === "bar") {
        const gap = barGap(h, time);
        const open = 0.82;
        const leftEnd = Math.max(-HALF, gap - open);
        const rightStart = Math.min(HALF, gap + open);
        const left = root.getObjectByName("left") as THREE.Mesh;
        const right = root.getObjectByName("right") as THREE.Mesh;
        const lw = Math.max(0.05, leftEnd + HALF);
        const rw = Math.max(0.05, HALF - rightStart);
        left.scale.x = lw;
        right.scale.x = rw;
        left.position.x = (HALF - leftEnd) / 2;
        right.position.x = -(rightStart + HALF) / 2;
      } else if (h.kind === "laser") {
        const beam = root.getObjectByName("beam") as THREE.Mesh;
        const glow = root.getObjectByName("glow") as THREE.Mesh;
        const on = laserOn(h, time);
        if (beam) beam.visible = on;
        if (glow) glow.visible = on;
      } else if (h.kind === "spinner") {
        const bar = root.getObjectByName("bar");
        if (bar) bar.rotation.y = spinnerAngle(h, time);
      } else if (h.kind === "bounce") {
        const ring = root.getObjectByName("ring");
        if (ring) ring.scale.setScalar(1 + Math.sin(time * 4 + h.phase * 6) * 0.08);
      } else {
        const block = root.getObjectByName("block") as THREE.Mesh;
        const bottom = crusherBottom(h, time);
        block.position.y = bottom + 0.57;
      }
    });
  }

  function updateCutGates(sim: any, elapsed: number) {
    cutRoots.forEach((root, i) => {
      const live = i >= sim.gateIndex && sim.mode === "elimination";
      root.visible = live;
      if (!live) return;
      const pulse = 1 + Math.sin(elapsed * 5 + i * 1.7) * 0.018;
      root.scale.set(pulse, pulse, pulse);
    });
  }

  function updateCoins(sim: any, elapsed: number) {
    if (!coinsMesh) return;
    const track = sim.level.track;
    for (let i = 0; i < sim.coins.length; i++) {
      const c = sim.coins[i];
      if (c.taken) {
        _scale.set(0, 0, 0);
        _pos.set(0, -10, 0);
        _q.identity();
      } else {
        const pop = coinPop.find((p) => p.i === i);
        const popK = pop ? 1 + Math.sin(Math.min(1, pop.t) * Math.PI) * 0.5 : 1;
        const p = poseAt(track, c.at);
        _pos.set(p.x + p.rx * c.lat, p.y + 1.05 + Math.sin(elapsed * 3 + i) * 0.08, p.z + p.rz * c.lat);
        _z.set(p.tx, 0, p.tz).normalize();
        _x.crossVectors(_up, _z).normalize();
        _m.makeBasis(_x, _up, _z);
        _q.setFromRotationMatrix(_m);
        _q2.setFromAxisAngle(_z, elapsed * 2.6 + i);
        _q.multiply(_q2);
        _scale.set(popK, popK, popK);
      }
      _m.compose(_pos, _q, _scale);
      coinsMesh.setMatrixAt(i, _m);
    }
    coinsMesh.instanceMatrix.needsUpdate = true;
  }

  function emit(kind: Particle["kind"], pos: THREE.Vector3, vel: THREE.Vector3, life: number, gravity = 0) {
    const p = pools.find((q) => q.kind === kind && q.life <= 0);
    if (!p) return;
    p.life = life;
    p.max = life;
    p.gravity = gravity;
    p.vel.copy(vel);
    p.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
    p.mesh.visible = true;
    p.mesh.position.copy(pos);
    p.mesh.scale.setScalar(1);
    (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
  }

  function burst(kind: Particle["kind"], pos: THREE.Vector3, count: number, spread: number, up: number, life: number, gravity = 0) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      _dir.set(Math.cos(a) * spread, up * (0.6 + Math.random() * 0.7), Math.sin(a) * spread);
      emit(kind, pos, _dir, life * (0.7 + Math.random() * 0.6), gravity);
    }
  }

  function updateParticles(dt: number) {
    for (const p of pools) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.kind !== "dust") p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.kind === "dust") {
        p.mesh.position.y += dt * 0.4;
        p.mesh.scale.addScalar(dt * 1.6);
      } else {
        p.mesh.rotation.x += p.spin.x * dt;
        p.mesh.rotation.y += p.spin.y * dt;
        p.mesh.rotation.z += p.spin.z * dt;
      }
      const k = Math.max(0, p.life / p.max);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.kind === "dust" ? k * 0.75 : k;
      if (p.life <= 0) p.mesh.visible = false;
    }
    coinPop = coinPop.filter((p) => (p.t += dt * 4) < 1);
  }

  function runnerPos(sim: any, r: any, out: THREE.Vector3) {
    const track = sim.level.track;
    const pose = poseAt(track, r.s);
    let lat = r.lateral;
    let lift = r.y;
    if (r.state === "tumble") {
      const k = Math.min(1, r.tumbleT / 0.88);
      lat += r.tumbleSide * k * 2.4;
      lift += Math.sin(k * Math.PI) * 2.2;
    }
    out.set(pose.x + pose.rx * lat, pose.y + lift, pose.z + pose.rz * lat);
    return pose;
  }

  function animateRig(sim: any, rig: CatRig, r: any, index: number, elapsed: number) {
    const idle = sim.phase === "menu" || (sim.phase === "race" && sim.countdown > 0);
    const moving = r.speed > 0.6 && r.state === "run";
    const p = r.anim;
    // Amplitude curves with speed — more lively at speed, gentle at crawl.
    let amp = 0.1;
    if (r.state === "tumble") amp = 0.4;
    else if (r.state === "done") amp = 0;
    else if (moving) amp = Math.min(1, 0.25 + 0.75 * (r.speed / 14));
    else if (idle) amp = 0.22;
    else if (r.state === "air") amp = 0.6;

    // Per-leg phase offset for natural opposition: lead leg lags body phase by ~0.25τ.
    const bodyPhase = moving ? p + index * 0.4 : elapsed * 2.2 + index;
    const bodyPhase2 = moving ? p + index * 0.4 + 1.57 : elapsed * 2.2 + index + 1.57;

    const l = Math.sin(bodyPhase);
    const r2 = Math.cos(bodyPhase);
    const k = Math.sin(bodyPhase * 0.9) * amp;

    // Torso: duck down with each stride, then squash-stretch on the run.
    rig.torso.position.y = 0.78 - Math.abs(r2) * 0.045;
    rig.torso.rotation.x = moving ? 0.05 + Math.min(0.2, r.speed / 70) : 0;
    const runK = moving ? Math.min(1, r.speed / 26) : 0;
    const breathe = !moving ? 1 + Math.sin(elapsed * 2.4 + index) * 0.02 : 1;
    rig.torso.scale.set(1 - 0.045 * runK, (1 + 0.035 * runK) * breathe, 1 - 0.04 * runK);

    // Head bob: slightly forward, following the run direction with lean.
    rig.head.position.y = (rig.headY ?? 1.42) + (moving ? Math.abs(l) * 0.07 : 0);
    rig.head.position.x = moving ? l * 0.06 : 0;
    for (let s = 0; s < 2; s++) {
      const ear = (rig.ears ?? [null, null])[s];
      if (ear) ear.rotation.x = sim.phase === "menu" ? 0.18 : 0;
      ear.rotation.z = moving ? -0.15 * (s === 0 ? l : l) * amp : 0;
    }
    for (let s = 0; s < 2; s++) {
      const brow = (rig.brows ?? [null, null])[s];
      if (brow) brow.rotation.z = -0.35 * (s === 0 ? r2 * 0.5 : r2 * 0.5) * (moving ? amp : 0.3);
    }

    // Eyes track slightly ahead in the run direction; lean into turns.
    const track = r.state !== "air";
    if (track) {
      const forward = sim.phase === "menu" ? 0.6 : 0.7 + 0.2 * (r.lateral / 2.35);
      for (let s = 0; s < 2; s++) {
        const eye = (rig.eyes ?? [null, null])[s];
        if (eye) {
          eye.position.z = 0.287 + forward * 0.02;
          eye.position.x = (s === 0 ? -1 : 1) * (0.148 + forward * 0.006);
          eye.rotation.z = moving ? -0.08 * r.lean : 0;
          eye.rotation.x = moving ? -0.25 : 0;
        }
      }
    }

    // Whiskers follow the head.
    const whisker = rig.whiskers;
    if (whisker) {
      whisker.rotation.z = moving ? -r.lean * 0.08 : 0;
      whisker.rotation.x = moving ? 0.1 : 0;
    }

    // Legs: thigh swings forward/back, shin folds on the recovery.
    // Lead leg swings with body phase; lag leg follows with a 90° offset.
    const swing = Math.sin(bodyPhase) * amp;
    const stride = Math.sin(bodyPhase * 0.9 + 0.6) * 0.5 * amp;
    const stride2 = Math.sin(bodyPhase * 0.9 + 0.9) * 0.5 * amp;
    const legs = (rig.legs ?? [null, null]);
    const knees = (rig.knees ?? [null, null]);
    const feet = (rig.feet ?? [null, null]);
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      // Legs counter-oscillate: when left leg goes forward, right goes back.
      legs[i].rotation.x = swing * 0.92 * s;
      // Knees bend more on the trailing leg during push-off.
      knees[i].rotation.x = Math.max(0, l * 0.9 + (i === 0 ? stride : stride2) * (i === 0 ? 1 : -1)) * 1.2;
      if (feet[i]) {
        feet[i].rotation.x = -0.35 - s * 0.6 * (1 - Math.abs(stride2));
        feet[i].rotation.z = s * 0.12;
      }
    }

    // Arms counter-oscillate with legs, swung slightly tighter for a sprinter look.
    const armSwing = Math.sin(bodyPhase * 0.9 + 0.2) * amp * 0.9;
    const fore = (rig.forearms ?? [null, null]);
    const paw = (rig.paws ?? [null, null]);
    const shoulders = rig.shoulders ?? [null, null];
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      // Arms oppose legs: when left leg forward, right arm forward.
      if (shoulders[i]) shoulders[i]!.rotation.x = -armSwing * 0.92 * s;
      if (fore[i]) fore[i]!.rotation.x = Math.max(0, l * 0.85 + armSwing * 0.6 * (i === 0 ? -1 : 1)) * 1.3;
      if (paw[i]) {
        paw[i].rotation.x = -0.25 + s * 0.3 * Math.abs(armSwing);
        paw[i].rotation.z = s * 0.18 * Math.abs(armSwing);
      }
    }

    // Tail follows the run direction with a gentle beat, leaning into turns.
    const tail = rig.tail;
    if (tail) {
      tail.rotation.z = moving ? r2 * 0.38 : -0.35;
      tail.rotation.x = moving ? l * 0.22 : 0;
      tail.position.x = 0.08 * r2;
    }

    // Muzzle stays put on the face; only its tilt follows the head.
    rig.muzzle.rotation.x = Math.min(0.08, r.speed / 260);

    if (r.state === "done") {
      // Victory routine. The player's chosen emote plays out on the finish
      // line; rivals always do the default happy hop.
      const emote = r.isPlayer ? sim.emote : "bounce";
      rig.head.rotation.x = 0.08;
      rig.head.rotation.z = 0;
      rig.torso.rotation.z = 0;
      rig.torso.position.x = 0;
      if (emote === "wave") {
        const wave = Math.sin(elapsed * 7.2);
        rig.torso.position.y = 0.78 + Math.abs(Math.sin(elapsed * 3.4)) * 0.08;
        rig.torso.rotation.x = 0.06;
        rig.head.rotation.z = wave * 0.14;
        for (let i = 0; i < 2; i++) {
          if (shoulders[i]) {
            shoulders[i]!.rotation.x = -2.95;
            shoulders[i]!.rotation.z = (i === 0 ? 1 : -1) * (0.32 + wave * 0.34);
          }
          if (fore[i]) fore[i]!.rotation.x = 0.35 + wave * 0.28;
          if (knees[i]) knees[i].rotation.x = 0.28;
        }
      } else if (emote === "floss") {
        const beat = Math.sin(elapsed * 6.4);
        rig.torso.position.y = 0.78 + Math.abs(beat) * 0.05;
        rig.torso.rotation.x = 0.05;
        rig.torso.rotation.z = beat * 0.26;
        rig.torso.position.x = beat * 0.1;
        rig.head.rotation.z = -beat * 0.12;
        for (let i = 0; i < 2; i++) {
          const s = i === 0 ? 1 : -1;
          if (shoulders[i]) {
            shoulders[i]!.rotation.x = -0.5 + beat * s * 0.3;
            shoulders[i]!.rotation.z = s * (0.9 + beat * s * 0.85);
          }
          if (fore[i]) fore[i]!.rotation.x = 0.55 + beat * s * 0.5;
          if (knees[i]) knees[i].rotation.x = 0.3 + Math.max(0, beat * s) * 0.3;
        }
      } else if (emote === "spin") {
        rig.torso.position.y = 0.78 + Math.abs(Math.sin(elapsed * 5)) * 0.12;
        rig.torso.rotation.x = 0.08;
        rig.head.rotation.x = 0;
        for (let i = 0; i < 2; i++) {
          if (shoulders[i]) {
            shoulders[i]!.rotation.x = -1.4;
            shoulders[i]!.rotation.z = (i === 0 ? 1 : -1) * 1.15;
          }
          if (fore[i]) fore[i]!.rotation.x = 0.1;
          if (knees[i]) knees[i].rotation.x = 0.3;
        }
      } else if (emote === "backflip") {
        for (let i = 0; i < 2; i++) {
          if (shoulders[i]) shoulders[i]!.rotation.x = -2.5;
          if (fore[i]) fore[i]!.rotation.x = 0.5;
          if (knees[i]) knees[i].rotation.x = 0.75;
          if (legs[i]) legs[i].rotation.x = -0.25;
        }
      } else {
        // Happy hop: hands up, little celebratory bounce.
        const hop = Math.abs(Math.sin(elapsed * 6) * 0.22);
        rig.torso.position.y = 0.78 + hop;
        rig.torso.rotation.x = 0.12;
        for (let i = 0; i < 2; i++) {
          if (shoulders[i]) shoulders[i]!.rotation.x = -2.8 - Math.sin(elapsed * 6) * 0.15;
          if (fore[i]) fore[i]!.rotation.x = 0.2;
          if (knees[i]) knees[i].rotation.x = 0.3;
        }
      }
    } else if (r.state === "tumble") {
      // Tumble: limp everything, head and tail tucking.
      const k = Math.min(1, r.tumbleT / 0.88);
      rig.torso.rotation.x = Math.sin(k * Math.PI * 0.5) * 0.35;
      rig.torso.position.y = 0.78 + Math.sin(k * Math.PI) * 0.12;
      for (let i = 0; i < 2; i++) {
        legs[i].rotation.x = -swing * 0.5;
        // Smooth flailing, not per-frame randomness: Math.random() here made
        // the limbs vibrate at 60fps and read as the whole model flickering.
        const flail = Math.sin(elapsed * 16 + i * 2.4);
        knees[i].rotation.x = -0.3 + flail * 0.25;
        fore[i].rotation.x = -1.5 - Math.sin(elapsed * 19 + i * 1.3) * 0.3;
        if (feet[i]) feet[i].rotation.x = -0.2 + Math.sin(elapsed * 21 + i * 1.7) * 0.2;
      }
      rig.head.rotation.x = -0.25 + Math.sin(elapsed * 15) * 0.15;
      rig.head.rotation.y = Math.sin(elapsed * 12.5) * 0.15;
      rig.tail.rotation.x = 0.6 - (0.3 + Math.sin(elapsed * 14) * 0.3);
    } else if (idle) {
      // Idle bounce on the start line, breathing while browsing the menu.
      rig.head.rotation.y = Math.sin(elapsed * 0.7 + index) * 0.2;
      rig.head.rotation.z = Math.sin(elapsed * 0.9 + index * 1.7) * 0.06;
      rig.torso.position.y = 0.78 + Math.sin(elapsed * 2.6 + index) * 0.025;
      if (shoulders[0]) shoulders[0]!.rotation.z = -0.08;
      if (shoulders[1]) shoulders[1]!.rotation.z = 0.08;
      for (let i = 0; i < 2; i++) {
        legs[i].rotation.x = 0.04 * Math.sin(elapsed * 1.9 + index + i * 1.2);
        knees[i].rotation.x = 0.35 * Math.sin(elapsed * 1.6 + index + i * 1.2);
      }
      // Ears flick and the tail sweeps so the roster is not statues.
      for (let i = 0; i < 2; i++) {
        const ear = (rig.ears ?? [null, null])[i];
        if (ear) ear.rotation.x = -0.16 + Math.sin(elapsed * 1.4 + index + i * 0.9) * 0.1;
      }
      if (rig.tail) {
        rig.tail.rotation.z = -0.1 + Math.sin(elapsed * 1.8 + index) * 0.45;
        rig.tail.rotation.x = Math.sin(elapsed * 1.1 + index) * 0.12;
      }
    } else {
      rig.head.rotation.y = 0;
      for (let i = 0; i < 2; i++) {
        legs[i].rotation.x = 0.06 * Math.sin(elapsed * 2.1 + index + i * 1.2);
        knees[i].rotation.x = 0.42 * Math.sin(elapsed * 1.7 + index + i * 1.2);
      }
      if (rig.whiskers) rig.whiskers.rotation.z = 0;
    }

    // Hat gadgets: the propeller spins faster at speed, the halo breathes.
    const prop = rig.hatRoot?.getObjectByName("hatProp");
    if (prop) prop.rotation.y = elapsed * (moving ? 22 : 7.5);
    const halo = rig.hatRoot?.getObjectByName("hatHalo");
    if (halo) halo.scale.setScalar(1 + Math.sin(elapsed * 3.2) * 0.06);

    // Blink on a per-cat clock so the face stays alive in every state.
    const squint = (elapsed * 0.5 + index * 0.31) % 1 < 0.055 ? 0.14 : 1;
    for (let i = 0; i < 2; i++) {
      const eye = (rig.eyes ?? [null, null])[i];
      if (eye) eye.scale.y += (squint - eye.scale.y) * 0.5;
    }
  }

  function updateRunner(sim: any, index: number, elapsed: number) {
    const r = sim.runners[index];
    const rig = rigs[index];
    if (!r || !rig) return;
    if (r.state === "out" || r.eliminated) {
      rig.group.visible = false;
      return;
    }
    // Each racer gets their own coat colour so you can tell the pack apart at
    // a glance, the way the original does.
    if (rig.fur && rig.furColor !== r.color) {
      rig.fur.color.set(r.color);
      rig.furColor = r.color;
      // Tabby stripes are a darkened copy of the coat, so the cat keeps its
      // Tom/Oggy tabby pattern on every skin colour.
      for (const m of rig.stripes ?? []) m.color.copy(rig.fur.color).multiplyScalar(0.52);
      if (index === 0) currentColor = r.color;
    }
    rig.group.visible = r.invuln > 0 ? Math.floor(elapsed * 10) % 2 === 0 : true;
    const pose = runnerPos(sim, r, _pos);
    rig.group.position.copy(_pos);
    const yaw = sim.phase === "menu" ? pose.yaw : r.bodyYaw;
    orient(rig.group, yaw);
    if (r.state === "tumble") {
      const k = Math.min(1, r.tumbleT / 0.88);
      const { rx, rz } = basisOf(yaw);
      _dir.set(rx, 0, rz);
      _q.setFromAxisAngle(_dir, k * 9);
      rig.group.quaternion.multiply(_q);
    }
    animateRig(sim, rig, r, index, elapsed);
    const lean = r.state === "tumble" ? 0 : r.lean;
    if (Math.abs(lean) > 0.002) {
      _dir.set(basisOf(yaw).tx, 0, basisOf(yaw).tz).normalize();
      _q.setFromAxisAngle(_dir, lean * 0.34);
      rig.group.quaternion.multiply(_q);
    }
    if (r.state === "done" && r.isPlayer) {
      if (sim.emote === "spin") {
        _q.setFromAxisAngle(_up, elapsed * 4.2);
        rig.group.quaternion.multiply(_q);
      } else if (sim.emote === "backflip") {
        const k = (elapsed % 1.5) / 1.5;
        const { rx, rz } = basisOf(yaw);
        _dir.set(rx, 0, rz);
        _q.setFromAxisAngle(_dir, -k * Math.PI * 2);
        rig.group.quaternion.multiply(_q);
        rig.group.position.y += Math.sin(k * Math.PI) * 1.8;
      }
    }
    if (rig.playerMark) {
      rig.playerMark.visible = sim.phase === "menu" || sim.countdown > 0;
      const ring = rig.playerMark.children[0];
      const arrow = rig.playerMark.children[1];
      if (ring) ring.rotation.z = elapsed * 1.4;
      if (arrow) arrow.position.y = 2.15 + Math.sin(elapsed * 3.4) * 0.12;
    }
  }

  function detectJuice(sim: any) {
    const player = sim.player;
    if (prevState !== "tumble" && player.state === "tumble") {
      runnerPos(sim, player, _pos);
      _pos.y += 1.0;
      burst("star", _pos, 8, 2.6, 3.2, 0.7, 9);
      burst("dust", _pos, 6, 2.0, 1.4, 0.5, 0);
    }
    sim.coins.forEach((c: any, i: number) => {
      if (c.taken && !prevTaken[i]) {
        const p = poseAt(sim.level.track, c.at);
        _pos.set(p.x + p.rx * c.lat, p.y + 1.05, p.z + p.rz * c.lat);
        burst("spark", _pos, 7, 1.9, 2.4, 0.5, 6);
        coinPop.push({ i, t: 0 });
      }
    });
    prevTaken = sim.coins.map((c: any) => c.taken);
    prevState = player.state;
    if (player.eliminated && !prevEliminated) {
      runnerPos(sim, player, _pos);
      _pos.y += 1.1;
      burst("dust", _pos, 12, 2.4, 1.6, 0.75, 0);
      burst("star", _pos, 6, 1.8, 2.4, 0.6, 7);
    }
    prevEliminated = player.eliminated;
  }

  function spawnDust(sim: any) {
    const r = sim.player;
    if (r.state !== "run" || r.speed < 9) return;
    // Throttled on a distance accumulator so the puff rate scales with speed
    // instead of with frame rate.
    dustT += r.speed * (1 / 60);
    if (dustT < 2.6) return;
    dustT = 0;
    runnerPos(sim, r, _pos);
    _pos.y += 0.06;
    burst("dust", _pos, 2, 0.5, 0.5, 0.45, 0);
  }

  function render(sim: any, dt: number, elapsed: number) {
    // A fresh level (or the first frame) needs its geometry built before we
    // can draw anything.
    if (builtGen !== sim.gen) build(sim);

    const player = sim.player;
    const track = sim.level.track;
    const pose = poseAt(track, player.s);
    const { tx, tz } = basisOf(pose.yaw);

    const px = pose.x + pose.rx * player.lateral;
    const py = pose.y;
    const pz = pose.z + pose.rz * player.lateral;

    // Hazards animate on sim time while racing so the swinging hammer you see
    // is exactly the one that can hit you; the menu preview runs on wall time
    // so the course still looks alive before the countdown.
    const hazardTime = sim.phase === "race" ? sim.time : elapsed;

    // --- Camera -------------------------------------------------------
    // Before the pack is released (menu + 3-2-1) we orbit the start line so
    // the roster is framed up front instead of the camera sitting on an empty
    // stretch of deck — that blank wash was the white screen on first open.
    const staging = sim.phase !== "race" || sim.countdown > 0;
    if (staging) {
      const focusY = py + 1.7;
      const orbit = elapsed * 0.3;
      _camBase.set(px + Math.sin(orbit) * 8.6, focusY + 2.4, pz + Math.cos(orbit) * 8.6);
      _camPos.lerp(_camBase, snapCam ? 1 : Math.min(1, dt * 3.2));
      camera.position.copy(_camPos);
      _look.set(px, focusY, pz);
      camera.lookAt(_look);
      snapCam = false;
      sunGroup.position.set(px + 18, py + 28, pz + 12);
      sun.position.set(sunGroup.position.x, sunGroup.position.y, sunGroup.position.z);
      sun.target.position.set(px, py, pz);
      sun.target.updateMatrixWorld();
      updateHazards(sim.level.hazards, hazardTime, player.s, false);
      updateCutGates(sim, elapsed);
      updateCoins(sim, elapsed);
      updateParticles(dt);
      for (let i = 0; i < sim.runners.length; i++) updateRunner(sim, i, elapsed);
      renderer.render(scene, camera);
      return;
    }

    // The smoothed position lives in its own vector: writing shake straight
    // into camera.position let each frame's random offset feed the next
    // frame's lerp, so one tumble left the camera drifting forever.
    const speedK = Math.min(1, player.speed / 26);
    const dist = 4.9 - speedK * 0.8;
    const height = 2.6 + speedK * 0.55;
    _camBase.set(px - tx * dist, py + height, pz - tz * dist);
    if (snapCam) {
      _camPos.copy(_camBase);
      snapCam = false;
    } else {
      _camPos.lerp(_camBase, Math.min(1, dt * 7));
    }
    camera.position.copy(_camPos);
    _look.set(px + tx * 5.5, py + 1.2 + player.y * 0.5, pz + tz * 5.5);
    camera.lookAt(_look);

    // Deterministic sine shake instead of white noise: it reads as an impact
    // rumble rather than 60fps static.
    const shake = sim.shake || 0;
    if (shake > 0.001) {
      const t = elapsed * 43;
      camera.position.x += Math.sin(t) * shake * 0.5;
      camera.position.y += Math.sin(t * 1.37 + 1.1) * shake * 0.34;
      camera.position.z += Math.sin(t * 0.83 + 2.3) * shake * 0.5;
    }

    // Keep the shadow frustum on the runner — without this the whole course
    // falls out of the light map as soon as it scrolls past ±18m.
    sunGroup.position.set(px + 18, py + 28, pz + 12);
    sun.position.set(sunGroup.position.x, sunGroup.position.y, sunGroup.position.z);
    sun.target.position.set(px, py, pz);
    sun.target.updateMatrixWorld();

    updateHazards(sim.level.hazards, hazardTime, player.s, sim.phase === "race");
    updateCutGates(sim, elapsed);
    updateCoins(sim, elapsed);
    updateParticles(dt);
    for (let i = 0; i < sim.runners.length; i++) updateRunner(sim, i, elapsed);
    spawnDust(sim);
    detectJuice(sim);

    renderer.render(scene, camera);
  }

  function resize() {
    const rect = renderer.domElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w < 1 || h < 1) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    renderer.dispose();
  }

  function celebrate(sim: any) {
    runnerPos(sim, sim.player, _pos);
    _pos.y += 1.0;
    burst("confetti", _pos, 120, 3.2, 2.6, 1.6, 0);
    burst("star", _pos, 18, 2.0, 3.0, 0.9, 0);
    burst("spark", _pos, 34, 2.4, 1.8, 0.7, 0);
    for (let i = 0; i < 14; i++) {
      const t = Math.random() * Math.PI * 2;
      const rr = 2.6 + Math.random() * 3.4;
      _pos.set(Math.cos(t) * rr, 1.4 + Math.random() * 2.2, Math.sin(t) * rr);
      emit("spark", _pos, new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14), 0.7 + Math.random() * 0.7, 3.2);
    }
    const pace = 0.45 * (1 + sim.player.y / 6);
    for (let i = 0; i < 6; i++) {
      const t = Date.now() * 0.0023 + i * 0.37;
      const amp = 0.14 + Math.sin(t * 1.1) * 0.06;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5 + Math.sin(t * 2.3) * 0.15, 0.1 + Math.cos(t * 3.1) * 0.05),
        new THREE.MeshBasicMaterial({ color: "#ffd23f", transparent: true, opacity: 0.85 })
      );
      mesh.position.set(0, 0.78 + amp, 0.6 + Math.sin(t * 1.7) * 0.8);
      mesh.rotation.x = Math.sin(t * 0.5) * 0.12;
      mesh.rotation.z = Math.cos(t * 0.8) * 0.1;
      scene.add(mesh);
      const t2 = t + 0.9;
      const mesh2 = new THREE.Mesh(
        new THREE.PlaneGeometry(0.44 + Math.sin(t2 * 2.1) * 0.12, 0.08 + Math.cos(t2 * 3.3) * 0.05),
        new THREE.MeshBasicMaterial({ color: "#ff4d6d", transparent: true, opacity: 0.8 })
      );
      mesh2.position.set(0, 0.72 + amp, -0.6 + Math.sin(t2 * 1.9) * 0.9);
      mesh2.rotation.x = Math.sin(t2 * 0.5) * 0.12;
      mesh2.rotation.z = Math.cos(t2 * 0.8) * 0.1;
      scene.add(mesh2);
    }
  }

  /** Read back a few centre-column pixels right after an explicit render — the
   *  drawing buffer is not preserved, so this is the only way to see what the
   *  camera actually points at. */
  function sample() {
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    const buf = new Uint8Array(4);
    const grab = (fx: number, fy: number) => {
      gl.readPixels(Math.floor(w * fx), Math.floor(h * (1 - fy)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return [buf[0], buf[1], buf[2]];
    };
    const strip = () => {
      const out: number[][] = [];
      for (let fy = 0.14; fy <= 0.96; fy += 0.04) out.push([Number(fy.toFixed(2)), ...grab(0.5, fy)]);
      return out;
    };
    renderer.render(scene, camera);
    const withSky = strip();
    sky.visible = false;
    renderer.render(scene, camera);
    const noSky = strip();
    sky.visible = true;
    renderer.render(scene, camera);
    return { withSky, noSky };
  }

  function debug() {
    let meshes = 0;
    let visible = 0;
    scene.traverse((o: any) => {
      if (o.isMesh || o.isInstancedMesh) {
        meshes++;
        if (o.visible) visible++;
      }
    });
    return {
      cam: camera.position.toArray().map((n) => Number(n.toFixed(2))),
      aspect: Number(camera.aspect.toFixed(3)),
      look: _look.toArray().map((n) => Number(n.toFixed(2))),
      levelChildren: levelRoot.children.length,
      firstTypes: levelRoot.children.slice(0, 6).map((c) => c.type),
      render: { ...renderer.info.render },
      trackMesh: (() => {
        const m: any = levelRoot.children[0];
        if (!m || !m.geometry) return null;
        const pos = m.geometry.getAttribute("position");
        return {
          verts: pos ? pos.count : 0,
          bbox: (() => { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox; return b ? [b.min.toArray(), b.max.toArray()] : null; })(),
          visible: m.visible,
          matVisible: !!m.material && m.material.visible,
        };
      })(),
      cats: CATS.map((c) => ({ v: c.group.visible, p: c.group.position.toArray().map((n) => Number(n.toFixed(2))) })),
      rig: (() => {
        const r = CATS[0] as any;
        return {
          headY: r.headY ?? 1.42,
          torsoKids: r.torso.children.map((c: any) => c.geometry?.type ?? c.type),
          tailKids: r.tail.children.length,
          earKids: r.ears.map((e: any) => e.children.length),
          hairKids: r.hair ? r.hair.children.length : 0,
          muzzleKids: r.muzzle.children.length,
          headKids: r.head.children.length,
          fur: r.fur?.color?.getHexString?.() ?? null,
        };
      })(),
      meshes,
      visible,
      builtGen,
      buf: [renderer.domElement.width, renderer.domElement.height],
    };
  }

  // Expose the player rig reference used by the world loop.
  const playerRig = CATS[0];

  return { renderer, scene, camera, render, resize, dispose, celebrate, setHat, setBuild, playerRig, debug, sample };
}
