import assert from "node:assert/strict";
import test from "node:test";
import { cameraTargetY, installSgpBlueMapControls, midpoint } from "../public/bluemap/sgp-controls.mjs";

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(value) { return this.set(value.x, value.y, value.z); }
  add(value) { this.x += value.x; this.y += value.y; this.z += value.z; return this; }
  addScaledVector(value, scale) { this.x += value.x * scale; this.y += value.y * scale; this.z += value.z * scale; return this; }
  multiplyScalar(scale) { this.x *= scale; this.y *= scale; this.z *= scale; return this; }
  applyQuaternion(q) {
    const { x, y, z } = this;
    const ix = q.w * x + q.y * z - q.z * y;
    const iy = q.w * y + q.z * x - q.x * z;
    const iz = q.w * z + q.x * y - q.y * x;
    const iw = -q.x * x - q.y * y - q.z * z;
    this.x = ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y;
    this.y = iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z;
    this.z = iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x;
    return this;
  }
}

class Vector2 {
  constructor(x = 0, y = 0) { this.set(x, y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  multiplyScalar(scale) { this.x *= scale; this.y *= scale; return this; }
  lengthSq() { return this.x * this.x + this.y * this.y; }
}

class MapHeightControls {
  constructor() { this.manager = null; }
  update() { this.manager.position.y = 999; }
}

class MouseMoveControls {
  constructor() {
    this.manager = null;
    this.deltaPosition = new Vector2();
    this.stiffness = 1;
    this.speed = 1;
    this.pixelToSpeedMultiplierX = 1;
    this.pixelToSpeedMultiplierY = 1;
  }
  update() {}
}

class TouchMoveControls extends MouseMoveControls {}

class MapControls {
  static getMaxPerspectiveAngleForDistance() { return 0.1; }
  static getMaxDistanceForPerspectiveAngle() { return 10; }

  constructor() {
    this.data = { followingPlayer: null };
    this.mouseMove = new MouseMoveControls();
    this.touchMove = new TouchMoveControls();
    this.mapHeight = new MapHeightControls();
    this.manager = null;
  }

  update(delta, map) {
    this.manager.position.y = -10000;
    this.mouseMove.update(delta, map);
    this.touchMove.update(delta, map);
    if (this.data.followingPlayer) this.manager.position.copy(this.data.followingPlayer.position);
    this.mapHeight.update(delta, map);
  }
}

const BlueMap = {
  MapControls,
  MapHeightControls,
  MouseMoveControls,
  TouchMoveControls,
  Three: {
    Vector3,
    MathUtils: { clamp: (value, min, max) => Math.min(max, Math.max(min, value)) },
  },
};

function fakeApp(version = "5.24") {
  const manager = {
    position: new Vector3(10, 50, 20),
    camera: { quaternion: { x: 0, y: 0, z: 0, w: 1 } },
    distance: 1,
    rotation: 0,
    angle: 0,
    tilt: 0,
    ortho: 0,
    updateCamera() {},
  };
  const controls = new MapControls();
  controls.manager = manager;
  controls.mouseMove.manager = manager;
  controls.touchMove.manager = manager;
  controls.mapHeight.manager = manager;

  let addresses = 0;
  const app = {
    settings: { version },
    mapControls: controls,
    mapViewer: {
      controlsManager: manager,
      map: { data: { id: "world", startPos: { x: 10, z: 20 } } },
      updateLoadedMapArea() {},
    },
    appState: { controls: { state: "perspective" } },
    resetCamera() {
      manager.position.set(10, 0, 20);
      manager.distance = 1500;
      manager.rotation = 0;
      manager.angle = 0;
      manager.tilt = 0;
      manager.ortho = 0;
      this.updatePageAddress();
    },
    setPerspectiveView() {
      manager.position.y = 999;
      manager.angle = 0.1;
      this.updatePageAddress();
    },
    updatePageAddress() { addresses += 1; },
  };
  return { app, manager, controls, get addresses() { return addresses; } };
}

function withGlobals(app, hash = "") {
  globalThis.window = { bluemap: app, BlueMap, location: { hash } };
  globalThis.document = { querySelector: () => null };
  return () => {
    const installed = window[Symbol.for("sgp.bluemap.controls")];
    installed?.rollback?.();
    delete globalThis.window;
    delete globalThis.document;
  };
}

test("camera helpers validate locations and render bounds", () => {
  assert.equal(cameraTargetY("#world:10:42:20:1500:0:0:0:0:perspective"), 42);
  assert.equal(cameraTargetY("world:10:-12.5:20:1500:0:0:0:0:perspective"), -12.5);
  assert.equal(cameraTargetY("#world:10:nope:20:1500:0:0:0:0:perspective"), null);
  assert.equal(cameraTargetY("#too:few:parts"), null);
  assert.equal(midpoint(100, 200), 150);
  assert.equal(midpoint(195, 300), 247.5);
  assert.equal(midpoint(200, 100), null);
  assert.equal(midpoint(Number.NaN, 100), null);
});

test("shim keeps a free target Y and pans in camera screen space", () => {
  const fixture = fakeApp();
  const cleanup = withGlobals(fixture.app);
  try {
    assert.equal(installSgpBlueMapControls({ resetY: 150 }), true);

    // With an identity camera quaternion, screen-up is world +Y. A downward
    // mouse drag has a negative BlueMap delta and therefore raises the target.
    fixture.controls.mouseMove.deltaPosition.set(0, -2);
    fixture.controls.update(16.666, fixture.app.mapViewer.map);
    assert.equal(fixture.manager.position.y, 52);
    assert.equal(fixture.manager.position.z, 20);

    // Rotate camera screen-up onto world -Z (top-down-like orientation): the
    // same drag now moves across Z without being projected onto terrain.
    const half = Math.sqrt(0.5);
    fixture.manager.camera.quaternion = { x: -half, y: 0, z: 0, w: half };
    fixture.controls.mouseMove.deltaPosition.set(0, -2);
    fixture.controls.update(16.666, fixture.app.mapViewer.map);
    assert.ok(Math.abs(fixture.manager.position.y - 52) < 1e-9);
    assert.ok(Math.abs(fixture.manager.position.z - 18) < 1e-9);

    assert.equal(MapControls.getMaxPerspectiveAngleForDistance(500), Math.PI / 2);
    assert.equal(MapControls.getMaxDistanceForPerspectiveAngle(Math.PI / 2), Number.POSITIVE_INFINITY);
  } finally {
    cleanup();
  }
});

test("shim reset and perspective transition do not reintroduce terrain Y", () => {
  const fixture = fakeApp();
  const cleanup = withGlobals(fixture.app);
  try {
    assert.equal(installSgpBlueMapControls({ resetCenter: { x: 1, y: 150, z: 2 } }), true);
    fixture.app.resetCamera();
    assert.deepEqual(
      [fixture.manager.position.x, fixture.manager.position.y, fixture.manager.position.z],
      [1, 150, 2],
    );

    fixture.manager.position.y = 177;
    fixture.app.setPerspectiveView(500);
    assert.equal(fixture.manager.position.y, 177);
  } finally {
    cleanup();
  }
});

test("startup recovery handles a terrain snap before the async shim loads", () => {
  const fresh = fakeApp();
  fresh.manager.position.set(10, 999, 20);
  fresh.manager.distance = 1500;
  const cleanupFresh = withGlobals(fresh.app);
  try {
    assert.equal(installSgpBlueMapControls({ resetY: 150, initialTargetY: 150 }), true);
    assert.equal(fresh.manager.position.y, 150);
  } finally {
    cleanupFresh();
  }

  const linked = fakeApp();
  linked.manager.position.set(35, 999, -18);
  linked.manager.distance = 375;
  linked.manager.rotation = 0.4;
  const cleanupLinked = withGlobals(linked.app, "#world:35:73:-18:375:0.4:0:0:0:perspective");
  try {
    assert.equal(installSgpBlueMapControls({ resetY: 150, initialTargetY: 73 }), true);
    assert.deepEqual(
      [linked.manager.position.x, linked.manager.position.y, linked.manager.position.z],
      [35, 73, -18],
    );
    assert.equal(linked.manager.distance, 375);
    assert.equal(linked.manager.rotation, 0.4);
  } finally {
    cleanupLinked();
  }
});

test("shim accepts BlueMap 5.24 build metadata", () => {
  const fixture = fakeApp("5.24+build.17");
  const cleanup = withGlobals(fixture.app);
  try {
    assert.equal(installSgpBlueMapControls({ resetY: 150 }), true);
  } finally {
    cleanup();
  }
});

test("shim fails closed on a different BlueMap version", () => {
  const fixture = fakeApp("5.25");
  const original = MapControls.prototype.update;
  const cleanup = withGlobals(fixture.app);
  const warnings = [];
  const warn = console.warn;
  console.warn = (message) => warnings.push(String(message));
  try {
    assert.equal(installSgpBlueMapControls({ resetY: 150 }), false);
    assert.equal(MapControls.prototype.update, original);
    assert.match(warnings.join("\n"), /expected 5\.24, found 5\.25/);
  } finally {
    console.warn = warn;
    cleanup();
  }
});

test("shim rolls back a partial install and can retry cleanly", () => {
  const fixture = fakeApp();
  const cleanup = withGlobals(fixture.app);
  const originals = {
    mapUpdate: MapControls.prototype.update,
    heightUpdate: MapHeightControls.prototype.update,
    mouseMoveUpdate: MouseMoveControls.prototype.update,
    touchMoveUpdate: TouchMoveControls.prototype.update,
    maxPerspectiveAngle: MapControls.getMaxPerspectiveAngleForDistance,
    maxDistanceForAngle: MapControls.getMaxDistanceForPerspectiveAngle,
    resetCamera: fixture.app.resetCamera,
    setPerspectiveView: fixture.app.setPerspectiveView,
  };
  const warnings = [];
  const warn = console.warn;
  console.warn = (message) => warnings.push(String(message));
  try {
    fixture.app.updatePageAddress = () => { throw new Error("forced startup failure"); };
    assert.equal(installSgpBlueMapControls({ resetY: 150, initialTargetY: 150 }), false);
    assert.equal(MapControls.prototype.update, originals.mapUpdate);
    assert.equal(MapHeightControls.prototype.update, originals.heightUpdate);
    assert.equal(MouseMoveControls.prototype.update, originals.mouseMoveUpdate);
    assert.equal(TouchMoveControls.prototype.update, originals.touchMoveUpdate);
    assert.equal(MapControls.getMaxPerspectiveAngleForDistance, originals.maxPerspectiveAngle);
    assert.equal(MapControls.getMaxDistanceForPerspectiveAngle, originals.maxDistanceForAngle);
    assert.equal(fixture.app.resetCamera, originals.resetCamera);
    assert.equal(fixture.app.setPerspectiveView, originals.setPerspectiveView);
    assert.equal(window[Symbol.for("sgp.bluemap.controls")], undefined);
    assert.match(warnings.join("\n"), /Stock controls were restored/);

    fixture.app.updatePageAddress = () => {};
    assert.equal(installSgpBlueMapControls({ resetY: 150, initialTargetY: 150 }), true);
    assert.equal(fixture.manager.position.y, 150);
  } finally {
    console.warn = warn;
    cleanup();
  }
});
