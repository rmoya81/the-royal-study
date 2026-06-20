// Procedural 3D chess pieces — ornate "baroque / medieval-fantasy" styling
// (inspired by carved collector sets rather than a minimal Staunton set), built
// entirely from lathe profiles + decorative primitives so the game still ships
// as a tiny bundle with no external model downloads.
//
// Each radially-symmetric body is a 2D silhouette revolved around Y, dressed
// with decorative collar rings, a stepped base and sculpted finials. The knight
// is composed from primitives into a sculpted horse head.

import {
  Group,
  LatheGeometry,
  Mesh,
  Vector2,
  CylinderGeometry,
  BoxGeometry,
  SphereGeometry,
  TorusGeometry,
  ConeGeometry,
} from 'three';

const SEG = 40; // lathe segments — higher = smoother carved look

// Silhouettes (radius, height), bottom→top, more sculpted than a plain Staunton
// profile: a wide stepped foot, a slender fluted stem with swellings, and an
// ornate head. The closing point sits on the axis (radius 0) to cap the top.
const PROFILES = {
  P: [
    [0.00, 0.00], [0.30, 0.00], [0.30, 0.05], [0.23, 0.09], [0.27, 0.12],
    [0.18, 0.17], [0.14, 0.22], [0.13, 0.34], [0.21, 0.40], [0.13, 0.47],
    [0.15, 0.52], [0.18, 0.58], [0.16, 0.64], [0.10, 0.70], [0.00, 0.74],
  ],
  R: [
    [0.00, 0.00], [0.34, 0.00], [0.34, 0.06], [0.26, 0.10], [0.30, 0.14],
    [0.21, 0.19], [0.19, 0.30], [0.18, 0.55], [0.21, 0.60], [0.27, 0.64],
    [0.27, 0.70], [0.30, 0.74], [0.30, 0.86], [0.22, 0.86], [0.22, 0.78],
    [0.00, 0.78],
  ],
  B: [
    [0.00, 0.00], [0.33, 0.00], [0.33, 0.06], [0.25, 0.10], [0.29, 0.13],
    [0.19, 0.18], [0.16, 0.30], [0.15, 0.50], [0.23, 0.57], [0.14, 0.63],
    [0.12, 0.70], [0.18, 0.78], [0.20, 0.86], [0.12, 0.96], [0.06, 1.04],
    [0.00, 1.08],
  ],
  Q: [
    [0.00, 0.00], [0.38, 0.00], [0.38, 0.07], [0.29, 0.11], [0.33, 0.15],
    [0.22, 0.21], [0.18, 0.34], [0.16, 0.62], [0.24, 0.70], [0.15, 0.78],
    [0.13, 0.86], [0.20, 0.94], [0.26, 1.02], [0.20, 1.10], [0.22, 1.18],
    [0.10, 1.24], [0.00, 1.28],
  ],
  K: [
    [0.00, 0.00], [0.40, 0.00], [0.40, 0.07], [0.31, 0.11], [0.35, 0.15],
    [0.23, 0.22], [0.19, 0.36], [0.17, 0.70], [0.25, 0.78], [0.16, 0.86],
    [0.14, 0.94], [0.21, 1.02], [0.27, 1.12], [0.20, 1.20], [0.22, 1.28],
    [0.16, 1.34], [0.00, 1.38],
  ],
};

function latheFromProfile(profile) {
  const points = profile.map(([x, y]) => new Vector2(x, y));
  const geo = new LatheGeometry(points, SEG);
  geo.computeVertexNormals();
  return geo;
}

// Build & cache the lathe bodies once; meshes share geometry across instances.
const GEO = {};
for (const key of Object.keys(PROFILES)) GEO[key] = latheFromProfile(PROFILES[key]);

// Shared decorative geometries (reused across all pieces of a kind).
const COLLAR = new TorusGeometry(0.205, 0.028, 10, SEG);
const BEAD = new SphereGeometry(0.06, 16, 16);

