import type { ProviderRequest, ProviderResponse } from "@ai-western-town/contracts";

import type {
  LLMCallFixture,
  LLMFixtureReplayCapability,
  LLMFixtureReplayHealthResult,
  LLMFixtureReplayProvider,
  LLMFixtureReplayProviderOptions
} from "./types.js";

const DEFAULT_REPLAY_PROVIDER_NAME = "fixture-replay";

export function createLLMFixtureReplayProvider(
  fixtures: LLMCallFixture[],
  options: LLMFixtureReplayProviderOptions = {}
): LLMFixtureReplayProvider {
  return new DefaultLLMFixtureReplayProvider(fixtures, options);
}

class DefaultLLMFixtureReplayProvider implements LLMFixtureReplayProvider {
  readonly #fixtures: LLMCallFixture[];
  readonly #name: string;

  public constructor(
    fixtures: LLMCallFixture[],
    options: LLMFixtureReplayProviderOptions
  ) {
    this.#fixtures = fixtures.map((fixture) => cloneJson(fixture));
    this.#name = options.name ?? DEFAULT_REPLAY_PROVIDER_NAME;
  }

  public getName(): string {
    return this.#name;
  }

  public getCapabilities(): LLMFixtureReplayCapability {
    return {
      supportsJsonObject: this.#fixtures.some(
        (fixture) => fixture.request.responseFormat === "json_object"
      ),
      supportsSystemRole: this.#fixtures.some((fixture) =>
        fixture.request.messages.some((message) => message.role === "system")
      ),
      supportsAssistantRole: this.#fixtures.some((fixture) =>
        fixture.request.messages.some((message) => message.role === "assistant")
      ),
      recommendedTimeoutMs: 1,
      supportsMockFallback: false
    };
  }

  public async invoke(request: ProviderRequest): Promise<ProviderResponse> {
    const fixture = this.#fixtures.find((candidate) =>
      requestsMatchForReplay(candidate.request, request)
    );

    if (!fixture) {
      return createReplayMissResponse(request, this.#name);
    }

    return {
      ...cloneJson(fixture.response),
      requestId: request.requestId
    };
  }

  public async healthCheck(): Promise<LLMFixtureReplayHealthResult> {
    if (this.#fixtures.length === 0) {
      return {
        providerName: this.#name,
        ok: false,
        errorCode: "fixture_replay_empty",
        errorMessage: "No LLM fixtures are loaded for replay."
      };
    }

    return {
      providerName: this.#name,
      ok: true
    };
  }
}

function requestsMatchForReplay(
  fixtureRequest: ProviderRequest,
  incomingRequest: ProviderRequest
): boolean {
  return (
    JSON.stringify(toReplayComparableRequest(fixtureRequest)) ===
    JSON.stringify(toReplayComparableRequest(incomingRequest))
  );
}

function toReplayComparableRequest(
  request: ProviderRequest
): Omit<ProviderRequest, "requestId"> {
  return {
    taskKind: request.taskKind,
    mode: request.mode,
    modelRef: request.modelRef,
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content
    })),
    responseFormat: request.responseFormat,
    maxInputTokens: request.maxInputTokens,
    maxOutputTokens: request.maxOutputTokens,
    temperature: request.temperature,
    topP: request.topP,
    timeoutMs: request.timeoutMs
  };
}

function createReplayMissResponse(
  request: ProviderRequest,
  providerName: string
): ProviderResponse {
  return {
    requestId: request.requestId,
    providerName,
    modelRef: request.modelRef,
    finishReason: "error",
    rawText: "",
    errorCode: "fixture_replay_miss",
    errorMessage: `No LLM fixture matches request ${request.requestId}.`
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
