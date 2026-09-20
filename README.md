# Scaling Lab — Horizontal vs Vertical Scaling with Node.js

A hands-on system design laboratory built to understand **horizontal scaling, vertical scaling, load balancing, CPU bottlenecks, benchmarking, and shared state** by actually running the experiments locally.

The project intentionally avoids AWS, EC2, Kubernetes, and Docker in the first stage. Everything runs on a single Windows machine using Node.js/TypeScript processes so that the architectural ideas can be observed directly.

> **Goal:** Stop learning system-design concepts as definitions and start learning them by building, stressing, breaking, and measuring a system.

---

## Table of Contents

- [Why This Project Exists](#why-this-project-exists)
- [What This Lab Teaches](#what-this-lab-teaches)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Experiment 1 — Single Node Instance](#experiment-1--single-node-instance)
- [Experiment 2 — Horizontal Scaling](#experiment-2--horizontal-scaling)
- [Experiment 3 — Build a Local Load Balancer](#experiment-3--build-a-local-load-balancer)
- [Experiment 4 — Verify Round-Robin Distribution](#experiment-4--verify-round-robin-distribution)
- [Experiment 5 — Failure Experiment](#experiment-5--failure-experiment)
- [Experiment 6 — Benchmarking the System](#experiment-6--benchmarking-the-system)
- [Experiment 7 — CPU-Heavy Workload](#experiment-7--cpu-heavy-workload)
- [Observed Horizontal Scaling Results](#observed-horizontal-scaling-results)
- [What the Results Mean](#what-the-results-mean)
- [Experiment 8 — State and the `counter` Problem](#experiment-8--state-and-the-counter-problem)
- [Experiment 9 — Vertical Scaling Experiment](#experiment-9--vertical-scaling-experiment)
- [Important Vertical-Scaling Correction](#important-vertical-scaling-correction)
- [Horizontal vs Vertical Scaling](#horizontal-vs-vertical-scaling)
- [Key System Design Lessons](#key-system-design-lessons)
- [Common Misconceptions](#common-misconceptions)
- [Next Experiments](#next-experiments)
- [Learning Roadmap](#learning-roadmap)
- [Running the Lab](#running-the-lab)
- [Conclusion](#conclusion)

---

# Why This Project Exists

System design is often introduced through definitions:

- Horizontal scaling
- Vertical scaling
- Load balancer
- Reverse proxy
- Cache
- Redis
- Message queue
- Replication
- Sharding
- Microservices
- Resilience

Knowing the names is useful, but it is not enough.

This project takes a different approach:

```text
Build
  ↓
Generate load
  ↓
Observe a bottleneck
  ↓
Scale the system
  ↓
Measure again
  ↓
Break an instance
  ↓
Find the architectural problem
  ↓
Introduce the next component
```

The purpose of the lab is therefore not to produce a production-ready web service. The purpose is to develop **system-design intuition**.

---

# What This Lab Teaches

By completing the experiments, you will understand:

### Scaling

- What horizontal scaling actually looks like.
- What vertical scaling actually means.
- Why adding instances does not automatically make every workload faster.
- Why a workload must be large enough to expose a bottleneck.

### Load Balancing

- Why clients should normally interact with a stable entry point.
- How a load balancer distributes requests across instances.
- How round-robin routing works.
- Why load balancing introduces overhead.
- Why health checks become necessary.

### CPU and Concurrency

- Why CPU-bound workloads behave differently from lightweight HTTP workloads.
- Why multiple Node.js processes can use multiple CPU cores.
- Why worker threads can be used to explore increased compute concurrency.
- Why "more workers" does not automatically mean "more performance."

### Distributed State

- Why process memory is local to a process.
- Why `let counter = 0` is not shared between multiple application instances.
- Why horizontally scaled services need a deliberate state-management strategy.

### Benchmarking

- Requests per second
- Average latency
- Percentile latency (`p50`, `p97.5`, `p99`)
- Standard deviation
- Timeouts/errors
- The difference between throughput and latency

---

# Technology Stack

Current lab:

```text
TypeScript
Node.js
Express
tsx
autocannon
```

Planned later:

```text
Redis
MySQL
Nginx
Message Queue
```

The early stages deliberately do **not** require:

```text
Docker
AWS
EC2
Kubernetes
Cloud services
```

Everything can run locally.

---

# Architecture

## Initial single-instance architecture

```text
Browser / Benchmark
        │
        ▼
Node.js App
:3000
```

---

## Horizontal scaling architecture

Multiple copies of the same application run as independent Node.js processes:

```text
                    One Laptop
┌─────────────────────────────────────────────┐
│                                             │
│  App 1              App 2              App 3│
│ :3001              :3002              :3003│
│                                             │
└─────────────────────────────────────────────┘
```

Conceptually:

```text
                 Client
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
      App 1      App 2      App 3
```

The important property is:

> Each instance has its own process and its own memory.

---

## Horizontal scaling with a load balancer

The client should not need to know about every backend instance.

Instead:

```text
                   Client
                     │
                     ▼
               Load Balancer
               localhost:8080
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       App 1      App 2      App 3
       :3001      :3002      :3003
```

The local lab uses a small Node.js load balancer implementation to make the routing behavior visible.

Later, the same architecture can be reproduced with Nginx.

---

# Project Structure

The current folder structure is intentionally small:

```text
Scaling-Lab/
│
├── src/
│   ├── server.ts
│   ├── load-balancer.ts
│   ├── heavy.ts
│   ├── worker.ts
│   └── vertical-server.ts
│
├── package.json
├── tsconfig.json
└── README.md
```

### `server.ts`

The normal application instance.

Responsibilities:

- Start an Express server.
- Read `PORT` and `INSTANCE_ID` from environment variables.
- Return instance identity and process ID.
- Expose `/health`.
- Expose the CPU-heavy `/heavy` endpoint.

### `load-balancer.ts`

A deliberately simple round-robin load balancer.

Responsibilities:

- Accept requests on `:8080`.
- Select one backend from the configured list.
- Forward the request.
- Return the backend response.

### `heavy.ts`

Contains the CPU-intensive calculation used to make the benchmark meaningful.

### `worker.ts`

Performs CPU-heavy work inside a worker thread for the vertical-scaling experiment.

### `vertical-server.ts`

Runs one application instance and uses a configurable worker pool so that the experiment can compare different levels of parallel compute capacity.

---

# Prerequisites

Install:

- Node.js
- npm
- PowerShell on Windows
- A code editor such as VS Code

Verify:

```powershell
node -v
npm -v
```

---

# Setup

Create the project:

```powershell
mkdir Scaling-Lab
cd Scaling-Lab

npm init -y

npm install express
npm install -D typescript tsx @types/node @types/express autocannon

npx tsc --init
```

A suitable `tsconfig.json` for the lab:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

# Experiment 1 — Single Node Instance

The first goal is simply to prove that a Node process can run independently.

A minimal application looks like:

```ts
import express from "express";
import os from "os";

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

app.listen(PORT, () => {
  console.log(
    `[${INSTANCE_ID}] Server running on http://localhost:${PORT} | PID: ${process.pid}`
  );
});
```

Run it:

```powershell
npx tsx src/server.ts
```

Open:

```text
http://localhost:3000
```

Example response:

```json
{
  "message": "Hello from scaling lab",
  "instance": "app-1",
  "pid": 12345,
  "cpuCores": 12
}
```

The important field here is:

```text
pid
```

The PID lets us distinguish independent Node.js processes.

---

# Experiment 2 — Horizontal Scaling

The same source code can be started multiple times.

### App 1

```powershell
$env:PORT=3001
$env:INSTANCE_ID="app-1"
npx tsx src/server.ts
```

### App 2

In another terminal:

```powershell
$env:PORT=3002
$env:INSTANCE_ID="app-2"
npx tsx src/server.ts
```

### App 3

In another terminal:

```powershell
$env:PORT=3003
$env:INSTANCE_ID="app-3"
npx tsx src/server.ts
```

Now:

```text
App 1 → localhost:3001
App 2 → localhost:3002
App 3 → localhost:3003
```

Each process is executing the same code but has different configuration.

This is the local demonstration of:

> **Horizontal scaling at the application-instance level.**

---

# Why Environment Variables?

The application contains:

```ts
const PORT = Number(process.env.PORT) || 3000;
const INSTANCE_ID = process.env.INSTANCE_ID || "app-1";
```

`process.env` contains environment variables provided to the Node process.

For App 1:

```text
PORT=3001
INSTANCE_ID=app-1
```

For App 2:

```text
PORT=3002
INSTANCE_ID=app-2
```

For App 3:

```text
PORT=3003
INSTANCE_ID=app-3
```

The code remains the same.

This models an important deployment principle:

> **Keep application code consistent; vary configuration per instance.**

---

# Experiment 3 — Build a Local Load Balancer

Instead of making the client choose a particular backend, create one stable endpoint:

```text
localhost:8080
```

The load balancer has the backend list:

```ts
const servers = [
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003"
];
```

A basic round-robin implementation:

```ts
import http from "http";

const servers = [
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003"
];

let currentServer = 0;

const loadBalancer = http.createServer(async (req, res) => {
  const target = servers[currentServer];

  currentServer =
    (currentServer + 1) % servers.length;

  try {
    const response = await fetch(target + req.url);
    const body = await response.text();

    res.writeHead(response.status, {
      "Content-Type":
        response.headers.get("content-type") ||
        "application/json"
    });

    res.end(body);

    console.log(`Forwarded ${req.url} → ${target}`);
  } catch {
    res.statusCode = 503;
    res.end("Service unavailable");
  }
});

loadBalancer.listen(8080, () => {
  console.log(
    "Load balancer running on http://localhost:8080"
  );
});
```

Run:

```powershell
npx tsx src/load-balancer.ts
```

Architecture:

```text
                       Browser
                          │
                          ▼
                    :8080 / LB
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
           :3001        :3002        :3003
           App 1        App 2        App 3
```

---

# Experiment 4 — Verify Round-Robin Distribution

Open:

```text
http://localhost:8080
```

Refresh several times.

Expected pattern:

```text
app-1
app-2
app-3
app-1
app-2
app-3
...
```

The exact browser refresh sequence can vary in real systems, but this custom load balancer intentionally implements a deterministic round-robin sequence.

The relevant logic is:

```ts
const target = servers[currentServer];

currentServer =
  (currentServer + 1) % servers.length;
```

For three servers:

```text
0 → 1
1 → 2
2 → 0
```

This creates:

```text
App 1 → App 2 → App 3 → App 1 → ...
```

---

# Why Does the Client Need a Load Balancer?

Without a load balancer, a client that wants to talk to App 1 must explicitly request:

```text
http://localhost:3001
```

For App 2:

```text
http://localhost:3002
```

For App 3:

```text
http://localhost:3003
```

The issue is not that a human user literally chooses a port. The issue is that the **client software would need to know the individual backend destinations**.

With a load balancer:

```text
Client
  │
  ▼
localhost:8080
  │
  ▼
Load Balancer
  │
  ├── App 1
  ├── App 2
  └── App 3
```

The client has one stable entry point.

The infrastructure decides which backend instance receives the request.

---

# Experiment 5 — Failure Experiment

Stop App 2:

```text
Ctrl + C
```

Now:

```text
App 1 ✅
App 2 ❌
App 3 ✅
```

The current toy load balancer still believes App 2 is available.

Eventually it will route a request to:

```text
localhost:3002
```

and fail.

The local implementation returns:

```text
503 Service unavailable
```

This demonstrates why production load balancers need mechanisms such as:

- Health checks
- Connection timeouts
- Failure detection
- Retry policies
- Instance removal/recovery

The lab intentionally exposes the problem rather than hiding it.

---

# Experiment 6 — Benchmarking the System

The benchmark tool is:

```text
autocannon
```

A typical command:

```powershell
npx autocannon -c 20 -d 10 http://localhost:3001
```

Meaning:

```text
-c 20
20 concurrent connections

-d 10
Run for 10 seconds
```

Important measurements:

### Throughput

```text
Req/Sec
```

How many requests the server processed per second.

### Average latency

How long requests took on average.

### p50

The median request latency.

Approximately half the requests were faster and half were slower than this value.

### p97.5 / p99

Tail latency.

These are important because a service can have an acceptable average while some requests take dramatically longer.

---

# Experiment 7 — CPU-Heavy Workload

A very lightweight endpoint is not enough to demonstrate why horizontal scaling can help.

The initial `/` route mostly serializes a small JSON response.

Instead, the lab introduces:

```text
GET /heavy
```

The heavy calculation:

```ts
export function heavyWork(iterations: number): number {
  let result = 0;

  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i) * Math.random();
  }

  return result;
}
```

This deliberately creates CPU pressure.

The endpoint performs:

```text
HTTP request
    ↓
5,000,000 iterations
    ↓
CPU-intensive work
    ↓
HTTP response
```

This creates a bottleneck that makes scaling behavior easier to observe.

---

# Observed Horizontal Scaling Results

These are **local experimental results**, not universal performance figures.

Your machine has 12 reported CPU cores, and the experiments were run with all instances on the same laptop.

## Lightweight endpoint

Earlier benchmarking produced approximately:

| Test | Avg Latency | Req/sec |
|---|---:|---:|
| Direct App (`:3001`) | 3.31 ms | 5,375.82 |
| Load Balancer (`:8080`) | 6.34 ms | 2,910.60 |

Interpretation:

- The load balancer adds an extra hop and therefore adds overhead.
- The lightweight workload is so cheap that one Node instance already handles it very efficiently.
- Adding three processes on the same laptop does not automatically create 3× hardware capacity.
- For a workload this small, the proxy overhead can dominate.

This is a valuable lesson:

> **Horizontal scaling is not automatically faster for every workload.**

---

## CPU-heavy endpoint — 20 concurrent connections

One application instance:

```text
Average latency ≈ 473 ms
Requests/sec ≈ 41.4
```

Three instances behind the load balancer:

```text
Average latency ≈ 283 ms
Requests/sec ≈ 67.6
```

That is roughly:

```text
41.4 → 67.6 req/sec
```

The important pattern is that the CPU-heavy workload exposed a bottleneck that could benefit from distributing work across multiple Node processes.

---

## CPU-heavy endpoint — 100 concurrent connections

One instance:

```text
Average latency ≈ 4562 ms
p50 ≈ 4400 ms
p97.5 ≈ 15743 ms
Requests/sec ≈ 20.1
Errors/timeouts = 12
```

Three instances behind the load balancer:

```text
Average latency ≈ 1345 ms
p50 ≈ 505 ms
p97.5 ≈ 5265 ms
Requests/sec ≈ 65.1
```

Another 100-connection load-balancer run produced approximately:

```text
Requests/sec ≈ 79.7
Average latency ≈ 1182 ms
```

Run-to-run variation is expected in local benchmarks because the laptop is also running the operating system, terminal, browser, and other background processes.

The main observation remains:

> Under CPU-heavy load, distributing work across multiple independent application processes can materially increase throughput and reduce latency compared with an overloaded single process.

---

# What the Results Mean

The experiments demonstrate an important distinction.

## Lightweight request

```text
Client
  ↓
Node instance
  ↓
Tiny JSON response
```

The server is already fast.

Adding:

```text
Load Balancer
```

introduces additional work without solving a significant bottleneck.

---

## CPU-heavy request

```text
Client
  ↓
CPU-heavy application
  ↓
Requests queue
```

Now the application itself becomes a bottleneck.

With multiple instances:

```text
                    Load
                     │
                     ▼
               Load Balancer
                /     |     \
               ▼      ▼      ▼
             App 1  App 2  App 3
               │      │      │
               └──────┼──────┘
                      ▼
                    CPU
```

The same laptop still has the same physical hardware, but multiple independent processes can make use of multiple cores.

The experiment therefore demonstrates the architecture and concurrency effects of horizontal application scaling without pretending that three local processes are equivalent to three independent machines.

---

# Experiment 8 — State and the `counter` Problem

Now consider:

```ts
let counter = 0;

app.get("/counter", (_req, res) => {
  counter++;

  res.json({
    instance: INSTANCE_ID,
    pid: process.pid,
    counter
  });
});
```

With a single process:

```text
Request 1 → counter = 1
Request 2 → counter = 2
Request 3 → counter = 3
```

Everything looks normal.

But with three independent processes:

```text
App 1 → counter = 0
App 2 → counter = 0
App 3 → counter = 0
```

there are actually **three different variables in three different process memories**.

Conceptually:

```text
┌──────────────────────┐
│ App 1 process memory │
│ counter = 5          │
└──────────────────────┘

┌──────────────────────┐
│ App 2 process memory │
│ counter = 3          │
└──────────────────────┘

┌──────────────────────┐
│ App 3 process memory │
│ counter = 7          │
└──────────────────────┘
```

So the system does not have one globally shared counter.

This creates problems for stateful features such as:

- Shopping carts
- Sessions
- Rate-limit counters
- User presence
- Temporary application state
- Job coordination

The architectural question becomes:

> **Where should shared state live?**

That question leads naturally to the next component:

```text
                    App 1
                       \
                        \
                    ┌────────┐
App 2 ─────────────▶│ Redis  │
                    └────────┘
                        /
                       /
                    App 3
```

Redis is intentionally postponed in this lab so that the reason for introducing it is discovered rather than memorized.

---

# Experiment 9 — Vertical Scaling Experiment

True vertical scaling means increasing the resources available to the same machine or instance:

```text
Before:

One machine
2 CPU cores
4 GB RAM

        ↓

After:

Same machine
8 CPU cores
16 GB RAM
```

The application instance remains conceptually the same.

The local machine cannot physically upgrade its CPU in the middle of an experiment, so this lab uses **worker threads as a controlled approximation of increased compute concurrency within one application instance**.

The vertical experiment therefore looks like:

```text
ONE APPLICATION INSTANCE

        ┌──────────┼──────────┐
        ▼          ▼          ▼
     Worker 1   Worker 2   Worker 3   Worker 4
```

instead of:

```text
MULTIPLE APPLICATION INSTANCES

        ┌──────────┼──────────┐
        ▼          ▼          ▼
      App 1      App 2      App 3
```

These are different scaling dimensions.

---

# Important Vertical-Scaling Correction

The first version of the vertical experiment contained a subtle but important benchmarking error.

The original implementation effectively did:

```ts
const jobs = Array.from(
  { length: WORKERS },
  () => runWorker()
);

await Promise.all(jobs);
```

If:

```text
WORKERS = 1
```

one HTTP request performs:

```text
5,000,000 iterations
```

But if:

```text
WORKERS = 4
```

one HTTP request performs:

```text
5,000,000
+
5,000,000
+
5,000,000
+
5,000,000
```

or roughly:

```text
20,000,000 iterations
```

That means the 4-worker benchmark was not a fair vertical-scaling comparison.

It was doing more work per request.

Therefore, the initial results showing the 4-worker version as slower were **not evidence that vertical scaling is inherently slower**.

They exposed a flaw in the experiment design.

---

# Correct Vertical Experiment Design

The correct comparison is:

```text
1 worker:

Request A → Worker 1
Request B → waits
Request C → waits
```

versus:

```text
4 workers:

Request A → Worker 1
Request B → Worker 2
Request C → Worker 3
Request D → Worker 4
Request E → waits
```

Every request should perform the same:

```text
5,000,000 iterations
```

The only changed variable should be:

> **How many CPU-heavy jobs can execute concurrently?**

A worker pool is therefore used.

Conceptually:

```text
                    HTTP Requests
                         │
                         ▼
                      Queue
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
          Worker 1    Worker 2    Worker 3 ... Worker N
```

This is the fair experiment.

---

# Horizontal vs Vertical Scaling

| Dimension | Horizontal Scaling | Vertical Scaling |
|---|---|---|
| What changes? | Number of instances | Resources/capacity of an instance |
| Basic idea | Add more instances | Make an instance more capable |
| Local lab | Multiple Node processes | One process + more worker concurrency |
| Typical architecture | Load balancer + multiple apps | One larger instance |
| Failure behavior | One instance can fail while others remain | Machine failure affects the whole instance |
| Complexity | More distributed-system concerns | Often simpler initially |
| Physical model | More machines/instances | Bigger machine |
| Main limitation | Coordination/state/networking | Hardware ceiling |
| Local experiment | `3001`, `3002`, `3003` | `WORKERS=1`, `WORKERS=4`, etc. |

The most important distinction:

```text
Horizontal = more instances

Vertical = more capacity per instance
```

Do not turn properties such as "resilient" or "single point of failure" into the definitions themselves. They depend on the architecture and failure model.

---

# Key System Design Lessons

## 1. Scaling should solve a bottleneck

Don't assume:

```text
3 servers = 3× faster
```

The benefit depends on what is limiting the system.

---

## 2. A load balancer adds overhead

The request path becomes:

```text
Client
  ↓
Load Balancer
  ↓
Application
  ↓
Load Balancer
  ↓
Client
```

instead of:

```text
Client
  ↓
Application
  ↓
Client
```

That extra layer costs time, but it enables:

- Traffic distribution
- A stable entry point
- Instance selection
- Health checking
- Horizontal scaling

---

## 3. More instances do not mean more physical hardware on a laptop

This:

```text
App 1
App 2
App 3
```

running on one laptop still means:

```text
ONE CPU
ONE RAM
ONE PHYSICAL MACHINE
```

The experiment teaches application-level scaling behavior, not cloud infrastructure topology.

---

## 4. CPU-bound workloads expose scaling differences

A tiny JSON endpoint can be so fast that scaling overhead dominates.

A CPU-heavy endpoint makes resource contention visible.

This is why `/heavy` exists.

---

## 5. Process memory is local

This:

```ts
let counter = 0;
```

belongs to a process.

Three processes mean three independent copies.

That is one of the foundations behind stateless service design and external state stores.

---

## 6. Benchmark design matters

A benchmark is meaningful only when the variables being compared are controlled.

The vertical-scaling mistake demonstrated this directly:

```text
1 worker → 1 job/request
4 workers → 4 jobs/request
```

That is not a fair comparison.

A good benchmark changes one factor while keeping the workload constant.

---

## 7. Average latency is not enough

Consider:

```text
Average = 1 second
p99 = 8 seconds
```

The average alone hides the tail.

System design discussions commonly care about percentile latency because users in the tail still experience poor performance.

---

# Common Misconceptions

### "Horizontal scaling always makes the system faster."

No.

If the original server is not bottlenecked, additional instances can simply introduce overhead.

---

### "A load balancer is the same thing as horizontal scaling."

No.

They are related but different:

```text
Horizontal scaling
→ add more instances

Load balancing
→ distribute traffic between instances
```

You often use one to make the other useful.

---

### "Horizontal scaling means multiple physical servers."

Not necessarily.

For this lab:

```text
Multiple Node processes
```

are enough to demonstrate independent application instances.

Production systems commonly spread those instances across machines, availability zones, containers, or other infrastructure.

---

### "Vertical scaling means adding worker threads."

Not literally.

Worker threads are the mechanism used in this local experiment to approximate increased compute capacity.

True vertical scaling is about increasing the resources of the underlying machine/instance.

---

### "If one instance dies, a load balancer automatically knows."

Not necessarily.

Our toy load balancer does not perform health checking.

That's why killing App 2 exposes the next architectural problem.

---

# Next Experiments

The laboratory can evolve naturally:

```text
Phase 1
One Node server
        ↓
Phase 2
Multiple Node instances
        ↓
Phase 3
Local round-robin load balancer
        ↓
Phase 4
Failure experiment
        ↓
Phase 5
CPU-heavy workload
        ↓
Phase 6
Benchmark horizontal scaling
        ↓
Phase 7
Vertical scaling with a worker pool
        ↓
Phase 8
Shared in-memory state
        ↓
Phase 9
Redis
        ↓
Phase 10
MySQL
        ↓
Phase 11
Rate limiting
        ↓
Phase 12
Message queue
        ↓
Phase 13
Caching
        ↓
Phase 14
Failure recovery / health checks
        ↓
Phase 15
Nginx reverse proxy / load balancer
```

The order matters because each new component should answer a problem discovered in the previous experiment.

---

# Learning Roadmap

This lab fits into a broader system-design progression:

```text
Backend Fundamentals
        ↓
HTTP / HTTPS
        ↓
DNS
        ↓
TCP/IP
        ↓
REST APIs
        ↓
Databases / SQL
        ↓
Caching
        ↓
LLD Fundamentals
        ↓
HLD Fundamentals
        ↓
Distributed Systems
```

The scaling lab sits near the transition between backend fundamentals and HLD.

The objective is to understand architectural behavior before memorizing more system-design terminology.

---

# Running the Lab

## Start three application instances

### Terminal 1

```powershell
$env:PORT=3001
$env:INSTANCE_ID="app-1"
npx tsx src/server.ts
```

### Terminal 2

```powershell
$env:PORT=3002
$env:INSTANCE_ID="app-2"
npx tsx src/server.ts
```

### Terminal 3

```powershell
$env:PORT=3003
$env:INSTANCE_ID="app-3"
npx tsx src/server.ts
```

## Start the load balancer

### Terminal 4

```powershell
npx tsx src/load-balancer.ts
```

Then open:

```text
http://localhost:8080
```

---

## Benchmark a direct instance

```powershell
npx autocannon -c 20 -d 10 http://localhost:3001
```

## Benchmark through the load balancer

```powershell
npx autocannon -c 20 -d 10 http://localhost:8080
```

## Benchmark CPU-heavy work

Single instance:

```powershell
npx autocannon -c 20 -d 10 http://localhost:3001/heavy
```

Three instances through the load balancer:

```powershell
npx autocannon -c 20 -d 10 http://localhost:8080/heavy
```

Higher pressure:

```powershell
npx autocannon -c 100 -d 20 http://localhost:3001/heavy
```

and:

```powershell
npx autocannon -c 100 -d 20 http://localhost:8080/heavy
```

---

# Conclusion

This project is a practical attempt to understand system design from the inside out.

Instead of starting with:

```text
"Redis is a cache."

"Load balancing distributes traffic."

"Horizontal scaling adds servers."
```

the lab asks:

```text
Why did we need Redis?

Why did we need a load balancer?

What bottleneck forced us to scale?

What broke after adding more instances?

Where does state live?

What happens when an instance dies?

What happens when traffic increases?
```

The resulting learning path is:

```text
                SYSTEM DESIGN THINKING

                     Observe
                       ↓
                    Measure
                       ↓
                   Find Problem
                       ↓
                    Design
                       ↓
                    Implement
                       ↓
                    Break
                       ↓
                   Understand
```

That is the core philosophy of the Scaling Lab.

> **Build the problem first. Then build the architecture that solves it.**

