const EXPECTED_BLUEMAP_VERSION = "5.24";
const INSTALL_KEY = Symbol.for("sgp.bluemap.controls");
const PAN_Y_KEY = Symbol("sgp-screen-plane-pan-y");
const HALF_PI = Math.PI / 2;

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeVersion(value) {
  return String(value ?? "").trim().replace(/^v/i, "");
}

function detectedBlueMapVersion(bluemap) {
  const runtime = normalizeVersion(bluemap?.settings?.version);
  if (runtime && runtime !== "?") return runtime;
  const documentVersion = normalizeVersion(document.querySelector('meta[name="version"]')?.getAttribute("content"));
  return documentVersion && documentVersion !== "?" ? documentVersion : "";
}

function isExpectedBlueMapVersion(version) {
  // BlueMap normally reports exactly "5.24". Permit build metadata/suffixes
  // without accidentally accepting a later numeric series such as 5.240.
  return /^5\.24(?:$|[^0-9])/.test(version);
}

function compatibilityError(message) {
  return new Error(`BlueMap ${EXPECTED_BLUEMAP_VERSION} compatibility check failed: ${message}`);
}

function requireFunction(value, name) {
  if (typeof value !== "function") throw compatibilityError(`missing ${name}`);
}

function validateBlueMap(bluemap, BlueMap) {
  const version = detectedBlueMapVersion(bluemap);
  if (!isExpectedBlueMapVersion(version)) {
    throw compatibilityError(`expected ${EXPECTED_BLUEMAP_VERSION}, found ${version || "unknown"}`);
  }

  if (!BlueMap?.MapControls || !BlueMap?.MapHeightControls || !BlueMap?.MouseMoveControls || !BlueMap?.TouchMoveControls) {
    throw compatibilityError("expected map-control classes are not exported on window.BlueMap");
  }
  if (!BlueMap?.Three?.Vector3 || !BlueMap?.Three?.MathUtils) {
    throw compatibilityError("expected Three.js exports are not available on window.BlueMap.Three");
  }
  requireFunction(BlueMap.Three.MathUtils.clamp, "Three.MathUtils.clamp");

  requireFunction(BlueMap.MapControls.prototype.update, "MapControls.update");
  requireFunction(BlueMap.MapControls.getMaxPerspectiveAngleForDistance, "MapControls.getMaxPerspectiveAngleForDistance");
  requireFunction(BlueMap.MapControls.getMaxDistanceForPerspectiveAngle, "MapControls.getMaxDistanceForPerspectiveAngle");
  requireFunction(BlueMap.MapHeightControls.prototype.update, "MapHeightControls.update");
  requireFunction(BlueMap.MouseMoveControls.prototype.update, "MouseMoveControls.update");
  requireFunction(BlueMap.TouchMoveControls.prototype.update, "TouchMoveControls.update");
  requireFunction(bluemap?.resetCamera, "BlueMapApp.resetCamera");
  requireFunction(bluemap?.setPerspectiveView, "BlueMapApp.setPerspectiveView");
  requireFunction(bluemap?.updatePageAddress, "BlueMapApp.updatePageAddress");

  const mapControls = bluemap?.mapControls;
  const manager = bluemap?.mapViewer?.controlsManager;
  if (!(mapControls instanceof BlueMap.MapControls)) throw compatibilityError("active mapControls is not a MapControls instance");
  if (!manager?.position || !manager?.camera?.quaternion) throw compatibilityError("active ControlsManager/camera shape is unexpected");
  requireFunction(manager.position.add, "ControlsManager.position.add");
  if (!(mapControls.mapHeight instanceof BlueMap.MapHeightControls)) throw compatibilityError("MapControls.mapHeight shape is unexpected");
  if (!(mapControls.mouseMove instanceof BlueMap.MouseMoveControls)) throw compatibilityError("MapControls.mouseMove shape is unexpected");
  if (!(mapControls.touchMove instanceof BlueMap.TouchMoveControls)) throw compatibilityError("MapControls.touchMove shape is unexpected");
  for (const [name, control] of [["mouseMove", mapControls.mouseMove], ["touchMove", mapControls.touchMove]]) {
    if (!control.deltaPosition || !finiteNumber(control.speed) || !finiteNumber(control.stiffness)
      || !finiteNumber(control.pixelToSpeedMultiplierX) || !finiteNumber(control.pixelToSpeedMultiplierY)) {
      throw compatibilityError(`MapControls.${name} state is unexpected`);
    }
    requireFunction(control.deltaPosition.multiplyScalar, `MapControls.${name}.deltaPosition.multiplyScalar`);
    requireFunction(control.deltaPosition.lengthSq, `MapControls.${name}.deltaPosition.lengthSq`);
  }
}

