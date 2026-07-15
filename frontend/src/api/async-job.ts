export type AsyncJobStatus = "ONGOING" | "SUCCEEDED" | "FAILED";

export interface AsyncJob<TPayload = unknown> {
  id: string;
  status: AsyncJobStatus;
  payload?: TPayload;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;

export async function pollUntilSucceeded<TPayload>(
  fetchJob: () => Promise<AsyncJob<TPayload>>,
  options: { intervalMs?: number } = {},
): Promise<TPayload> {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  while (true) {
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

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
