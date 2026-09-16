import assert from "node:assert/strict";
import test from "node:test";
import { applySgpHiresViewDistance, SGP_HIRES_VIEW_DISTANCE } from "../src/lib/map-viewer-settings";

test("archive viewer normalizes hi-res distance to the live-map value", () => {
  let updates = 0;
  const bluemap = {
    settings: { hiresSliderDefault: 100 },
    mapViewer: {
      data: { loadedHiresViewDistance: 100 },
      updateLoadedMapArea() { updates += 1; },
    },
  };

  assert.equal(SGP_HIRES_VIEW_DISTANCE, 250);
  assert.equal(applySgpHiresViewDistance(bluemap), true);
  assert.equal(bluemap.settings.hiresSliderDefault, 250);
  assert.equal(bluemap.mapViewer.data.loadedHiresViewDistance, 250);
  assert.equal(updates, 1);
  assert.equal(applySgpHiresViewDistance(bluemap), true);
  assert.equal(updates, 1);
});

test("hi-res normalization is safe before BlueMap is ready", () => {
  assert.equal(applySgpHiresViewDistance(undefined), false);
  assert.equal(applySgpHiresViewDistance({ settings: null, mapViewer: null }), false);
});
