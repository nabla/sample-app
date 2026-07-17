export type AsyncJobStatus = "ONGOING" | "SUCCEEDED" | "FAILED";

export interface AsyncJob<TPayload = unknown> {
  id: string;
  status: AsyncJobStatus;
  payload?: TPayload;
}

const DEFAULT_POLL_INTERVAL_MS = 10 * 1_000;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1_000;

export async function pollUntilSucceeded<TPayload>(
  fetchJob: () => Promise<AsyncJob<TPayload>>,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<TPayload> {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    await sleep(intervalMs);

    if (Date.now() >= deadline) {
      throw new Error(`Did not get results within ${timeoutMs}ms. Aborting polling.`);
    }

    const job = await fetchJob();

    if (job.status === "SUCCEEDED") {
      if (job.payload === undefined) {
        throw new Error("Async job succeeded but returned no payload.");
      }
      return job.payload;
    }

    if (job.status === "FAILED") {
      throw new Error(`Async job ${job.id} failed.`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
