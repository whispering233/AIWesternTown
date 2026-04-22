# W02 Content Schema Starter Design

## Context

This spec documents the approved implementation direction for task card `W02-content-schema-starter`.

The repository already contains the shared `contracts` package from `W01`, but `packages/content-schema` is still an empty shell. `W02` is responsible for establishing the first minimal content schema layer plus a starter town content pack that can be validated and consumed directly by later session or save initialization work.

## Scope

- Add minimal content schemas for:
  - scenes
  - NPCs
  - items
- Add a top-level starter content bundle schema and validation entry point
- Add a starter town content pack under `content/starter-town`
- Organize starter content as type-specific source files plus one aggregate export
- Ensure the starter bundle validates successfully

## Out Of Scope

- Runtime world state DTOs
- Scene partition topology data
- Narrative line, secret, event, or ending content
- Full item template/container/knowledge system
- Database persistence or save/load implementation
- Editor UI

## Design

### Approach

Use a `bundle-first` shape with mixed storage:

- raw starter content is stored as type-specific data files
- one aggregate module assembles and validates the bundle
- downstream consumers import one stable object instead of scanning the filesystem

This keeps content authoring data-oriented while still giving later bootstrap code a direct, typed entry point.

### Package responsibilities

`packages/content-schema` owns:

- Zod schemas
- inferred TypeScript types
- bundle-level validation helpers

`content/starter-town` owns:

- raw starter content data split by type
- one aggregate module that exports the validated starter bundle

### Bundle shape

The first stable aggregate format is:

```ts
type StarterContentBundle = {
  packId: string;
  version: string;
  scenes: SceneContent[];
  npcs: NpcContent[];
  items: ItemContent[];
};
```

This is intentionally minimal. It is designed to be a direct input for future session or save initialization without prematurely importing runtime-only state or advanced narrative systems.

### Scene schema

`SceneContent` uses a stable coarse category plus extensible tags:

```ts
type SceneContent = {
  sceneId: string;
  displayName: string;
  summary: string;
  category: "interior" | "exterior" | "service" | "residence" | "civic";
  tags: string[];
  connections: {
    toSceneId: string;
    travelTime: "short" | "medium" | "long";
  }[];
};
```

Rationale:

- `category` remains stable enough for future consumers to branch on
- `tags` carries business-specific semantics such as `saloon`, `railway`, or `law_enforcement`
- this avoids locking the schema to a large business enum while also avoiding unbounded free-form `kind` values

### NPC schema

`NpcContent` captures only static starter information plus spawn location:

```ts
type NpcContent = {
  npcId: string;
  displayName: string;
  role: string;
  homeSceneId: string;
  startSceneId: string;
  publicPersona: string;
  coreDrives: string[];
  shortTermGoals: string[];
  tags: string[];
};
```

This excludes runtime memory, schedule, suspicion, and narrative-role data. Those belong to later cards and would create avoidable drift if guessed here.

### Item schema

`ItemContent` also uses coarse category plus tags, with minimal starter placement:

```ts
type ItemContent = {
  itemId: string;
  displayName: string;
  category: "document" | "access" | "tool" | "valuable" | "misc";
  tags: string[];
  startPlacement:
    | { holderType: "scene"; sceneId: string }
    | { holderType: "npc"; npcId: string };
};
```

Only `scene` and `npc` placements are supported in this first pass.

This is deliberate:

- it covers the minimum starter use cases needed by the task card
- it avoids prematurely implementing container, hidden stash, carry mode, and visibility semantics from the later item-system work

## Validation

Validation is split into two layers.

### Structural validation

Each object is validated independently for field shape:

- required IDs and names are present
- category enums are valid
- arrays are arrays of strings or objects as expected
- placement and connection unions resolve correctly

### Bundle validation

The starter bundle is then validated as a graph:

- scene IDs are unique
- NPC IDs are unique
- item IDs are unique
- every scene connection points to an existing scene
- every NPC `homeSceneId` and `startSceneId` points to an existing scene
- every item placement references an existing scene or NPC

### Minimum usable starter rules

To align validation with later bootstrap consumption, the bundle must also satisfy:

- at least one scene
- at least one NPC
- at least one item
- at least one scene connection
- every NPC has a valid start location
- every item has a valid initial placement

These checks ensure the bundle is not only syntactically valid, but also minimally usable for future initialization flows.

## Starter Town Content

The starter town pack should remain intentionally small:

### Scenes

- `saloon`
- `sheriff_office`
- `hotel_lobby`
- `train_station`

### NPCs

- `bartender`
- `sheriff`
- `doctor`

### Items

- `town_ledger`
- `office_key`
- `medical_bag`

### Initial placement

- `town_ledger` starts on `sheriff`
- `office_key` starts in scene `saloon`
- `medical_bag` starts on `doctor`

This starter set is enough to validate the schema layer and prove that the bundle can represent:

- multiple connected scenes
- NPC spawn locations
- items placed both in a scene and on NPCs

## File layout

The approved storage layout is:

```text
packages/content-schema/src/...
content/starter-town/scenes.json
content/starter-town/npcs.json
content/starter-town/items.json
content/starter-town/index.ts
```

`index.ts` assembles:

```ts
export const starterTownContent = parseStarterContentBundle({
  packId: "starter-town",
  version: "0.1.0",
  scenes,
  npcs,
  items
});
```

This gives future bootstrap code one direct import target while preserving data-first source files for content authoring.

## Boundary notes

- Reuse shared scalar conventions from `packages/contracts` where appropriate, but do not force early extraction of content-specific DTOs into `contracts`
- If shared content fields later need to move into `contracts`, handle that in a separate task as stated by the task card merge notes
- Do not guess runtime DTO fields in `W02`
- Do not add filesystem discovery logic as the primary consumption path

## Validation plan

Implementation success for `W02` is defined by:

- `packages/content-schema` builds and typechecks
- the starter content bundle validates successfully
- the starter pack covers scenes, NPCs, and items
- downstream code can import one aggregate starter bundle directly
