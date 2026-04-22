import items from "./items.json";
import npcs from "./npcs.json";
import scenes from "./scenes.json";

import {
  parseStarterContentBundle,
  type ItemContent,
  type NpcContent,
  type SceneContent
} from "../../packages/content-schema/src";

export const starterTownContent = parseStarterContentBundle({
  packId: "starter-town",
  version: "0.1.0",
  scenes: scenes as SceneContent[],
  npcs: npcs as NpcContent[],
  items: items as ItemContent[]
});

export type StarterTownContent = typeof starterTownContent;
