// Procedural 3D chess pieces built from lathe profiles (no external models, so
// the whole game ships as a tiny bundle). Radially symmetric pieces (pawn,
// rook, bishop, queen, king) come from a 2D silhouette revolved around Y; the
// knight is composed from primitives.

import {
  Group,
  LatheGeometry,
  Mesh,
  Vector2,
  CylinderGeometry,
  BoxGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';

// Profile points are (radius, height) pairs in board units. Pieces sit on the
// XZ plane with their base at y=0. Tuned for a ~0.42 unit piece radius.
const PROFILES = {
  P: [
    [0.00, 0.00], [0.26, 0.00], [0.26, 0.05], [0.17, 0.10], [0.15, 0.30],
    [0.20, 0.38], [0.13, 0.44], [0.12, 0.55], [0.20, 0.62], [0.00, 0.62],
  ],
  R: [
    [0.00, 0.00], [0.30, 0.00], [0.30, 0.06], [0.20, 0.12], [0.18, 0.62],
    [0.26, 0.66], [0.26, 0.80], [0.20, 0.80], [0.20, 0.72], [0.00, 0.72],
  ],
  B: [
    [0.00, 0.00], [0.30, 0.00], [0.30, 0.06], [0.18, 0.12], [0.16, 0.55],
    [0.24, 0.62], [0.13, 0.70], [0.16, 0.80], [0.10, 0.92], [0.00, 0.98],
  ],
  Q: [
    [0.00, 0.00], [0.34, 0.00], [0.34, 0.07], [0.20, 0.14], [0.17, 0.70],
    [0.27, 0.78], [0.16, 0.86], [0.20, 1.00], [0.10, 1.06], [0.14, 1.14],
    [0.00, 1.16],
  ],
  K: [
    [0.00, 0.00], [0.36, 0.00], [0.36, 0.07], [0.21, 0.14], [0.18, 0.78],
    [0.28, 0.86], [0.17, 0.94], [0.20, 1.08], [0.12, 1.14], [0.16, 1.20],
    [0.10, 1.24], [0.00, 1.26],
  ],
};

function latheFromProfile(profile, segments = 28) {
  const points = profile.map(([x, y]) => new Vector2(x, y));
  const geo = new LatheGeometry(points, segments);
  geo.computeVertexNormals();
  return geo;
}

// Pre-build lathe geometries once and reuse them across every instance.
const GEO = {};
for (const key of Object.keys(PROFILES)) GEO[key] = latheFromProfile(PROFILES[key]);

function makeKnight(material) {
  // Stylized horse head from a few primitives — readable from any angle.
  const g = new Group();

  const base = new Mesh(new CylinderGeometry(0.3, 0.3, 0.08, 24), material);
  base.position.y = 0.04;
  g.add(base);

  const collar = new Mesh(new CylinderGeometry(0.2, 0.28, 0.12, 24), material);
  collar.position.y = 0.14;
  g.add(collar);

  const neck = new Mesh(new BoxGeometry(0.22, 0.45, 0.2), material);
  neck.position.set(0, 0.42, -0.02);
  neck.rotation.x = -0.25;
  g.add(neck);

  const head = new Mesh(new BoxGeometry(0.24, 0.22, 0.42), material);
  head.position.set(0, 0.66, 0.08);
  head.rotation.x = 0.35;
  g.add(head);

  const muzzle = new Mesh(new BoxGeometry(0.18, 0.16, 0.2), material);
  muzzle.position.set(0, 0.6, 0.3);
  muzzle.rotation.x = 0.55;
  g.add(muzzle);

  const earL = new Mesh(new BoxGeometry(0.05, 0.14, 0.05), material);
  earL.position.set(0.06, 0.82, -0.04);
  g.add(earL);
  const earR = earL.clone();
  earR.position.x = -0.06;
  g.add(earR);

  for (const m of g.children) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  return g;
}

/** Build a piece mesh/group for a piece type, using the supplied material. */
export function buildPiece(type, material) {
  if (type === 'N') return makeKnight(material);

  const group = new Group();
  const body = new Mesh(GEO[type], material);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Crowns / finials that read better as separate caps.
  if (type === 'Q') {
    const ball = new Mesh(new SphereGeometry(0.07, 16, 16), material);
    ball.position.y = 1.2;
    ball.castShadow = true;
    group.add(ball);
  }
  if (type === 'K') {
    const cross = new Mesh(new BoxGeometry(0.05, 0.18, 0.05), material);
    cross.position.y = 1.34;
    cross.castShadow = true;
    group.add(cross);
    const arm = new Mesh(new BoxGeometry(0.14, 0.05, 0.05), material);
    arm.position.y = 1.34;
    arm.castShadow = true;
    group.add(arm);
  }
  if (type === 'R') {
    // Crenellations on the rook.
    const ring = new Mesh(new TorusGeometry(0.21, 0.03, 8, 20), material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.8;
    group.add(ring);
  }
  return group;
}

export const PIECE_HEIGHT = {
  P: 0.62, R: 0.8, B: 0.98, N: 0.86, Q: 1.16, K: 1.26,
};
