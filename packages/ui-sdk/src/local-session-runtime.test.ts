import assert from "node:assert/strict";
import test from "node:test";

import type {
  CreateLocalSessionResponse,
  LocalHostStreamEvent,
  PlayerCommandEnvelope,
  SubmitLocalCommandResponse
} from "@ai-western-town/contracts";

import { createLocalSessionRuntime } from "./local-session-runtime.js";

const baseSession: CreateLocalSessionResponse["session"] = {
  sessionId: "session-1",
  status: "active",
  createdAt: "2026-04-24T10:00:00+08:00",
  updatedAt: "2026-04-24T10:00:00+08:00",
  worldTick: 0
};

const observeCommand: PlayerCommandEnvelope = {
  commandId: "cmd-look-saloon",
  commandType: "observe",
  parsedAction: {
    actionType: "look",
    targetLocationId: "saloon",
    tags: ["observe"]
  },
  issuedAtTick: 0,
  consumesTick: true
};

test("initializes a session runtime and caches incoming stream events", async () => {
  let eventHandlers:
    | Parameters<
        Parameters<
          typeof createLocalSessionRuntime
        >[0]["client"]["subscribeToSessionEvents"]
      >[1]
    | undefined;
  let unsubscribed = false;

  const runtime = createLocalSessionRuntime({
    client: {
      async createSession() {
        return {
          session: baseSession
        };
      },
      async submitCommand() {
        throw new Error("submitCommand should not be called in this test");
      },
      subscribeToSessionEvents(_sessionId, handlers) {
        eventHandlers = handlers;

        return () => {
          unsubscribed = true;
        };
      }
    }
  });

  await runtime.initialize();

  assert.equal(runtime.getState().connectionState, "connecting");
  assert.equal(runtime.getState().session?.sessionId, "session-1");

  eventHandlers?.onEvent(
    createStreamEvent("session.snapshot", {
      session: {
        ...baseSession,
        updatedAt: "2026-04-24T10:00:01+08:00"
      }
    })
  );
  eventHandlers?.onEvent(
    createStreamEvent("world.event", {
      event: {
        eventId: "evt-1",
        eventType: "look_result",
        worldTick: 1,
        originSceneId: "saloon",
        actorIds: ["player"],
        targetIds: [],
        tags: ["observe"],
        heatLevel: "high",
        sourceCommandId: "cmd-look-saloon",
        summary: "The room goes quiet for a beat."
      }
    })
  );
  eventHandlers?.onEvent(
    createStreamEvent("tick.trace", {
      trace: {
        traceId: "trace-1",
        worldTick: 1,
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
          worldTick: 1,
          runModeBefore: "free_explore",
          runModeAfter: "settle",
          promotedNpcIds: [],
          suppressedNpcIds: [],
          interruptCandidates: [],
          budgetNotes: ["runtime test"]
        }
      }
    })
  );

  const state = runtime.getState();
  assert.equal(state.connectionState, "live");
  assert.equal(state.streamEvents.length, 3);
  assert.equal(state.lastWorldEvent?.eventId, "evt-1");
  assert.equal(state.lastTrace?.traceId, "trace-1");

  runtime.dispose();
  assert.equal(unsubscribed, true);
});

test("submitCommand forwards envelopes and tracks the last submitted command", async () => {
  const submittedCommands: PlayerCommandEnvelope[] = [];

  const runtime = createLocalSessionRuntime({
    client: {
      async createSession() {
        return {
          session: baseSession
        };
      },
      async submitCommand(
        sessionId: string,
        input: { playerCommand: PlayerCommandEnvelope }
      ): Promise<SubmitLocalCommandResponse> {
        submittedCommands.push(input.playerCommand);

        return {
          session: {
            ...baseSession,
            sessionId,
            worldTick: 1,
            updatedAt: "2026-04-24T10:00:02+08:00"
          },
          acceptedCommandId: input.playerCommand.commandId,
          emittedEventIds: ["evt-2", "trace-2"]
        };
      },
      subscribeToSessionEvents() {
        return () => undefined;
      }
    }
  });

  await runtime.initialize();

  const response = await runtime.submitCommand(observeCommand);
  const state = runtime.getState();

  assert.equal(response.acceptedCommandId, "cmd-look-saloon");
  assert.equal(submittedCommands.length, 1);
  assert.equal(submittedCommands[0]?.commandId, "cmd-look-saloon");
  assert.equal(state.lastSubmittedCommand?.commandId, "cmd-look-saloon");
  assert.equal(state.session?.worldTick, 1);
});

function createStreamEvent<TType extends LocalHostStreamEvent["type"]>(
  type: TType,
  extras: Omit<Extract<LocalHostStreamEvent, { type: TType }>, "type" | "eventId" | "sessionId" | "sequence" | "emittedAt">
): Extract<LocalHostStreamEvent, { type: TType }> {
  return {
    eventId: `stream-${type}`,
    sessionId: "session-1",
    sequence: 1,
    emittedAt: "2026-04-24T10:00:01+08:00",
    type,
    ...extras
  } as Extract<LocalHostStreamEvent, { type: TType }>;
}
