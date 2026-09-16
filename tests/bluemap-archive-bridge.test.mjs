import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

test("archive bridge can warm-switch cameras, change preload quality, reset, pause, and dispose WebGL", async () => {
  const source = await readFile(path.resolve("public/map-archive/bluemap-archive.js"), "utf8");
  const listeners = new Map();
  const posted = [];
  const loadedHashes = [];
  const clearedIntervals = [];
  let nextInterval = 1;
  let eventSourceClosed = false;
  let playerManagerDisposed = false;
  let markerManagerDisposed = false;
  let loadedAreaUpdates = 0;
  let rendererDisposed = false;
  let rendererContextLost = false;
  let canvasContextLost = false;

  const location = {
    origin: "https://sgp.test",
    pathname: "/map-archive/editions/edition-4/r1/index.html",
    search: "",
    hash: "#world:1:65:2:100:0:1:0:0:perspective",
  };
  const parent = {
    postMessage(message, origin) {
      posted.push({ message, origin });
    },
  };
  const history = {
    state: null,
    replaceState(state, _title, url) {
      this.state = state;
      const hashIndex = String(url).indexOf("#");
      location.hash = hashIndex >= 0 ? String(url).slice(hashIndex) : "";
    },
  };
  const bluemap = {
    mapEventSource: { close() { eventSourceClosed = true; } },
    playerMarkerManager: { dispose() { playerManagerDisposed = true; } },
    markerFileManager: { dispose() { markerManagerDisposed = true; } },
    updateLoop: 99,
    settings: { hiresSliderDefault: 250 },
    mapViewer: {
      data: { loadedHiresViewDistance: 250 },
      updateLoadedMapArea() { loadedAreaUpdates += 1; },
      renderer: {
        setAnimationLoop() {},
        dispose() { rendererDisposed = true; },
        forceContextLoss() { rendererContextLost = true; },
      },
    },
    async loadPageAddress() {
      loadedHashes.push(location.hash);
      return true;
    },
    resetCamera() {
      location.hash = "#world:0:64:0:100:0:1:0:0:perspective";
    },
    updatePageAddress() {},
  };

  const canvas = {
    getContext(kind) {
      if (kind !== "webgl2") return null;
      return {
        getExtension(name) {
          if (name !== "WEBGL_lose_context") return null;
          return { loseContext() { canvasContextLost = true; } };
        },
      };
    },
  };
  const document = {
    currentScript: null,
    querySelectorAll(selector) {
      return selector === "canvas" ? [canvas] : [];
    },
  };
  const window = {
    parent,
    location,
    history,
    bluemap,
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) ?? [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    setInterval() { return nextInterval++; },
    clearInterval(id) { clearedIntervals.push(id); },
    clearTimeout() {},
  };
  const context = vm.createContext({
    window,
    document,
    console: { info() {}, warn() {} },
    URL,
    Number,
    Error,
    Promise,
  });

  new vm.Script(source, { filename: "bluemap-archive.js" }).runInContext(context);
  await flushAsyncWork();

  assert.equal(eventSourceClosed, true);
  assert.equal(playerManagerDisposed, true);
  assert.equal(markerManagerDisposed, true);
  assert.equal(bluemap.updateLoop, null);
  assert.ok(posted.some(({ message }) => message.type === "sgp-map-ready"));

  const dispatchMessage = (data) => {
    for (const callback of listeners.get("message") ?? []) {
      callback({ origin: location.origin, source: parent, data });
    }
  };

  dispatchMessage({ type: "sgp-map-hires", distance: 125 });
  assert.equal(bluemap.settings.hiresSliderDefault, 125);
  assert.equal(bluemap.mapViewer.data.loadedHiresViewDistance, 125);
  assert.equal(loadedAreaUpdates, 1);

  dispatchMessage({ type: "sgp-map-active", active: true });
  dispatchMessage({ type: "sgp-map-set-camera", hash: "#world:10:70:20:200:1:2:0:0:perspective" });
  await flushAsyncWork();
  assert.equal(location.hash, "#world:10:70:20:200:1:2:0:0:perspective");
  assert.deepEqual(loadedHashes, ["#world:10:70:20:200:1:2:0:0:perspective"]);
  assert.ok(posted.some(({ message }) => message.type === "sgp-map-camera" && message.hash === location.hash));

  dispatchMessage({ type: "sgp-map-reset" });
  await flushAsyncWork();
  assert.equal(location.hash, "#world:0:64:0:100:0:1:0:0:perspective");
  assert.ok(posted.some(({ message }) => message.type === "sgp-map-reset-complete" && message.hash === location.hash));

  dispatchMessage({ type: "sgp-map-active", active: false });
  assert.deepEqual(clearedIntervals, [1]);
  assert.ok(posted.every(({ origin }) => origin === location.origin));

  assert.equal(typeof window.sgpArchiveDispose, "function");
  assert.equal(window.sgpArchiveDispose(), true);
  assert.equal(rendererDisposed, true);
  assert.equal(rendererContextLost, true);
  assert.equal(canvasContextLost, true);
  assert.equal(window.sgpArchiveDispose(), true, "teardown is idempotent");
});
