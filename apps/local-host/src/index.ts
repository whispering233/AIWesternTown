import { buildLocalHostServer } from "./server";

export * from "./server";
export * from "./session-store";

async function main(): Promise<void> {
  const server = buildLocalHostServer();
  const port = Number.parseInt(process.env.LOCAL_HOST_PORT ?? "8787", 10);
  const host = process.env.LOCAL_HOST_BIND ?? "127.0.0.1";

  await server.listen({
    port,
    host
  });
}

if (require.main === module) {
  void main();
}
