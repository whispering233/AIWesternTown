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
import {
  createStarterTownSessionRuntime,
  type StarterTownSessionRuntime,
  type StarterTownSessionState
} from "@ai-western-town/app-services";

type Clock = () => Date;
type StreamSubscriber = (event: LocalHostStreamEvent) => void;

type SessionState = {
  session: LocalSession;
  appState: StarterTownSessionState;
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
  private readonly sessionRuntime: StarterTownSessionRuntime;

  constructor(options?: {
    clock?: Clock;
    sessionRuntime?: StarterTownSessionRuntime;
  }) {
    this.clock = options?.clock ?? (() => new Date());
    this.sessionRuntime =
      options?.sessionRuntime ?? createStarterTownSessionRuntime();
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
      appState: this.sessionRuntime.createInitialState({
        currentSceneId: getInitialSceneId(input)
      }),
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
  ): Promise<SubmitLocalCommandResponse> {
    return this.submitCommandAsync(sessionId, playerCommand);
  }

  private async submitCommandAsync(
    sessionId: string,
    playerCommand: PlayerCommandEnvelope
  ): Promise<SubmitLocalCommandResponse> {
    const state = this.getSessionState(sessionId);
    const commandResult = await this.sessionRuntime.submitCommand(
      state.appState,
      playerCommand
    );
    const now = this.clock().toISOString();

    state.appState = commandResult.nextState;
    state.session = {
      ...state.session,
      updatedAt: now,
      worldTick: commandResult.nextState.worldTick
    };

    const commandAcceptedEvent = this.buildCommandAcceptedEvent(
      state,
      playerCommand
    );
    const worldEvents = commandResult.worldEvents.map((event) =>
      this.buildWorldEventStreamEvent(state, event)
    );
    const traceEvent = this.buildTickTraceStreamEvent(
      state,
      commandResult.tickTrace
    );

    this.publish(state, commandAcceptedEvent);
    for (const worldEvent of worldEvents) {
      this.publish(state, worldEvent);
    }
    this.publish(state, traceEvent);

    return {
      session: state.session,
      acceptedCommandId: playerCommand.commandId,
      emittedEventIds: [
        commandAcceptedEvent.eventId,
        ...worldEvents.map((event) => event.eventId),
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
}

function getInitialSceneId(
  input: CreateLocalSessionRequest
): string | undefined {
  const currentSceneId = input.metadata?.currentSceneId;

  return typeof currentSceneId === "string" ? currentSceneId : undefined;
}
