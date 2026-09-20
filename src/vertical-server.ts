import express from "express";
import os from "os";
import { Worker } from "worker_threads";

const app = express();

const PORT = 4000;
const WORKERS = Number(process.env.WORKERS) || 1;
const ITERATIONS = 5_000_000;

type Job = {
  resolve: (value: number) => void;
  reject: (error: Error) => void;
};

type WorkerWrapper = {
  worker: Worker;
  busy: boolean;
  currentJob?: Job;
};

const workerPool: WorkerWrapper[] = [];
const queue: Job[] = [];

function runNext() {
  const availableWorker = workerPool.find(
    (worker) => !worker.busy
  );

  if (!availableWorker || queue.length === 0) {
    return;
  }

  const job = queue.shift()!;

  availableWorker.busy = true;
  availableWorker.currentJob = job;

  availableWorker.worker.postMessage(ITERATIONS);
}

function createWorker() {
  const wrapper: WorkerWrapper = {
    worker: new Worker(
      new URL("./worker.ts", import.meta.url)
    ),
    busy: false
  };

  wrapper.worker.on("message", (result: number) => {
    wrapper.busy = false;

    wrapper.currentJob?.resolve(result);
    wrapper.currentJob = undefined;

    runNext();
  });

  wrapper.worker.on("error", (error) => {
    wrapper.busy = false;

    wrapper.currentJob?.reject(error);
    wrapper.currentJob = undefined;

    runNext();
  });

  workerPool.push(wrapper);
}

for (let i = 0; i < WORKERS; i++) {
  createWorker();
}

function runJob(): Promise<number> {
  return new Promise((resolve, reject) => {
    queue.push({
      resolve,
      reject
    });

    runNext();
  });
}

app.get("/heavy", async (_req, res) => {
  const start = performance.now();

  try {
    const result = await runJob();

    const duration = performance.now() - start;

    res.json({
      pid: process.pid,
      workers: WORKERS,
      durationMs: Number(duration.toFixed(2)),
      result
    });
  } catch (error) {
    res.status(500).json({
      error: "Worker failed"
    });
  }
});

app.get("/", (_req, res) => {
  res.json({
    message: "Vertical scaling experiment",
    pid: process.pid,
    workers: WORKERS,
    cpuCores: os.cpus().length
  });
});

app.listen(PORT, () => {
  console.log(
    `Vertical server running on http://localhost:${PORT}`
  );

  console.log(`Workers: ${WORKERS}`);
  console.log(`CPU cores available: ${os.cpus().length}`);
});