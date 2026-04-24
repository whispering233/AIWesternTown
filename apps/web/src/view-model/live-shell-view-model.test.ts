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

test("buildLiveShellViewModel exposes movement leads for the current scene", () => {
  const viewModel = buildLiveShellViewModel(createRuntimeState());

  assert.equal(viewModel.scene.locationLabel, "Rail House Hotel Lobby");
  assert.ok(viewModel.movement.items.some((item) => item.sceneId === "saloon"));
  assert.ok(viewModel.opportunities.items.some((item) => item.kind === "observe"));
});

test("buildLiveShellViewModel keeps accepted commands, world events, and traces in separate UI zones", () => {
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

  assert.ok(viewModel.feed.some((entry) => entry.label === "宿主已接收"));
  assert.ok(viewModel.feed.some((entry) => entry.label === "世界后果"));
  assert.ok(
    viewModel.debugPanel.cards.some((card) =>
      card.description.includes("trace-1")
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
