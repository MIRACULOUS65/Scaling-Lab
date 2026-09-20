import { parentPort } from "worker_threads";

function heavyWork(iterations: number): number {
  let result = 0;

  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i) * Math.random();
  }

  return result;
}

parentPort?.on("message", (iterations: number) => {
  const result = heavyWork(iterations);

  parentPort?.postMessage(result);
});