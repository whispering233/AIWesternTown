import assert from "node:assert/strict";
import test from "node:test";

import type {
  LocalHostStreamEvent,
  PlayerCommandEnvelope
} from "@ai-western-town/contracts";
import type { LocalSessionRuntimeState } from "@ai-western-town/ui-sdk";

import { buildLiveShellViewModel } from "./live-shell-view-model";

const observeCommand: PlayerCommandEnvelope = {
  commandId: "cmd-1",
  commandType: "observe",
  parsedAction: {
    actionType: "observe-doctor",
    targetActorId: "doctor",
    targetLocationId: "hotel_lobby",
    tags: ["observe"]
  },
  issuedAtTick: 1,
  consumesTick: true,
  metadata: {
    commandText: "观察医生的反应"
  }
};

const oldObserveCommand: PlayerCommandEnvelope = {
  ...observeCommand,
  commandId: "cmd-old",
  metadata: {
    commandText: "翻看旧卷宗"
  }
};

const saloonCommand: PlayerCommandEnvelope = {
  commandId: "cmd-saloon-approach",
  commandType: "social",
  parsedAction: {
    actionClass: "intervene",
    actionType: "approach",
    targetLocationId: "saloon",
    targetSceneId: "saloon",
    tags: ["approach"]
  },
  issuedAtTick: 1,
  consumesTick: true,
  metadata: {
    commandText: "走近酒保，看看她刚才在留意谁"
  }
};

test("buildLiveShellViewModel exposes current scene choices and map routes", () => {
  const viewModel = buildLiveShellViewModel(createRuntimeState());

  assert.equal(viewModel.scene.locationLabel, "Rail House Hotel Lobby");
  assert.ok(
    viewModel.mapPanel.routes.some((item) => item.sceneId === "saloon")
  );
  assert.ok(viewModel.opportunities.items.some((item) => item.kind === "observe"));
});

test("buildLiveShellViewModel exposes map panel routes for the right rail", () => {
  const viewModel = buildLiveShellViewModel(createRuntimeState());
  const mapPanel = (viewModel as {
    mapPanel?: {
      title: string;
      focusLabel: string;
      currentLocationId: string;
      routes: Array<{
        sceneId: string;
        label: string;
        state: string;
        commandText: string;
      }>;
    };
  }).mapPanel;

  assert.ok(mapPanel);
  assert.equal(mapPanel.title, "地图");
  assert.equal(mapPanel.focusLabel, "Rail House Hotel Lobby");
  assert.equal(mapPanel.currentLocationId, "hotel_lobby");
  assert.ok(mapPanel.routes.some((route) => route.sceneId === "saloon"));
  assert.ok(
    mapPanel.routes.every((route) => route.commandText.startsWith("前往 "))
  );
});

test("buildLiveShellViewModel does not expose legacy shell UI fields", () => {
  const viewModel = buildLiveShellViewModel(createRuntimeState()) as Record<
    string,
    unknown
  >;

  assert.equal(Object.hasOwn(viewModel, "movement"), false);
  assert.equal(Object.hasOwn(viewModel, "suggestions"), false);
  assert.equal(Object.hasOwn(viewModel, "debugPanel"), false);
});

test("buildLiveShellViewModel keeps accepted commands and world events in narrative and log zones", () => {
  const viewModel = buildLiveShellViewModel(
    createRuntimeState({
      streamEvents: [
        createEvent("command.accepted", {
          playerCommand: observeCommand,
          session: {
            sessionId: "session-1",
            status: "active",
            createdAt: "2026-04-24T10:00:00+08:00",
            updatedAt: "2026-04-24T10:00:01+08:00",
            worldTick: 2
          }
        }),
        createEvent("world.event", {
          event: {
            eventId: "evt-1",
            eventType: "observe_result",
            worldTick: 2,
            originSceneId: "hotel_lobby",
            actorIds: ["player"],
            targetIds: ["doctor"],
            tags: ["observe"],
            heatLevel: "high",
            sourceCommandId: "cmd-1",
            summary: "Eliza Wynn glances toward the staircase before looking away."
          }
        }),
        createEvent("tick.trace", {
          trace: {
            traceId: "trace-1",
            worldTick: 2,
            playerCommand: observeCommand,
            runModeBefore: "free_explore",
            runModeAfter: "settle",
            scheduleDecisions: {
              foregroundFullNpcIds: [],
              foregroundReactiveNpcIds: [],
              nearFieldLightNpcIds: [],
              nearFieldEscalatedNpcIds: [],
              deferredFarFieldNpcIds: []
            },
            npcExecutions: [],
            appendedEventIds: ["evt-1"],
            debugSummary: {
              worldTick: 2,
              runModeBefore: "free_explore",
              runModeAfter: "settle",
              promotedNpcIds: [],
              suppressedNpcIds: [],
              interruptCandidates: [],
              budgetNotes: ["web vm test"]
            }
          }
        })
      ],
      lastSubmittedCommand: observeCommand
    })
  );

  assert.equal(viewModel.scene.runModeLabel, "settle");
  assert.ok(viewModel.feed.some((entry) => entry.label === "宿主已接收"));
  assert.ok(viewModel.feed.some((entry) => entry.label === "世界后果"));
  assert.ok(
    viewModel.leftPanel.logEntries.some((entry) =>
      entry.body.includes("Eliza Wynn glances")
    )
  );
});

