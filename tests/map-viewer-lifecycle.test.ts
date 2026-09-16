import assert from "node:assert/strict";
import test from "node:test";
import { disposeMapViewerFrame } from "../src/lib/map-viewer-lifecycle";

test("viewer teardown prefers the archive bridge and detaches the document", () => {
  let bridgeCalls = 0;
  let canvasQueries = 0;
  const frame = {
    src: "/map-archive/example/index.html",
    contentWindow: {
      sgpArchiveDispose() {
        bridgeCalls += 1;
        return true;
      },
    },
    contentDocument: {
      querySelectorAll() {
        canvasQueries += 1;
        return [];
      },
    },
  } as unknown as HTMLIFrameElement;

  disposeMapViewerFrame(frame);
  assert.equal(bridgeCalls, 1);
  assert.equal(canvasQueries, 0);
  assert.equal(frame.src, "about:blank");
});

test("viewer teardown loses WebGL contexts for older archive revisions", () => {
  let lost = 0;
  const canvas = {
    getContext(kind: string) {
      if (kind !== "webgl2") return null;
      return {
        getExtension(name: string) {
          if (name !== "WEBGL_lose_context") return null;
          return { loseContext() { lost += 1; } };
        },
      };
    },
  };
  const frame = {
    src: "/map-archive/old/index.html",
    contentWindow: {},
    contentDocument: {
      querySelectorAll(selector: string) {
        return selector === "canvas" ? [canvas] : [];
      },
    },
  } as unknown as HTMLIFrameElement;

  disposeMapViewerFrame(frame);
  assert.equal(lost, 1);
  assert.equal(frame.src, "about:blank");
});
