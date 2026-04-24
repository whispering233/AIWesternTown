import test from "node:test";
import assert from "node:assert/strict";

import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";
import { createServer } from "node:net";
import { once } from "node:events";

import type {
  CreateLocalSessionResponse,
  LocalHostStreamEvent,
  SubmitLocalCommandResponse
} from "@ai-western-town/contracts";
import {
  createLocalSessionResponseSchema,
  localHostStreamEventSchema,
  submitLocalCommandResponseSchema
} from "@ai-western-town/contracts";

import { buildLocalHostServer } from "./server.js";

test("creates sessions, accepts commands, and emits SSE events", async () => {
  const server = buildLocalHostServer({
    logger: false
  });

  await server.listen({
    port: 0,
    host: "127.0.0.1"
  });

  const baseUrl = `http://127.0.0.1:${getAddressInfo(server.server.address()).port}`;

  try {
    const createResponse = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });
    assert.equal(createResponse.status, 201);

    const createPayload =
      createLocalSessionResponseSchema.parse(
        (await createResponse.json()) as CreateLocalSessionResponse
      );

    const streamResponse = await fetch(
      `${baseUrl}/sessions/${createPayload.session.sessionId}/events`
    );
    assert.equal(streamResponse.status, 200);
    assert.notEqual(streamResponse.body, null);

    const streamPromise = collectSseEvents(streamResponse, 4);

    const commandResponse = await fetch(
      `${baseUrl}/sessions/${createPayload.session.sessionId}/commands`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          playerCommand: {
            commandId: "cmd-1",
            commandType: "observe",
            parsedAction: {
              actionType: "look",
              targetLocationId: "starter-town.saloon",
              tags: ["look"]
            },
            issuedAtTick: 0,
            consumesTick: true
          }
        })
      }
    );

    assert.equal(commandResponse.status, 202);

    const commandPayload = submitLocalCommandResponseSchema.parse(
      (await commandResponse.json()) as SubmitLocalCommandResponse
    );

    assert.equal(commandPayload.acceptedCommandId, "cmd-1");
    assert.equal(commandPayload.session.worldTick, 1);

    const events = await streamPromise;

    assert.deepEqual(
      events.map((event) => event.type),
      [
        "session.snapshot",
        "command.accepted",
        "world.event",
        "tick.trace"
      ]
    );
    assert.equal(events[1]?.type, "command.accepted");
    assert.equal(events[2]?.type, "world.event");
    assert.equal(events[3]?.type, "tick.trace");

    if (
      events[1]?.type !== "command.accepted" ||
      events[2]?.type !== "world.event" ||
      events[3]?.type !== "tick.trace"
    ) {
      assert.fail("Expected command, world event, and tick trace frames");
    }

    assert.equal(events[1].session.worldTick, 1);
    assert.equal(events[2].event.sourceCommandId, "cmd-1");
    assert.equal(events[3].trace.appendedEventIds.length, 1);
  } finally {
    await server.close();
  }
});

test("responds to local web CORS preflight and session creation requests", async () => {
  const server = buildLocalHostServer({
    logger: false
  });

  await server.listen({
    port: 0,
    host: "127.0.0.1"
  });

  const baseUrl = `http://127.0.0.1:${getAddressInfo(server.server.address()).port}`;

  try {
    const preflightResponse = await fetch(`${baseUrl}/sessions`, {
      method: "OPTIONS",
      headers: {
        origin: "http://127.0.0.1:4173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type"
      }
    });

    assert.equal(preflightResponse.status, 204);
    assert.equal(
      preflightResponse.headers.get("access-control-allow-origin"),
      "http://127.0.0.1:4173"
    );

    const createResponse = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: {
        origin: "http://127.0.0.1:4173",
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });

    assert.equal(createResponse.status, 201);
    assert.equal(
      createResponse.headers.get("access-control-allow-origin"),
      "http://127.0.0.1:4173"
    );
  } finally {
    await server.close();
  }
});

test("includes CORS headers on SSE event streams for the local web client", async () => {
  const server = buildLocalHostServer({
    logger: false
  });

  await server.listen({
    port: 0,
    host: "127.0.0.1"
  });

  const baseUrl = `http://127.0.0.1:${getAddressInfo(server.server.address()).port}`;

  try {
    const createResponse = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: {
        origin: "http://127.0.0.1:4173",
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });
    const createPayload =
      createLocalSessionResponseSchema.parse(
        (await createResponse.json()) as CreateLocalSessionResponse
      );

    const streamResponse = await fetch(
      `${baseUrl}/sessions/${createPayload.session.sessionId}/events`,
      {
        headers: {
          origin: "http://127.0.0.1:4173"
        }
      }
    );

    try {
      assert.equal(streamResponse.status, 200);
      assert.equal(
        streamResponse.headers.get("access-control-allow-origin"),
        "http://127.0.0.1:4173"
      );
    } finally {
      await streamResponse.body?.cancel();
    }
  } finally {
    await server.close();
  }
});

test("entrypoint starts the local host when executed with node", async () => {
  const port = await getAvailablePort();
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      LOCAL_HOST_PORT: String(port),
      LOCAL_HOST_BIND: "127.0.0.1"
    },
    stdio: "ignore"
  });

  try {
    const response = await waitForSessionResponse(`http://127.0.0.1:${port}`);
    assert.equal(response.status, 201);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
  }
});

async function collectSseEvents(
  response: Response,
  targetCount: number
): Promise<LocalHostStreamEvent[]> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Expected an SSE response body");
  }

  const decoder = new TextDecoder();
  const events: LocalHostStreamEvent[] = [];
  let buffer = "";

  while (events.length < targetCount) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, {
      stream: true
    });

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex >= 0) {
      const frame = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      const dataLine = frame
        .split("\n")
        .find((line) => line.startsWith("data: "));

      if (dataLine) {
        events.push(localHostStreamEventSchema.parse(JSON.parse(dataLine.slice(6))));
      }

      separatorIndex = buffer.indexOf("\n\n");
    }
  }

  await reader.cancel();

  return events;
}

function getAddressInfo(address: string | AddressInfo | null): AddressInfo {
  if (address === null || typeof address === "string") {
    throw new Error("Expected Fastify to listen on a TCP address");
  }

  return address;
}

async function getAvailablePort(): Promise<number> {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Expected a TCP port while probing for an available port");
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  return address.port;
}

async function waitForSessionResponse(baseUrl: string): Promise<Response> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < 10_000) {
    try {
      const response = await fetch(`${baseUrl}/sessions`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({})
      });

      if (response.ok) {
        return response;
      }

      lastError = new Error(`Unexpected status: ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Timed out waiting for the local-host entrypoint to listen");
}
