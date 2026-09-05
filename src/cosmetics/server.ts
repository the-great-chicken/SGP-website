import "server-only";
import { db } from "@/db/client";
import { createCosmeticBridge } from "./bridge";
import { createCosmeticService } from "./service";
import { readCosmeticCache, saveCosmeticSnapshot } from "./store";

export const cosmeticService = createCosmeticService(createCosmeticBridge({
  url: process.env.COSMETICS_BRIDGE_URL,
  secret: process.env.COSMETICS_BRIDGE_SECRET,
}), {
  read: (uuid) => readCosmeticCache(db, uuid),
  save: (snapshot) => saveCosmeticSnapshot(db, snapshot),
});
