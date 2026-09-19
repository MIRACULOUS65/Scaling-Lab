import express from "express";
import os from "os";
import { heavyWork } from "./heavy.js";

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const INSTANCE_ID = process.env.INSTANCE_ID || "app-1";

app.get("/", (_req, res) => {
  res.json({
    message: "Hello from scaling lab",
    instance: INSTANCE_ID,
    pid: process.pid,
    cpuCores: os.cpus().length
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    instance: INSTANCE_ID,
    pid: process.pid
  });
});

app.get("/heavy", (_req, res) => {
  const start = performance.now();

  console.log(`Heavy request handled by ${INSTANCE_ID} | PID ${process.pid}`);

  const result = heavyWork(5_000_000);

  const duration = performance.now() - start;

  res.json({
    instance: INSTANCE_ID,
    pid: process.pid,
    durationMs: duration,
    result
  });
});

app.listen(PORT, () => {
  console.log(
    `[${INSTANCE_ID}] Server running on http://localhost:${PORT} | PID: ${process.pid}`
  );
});