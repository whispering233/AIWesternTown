import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest
} from "fastify";

import {
  createLocalSessionRequestSchema,
  createLocalSessionResponseSchema,
  localHostStreamEventSchema,
  submitLocalCommandRequestSchema,
  submitLocalCommandResponseSchema
} from "@ai-western-town/contracts";

import {
  InMemoryLocalSessionStore,
  SessionNotFoundError
} from "./session-store";

type SessionParams = {
  sessionId: string;
};

export type BuildLocalHostServerOptions = {
  sessionStore?: InMemoryLocalSessionStore;
  logger?: boolean;
};

export function buildLocalHostServer(
  options: BuildLocalHostServerOptions = {}
): FastifyInstance {
  const sessionStore =
    options.sessionStore ?? new InMemoryLocalSessionStore();
  const server = Fastify({
    logger: options.logger ?? true
  });

  server.setErrorHandler((error, _request, reply) => {
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
    const body = createLocalSessionRequestSchema.parse(request.body ?? {});
    const session = sessionStore.createSession(body);
    const response = createLocalSessionResponseSchema.parse({
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
      const body = submitLocalCommandRequestSchema.parse(request.body ?? {});
      const response = submitLocalCommandResponseSchema.parse(
        sessionStore.submitCommand(request.params.sessionId, body.playerCommand)
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
      reply.raw.flushHeaders?.();

      writeSseEvent(reply, snapshotEvent);

      request.raw.on("close", () => {
        unsubscribe();
        if (!reply.raw.destroyed) {
          reply.raw.end();
        }
      });
    }
  );

  return server;
}

function writeSseEvent(reply: FastifyReply, event: unknown): void {
  const payload = localHostStreamEventSchema.parse(event);

  reply.raw.write(`id: ${payload.sequence}\n`);
  reply.raw.write(`event: ${payload.type}\n`);
  reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}
