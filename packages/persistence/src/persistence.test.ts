import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { openPersistenceStore } from "./index";

function withStore(run: (store: ReturnType<typeof openPersistenceStore>) => void) {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ai-western-town-persistence-"));
  const filename = join(tempDirectory, "save-store.sqlite");
  const store = openPersistenceStore({ filename });

  try {
    run(store);
  } finally {
    store.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

test("creates and reads back a save record", () => {
  withStore((store) => {
    const created = store.saves.create({
      saveId: "save-001",
      name: "Saloon opening",
      worldTick: 0,
      metadata: {
        seed: "starter-town"
      }
    });

    const loaded = store.saves.getById("save-001");

    assert.deepEqual(loaded, created);
  });
});

test("writes and reads back one tick of event logs", () => {
  withStore((store) => {
    store.saves.create({
      saveId: "save-events",
      name: "Event log test"
    });

    store.eventLogs.appendMany("save-events", [
      {
        eventId: "evt-1",
        eventType: "public_question",
        worldTick: 1,
        originSceneId: "saloon",
        actorIds: ["player", "npc-doctor"],
        targetIds: ["npc-doctor"],
        tags: ["social", "public"],
        heatLevel: "high",
        summary: "The player pressures the doctor in public.",
        payload: {
          pressure: 0.8
        },
        metadata: {
          commandId: "cmd-1"
        }
      },
      {
        eventId: "evt-2",
        eventType: "guard_reacts",
        worldTick: 1,
        originSceneId: "saloon",
        actorIds: ["npc-sheriff"],
        targetIds: [],
        tags: ["reaction"],
        heatLevel: "ordinary",
        summary: "The sheriff watches the exchange.",
        payload: {
          stance: "alert"
        },
        metadata: {}
      }
    ]);

    const loaded = store.eventLogs.listByTick("save-events", 1);

    assert.equal(loaded.length, 2);
    assert.deepEqual(
      loaded.map((event) => event.eventId),
      ["evt-1", "evt-2"]
    );
    assert.equal(loaded[0]?.payload.pressure, 0.8);
    assert.equal(loaded[1]?.summary, "The sheriff watches the exchange.");
  });
});

test("restores persisted session state", () => {
  withStore((store) => {
    store.saves.create({
      saveId: "save-session",
      name: "Session restore test"
    });

    store.sessionStates.upsert({
      saveId: "save-session",
      worldTick: 12,
      currentSceneId: "saloon",
      runMode: "focused_dialogue",
      foregroundNpcIds: ["npc-doctor", "npc-sheriff"],
      nearFieldQueue: [
        {
          npcId: "npc-innkeeper",
          heat: 0.7
        }
      ],
      farFieldBacklog: [
        {
          npcId: "npc-stablehand",
          queuedAtTick: 10
        }
      ],
      dialogueThread: {
        threadId: "thread-1",
        anchorNpcId: "npc-doctor",
        status: "active"
      },
      interruptState: {
        priority: 2
      },
      npcScheduleStates: [
        {
          npcId: "npc-doctor",
          sceneTier: "foreground"
        }
      ],
      activeLongActionsByNpc: {
        "npc-preacher": {
          actionKind: "sleep",
          status: "holding",
          enteredAtTick: 11
        }
      },
      eventWindow: {
        tickRange: {
          from: 11,
          to: 12
        },
        events: ["evt-1", "evt-2"]
      },
      playerActionLedger: [
        {
          commandId: "cmd-12",
          consumesTick: true
        }
      ]
    });

    const restored = store.sessionStates.getBySaveId("save-session");

    assert.ok(restored);
    if (!restored) {
      return;
    }

    assert.equal(restored.worldTick, 12);
    assert.equal(restored.currentSceneId, "saloon");
    assert.equal(restored.runMode, "focused_dialogue");
    assert.deepEqual(restored.foregroundNpcIds, ["npc-doctor", "npc-sheriff"]);
    assert.equal(restored.dialogueThread?.threadId, "thread-1");
    assert.equal(
      restored.activeLongActionsByNpc["npc-preacher"] &&
        typeof restored.activeLongActionsByNpc["npc-preacher"] === "object",
      true
    );
  });
});
