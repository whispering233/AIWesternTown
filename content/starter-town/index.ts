import items from "./items.json" with { type: "json" };
import npcs from "./npcs.json" with { type: "json" };
import scenes from "./scenes.json" with { type: "json" };

import { parseStarterContentBundle } from "@ai-western-town/content-schema";

export const starterTownContent = parseStarterContentBundle({
  packId: "starter-town",
  version: "0.1.0",
  scenes,
  npcs,
  items
});

export type StarterTownContent = typeof starterTownContent;
