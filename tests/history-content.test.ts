import assert from "node:assert/strict";
import test from "node:test";
import { historyEditions, publishedHistoryEditions } from "../src/content/history/editions";
import { historyCharacters } from "../src/content/history/characters";

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


test("history character registry keeps stable unique slugs and valid edition links", () => {
  assert.equal(historyCharacters.length, 4);
  assert.equal(new Set(historyCharacters.map((character) => character.slug)).size, historyCharacters.length);

  for (const character of historyCharacters) {
    assert.ok(character.appearances.some((number) => number === character.firstAppearance));
    assert.ok(character.appearances.every((number) => historyEditions.some((edition) => edition.number === number)));
  }
});
