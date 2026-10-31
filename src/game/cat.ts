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
  /** Resting head height — the humanoid sits taller above its suit. */
  headY?: number;
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
  /** Tabby stripe materials — darkened to match `fur` on every recolour. */
  stripes?: THREE.MeshToonMaterial[];
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

export function makeCatRig(index: number, build: string = "medium", kind: "cat" | "humanoid" = "cat"): CatRig {
  const group = new THREE.Group();
  // Tom-style cartoon cat for all racers, or a humanoid runner for the
  // GameSnacks-style roster. Body shape (build) scales proportions.
  const TOM = kind === "cat";
  const human = kind === "humanoid";
  const buildScale = { slim: 0.85, medium: 1.0, chubby: 1.15, superhero: 1.08 }[build] ?? 1.0;

  // Suit colour: the sim recolours `fur` per racer, so for the humanoid
  // roster this is the athletic outfit; for the cat roster it is the coat.
  const suitColor = human
    ? (["#ff5a5f", "#3db7ff", "#1fce93", "#ffd43b"][index] ?? "#ff5a5f")
    : index === 0
      ? "#8fb0dd"
      : "#ff8fae";
  const fur = toon(suitColor);
  // Tabby stripes track the coat — a darkened copy of the player's fur, so the
  // cat always reads as Tom/Oggy whatever skin colour is equipped.
  const stripeMat = toon(
    human ? "#4a2a1a" : `#${new THREE.Color(suitColor).multiplyScalar(0.52).getHexString()}`,
  );
  // Humanoid-only materials: skin for face/hands, hair, sneakers.
  const skin = toon("#ffcfa4");
  const noseSkin = toon("#f0a678");
  const hairMat = toon(["#4a2f1e", "#2e2a33", "#8a5a2b", "#3a3f7a"][index] ?? "#4a2f1e");
  const shoeMat = toon("#2f3a5f");
  const kitWhite = toon("#f7f8fc");
  const cream = toon("#fff6e6");
  const blush = toon("#ffb3c7");
  const pink = toon("#ff8fb0");
  const collar = toon(index === 0 ? "#ffb020" : index === 1 ? "#3db7ff" : index === 2 ? "#1fce93" : "#ff4d6d");
  const bell = toon("#ffd43b");
  const eyeWhite = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false });
  const irisMat = new THREE.MeshBasicMaterial({ color: "#20335c", fog: false });
  const shineMat = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false });

  // ---------- torso: humanoid runner chest (GameSnacks-style) or cat pear tummy ----------
  const torso = new THREE.Group();
  torso.position.y = 0.78;

  const body = human
    ? ink(new THREE.Mesh(new THREE.CapsuleGeometry(0.3 * buildScale, 0.5 * buildScale, 8, 16), fur), 1.045)
    : ink(new THREE.Mesh(new THREE.SphereGeometry(TOM ? 0.385 : 0.3, 32, 24), fur), 1.045);
  body.position.y = 0.02;
  body.castShadow = true;
  torso.add(body);

  if (human) {
    // Athletic kit: navy belt at the waist, a white jersey yoke across the
    // chest and a white collar ring where the head meets the shoulders.
    const belt = new THREE.Mesh(
      new THREE.TorusGeometry(0.305 * buildScale, 0.05 * buildScale, 10, 28),
      shoeMat,
    );
    belt.rotation.x = Math.PI / 2;
    belt.position.y = -0.24;
    belt.castShadow = true;
    torso.add(belt);

    const yoke = new THREE.Mesh(
      new THREE.SphereGeometry(0.306 * buildScale, 24, 16),
      kitWhite,
    );
    yoke.scale.set(1.0, 0.6, 1.0);
    yoke.position.y = 0.2;
    yoke.castShadow = true;
    torso.add(yoke);

    // Collar ring sized to the capsule's cross-section at neck height.
    const capCenter = 0.02 + 0.25 * buildScale;
    const collarR = Math.sqrt(
      Math.max(0.04, (0.3 * buildScale) ** 2 - (0.4 - capCenter) ** 2),
    );
    const collarRing = new THREE.Mesh(
      new THREE.TorusGeometry(collarR, 0.045, 10, 28),
      kitWhite,
    );
    collarRing.rotation.x = Math.PI / 2;
    collarRing.position.y = 0.4;
    collarRing.castShadow = true;
    torso.add(collarRing);
  } else {
    // Big round cream belly — soft, round shapes read as huggable.
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 28, 20), cream);
    belly.scale.set(1.02 * buildScale, 0.96 * buildScale, 0.6 * buildScale);
    belly.position.set(0, -0.04, 0.22);
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
      for (let i = 0; i < 3; i++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.34 - i * 0.02, 0.022, 8, 32), stripeMat);
        band.rotation.x = Math.PI / 2;
        band.position.set(0, 0.02 - i * 0.12, 0.0);
        band.scale.set(1.0, 1.0, 0.86);
        band.castShadow = true;
        torso.add(band);
      }
    }
  }

  // ---------- head: oversized, round, expressive ----------
  const head = new THREE.Group();
  head.position.y = human ? 1.4 : 1.45;
  // Chibi proportions for the cat: a big round kitten head on a small body.
  head.scale.setScalar((human ? 1.06 : 1.2) * buildScale);

  const skull = ink(
    new THREE.Mesh(new THREE.SphereGeometry(human ? 0.3 : 0.36, 32, 26), human ? skin : fur),
    1.045,
  );
  skull.scale.set(human ? 1.04 : 1.0, human ? 0.96 : 0.98, human ? 0.98 : 0.94);
  skull.castShadow = true;
  head.add(skull);

  // Chubby cheek tufts make the silhouette read as a kitten, not a robot.
  if (!human) {
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), fur);
      cheek.scale.set(0.92, 0.8, 0.7);
      cheek.position.set(side * 0.25, -0.08, 0.18);
      cheek.castShadow = true;
      head.add(cheek);
    }
  }

  // Ears: rounded triangles with pink insides, tilted slightly outward.
  const ear = (side: number) => {
    const g = new THREE.Group();
    if (human) {
      // Simple rounded human ears on the sides of the head.
      const lobe = ink(new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 12), skin), 1.06);
      lobe.scale.set(0.5, 0.95, 0.8);
      lobe.position.set(side * 0.3, -0.02, -0.01);
      lobe.castShadow = true;
      g.add(lobe);
      return g;
    }
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

  // Big anime eyes — for the cat they're oversized and glossy, the core of
  // the cute/kitten look (large pupils read as soft and friendly).
  const eye = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * (human ? 0.148 : 0.17), human ? 0.085 : 0.055, 0.287);

    const white = new THREE.Mesh(
      new THREE.SphereGeometry(human ? 0.122 : 0.152, 22, 18),
      eyeWhite,
    );
    white.scale.set(human ? 0.85 : 0.92, human ? 1.12 : 1.16, human ? 0.46 : 0.5);
    white.castShadow = true;
    g.add(white);

    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(human ? 0.082 : 0.108, 20, 16),
      irisMat,
    );
    iris.position.set(0, -0.008, 0.05);
    iris.scale.set(0.86, 1.08, 0.4);
    g.add(iris);

    // Pupil: a big dark dot — dilated pupils make the face read as adorable.
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(human ? 0.032 : 0.055, 14, 12),
      toon(INK),
    );
    pupil.position.set(0, -0.008, 0.072);
    pupil.scale.set(0.9, 1.1, 0.5);
    g.add(pupil);

    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(human ? 0.03 : 0.048, 12, 10),
      shineMat,
    );
    shine.position.set(-0.026, human ? 0.045 : 0.055, 0.095);
    g.add(shine);
    const shine2 = new THREE.Mesh(
      new THREE.SphereGeometry(human ? 0.014 : 0.022, 9, 8),
      shineMat,
    );
    shine2.position.set(0.03, -0.03, 0.098);
    g.add(shine2);

    // Eyelid: a face-coloured half-shell that closes over the eye on blink.
    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(human ? 0.128 : 0.16, 20, 12),
      human ? skin : fur,
    );
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
    if (human) {
      // Short brows set close to the forehead so they never float off the face.
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.05, 6, 10), toon(INK));
      b.position.set(side * 0.11, 0.215, 0.2);
      b.rotation.z = Math.PI / 2 + side * 0.14;
      b.rotation.x = 0.1;
      g.add(b);
      return g;
    }
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

  // ---------- face: cat muzzle or a human nose + smile ----------
  const muzzle = new THREE.Group();
  muzzle.position.set(0, -0.14, 0.06);
  let nose: THREE.Mesh;
  let smile: THREE.Mesh;
  let whL: THREE.Group;
  let whR: THREE.Group;

  if (human) {
    // Cartoon human face: a small rounded nose sitting on the face surface…
    nose = ink(new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 12), noseSkin), 1.05);
    nose.scale.set(1.0, 0.9, 0.85);
    nose.position.set(0, 0.09, 0.215);
    nose.castShadow = true;
    muzzle.add(nose);

    // …and a friendly smile just proud of the chin.
    smile = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.013, 6, 16, Math.PI), toon(INK));
    smile.position.set(0, -0.05, 0.178);
    smile.rotation.z = Math.PI;
    smile.rotation.x = -0.06;
    muzzle.add(smile);

    whL = new THREE.Group();
    whR = new THREE.Group();
  } else {
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
      const blushM = new THREE.Mesh(new THREE.SphereGeometry(0.078, 16, 12), blush);
      blushM.scale.set(1, 0.8, 0.5);
      blushM.position.set(side * 0.255, 0.0, 0.28);
      muzzle.add(blushM);
    }

    nose = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), pink);
    nose.scale.set(1.25, 0.8, 0.72);
    nose.position.set(0, 0.075, 0.285);
    nose.castShadow = true;
    muzzle.add(nose);

    smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.012, 6, 16, Math.PI),
      toon(INK),
    );
    smile.position.set(0, -0.02, 0.285);
    smile.rotation.z = Math.PI;
    smile.rotation.x = -0.06;
    muzzle.add(smile);

    // The classic ω kitten mouth: two small arcs curling up either side of
    // the nose. This single detail sells "cute cat" more than anything else.
    for (const side of [-1, 1]) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(0.036, 0.009, 6, 14, Math.PI),
        toon(INK),
      );
      arc.position.set(side * 0.036, 0.028, 0.288);
      arc.rotation.z = Math.PI;
      arc.rotation.x = -0.05;
      muzzle.add(arc);
    }

    const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), pink);
    tongue.scale.set(1.2, 0.5, 0.55);
    tongue.position.set(0, -0.06, 0.284);
    muzzle.add(tongue);

    // Whiskers: three per cheek, thin and swept back a little.
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
    whL = makeWhiskers(-1);
    whR = makeWhiskers(1);
  }
  const whiskerLine = new THREE.Group();
  whiskerLine.add(whL, whR);
  muzzle.add(whiskerLine);
  head.add(muzzle);

  // Tom & Jerry cartoon stripes on the head (Tom only).
  if (index === 0 && !human) {
    const headStripe = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.022, 8, 28), stripeMat);
    headStripe.rotation.x = Math.PI / 2;
    headStripe.position.set(0, 0.18, 0.12);
    headStripe.scale.set(1.0, 0.6, 0.8);
    headStripe.castShadow = true;
    head.add(headStripe);
  }

  // Forehead tuft (cat) or a swept-back hair shell (human).
  const hair = new THREE.Group();
  if (human) {
    // Shifted behind the face so the forehead and features stay clear while
    // the crown, sides and back of the head stay covered.
    const cap = ink(new THREE.Mesh(new THREE.SphereGeometry(0.305, 26, 20), hairMat), 1.03);
    cap.scale.set(1.05, 1.0, 1.0);
    cap.position.set(0, 0.02, -0.06);
    cap.castShadow = true;
    hair.add(cap);
    // Side-swept fringe: two lobes that arc across the upper forehead and
    // vanish into the face, giving the hair a styled silhouette.
    const fringe = (x: number, y: number, z: number, sx: number, sy: number, rz: number) => {
      const f = ink(new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), hairMat), 1.04);
      f.scale.set(sx, sy, 0.9);
      f.position.set(x, y, z);
      f.rotation.z = rz;
      f.castShadow = true;
      hair.add(f);
    };
    fringe(0.03, 0.27, 0.1, 1.3, 0.42, -0.18);
    fringe(-0.09, 0.255, 0.085, 0.9, 0.4, 0.22);
  } else {
    for (let i = 0; i < 3; i++) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 10), fur);
      tuft.position.set((i - 1) * 0.052, 0.28 + (i === 1 ? 0.03 : 0), 0.07);
      tuft.rotation.z = (i - 1) * 0.38;
      tuft.rotation.x = -0.5;
      tuft.castShadow = true;
      hair.add(tuft);
    }
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

  // ---------- tail: a real curved tube, cream tip (cats only) ----------
  const tail = new THREE.Group();
  tail.position.set(0, 0.62, -0.24);
  if (human) {
    // Humans have no tail — keep an empty group so the animator can still
    // rotate it safely (it is referenced unguarded during tumbles).
    group.add(tail);
  } else {
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
      for (let i = 0; i < 3; i++) {
        const tband = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 6, 16), stripeMat);
        tband.position.set(0.05 + i * 0.12, 0.1 + i * 0.06, -0.2 - i * 0.1);
        tband.rotation.y = 0.4 + i * 0.3;
        tband.castShadow = true;
        tail.add(tband);
      }
    }
    group.add(tail);
  }

  // ---------- legs ----------
  const leg = (side: number) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.145, 0.44, 0);
    hip.scale.setScalar(1.05 * buildScale);
    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.095, 0.2, 8, 14),
      human ? kitWhite : fur,
    );
    thigh.position.y = -0.17;
    thigh.castShadow = true;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.33;
    const shin = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.078, 0.17, 8, 14),
      human ? skin : fur,
    );
    shin.position.y = -0.15;
    shin.castShadow = true;
    knee.add(shin);
    const foot = ink(
      new THREE.Mesh(
        new THREE.SphereGeometry(human ? 0.1 : 0.118, 16, 12),
        human ? shoeMat : cream,
      ),
      1.06,
    );
    foot.scale.set(human ? 1.0 : 1.08, human ? 0.58 : 0.62, human ? 1.55 : 1.5);
    foot.position.set(0, -0.26, 0.07);
    foot.castShadow = true;
    knee.add(foot);
    if (human) {
      // White sneaker sole, parented to the foot so it follows the run cycle.
      const sole = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), toon("#f4f6fb"));
      sole.scale.set(1.06, 0.5, 1.0);
      sole.position.set(0, -0.09, 0);
      foot.add(sole);
      // Rounded white toe cap at the front of the shoe.
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), toon("#f4f6fb"));
      toe.scale.set(1.15, 0.75, 0.95);
      toe.position.set(0, -0.052, 0.065);
      foot.add(toe);
    }
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
    if (human) {
      // Deltoid ball + white sleeve hem so the arm reads as a shirt sleeve.
      const delt = ink(new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), fur), 1.05);
      delt.castShadow = true;
      shoulder.add(delt);
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 18), kitWhite);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.27;
      shoulder.add(cuff);
    }
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    const fore = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.06, 0.15, 8, 14),
      human ? skin : fur,
    );
    fore.position.y = -0.13;
    fore.castShadow = true;
    elbow.add(fore);
    // Chunky mitten paws — big soft paws are a signature of cute kittens.
    const paw = ink(
      new THREE.Mesh(
        new THREE.SphereGeometry(human ? 0.085 : 0.1, 14, 12),
        human ? skin : cream,
      ),
      1.07,
    );
    paw.scale.set(1.05, 0.86, 1.16);
    paw.position.set(0, -0.27, 0.01);
    paw.castShadow = true;
    elbow.add(paw);
    if (human) {
      // Thumb bump so the hand reads as a cartoon fist, not a ball.
      const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), skin);
      thumb.position.set(-side * 0.06, -0.255, 0.045);
      thumb.scale.set(0.9, 1.1, 0.9);
      elbow.add(thumb);
    }
    // Toe beans make the mitten unmistakably a cat paw.
    if (!human) {
      for (let k = 0; k < 3; k++) {
        const bean = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), pink);
        bean.position.set((k - 1) * 0.03, -0.305, 0.075);
        bean.scale.set(0.9, 0.8, 0.5);
        elbow.add(bean);
      }
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
    furColor: suitColor,
    stripes: human || index !== 0 ? [] : [stripeMat],
    headY: human ? 1.52 : 1.46,
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
