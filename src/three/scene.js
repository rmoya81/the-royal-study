// 3D presentation layer: renderer, camera, lights, the wooden board and the
// pieces. It knows nothing about rules — it just renders a position and reports
// clicks (on a piece or on a square) back to the controller.

import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  Group,
  Mesh,
  BoxGeometry,
  PlaneGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  HemisphereLight,
  DirectionalLight,
  AmbientLight,
  PCFSoftShadowMap,
  Raycaster,
  Vector2,
  Vector3,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  RingGeometry,
  DoubleSide,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildPiece, PIECE_HEIGHT } from './pieces.js';

const COL_LIGHT = 0xead7b0; // maple
const COL_DARK = 0x6b4326; // walnut
const COL_PIECE = 0xf2e2c2; // boxwood ivory
const COL_FRAME = 0x3a2414;

export class Studio {
  constructor(canvas) {
    this.canvas = canvas;
    this.onPickPiece = null;
    this.onPickSquare = null;

    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = SRGBColorSpace;

    this.scene = new Scene();
    this.scene.background = new Color(0x0d2b3e);

    this.camera = new PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 6.5, 7);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 16;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(0, 0, 0);

    this._setupLights();
    this._setupStage();

    this.boardGroup = new Group();
    this.pieceGroup = new Group();
    this.markerGroup = new Group();
    this.scene.add(this.boardGroup, this.pieceGroup, this.markerGroup);

    this.squares = []; // { mesh, c, r }
    this.pieceMeshes = new Map(); // id -> { group, type, c, r }
    this.markers = [];
    this.selectedId = null;
    this.animations = [];

    this.raycaster = new Raycaster();
    this.pointer = new Vector2();
    this._bindInput();

    this._resize();
    window.addEventListener('resize', () => this._resize());

