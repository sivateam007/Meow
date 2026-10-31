import * as THREE from "three";

const _up = new THREE.Vector3(0, 1, 0);
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();

export type CatState =
  | { kind: "run"; swing: number; swing2: number }
  | { kind: "idle"; t: number }
  | { kind: "tumble"; k: number }
  | { kind: "done"; t: number; hop: number }
  | { kind: "air"; p: number };

export type CatRig = {
  group: THREE.Group;
  head: THREE.Group;
  body?: THREE.Mesh;
  torso: THREE.Group;
  ears: THREE.Group[];
  eyes: THREE.Group[];
  brows: THREE.Group[];
  muzzle: THREE.Group;
  nose: THREE.Mesh;
  mouth: THREE.Mesh;
  whiskers: THREE.Group;
  whiskersL: THREE.Group;
  whiskersR: THREE.Group;
  hair?: THREE.Object3D | null;
  /** Gold ring + pointer that marks the human player; null/absent for rivals. */
  playerMark?: THREE.Object3D | null;
  /** Empty socket above the skull that holds the selected hat. */
  hatRoot?: THREE.Group;
  /** Fur material, recoloured per runner so each racer reads at a glance. */
  fur?: THREE.MeshStandardMaterial | THREE.MeshToonMaterial;
  furColor?: string;
  tail: THREE.Group;
  legs: THREE.Group[];
  knees: THREE.Group[];
  feet: THREE.Mesh[];
  shoulders: THREE.Group[];
  upperArms: THREE.Group[];
  forearms: THREE.Group[];
  paws: THREE.Mesh[];
  hips: THREE.Group[];
  spine?: THREE.Group;
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

/* ------------------------------------------------------------------ */
/* Cel-shading helpers                                                 */
/* ------------------------------------------------------------------ */

/** 4-step ramp so every form reads as a soft cartoon, never glossy plastic. */
const RAMP = (() => {
  const data = new Uint8Array([
    92, 92, 92, 255, 152, 152, 152, 255, 212, 212, 212, 255, 255, 255, 255, 255,
  ]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

function toon(color: string) {
  return new THREE.MeshToonMaterial({ color, gradientMap: RAMP });
}

const INK = "#2a1b3d";
const outlineMat = new THREE.MeshBasicMaterial({
  color: INK,
  side: THREE.BackSide,
  fog: false,
});

/** Back-face shell that gives every rounded piece a clean cartoon ink line. */
function ink(mesh: THREE.Mesh, amount = 1.055) {
  const shell = new THREE.Mesh(mesh.geometry, outlineMat);
  shell.scale.setScalar(amount);
  shell.castShadow = false;
  shell.receiveShadow = false;
  mesh.add(shell);
  return mesh;
}

function capsule(radius: number, length: number, material: THREE.Material) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 8, 16), material);
}

export function makeCatRig(index: number, build: string = "medium"): CatRig {
  const group = new THREE.Group();
  // Tom-style cartoon cat for all racers. Body shape (build) scales proportions.
  const TOM = true;
  const buildScale = { slim: 0.85, medium: 1.0, chubby: 1.15, superhero: 1.08 }[build] ?? 1.0;

  // One fur material shared by head, body, limbs and tail: the sim recolours
  // this per racer, so the whole cat changes coat together.
  // Tom (Tom & Jerry) / Oggy style: warm orange tabby for the player, soft pink
  // for rivals — but every racer reads as the same friendly cartoon cat.
  const fur = toon(index === 0 ? "#e89a4e" : "#ff8fae");
  const cream = toon("#fff6e6");
  const blush = toon("#ffb3c7");
  const pink = toon("#ff8fb0");
  const collar = toon(index === 0 ? "#ffb020" : index === 1 ? "#3db7ff" : index === 2 ? "#1fce93" : "#ff4d6d");
  const bell = toon("#ffd43b");
  const eyeWhite = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false });
  const irisMat = new THREE.MeshBasicMaterial({ color: "#20335c", fog: false });
  const shineMat = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false });

  // ---------- torso: soft pear shape with a cream tummy ----------
  const torso = new THREE.Group();
  torso.position.y = 0.78;

  const body = ink(
    new THREE.Mesh(new THREE.SphereGeometry(TOM ? 0.385 : 0.3, 32, 24), fur),
    1.045,
  );
  body.scale.set(1.05 * buildScale, 1.0 * buildScale, 0.9 * buildScale);
  body.position.y = 0.02;
  body.castShadow = true;
  torso.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 28, 20), cream);
  belly.scale.set(0.97 * buildScale, 0.9 * buildScale, 0.56 * buildScale);
  belly.position.set(0, -0.02, 0.22);
  belly.castShadow = true;
  torso.add(belly);

  // A little neck fluff hides the seam between head and body.
  const ruff = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), cream);
  ruff.scale.set(1.0 * buildScale, 0.5 * buildScale, 0.97 * buildScale);
  ruff.position.y = 0.27;
  ruff.castShadow = true;
  torso.add(ruff);

  const band = new THREE.Mesh(new THREE.TorusGeometry(0.2 * buildScale, 0.045 * buildScale, 10, 28), collar);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.29;
  band.castShadow = true;
  torso.add(band);
  const bellMesh = new THREE.Mesh(new THREE.SphereGeometry(TOM ? 0.065 : 0.058, 14, 12), bell);
  bellMesh.position.set(0, 0.27, 0.2);
  bellMesh.castShadow = true;
  torso.add(bellMesh);
  const bellDot = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), toon(INK));
  bellDot.position.set(0, 0.25, 0.25);
  torso.add(bellDot);

  // Tom & Jerry cartoon stripes: dark tabby bands for the player (Tom).
  if (index === 0) {
    const stripeMat = toon("#4a2a1a");
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.34 - i * 0.02, 0.022, 8, 32), stripeMat);
      band.rotation.x = Math.PI / 2;
      band.position.set(0, 0.02 - i * 0.12, 0.0);
      band.scale.set(1.0, 1.0, 0.86);
      band.castShadow = true;
      torso.add(band);
    }
  }

  // ---------- head: oversized, round, expressive ----------
  const head = new THREE.Group();
  head.position.y = 1.4;
  head.scale.setScalar(1.06 * buildScale);

  const skull = ink(new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 26), fur), 1.045);
  skull.scale.set(1.02, 0.98, 0.94);
  skull.castShadow = true;
  head.add(skull);

  // Chubby cheek tufts make the silhouette read as a kitten, not a robot.
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), fur);
    cheek.scale.set(0.92, 0.8, 0.7);
    cheek.position.set(side * 0.25, -0.08, 0.18);
    cheek.castShadow = true;
    head.add(cheek);
  }

  // Ears: rounded triangles with pink insides, tilted slightly outward.
  const ear = (side: number) => {
    const g = new THREE.Group();
    const outer = ink(
      new THREE.Mesh(new THREE.ConeGeometry(0.2 * buildScale, 0.44 * buildScale, 16, 2), fur),
      1.06,
    );
    outer.position.y = 0.035 * buildScale;
    outer.scale.set(1, 1, 0.84);
    outer.castShadow = true;
    g.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.12 * buildScale, 0.28 * buildScale, 14, 1), pink);
    inner.position.set(0, 0.05 * buildScale, 0.045);
    inner.scale.set(1, 1, 0.7);
    g.add(inner);
    g.position.set(side * 0.24 * buildScale, 0.31 * buildScale, -0.01);
    g.rotation.z = -side * 0.24;
    g.rotation.x = -0.08;
    return g;
  };
  const earL = ear(-1);
  const earR = ear(1);
  head.add(earL, earR);

  // Big anime eyes. Each group can be moved/scaled by the rig animator.
  const eye = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.148, 0.085, 0.287);

    const white = new THREE.Mesh(new THREE.SphereGeometry(0.122, 22, 18), eyeWhite);
    white.scale.set(0.85, 1.12, 0.46);
    white.castShadow = true;
    g.add(white);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.082, 20, 16), irisMat);
    iris.position.set(0, -0.008, 0.05);
    iris.scale.set(0.86, 1.08, 0.4);
    g.add(iris);

    // Pupil: a small dark dot that gives the eye direction and focus.
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), toon(INK));
    pupil.position.set(0, -0.008, 0.072);
    pupil.scale.set(0.9, 1.1, 0.5);
    g.add(pupil);

    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), shineMat);
    shine.position.set(-0.026, 0.045, 0.088);
    g.add(shine);
    const shine2 = new THREE.Mesh(new THREE.SphereGeometry(0.014, 9, 8), shineMat);
    shine2.position.set(0.03, -0.03, 0.09);
    g.add(shine2);

    // Eyelid: a fur-coloured half-shell that closes over the eye on blink.
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.128, 20, 12), fur);
    lid.scale.set(0.88, 0.35, 0.5);
    lid.position.set(0, 0.06, 0.02);
    lid.castShadow = false;
    g.add(lid);

    return g;
  };
  const eyeL = eye(-1);
  const eyeR = eye(1);
  head.add(eyeL, eyeR);

  // Soft brows; barely tilted so the resting face stays friendly.
  const brow = (side: number) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.07, 6, 10), toon(INK));
    b.position.set(side * 0.15, 0.235, 0.285);
    b.rotation.z = Math.PI / 2 + side * 0.16;
    b.rotation.x = 0.1;
    g.add(b);
    return g;
  };
  const browL = brow(-1);
  const browR = brow(1);
  head.add(browL, browR);

  // ---------- muzzle / nose / smile ----------
  const muzzle = new THREE.Group();
  muzzle.position.set(0, -0.14, 0.06);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.155, 24, 18), cream);
  snout.scale.set(1.1, 0.78, 0.72);
  snout.position.set(0, 0.015, 0.16);
  snout.castShadow = true;
  muzzle.add(snout);

  for (const side of [-1, 1]) {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), cream);
    pad.scale.set(1.0, 0.8, 0.8);
    pad.position.set(side * 0.082, -0.005, 0.185);
    muzzle.add(pad);
  }

  // Cheek blush: soft pink circles so the face reads friendly and cute.
  for (const side of [-1, 1]) {
    const blushM = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), blush);
    blushM.scale.set(1, 0.85, 0.55);
    blushM.position.set(side * 0.235, -0.005, 0.275);
    muzzle.add(blushM);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), pink);
  nose.scale.set(1.25, 0.8, 0.72);
  nose.position.set(0, 0.075, 0.285);
  nose.castShadow = true;
  muzzle.add(nose);

  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.055, 0.012, 6, 16, Math.PI),
    toon(INK),
  );
  smile.position.set(0, -0.02, 0.285);
  smile.rotation.z = Math.PI;
  smile.rotation.x = -0.06;
  muzzle.add(smile);

  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), pink);
  tongue.scale.set(1.2, 0.5, 0.55);
  tongue.position.set(0, -0.06, 0.284);
  muzzle.add(tongue);

  // Whiskers: three per cheek, thin and swept back a little.
  const whiskerLine = new THREE.Group();
  const makeWhiskers = (side: number) => {
    const g = new THREE.Group();
    const mat = toon(INK);
    for (let i = 0; i < 3; i++) {
      const len = 0.24 + i * 0.025;
      const n = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, len, 5), mat);
      n.rotation.z = Math.PI / 2 + (i - 1) * 0.16;
      n.rotation.y = -side * 0.22;
      n.position.set(side * (0.12 + len * 0.42), 0.02 + (i - 1) * 0.028, 0.2);
      g.add(n);
    }
    return g;
  };
  const whL = makeWhiskers(-1);
  const whR = makeWhiskers(1);
  whiskerLine.add(whL, whR);
  muzzle.add(whiskerLine);
  head.add(muzzle);

  // Tom & Jerry cartoon stripes on the head (Tom only).
  if (index === 0) {
    const stripeMat = toon("#4a2a1a");
    const headStripe = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.022, 8, 28), stripeMat);
    headStripe.rotation.x = Math.PI / 2;
    headStripe.position.set(0, 0.18, 0.12);
    headStripe.scale.set(1.0, 0.6, 0.8);
    headStripe.castShadow = true;
    head.add(headStripe);
  }

  // Forehead tuft: three soft leaves of fur.
  const hair = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 10), fur);
    tuft.position.set((i - 1) * 0.052, 0.28 + (i === 1 ? 0.03 : 0), 0.07);
    tuft.rotation.z = (i - 1) * 0.38;
    tuft.rotation.x = -0.5;
    tuft.castShadow = true;
    hair.add(tuft);
  }
  head.add(hair);

  // ---------- hat socket ----------
  const hatRoot = new THREE.Group();
  hatRoot.position.set(0, 0.35, 0);
  head.add(hatRoot);

  // ---------- player marker ----------
  let playerMark: THREE.Object3D | null = null;
  if (index === 0) {
    const marker = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.055, 10, 28),
      new THREE.MeshBasicMaterial({ color: "#ffcf4d", transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    marker.add(ring);
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.24, 12),
      new THREE.MeshBasicMaterial({ color: "#ffcf4d" }),
    );
    arrow.position.y = 2.18;
    arrow.rotation.x = Math.PI;
    marker.add(arrow);
    group.add(marker);
    playerMark = marker;
  }

  // ---------- tail: a real curved tube, cream tip ----------
  const tail = new THREE.Group();
  tail.position.set(0, 0.62, -0.24);
  tail.scale.setScalar(1.05 * buildScale);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.02, 0.16, -0.19),
    new THREE.Vector3(0.14, 0.22, -0.34),
    new THREE.Vector3(0.34, 0.12, -0.4),
    new THREE.Vector3(0.42, 0.3, -0.46),
  ]);
  const tailMesh = ink(
    new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.052, 8, false), fur),
    1.09,
  );
  tailMesh.castShadow = true;
  tail.add(tailMesh);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.073, 14, 12), cream);
  tip.position.copy(curve.getPointAt(1));
  tip.scale.set(1.05, 1.05, 1.05);
  tail.add(tip);
  if (index === 0) {
    const stripeMat = toon("#4a2a1a");
    for (let i = 0; i < 3; i++) {
      const tband = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 6, 16), stripeMat);
      tband.position.set(0.05 + i * 0.12, 0.1 + i * 0.06, -0.2 - i * 0.1);
      tband.rotation.y = 0.4 + i * 0.3;
      tband.castShadow = true;
      tail.add(tband);
    }
  }
  group.add(tail);

  // ---------- legs ----------
  const leg = (side: number) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.145, 0.44, 0);
    hip.scale.setScalar(1.05 * buildScale);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.2, 8, 14), fur);
    thigh.position.y = -0.17;
    thigh.castShadow = true;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.33;
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.17, 8, 14), fur);
    shin.position.y = -0.15;
    shin.castShadow = true;
    knee.add(shin);
    const foot = ink(
      new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), cream),
      1.06,
    );
    foot.scale.set(1.0, 0.58, 1.55);
    foot.position.set(0, -0.26, 0.07);
    foot.castShadow = true;
    knee.add(foot);
    hip.add(knee);
    group.add(hip);
    return { hip, knee, foot };
  };
  const legL = leg(-1);
  const legR = leg(1);

  // ---------- arms with attached mitten paws ----------
  const arm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.3, 1.12, 0.01);
    shoulder.scale.setScalar(1.06 * buildScale);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.17, 8, 14), fur);
    upper.position.y = -0.15;
    upper.castShadow = true;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.15, 8, 14), fur);
    fore.position.y = -0.13;
    fore.castShadow = true;
    elbow.add(fore);
    const paw = ink(
      new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), cream),
      1.07,
    );
    paw.scale.set(1.05, 0.86, 1.16);
    paw.position.set(0, -0.27, 0.01);
    paw.castShadow = true;
    elbow.add(paw);
    // Toe beans make the mitten unmistakably a cat paw.
    for (let k = 0; k < 3; k++) {
      const bean = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), pink);
      bean.position.set((k - 1) * 0.03, -0.305, 0.075);
      bean.scale.set(0.9, 0.8, 0.5);
      elbow.add(bean);
    }
    shoulder.add(elbow);
    group.add(shoulder);
    return { shoulder, elbow, paw };
  };
  const armL = arm(-1);
  const armR = arm(1);

  // Attach torso (body/belly) and head (skull/ears/face) to the render group.
  group.add(torso);
  group.add(head);

  return {
    group,
    head,
    body,
    torso,
    ears: [earL, earR],
    eyes: [eyeL, eyeR],
    brows: [browL, browR],
    muzzle,
    nose,
    mouth: smile,
    whiskers: whiskerLine,
    whiskersL: whL,
    whiskersR: whR,
    hair,
    playerMark,
    hatRoot,
    fur,
    furColor: index === 0 ? "#e89a4e" : "#ff8fae",
    tail,
    legs: [legL.hip, legR.hip],
    knees: [legL.knee, legR.knee],
    feet: [legL.foot, legR.foot],
    shoulders: [armL.shoulder, armR.shoulder],
    upperArms: [armL.shoulder, armR.shoulder],
    forearms: [armL.elbow, armR.elbow],
    paws: [armL.paw, armR.paw],
    hips: [legL.hip, legR.hip],
    spine: new THREE.Group(),
  };
}
