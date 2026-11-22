/**
 * The notification worker: claim a batch, send it, sleep, forever.
 *
 * A separate process on purpose. The web app only ever writes a row to the
 * outbox inside its own transaction; whether the mail server is slow, down
 * or rejecting us is this process's problem and never a customer's page
 * load. Run as many copies as you like: they do not share rows
 * (lib/notifications/process-queue.ts).
 */
import { createMailer } from "@/lib/notifications/mailer";
import { processQueue } from "@/lib/notifications/process-queue";
import { prisma } from "@/lib/prisma";
import { purgeRateLimits } from "@/lib/security/rate-limit";

const POLL_MS = 5_000;
const PURGE_EVERY_MS = 60 * 60_000;

let running = true;
let wake: (() => void) | undefined;

function stop(signal: string): void {
  console.log(`[worker] ${signal} received, finishing the current batch`);
  running = false;
  wake?.();
}
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    wake = () => {
      clearTimeout(timer);
      resolve();
    };
  });

async function main(): Promise<void> {
  const mailer = createMailer();
  let lastPurge = 0;
  console.log("[worker] started");

  while (running) {
    try {
      const result = await processQueue({ mailer });
      if (result.sent + result.retried + result.failed > 0) {
        console.log(`[worker] sent=${result.sent} retried=${result.retried} failed=${result.failed}`);
      }
      if (Date.now() - lastPurge > PURGE_EVERY_MS) {
        await purgeRateLimits();
        lastPurge = Date.now();
      }
    } catch (error) {
      // The database being briefly unreachable must not kill the worker:
      // the rows are still there on the next pass.
      console.error("[worker] batch failed:", error instanceof Error ? error.message : error);
    }
    if (running) await sleep(POLL_MS);
  }

  await prisma.$disconnect();
  console.log("[worker] stopped");
}

void main();