function screenPlaneMoveUpdate(Vector3, MathUtils) {
  const right = new Vector3();
  const up = new Vector3();
  const movement = new Vector3();

  return function updateScreenPlaneMove(delta) {
    if (this.deltaPosition.x === 0 && this.deltaPosition.y === 0) return;

    let smoothing = this.stiffness / (16.666 / delta);
    smoothing = MathUtils.clamp(smoothing, 0, 1);

    // Match BlueMap's existing drag/inertia scaling, but translate the orbit
    // target in the camera's screen plane instead of projecting onto X/Z.
    const moveX = this.deltaPosition.x * smoothing * this.manager.distance * this.speed * this.pixelToSpeedMultiplierX;
    const moveY = this.deltaPosition.y * smoothing * this.manager.distance * this.speed * this.pixelToSpeedMultiplierY;
    const quaternion = this.manager.camera.quaternion;

    right.set(1, 0, 0).applyQuaternion(quaternion);
    up.set(0, 1, 0).applyQuaternion(quaternion);
    movement.copy(right).multiplyScalar(moveX).addScaledVector(up, -moveY);
    this.manager.position.add(movement);
    this.manager[PAN_Y_KEY] = (this.manager[PAN_Y_KEY] ?? 0) + movement.y;

    this.deltaPosition.multiplyScalar(1 - smoothing);
    if (this.deltaPosition.lengthSq() < 0.0001) this.deltaPosition.set(0, 0);
  };
}

function resolveResetCenter(bluemap, options) {
  const map = bluemap.mapViewer.map;
  if (!map) return null;

  const configured = typeof options.resetCenter === "function"
    ? options.resetCenter(map, bluemap)
    : options.resetCenter;
  if (configured && finiteNumber(configured.x) && finiteNumber(configured.y) && finiteNumber(configured.z)) {
    return configured;
  }

  const resetY = typeof options.resetY === "function"
    ? options.resetY(map, bluemap)
    : options.resetY;
  if (!finiteNumber(resetY)) return null;
  return { x: map.data.startPos.x, y: resetY, z: map.data.startPos.z };
}

function updateCameraTarget(bluemap) {
  const manager = bluemap.mapViewer.controlsManager;
  manager.updateCamera?.();
  bluemap.mapViewer.updateLoadedMapArea?.();
  bluemap.updatePageAddress();
}

function applyResetCenter(bluemap, options) {
  const center = resolveResetCenter(bluemap, options);
  if (!center) return false;

  bluemap.mapViewer.controlsManager.position.set(center.x, center.y, center.z);
  updateCameraTarget(bluemap);
  return true;
}

function applyInitialTargetY(bluemap, value) {
  const targetY = typeof value === "function" ? value(bluemap.mapViewer.map, bluemap) : value;
  if (!finiteNumber(targetY)) return false;
  bluemap.mapViewer.controlsManager.position.y = targetY;
  updateCameraTarget(bluemap);
  return true;
}


/**
 * Installs the SGP arena camera model on the already-running BlueMap 5.24 app.
 * If any expected internal shape does not match, nothing is patched and stock
 * BlueMap controls remain active.
 */
