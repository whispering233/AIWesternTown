import test from "node:test";
import assert from "node:assert/strict";

import type { AddressInfo } from "node:net";

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

import { buildLocalHostServer } from "./server";

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
