import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest
} from "fastify";

import * as contracts from "@ai-western-town/contracts";
import type { StarterTownSessionRuntime } from "@ai-western-town/app-services";
import {
  createNoopLogger,
  serializeError,
  type Logger
} from "@ai-western-town/observability";

import {
  InMemoryLocalSessionStore,
  SessionNotFoundError
} from "./session-store.js";

type SessionParams = {
  sessionId: string;
};

export type BuildLocalHostServerOptions = {
  sessionStore?: InMemoryLocalSessionStore;
  sessionRuntime?: StarterTownSessionRuntime;
  logger?: boolean;
  observabilityLogger?: Logger;
};

export function buildLocalHostServer(
  options: BuildLocalHostServerOptions = {}
): FastifyInstance {
  const appLogger = (options.observabilityLogger ?? createNoopLogger()).child({
    module: "local-host"
  });
  const requestStartedAt = new WeakMap<FastifyRequest, number>();
  const sessionStore =
    options.sessionStore ??
    new InMemoryLocalSessionStore({
      sessionRuntime: options.sessionRuntime
    });
  const server = Fastify({
    logger: options.logger ?? true
  });

  server.addHook("onRequest", (request, reply, done) => {
    requestStartedAt.set(request, Date.now());
    appLogger.info({
      event: "http.request",
      requestId: getRequestId(request),
      method: request.method,
      url: request.url
    });

    applyCorsHeaders(request, reply);

    if (request.method === "OPTIONS") {
      void reply.code(204).send();
      return;
    }

    done();
  });

  server.addHook("onResponse", (request, reply, done) => {
    appLogger.info({
      event: "http.response",
      requestId: getRequestId(request),
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: Date.now() - (requestStartedAt.get(request) ?? Date.now())
    });
    done();
  });

  server.setErrorHandler((error, request, reply) => {
    appLogger.error({
      event: "http.error",
      requestId: getRequestId(request),
      method: request.method,
      url: request.url,
      ...serializeError(error, true)
    });

    if (error instanceof SessionNotFoundError) {
      void reply.code(404).send({
        message: error.message
      });
      return;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "issues" in error &&
      Array.isArray(error.issues)
    ) {
      void reply.code(400).send({
        message: "Request validation failed",
        issues: error.issues
      });
      return;
    }

    server.log.error(error);
    void reply.code(500).send({
      message: "Internal local-host error"
    });
  });

  server.post("/sessions", async (request, reply) => {
    const body = contracts.createLocalSessionRequestSchema.parse(
      request.body ?? {}
    );
    const session = sessionStore.createSession(body);
    const response = contracts.createLocalSessionResponseSchema.parse({
      session
    });

    return reply.code(201).send(response);
  });

  server.post(
    "/sessions/:sessionId/commands",
    async (
      request: FastifyRequest<{ Params: SessionParams }>,
      reply: FastifyReply
    ) => {
      const requestId = getRequestId(request);
      const routeLogger = appLogger.child({
        requestId,
        sessionId: request.params.sessionId
      });
      const body = contracts.submitLocalCommandRequestSchema.parse(
        request.body ?? {}
      );
      const response = contracts.submitLocalCommandResponseSchema.parse(
        await sessionStore.submitCommand(
          request.params.sessionId,
          body.playerCommand,
          {
            logger: routeLogger,
            requestId
          }
        )
      );

      return reply.code(202).send(response);
    }
  );

  server.get(
    "/sessions/:sessionId/events",
    async (
      request: FastifyRequest<{ Params: SessionParams }>,
      reply: FastifyReply
    ) => {
      const requestId = getRequestId(request);
      const routeLogger = appLogger.child({
        requestId,
        sessionId: request.params.sessionId
      });
      const { snapshotEvent, unsubscribe } = sessionStore.subscribe(
        request.params.sessionId,
        (event) => {
          writeSseEvent(reply, event);
        }
      );

      reply.hijack();
      reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader(
        "Access-Control-Allow-Origin",
        getAllowedOrigin(request.headers.origin)
      );
      reply.raw.setHeader("Vary", "Origin");
      reply.raw.flushHeaders?.();

      routeLogger.info({
        event: "sse.connect"
      });
      writeSseEvent(reply, snapshotEvent);

      request.raw.on("close", () => {
        unsubscribe();
        routeLogger.info({
          event: "sse.disconnect"
        });
        if (!reply.raw.destroyed) {
          reply.raw.end();
        }
      });
    }
  );

  return server;
}

function writeSseEvent(reply: FastifyReply, event: unknown): void {
  const payload = contracts.localHostStreamEventSchema.parse(event);

  reply.raw.write(`id: ${payload.sequence}\n`);
  reply.raw.write(`event: ${payload.type}\n`);
  reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function applyCorsHeaders(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  reply.header(
    "Access-Control-Allow-Origin",
    getAllowedOrigin(request.headers.origin)
  );
  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  reply.header("Access-Control-Allow-Headers", "content-type");
}

function getAllowedOrigin(originHeader: string | string[] | undefined): string {
  return typeof originHeader === "string" && originHeader.length > 0
    ? originHeader
    : "*";
}

function getRequestId(request: FastifyRequest): string {
  const header = request.headers["x-request-id"];

  return typeof header === "string" && header.length > 0
    ? header
    : String(request.id);
}