export function installSgpBlueMapControls(options = {}) {
  const bluemap = window.bluemap;
  const BlueMap = window.BlueMap;
  if (!bluemap || !BlueMap) {
    console.warn(`[SGP map controls] BlueMap ${EXPECTED_BLUEMAP_VERSION} globals are unavailable; leaving stock controls active.`);
    return false;
  }
  if (window[INSTALL_KEY]) return true;

  try {
    validateBlueMap(bluemap, BlueMap);
  } catch (error) {
    console.warn(`[SGP map controls] ${error instanceof Error ? error.message : error}; leaving stock controls active.`);
    return false;
  }

  const { MapControls, MapHeightControls, MouseMoveControls, TouchMoveControls, Three } = BlueMap;
  const originals = {
    mapUpdate: MapControls.prototype.update,
    heightUpdate: MapHeightControls.prototype.update,
    mouseMoveUpdate: MouseMoveControls.prototype.update,
    touchMoveUpdate: TouchMoveControls.prototype.update,
    maxPerspectiveAngle: MapControls.getMaxPerspectiveAngleForDistance,
    maxDistanceForAngle: MapControls.getMaxDistanceForPerspectiveAngle,
    resetCamera: bluemap.resetCamera,
    setPerspectiveView: bluemap.setPerspectiveView,
  };

  const rollback = () => {
    MapControls.prototype.update = originals.mapUpdate;
    MapHeightControls.prototype.update = originals.heightUpdate;
    MouseMoveControls.prototype.update = originals.mouseMoveUpdate;
    TouchMoveControls.prototype.update = originals.touchMoveUpdate;
    MapControls.getMaxPerspectiveAngleForDistance = originals.maxPerspectiveAngle;
    MapControls.getMaxDistanceForPerspectiveAngle = originals.maxDistanceForAngle;
    bluemap.resetCamera = originals.resetCamera;
    bluemap.setPerspectiveView = originals.setPerspectiveView;
    delete window[INSTALL_KEY];
  };

  try {
    const moveUpdate = screenPlaneMoveUpdate(Three.Vector3, Three.MathUtils);
    MouseMoveControls.prototype.update = moveUpdate;
    TouchMoveControls.prototype.update = moveUpdate;

    // BlueMap's stock update resets target Y to -10000 before terrain snapping.
    // Let the stock update keep handling zoom/orbit/rotation, then restore the
    // freely movable target Y plus the Y component contributed by screen pan.
    MapHeightControls.prototype.update = function noTerrainHeightSnap() {};
    MapControls.prototype.update = function updateFreeTargetY(delta, map) {
      const manager = this.manager;
      const startY = manager.position.y;
      manager[PAN_Y_KEY] = 0;
      originals.mapUpdate.call(this, delta, map);
      if (!this.data.followingPlayer) manager.position.y = startY + (manager[PAN_Y_KEY] ?? 0);
      manager[PAN_Y_KEY] = 0;
    };

    // Keep the normal perspective range at every useful arena distance. The
    // mouse/touch/keyboard angle and zoom controls already consult these helpers.
    MapControls.getMaxPerspectiveAngleForDistance = () => HALF_PI;
    MapControls.getMaxDistanceForPerspectiveAngle = () => Number.POSITIVE_INFINITY;

    bluemap.setPerspectiveView = function setSgpPerspectiveView(transition = 0, minDistance = 5) {
      void transition;

      const manager = this.mapViewer.controlsManager;
      const targetY = manager.position.y;
      // A zero-duration BlueMap transition is synchronous in 5.24. It keeps all
      // native mode-transition bookkeeping while avoiding a terrain-Y animation.
      const result = originals.setPerspectiveView.call(this, 0, minDistance);
      manager.position.y = targetY;
      updateCameraTarget(this);
      return result;
    };

    bluemap.resetCamera = function resetSgpCamera() {
      const result = originals.resetCamera.apply(this, arguments);
      applyResetCenter(this, options);
      return result;
    };

    window[INSTALL_KEY] = { version: EXPECTED_BLUEMAP_VERSION, rollback };

    // A stock update can run between BlueMap's initial address load and this
    // asynchronously imported shim, so each bootstrap supplies the intended
    // startup Y explicitly. Only Y is restored; URL-provided X/Z/view state stay intact.
    applyInitialTargetY(bluemap, options.initialTargetY);
    console.info(`[SGP map controls] Active on BlueMap ${detectedBlueMapVersion(bluemap)}.`);
    return true;
  } catch (error) {
    rollback();
    console.warn(`[SGP map controls] Failed to install the BlueMap ${EXPECTED_BLUEMAP_VERSION} control shim: ${error instanceof Error ? error.message : error}. Stock controls were restored.`);
    return false;
  }
}

export function cameraTarget(location) {
  if (typeof location !== "string") return null;
  const parts = location.replace(/^#/, "").split(":");
  if (parts.length !== 10) return null;
  const x = Number(parts[1]);
  const y = Number(parts[2]);
  const z = Number(parts[3]);
  return finiteNumber(x) && finiteNumber(y) && finiteNumber(z) ? { x, y, z } : null;
}

export function cameraTargetY(location) {
  return cameraTarget(location)?.y ?? null;
}

export function midpoint(min, max) {
  if (!finiteNumber(min) || !finiteNumber(max) || max < min) return null;
  return min + (max - min) / 2;
}
