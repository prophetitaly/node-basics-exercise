import { parentPort, workerData } from "worker_threads";

// Heavy computation task
function heavyComputation(iterations: number): number {
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i) * Math.sin(i);
  }
  return result;
}

if (parentPort) {
  const { iterations } = workerData;
  const result = heavyComputation(iterations);
  parentPort.postMessage(result);
}
