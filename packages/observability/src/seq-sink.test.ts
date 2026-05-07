import assert from "node:assert/strict";
import test from "node:test";

import { createSeqSink, formatSeqEvent } from "./index.js";

test("formatSeqEvent converts logger fields to CLEF", () => {
  const event = formatSeqEvent(
    "info",
    {
      event: "llm.error",
      requestId: "req-1",
      errorName: "AbortError"
    },
    "LLM failed"
  );

  assert.equal(event["@mt"], "LLM failed");
  assert.equal(event["@l"], "Information");
  assert.equal(event.event, "llm.error");
  assert.equal(event.requestId, "req-1");
  assert.equal(event.errorName, "AbortError");
});

test("seq sink posts CLEF to /ingest/clef with optional API key", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const sink = createSeqSink({
    url: "http://127.0.0.1:5341",
    apiKey: "seq-key",
    fetchFn: async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;

      return new Response(JSON.stringify({ MinimumLevelAccepted: null }), {
        status: 201,
        headers: {
          "content-type": "application/json"
        }
      });
    }
  });

  await sink.write("error", {
    event: "llm.error",
    errorName: "AbortError"
  });

  assert.equal(capturedUrl, "http://127.0.0.1:5341/ingest/clef");
  assert.equal(capturedInit?.method, "POST");
  assert.equal(
    new Headers(capturedInit?.headers).get("content-type"),
    "application/vnd.serilog.clef"
  );
  assert.equal(
    new Headers(capturedInit?.headers).get("x-seq-apikey"),
    "seq-key"
  );
  assert.match(String(capturedInit?.body), /"event":"llm.error"/);
});

test("seq sink rejects failed ingestion responses", async () => {
  const sink = createSeqSink({
    url: "http://127.0.0.1:5341",
    fetchFn: async () =>
      new Response("API key required", {
        status: 401,
        statusText: "Unauthorized"
      })
  });

  await assert.rejects(
    () =>
      sink.write("info", {
        event: "llm.request"
      }),
    /Seq ingestion failed with 401 Unauthorized/
  );
});