function addCollar(group, mat, y, radius = 0.205, tube = 0.028) {
  const ring = new Mesh(radius === 0.205 && tube === 0.028 ? COLLAR : new TorusGeometry(radius, tube, 10, SEG), mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  ring.castShadow = true;
  group.add(ring);
  return ring;
}

function makeKnight(material) {
  // Sculpted horse head with a flowing mane — reads from any angle.
  const g = new Group();

  // Stepped ornate base.
  const foot = new Mesh(new CylinderGeometry(0.34, 0.34, 0.06, SEG), material);
  foot.position.y = 0.03;
  g.add(foot);
  const foot2 = new Mesh(new CylinderGeometry(0.27, 0.32, 0.05, SEG), material);
  foot2.position.y = 0.085;
  g.add(foot2);
  addCollar(g, material, 0.13, 0.2, 0.03);

  const neck = new Mesh(new BoxGeometry(0.24, 0.5, 0.22), material);
  neck.position.set(0, 0.44, -0.03);
  neck.rotation.x = -0.28;
  g.add(neck);

  const head = new Mesh(new BoxGeometry(0.26, 0.24, 0.46), material);
  head.position.set(0, 0.72, 0.08);
  head.rotation.x = 0.32;
  g.add(head);

  const muzzle = new Mesh(new BoxGeometry(0.19, 0.17, 0.22), material);
  muzzle.position.set(0, 0.65, 0.33);
  muzzle.rotation.x = 0.5;
  g.add(muzzle);

  // Mane: a row of small wedges down the back of the neck.
  for (let i = 0; i < 5; i++) {
    const tuft = new Mesh(new ConeGeometry(0.06, 0.16, 6), material);
    tuft.position.set(0, 0.86 - i * 0.12, -0.16 + i * 0.04);
    tuft.rotation.x = -0.9;
    g.add(tuft);
  }

  const earL = new Mesh(new ConeGeometry(0.05, 0.16, 8), material);
  earL.position.set(0.07, 0.9, -0.02);
  g.add(earL);
  const earR = earL.clone();
  earR.position.x = -0.07;
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

  // Ornate accents per piece.
  switch (type) {
    case 'P':
      addCollar(group, material, 0.4, 0.16, 0.022);
      group.add(place(new Mesh(BEAD, material), 0, 0.74));
      break;

    case 'R': {
      // Battlement crown: a ring of merlons around the top.
      const merlons = 6;
      for (let i = 0; i < merlons; i++) {
        const a = (i / merlons) * Math.PI * 2;
        const m = new Mesh(new BoxGeometry(0.09, 0.12, 0.09), material);
        m.position.set(Math.cos(a) * 0.21, 0.84, Math.sin(a) * 0.21);
        m.castShadow = true;
        group.add(m);
      }
      addCollar(group, material, 0.55, 0.19, 0.024);
      break;
    }

    case 'B':
      addCollar(group, material, 0.56, 0.18, 0.024);
      // Mitre slit + crowning bead.
      group.add(place(new Mesh(BEAD, material), 0, 1.1));
      break;

    case 'Q': {
      addCollar(group, material, 0.68, 0.2, 0.026);
      // Coronet of beads.
      const pts = 8;
      for (let i = 0; i < pts; i++) {
        const a = (i / pts) * Math.PI * 2;
        const b = new Mesh(new SphereGeometry(0.04, 10, 10), material);
        b.position.set(Math.cos(a) * 0.16, 1.18, Math.sin(a) * 0.16);
        b.castShadow = true;
        group.add(b);
      }
      group.add(place(new Mesh(new SphereGeometry(0.06, 16, 16), material), 0, 1.32));
      break;
    }

    case 'K': {
      addCollar(group, material, 0.76, 0.21, 0.026);
      // Crown band + cross finial.
      const band = new Mesh(new TorusGeometry(0.14, 0.03, 10, SEG), material);
      band.rotation.x = Math.PI / 2;
      band.position.y = 1.3;
      band.castShadow = true;
      group.add(band);
      const cross = new Mesh(new BoxGeometry(0.05, 0.2, 0.05), material);
      cross.position.y = 1.5;
      cross.castShadow = true;
      group.add(cross);
      const arm = new Mesh(new BoxGeometry(0.16, 0.05, 0.05), material);
      arm.position.y = 1.5;
      arm.castShadow = true;
      group.add(arm);
      break;
    }
  }

  return group;
}

function place(mesh, x, y) {
  mesh.position.set(x, y, 0);
  mesh.castShadow = true;
  return mesh;
}

export const PIECE_HEIGHT = {
  P: 0.74, R: 0.86, B: 1.1, N: 0.98, Q: 1.32, K: 1.5,
};
