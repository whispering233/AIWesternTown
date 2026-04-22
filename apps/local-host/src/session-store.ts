import { randomUUID } from "node:crypto";

import type {
  CommandAcceptedStreamEvent,
  LocalHostStreamEvent,
  LocalSession,
  SessionSnapshotStreamEvent,
  SubmitLocalCommandResponse,
  TickTraceStreamEvent,
  WorldEventStreamEvent
} from "@ai-western-town/contracts";
import type {
  CreateLocalSessionRequest,
  PlayerCommandEnvelope,
  TickTraceRecord,
  WorldEventRecord
} from "@ai-western-town/contracts";

type Clock = () => Date;
type StreamSubscriber = (event: LocalHostStreamEvent) => void;

type SessionState = {
  session: LocalSession;
  nextSequence: number;
  subscribers: Set<StreamSubscriber>;
};

export class SessionNotFoundError extends Error {
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Unknown local session: ${sessionId}`);
    this.name = "SessionNotFoundError";
    this.sessionId = sessionId;
  }
}

export class InMemoryLocalSessionStore {
  private readonly sessions = new Map<string, SessionState>();
  private readonly clock: Clock;

  constructor(options?: { clock?: Clock }) {
    this.clock = options?.clock ?? (() => new Date());
  }

  createSession(input: CreateLocalSessionRequest = {}): LocalSession {
    const now = this.clock().toISOString();
    const session: LocalSession = {
      sessionId: `session-${randomUUID()}`,
      status: "active",
      createdAt: now,
      updatedAt: now,
      worldTick: 0,
      metadata: input.metadata
    };

    this.sessions.set(session.sessionId, {
      session,
      nextSequence: 1,
      subscribers: new Set()
    });

    return session;
  }

  getSession(sessionId: string): LocalSession {
    return this.getSessionState(sessionId).session;
  }

  subscribe(
    sessionId: string,
    subscriber: StreamSubscriber
  ): { snapshotEvent: SessionSnapshotStreamEvent; unsubscribe: () => void } {
    const state = this.getSessionState(sessionId);

    state.subscribers.add(subscriber);

    return {
      snapshotEvent: this.buildSessionSnapshotEvent(state),
      unsubscribe: () => {
        state.subscribers.delete(subscriber);
      }
    };
  }

  submitCommand(
    sessionId: string,
    playerCommand: PlayerCommandEnvelope
  ): SubmitLocalCommandResponse {
    const state = this.getSessionState(sessionId);
    const nextTick = playerCommand.consumesTick
      ? state.session.worldTick + 1
      : state.session.worldTick;
    const now = this.clock().toISOString();

    state.session = {
      ...state.session,
      updatedAt: now,
      worldTick: nextTick
    };

    const commandAcceptedEvent = this.buildCommandAcceptedEvent(
      state,
      playerCommand
    );

    const worldEventRecord = this.buildFakeWorldEvent(
      state.session,
      playerCommand,
      now
    );
    const worldEvent = this.buildWorldEventStreamEvent(state, worldEventRecord);

    const tickTrace = this.buildFakeTickTrace(
      state.session,
      playerCommand,
      worldEventRecord
    );
    const traceEvent = this.buildTickTraceStreamEvent(state, tickTrace);

    this.publish(state, commandAcceptedEvent);
    this.publish(state, worldEvent);
    this.publish(state, traceEvent);

    return {
      session: state.session,
      acceptedCommandId: playerCommand.commandId,
      emittedEventIds: [
        commandAcceptedEvent.eventId,
        worldEvent.eventId,
        traceEvent.eventId
      ]
    };
  }

  private getSessionState(sessionId: string): SessionState {
    const state = this.sessions.get(sessionId);

    if (!state) {
      throw new SessionNotFoundError(sessionId);
    }

    return state;
  }

  private nextStreamMetadata(state: SessionState): {
    eventId: string;
    sessionId: string;
    sequence: number;
    emittedAt: string;
  } {
    return {
      eventId: `stream-${randomUUID()}`,
      sessionId: state.session.sessionId,
      sequence: state.nextSequence++,
      emittedAt: this.clock().toISOString()
    };
  }

  private buildSessionSnapshotEvent(
    state: SessionState
  ): SessionSnapshotStreamEvent {
    return {
      ...this.nextStreamMetadata(state),
      type: "session.snapshot",
      session: state.session
    };
  }

  private buildCommandAcceptedEvent(
    state: SessionState,
    playerCommand: PlayerCommandEnvelope
  ): CommandAcceptedStreamEvent {
    return {
      ...this.nextStreamMetadata(state),
      type: "command.accepted",
      playerCommand,
      session: state.session
    };
  }

  private buildWorldEventStreamEvent(
    state: SessionState,
    event: WorldEventRecord
  ): WorldEventStreamEvent {
    return {
      ...this.nextStreamMetadata(state),
      type: "world.event",
      event
    };
  }

  private buildTickTraceStreamEvent(
    state: SessionState,
    trace: TickTraceRecord
  ): TickTraceStreamEvent {
    return {
      ...this.nextStreamMetadata(state),
      type: "tick.trace",
      trace
    };
  }

  private publish(state: SessionState, event: LocalHostStreamEvent): void {
    for (const subscriber of state.subscribers) {
      subscriber(event);
    }
  }

  private buildFakeWorldEvent(
    session: LocalSession,
    playerCommand: PlayerCommandEnvelope,
    emittedAt: string
  ): WorldEventRecord {
    return {
      eventId: `evt-${randomUUID()}`,
      eventType: playerCommand.parsedAction.actionType ?? "player_command",
      worldTick: session.worldTick,
      originSceneId:
        playerCommand.parsedAction.targetLocationId ?? "starter-town.saloon",
      actorIds: ["player"],
      targetIds: playerCommand.parsedAction.targetActorId
        ? [playerCommand.parsedAction.targetActorId]
        : [],
      tags: playerCommand.parsedAction.tags ?? ["host-shell", "mock"],
      heatLevel: playerCommand.consumesTick ? "high" : "ordinary",
      sourceCommandId: playerCommand.commandId,
      summary: `Accepted ${playerCommand.commandType} command in local host shell.`,
      payload: {
        emittedAt,
        consumesTick: playerCommand.consumesTick
      }
    };
  }

  private buildFakeTickTrace(
    session: LocalSession,
    playerCommand: PlayerCommandEnvelope,
    worldEvent: WorldEventRecord
  ): TickTraceRecord {
    return {
      traceId: `trace-${randomUUID()}`,
      worldTick: session.worldTick,
      playerCommand,
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
      appendedEventIds: [worldEvent.eventId],
      debugSummary: {
        worldTick: session.worldTick,
        runModeBefore: "free_explore",
        runModeAfter: "settle",
        promotedNpcIds: [],
        suppressedNpcIds: [],
        interruptCandidates: [],
        budgetNotes: [
          "local-host-shell generated a fake event stream",
          "scheduler integration pending"
        ]
      }
    };
  }
}