test("buildLiveShellViewModel keeps the main feed scoped to the latest submitted command", () => {
  const viewModel = buildLiveShellViewModel(
    createRuntimeState({
      streamEvents: [
        createEvent("command.accepted", {
          playerCommand: oldObserveCommand,
          session: {
            sessionId: "session-1",
            status: "active",
            createdAt: "2026-04-24T10:00:00+08:00",
            updatedAt: "2026-04-24T10:00:01+08:00",
            worldTick: 1
          }
        }),
        createEvent("world.event", {
          event: {
            eventId: "evt-old",
            eventType: "observe_result",
            worldTick: 1,
            originSceneId: "hotel_lobby",
            actorIds: ["player"],
            targetIds: ["doctor"],
            tags: ["observe"],
            heatLevel: "ordinary",
            sourceCommandId: "cmd-old",
            summary: "旧反馈不应该继续占据主交互栏。"
          }
        }),
        createEvent("command.accepted", {
          playerCommand: observeCommand,
          session: {
            sessionId: "session-1",
            status: "active",
            createdAt: "2026-04-24T10:00:00+08:00",
            updatedAt: "2026-04-24T10:00:02+08:00",
            worldTick: 2
          }
        }),
        createEvent("world.event", {
          event: {
            eventId: "evt-current",
            eventType: "observe_result",
            worldTick: 2,
            originSceneId: "hotel_lobby",
            actorIds: ["player"],
            targetIds: ["doctor"],
            tags: ["observe"],
            heatLevel: "high",
            sourceCommandId: "cmd-1",
            summary: "最新反馈应该留在主交互栏。"
          }
        })
      ],
      lastSubmittedCommand: observeCommand
    })
  );

  assert.equal(viewModel.feed.length, 3);
  assert.deepEqual(
    viewModel.feed.map((entry) => entry.label),
    ["你", "宿主已接收", "世界后果"]
  );
  assert.ok(
    viewModel.feed.some((entry) => entry.body.includes("最新反馈应该留在主交互栏"))
  );
  assert.ok(
    viewModel.feed.every((entry) => !entry.body.includes("旧反馈不应该继续占据主交互栏"))
  );
});

test("buildLiveShellViewModel keeps opportunities scoped to the player scene", () => {
  const viewModel = buildLiveShellViewModel(
    createRuntimeState({
      streamEvents: [
        createEvent("command.accepted", {
          playerCommand: saloonCommand,
          session: {
            sessionId: "session-1",
            status: "active",
            createdAt: "2026-04-24T10:00:00+08:00",
            updatedAt: "2026-04-24T10:00:02+08:00",
            worldTick: 2
          }
        }),
        createEvent("world.event", {
          event: {
            eventId: "evt-current-scene",
            eventType: "npc_observe",
            worldTick: 2,
            originSceneId: "saloon",
            actorIds: ["bartender"],
            targetIds: [],
            tags: ["observe"],
            heatLevel: "ordinary",
            sourceCommandId: "cmd-saloon-approach",
            summary: "Mara watches the room."
          }
        }),
        createEvent("world.event", {
          event: {
            eventId: "evt-near-field",
            eventType: "npc_observe",
            worldTick: 2,
            originSceneId: "hotel_lobby",
            actorIds: ["doctor"],
            targetIds: [],
            tags: ["observe"],
            heatLevel: "ordinary",
            sourceCommandId: "cmd-saloon-approach",
            summary: "Eliza watches the room from the hotel lobby."
          }
        })
      ],
      lastSubmittedCommand: saloonCommand
    })
  );

  assert.equal(viewModel.scene.sceneId, "saloon");
  assert.ok(
    viewModel.opportunities.items.some((opportunity) =>
      opportunity.title.includes("Mara Holt")
    )
  );
  assert.ok(
    viewModel.opportunities.items.every((opportunity) =>
      !opportunity.title.includes("Eliza Wynn")
    )
  );
});

function createRuntimeState(
  overrides: Partial<LocalSessionRuntimeState> = {}
): LocalSessionRuntimeState {
  return {
    connectionState: "live",
    initialized: true,
    session: {
      sessionId: "session-1",
      status: "active",
      createdAt: "2026-04-24T10:00:00+08:00",
      updatedAt: "2026-04-24T10:00:00+08:00",
      worldTick: 1
    },
    streamEvents: [],
    ...overrides
  };
}

function createEvent<TType extends LocalHostStreamEvent["type"]>(
  type: TType,
  extras: Omit<Extract<LocalHostStreamEvent, { type: TType }>, "type" | "eventId" | "sessionId" | "sequence" | "emittedAt">
): Extract<LocalHostStreamEvent, { type: TType }> {
  return {
    eventId: `stream-${type}`,
    sessionId: "session-1",
    sequence: 1,
    emittedAt: "2026-04-24T10:00:02+08:00",
    type,
    ...extras
  } as Extract<LocalHostStreamEvent, { type: TType }>;
}
