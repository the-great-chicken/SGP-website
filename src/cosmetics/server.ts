import "server-only";
import { db } from "@/db/client";
import { createCosmeticBridge } from "./bridge";
import { createCosmeticService } from "./service";
import { readCosmeticCache, saveCosmeticSnapshot } from "./store";
import { withCosmeticIcons } from "./icons";

const service = createCosmeticService(createCosmeticBridge({
  url: process.env.COSMETICS_BRIDGE_URL,
  secret: process.env.COSMETICS_BRIDGE_SECRET,
}), {
  read: (uuid) => readCosmeticCache(db, uuid),
  save: (snapshot) => saveCosmeticSnapshot(db, snapshot),
});

export const cosmeticService: typeof service = {
  async read(session) { return withCosmeticIcons(await service.read(session)); },
  async change(session, input) {
    const result = await service.change(session, input);
    return { ...result, view: await withCosmeticIcons(result.view) };
  },
};
