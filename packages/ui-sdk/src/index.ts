import * as contracts from "@ai-western-town/contracts";

import type {
  CreateLocalSessionRequest,
  CreateLocalSessionResponse,
  LocalHostStreamEvent,
  SubmitLocalCommandRequest,
  SubmitLocalCommandResponse
} from "@ai-western-town/contracts";

export type EventSourceMessage = {
  data: string;
};

export type EventSourceLike = {
  addEventListener(
    type: string,
    listener: (event: EventSourceMessage) => void
  ): void;
  close(): void;
};

export type LocalHostClientOptions = {
  baseUrl: string;
  fetchFn?: typeof fetch;
  eventSourceFactory?: (url: string) => EventSourceLike;
};

export type LocalHostClient = ReturnType<typeof createLocalHostClient>;
export {
  createLocalSessionRuntime
} from "./local-session-runtime.js";
export type {
  LocalSessionRuntimeClient,
  LocalSessionRuntimeConnectionState,
  LocalSessionRuntimeOptions,
  LocalSessionRuntimeState
} from "./local-session-runtime.js";

export function createLocalHostClient(options: LocalHostClientOptions) {
  const fetchFn = options.fetchFn ?? fetch;

  return {
    async createSession(
      input: CreateLocalSessionRequest = {}
    ): Promise<CreateLocalSessionResponse> {
      const response = await fetchFn(joinUrl(options.baseUrl, "/sessions"), {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(input)
      });
      await assertOk(response);

      return contracts.createLocalSessionResponseSchema.parse(await response.json());
    },

    async submitCommand(
      sessionId: string,
      input: SubmitLocalCommandRequest
    ): Promise<SubmitLocalCommandResponse> {
      const response = await fetchFn(
        joinUrl(options.baseUrl, `/sessions/${sessionId}/commands`),
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(input)
        }
      );
      await assertOk(response);

      return contracts.submitLocalCommandResponseSchema.parse(await response.json());
    },

    subscribeToSessionEvents(
      sessionId: string,
      handlers: {
        onEvent: (event: LocalHostStreamEvent) => void;
        onError?: (error: unknown) => void;
      }
    ): () => void {
      const eventSourceFactory =
        options.eventSourceFactory ??
        ((url: string) =>
          new EventSource(url) as unknown as EventSourceLike);
      const stream = eventSourceFactory(
        joinUrl(options.baseUrl, `/sessions/${sessionId}/events`)
      );

      const handleMessage = (event: EventSourceMessage) => {
        try {
          handlers.onEvent(
            contracts.localHostStreamEventSchema.parse(JSON.parse(event.data))
          );
        } catch (error) {
          handlers.onError?.(error);
        }
      };

      stream.addEventListener("session.snapshot", handleMessage);
      stream.addEventListener("command.accepted", handleMessage);
      stream.addEventListener("world.event", handleMessage);
      stream.addEventListener("tick.trace", handleMessage);

      return () => {
        stream.close();
      };
    }
  };
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

async function assertOk(response: Response): Promise<void> {
  if (!response.ok) {
    throw new Error(
      `local-host request failed: ${response.status} ${await response.text()}`
    );
  }
}
