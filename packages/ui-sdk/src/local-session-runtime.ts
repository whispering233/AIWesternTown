import type {
  CreateLocalSessionRequest,
  CreateLocalSessionResponse,
  LocalHostStreamEvent,
  LocalSession,
  PlayerCommandEnvelope,
  SubmitLocalCommandResponse,
  TickTraceRecord,
  WorldEventRecord
} from "@ai-western-town/contracts";

import type { LocalHostClient } from "./index.js";

export type LocalSessionRuntimeConnectionState =
  | "idle"
  | "connecting"
  | "live";

export type LocalSessionRuntimeState = {
  connectionState: LocalSessionRuntimeConnectionState;
  initialized: boolean;
  session?: LocalSession;
  streamEvents: LocalHostStreamEvent[];
  lastSubmittedCommand?: PlayerCommandEnvelope;
  lastWorldEvent?: WorldEventRecord;
  lastTrace?: TickTraceRecord;
  lastError?: unknown;
};

export type LocalSessionRuntimeClient = Pick<
  LocalHostClient,
  "createSession" | "submitCommand" | "subscribeToSessionEvents"
>;

export type LocalSessionRuntimeOptions = {
  client: LocalSessionRuntimeClient;
  sessionInput?: CreateLocalSessionRequest;
  maxCachedEvents?: number;
};

type RuntimeListener = (state: LocalSessionRuntimeState) => void;

const DEFAULT_MAX_CACHED_EVENTS = 25;

export function createLocalSessionRuntime(options: LocalSessionRuntimeOptions) {
  let unsubscribeFromStream: (() => void) | undefined;
  const listeners = new Set<RuntimeListener>();
  let state: LocalSessionRuntimeState = {
    connectionState: "idle",
    initialized: false,
    streamEvents: []
  };

  function emit(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  function setState(
    nextState:
      | LocalSessionRuntimeState
      | ((currentState: LocalSessionRuntimeState) => LocalSessionRuntimeState)
  ): void {
    state =
      typeof nextState === "function"
        ? nextState(state)
        : nextState;
    emit();
  }

  function applyStreamEvent(event: LocalHostStreamEvent): void {
    setState((currentState) => ({
      ...currentState,
      connectionState: "live",
      streamEvents: [...currentState.streamEvents, event].slice(
        -1 * (options.maxCachedEvents ?? DEFAULT_MAX_CACHED_EVENTS)
      ),
      session:
        event.type === "session.snapshot" || event.type === "command.accepted"
          ? event.session
          : currentState.session,
      lastWorldEvent:
        event.type === "world.event" ? event.event : currentState.lastWorldEvent,
      lastTrace:
        event.type === "tick.trace" ? event.trace : currentState.lastTrace
    }));
  }

  return {
    getState(): LocalSessionRuntimeState {
      return state;
    },

    subscribe(listener: RuntimeListener): () => void {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    async initialize(): Promise<CreateLocalSessionResponse["session"]> {
      if (state.initialized && state.session) {
        return state.session;
      }

      setState((currentState) => ({
        ...currentState,
        connectionState: "connecting",
        initialized: true,
        lastError: undefined
      }));

      const response = await options.client.createSession(options.sessionInput ?? {});

      setState((currentState) => ({
        ...currentState,
        session: response.session
      }));

      unsubscribeFromStream?.();
      unsubscribeFromStream = options.client.subscribeToSessionEvents(
        response.session.sessionId,
        {
          onEvent: (event) => {
            applyStreamEvent(event);
          },
          onError: (error) => {
            setState((currentState) => ({
              ...currentState,
              connectionState: "connecting",
              lastError: error
            }));
          }
        }
      );

      return response.session;
    },

    async submitCommand(
      playerCommand: PlayerCommandEnvelope
    ): Promise<SubmitLocalCommandResponse> {
      if (!state.session) {
        throw new Error("Local session runtime has not been initialized.");
      }

      setState((currentState) => ({
        ...currentState,
        lastSubmittedCommand: playerCommand
      }));

      const response = await options.client.submitCommand(state.session.sessionId, {
        playerCommand
      });

      setState((currentState) => ({
        ...currentState,
        session: response.session
      }));

      return response;
    },

    dispose(): void {
      unsubscribeFromStream?.();
      unsubscribeFromStream = undefined;
    }
  };
}