    this._tick = this._tick.bind(this);
    this._lastT = performance.now();
    requestAnimationFrame(this._tick);
  }

  _setupLights() {
    this.scene.add(new AmbientLight(0xffffff, 0.25));

    const hemi = new HemisphereLight(0xbfd8ff, 0x2a1c10, 0.55);
    this.scene.add(hemi);

    const key = new DirectionalLight(0xfff1d8, 1.6);
    key.position.set(5, 9, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    key.shadow.bias = -0.0004;
    this.scene.add(key);

    const fill = new DirectionalLight(0x9fc0ff, 0.4);
    fill.position.set(-6, 4, -3);
    this.scene.add(fill);
  }

  _setupStage() {
    // A dark felt table the board rests on.
    const table = new Mesh(
      new PlaneGeometry(60, 60),
      new MeshStandardMaterial({ color: 0x10202c, roughness: 0.95, metalness: 0 }),
    );
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.26;
    table.receiveShadow = true;
    this.scene.add(table);
  }

  /** (col,row) -> world XZ, centered on origin for the current board size. */
  _squareToWorld(c, r) {
    return new Vector3(c - (this.cols - 1) / 2, 0, r - (this.rows - 1) / 2);
  }

  /** Build the board + pieces for a fresh position. */
  loadPosition(state) {
    this.cols = state.cols;
    this.rows = state.rows;

    this.boardGroup.clear();
    this.pieceGroup.clear();
    this.markerGroup.clear();
    this.squares = [];
    this.pieceMeshes.clear();
    this.markers = [];
    this.selectedId = null;

    // Wooden frame under the playing surface.
    const frame = new Mesh(
      new BoxGeometry(this.cols + 0.7, 0.28, this.rows + 0.7),
      new MeshStandardMaterial({ color: COL_FRAME, roughness: 0.6, metalness: 0.05 }),
    );
    frame.position.y = -0.15;
    frame.receiveShadow = true;
    frame.castShadow = true;
    this.boardGroup.add(frame);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const isLight = (c + r) % 2 === 0;
        const mat = new MeshStandardMaterial({
          color: isLight ? COL_LIGHT : COL_DARK,
          roughness: 0.5,
          metalness: 0.02,
        });
        const tile = new Mesh(new BoxGeometry(0.98, 0.12, 0.98), mat);
        const p = this._squareToWorld(c, r);
        tile.position.set(p.x, -0.02, p.z);
        tile.receiveShadow = true;
        tile.userData = { c, r, baseColor: mat.color.clone() };
        this.boardGroup.add(tile);
        this.squares.push({ mesh: tile, c, r });
      }
    }

    for (const p of state.pieces) this._addPiece(p);
    this._frameCamera();
  }

  /** Re-place pieces for the same board (used by undo / reset). */
  resetPieces(state) {
    this.clearMarkers();
    this.select(null);
    this.pieceGroup.clear();
    this.pieceMeshes.clear();
    this.animations = [];
    for (const p of state.pieces) this._addPiece(p);
  }

  _addPiece(p) {
    const mat = new MeshStandardMaterial({
      color: COL_PIECE,
      roughness: 0.35,
      metalness: 0.05,
      emissive: new Color(0x000000),
    });
    const group = buildPiece(p.type, mat);
    const pos = this._squareToWorld(p.c, p.r);
    group.position.set(pos.x, 0.04, pos.z);
    group.userData = { id: p.id, type: p.type };
    this.pieceGroup.add(group);
    this.pieceMeshes.set(p.id, { group, mat, type: p.type, c: p.c, r: p.r });
  }

  _frameCamera() {
    const span = Math.max(this.cols, this.rows);
    const dist = span * 1.5 + 2;
    this.camera.position.set(0, dist * 0.85, dist * 0.95);
    this.controls.target.set(0, 0.2, 0);
    this.controls.update();
  }

  // --- selection & highlights ----------------------------------------------

  select(id) {
    if (this.selectedId && this.pieceMeshes.has(this.selectedId)) {
      this.pieceMeshes.get(this.selectedId).mat.emissive.setHex(0x000000);
    }
    this.selectedId = id;
    if (id && this.pieceMeshes.has(id)) {
      this.pieceMeshes.get(id).mat.emissive.setHex(0x2a6f4b);
    }
  }

  clearMarkers() {
    this.markerGroup.clear();
    this.markers = [];
    for (const s of this.squares) s.mesh.material.color.copy(s.mesh.userData.baseColor);
  }

  /** Highlight capture-target squares; `targets` is [{c,r}]. */
  showTargets(targets) {
    this.clearMarkers();
    for (const t of targets) {
      const pos = this._squareToWorld(t.c, t.r);
      const ring = new Mesh(
        new RingGeometry(0.3, 0.42, 28),
        new MeshBasicMaterial({ color: 0xffce4d, side: DoubleSide, transparent: true, opacity: 0.95 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos.x, 0.07, pos.z);
      ring.userData = { c: t.c, r: t.r, marker: true };
      this.markerGroup.add(ring);
      this.markers.push(ring);
    }
  }

  /** Pulse a square gold (used by the hint system). */
  flashSquare(c, r, color = 0x57c785) {
    const sq = this.squares.find((s) => s.c === c && s.r === r);
    if (sq) sq.mesh.material.color.setHex(color);
  }

  // --- animation ------------------------------------------------------------

  /** Animate a capture; resolves when the motion finishes. */
  animateMove(move) {
    return new Promise((resolve) => {
      const moverRec = this.pieceMeshes.get(move.pieceId);
      const targetRec = this.pieceMeshes.get(move.targetId);
      if (!moverRec) return resolve();

      const from = moverRec.group.position.clone();
      const to = this._squareToWorld(move.to.c, move.to.r);
      to.y = 0.04;
      const dur = 360;

      this.animations.push({
        t0: performance.now(),
        dur,
        update: (k) => {
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOut
          moverRec.group.position.lerpVectors(from, to, e);
          moverRec.group.position.y = 0.04 + Math.sin(Math.PI * k) * 0.5; // hop
        },
        done: () => {
          moverRec.group.position.copy(to);
          moverRec.c = move.to.c;
          moverRec.r = move.to.r;
          if (targetRec) {
            this.pieceGroup.remove(targetRec.group);
            this.pieceMeshes.delete(move.targetId);
          }
          resolve();
        },
      });
    });
  }

  // --- input ----------------------------------------------------------------

  _bindInput() {
    let downX = 0;
    let downY = 0;
    this.canvas.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
    });
    this.canvas.addEventListener('pointerup', (e) => {
      // Ignore drags (orbiting), only treat as a click if pointer barely moved.
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      this._handleClick(e);
    });
  }

  _handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Markers take priority (they sit above squares).
    const markerHit = this.raycaster.intersectObjects(this.markers, false)[0];
    if (markerHit && this.onPickSquare) {
      const { c, r } = markerHit.object.userData;
      this.onPickSquare(c, r);
      return;
    }

    const pieceHit = this.raycaster.intersectObjects(this.pieceGroup.children, true)[0];
    if (pieceHit) {
      let obj = pieceHit.object;
      while (obj && !(obj.userData && obj.userData.id)) obj = obj.parent;
      if (obj && this.onPickPiece) {
        this.onPickPiece(obj.userData.id);
        return;
      }
    }

    const tileHit = this.raycaster.intersectObjects(
      this.squares.map((s) => s.mesh),
      false,
    )[0];
    if (tileHit && this.onPickSquare) {
      const { c, r } = tileHit.object.userData;
      this.onPickSquare(c, r);
    }
  }

  // --- loop -----------------------------------------------------------------

  _resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _tick(now) {
    const dt = now - this._lastT;
    this._lastT = now;

    // Run active animations.
    if (this.animations.length) {
      for (const a of this.animations) {
        const k = Math.min(1, (now - a.t0) / a.dur);
        a.update(k);
        if (k >= 1) a._finished = true;
      }
      const finished = this.animations.filter((a) => a._finished);
      this.animations = this.animations.filter((a) => !a._finished);
      finished.forEach((a) => a.done());
    }

    // Gentle idle spin on the selected piece.
    if (this.selectedId && this.pieceMeshes.has(this.selectedId)) {
      this.pieceMeshes.get(this.selectedId).group.rotation.y += dt * 0.002;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._tick);
  }

  get busy() {
    return this.animations.length > 0;
  }
}
