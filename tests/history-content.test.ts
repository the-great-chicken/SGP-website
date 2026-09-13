import assert from "node:assert/strict";
import test from "node:test";
import { historyEditions, publishedHistoryEditions } from "../src/content/history/editions";

test("history edition registry stays chronological and map-addressable", () => {
  assert.deepEqual(historyEditions.map((edition) => edition.number), [1, 2, 3, 4]);
  assert.deepEqual(historyEditions.map((edition) => edition.dateIso), [
    "2023-06-03",
    "2023-08-27",
    "2024-04-06",
    "2024-08-31",
  ]);

  const snapshotKeys = historyEditions.map((edition) => edition.map.snapshotKey);
  assert.equal(new Set(snapshotKeys).size, snapshotKeys.length);
  assert.ok(snapshotKeys.every(Boolean));
});

test("only editions with public articles are exposed as published", () => {
  assert.deepEqual(publishedHistoryEditions().map((edition) => edition.number), [1, 2, 3, 4]);
});
