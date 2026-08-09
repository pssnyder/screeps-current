# Screeps Engine Reengagement and Maintenance Plan

This document is a human-owner handoff for the current community-built automation engine.
It translates the codebase into plain English, defines maintenance success criteria, and outlines a practical SDLC maintenance workflow for the next release.

## 1) System Intent

The current system is a layered colony automation engine with:

- A per-tick orchestrator (`main.js`)
- A strategy layer (`decision.tree.js`) inspired by chess evaluation/search
- A room operations layer (spawn/tower/structures/links/expansion)
- A creep execution layer (`role.manager.js` + role modules)
- A telemetry layer (`analytics.js`, `memory.manager.js`, `console.helper.js`)
- A market layer (`market.manager.js`)

The architecture is centralized: one loop makes strategic decisions, then room controllers and role modules execute those decisions.

## 2) Team Build Map (How Modules Fit Together)

### Entry and orchestration

- `main.js`
- Runs every tick and controls execution order:
  1. Memory cleanup
  2. Tick analytics sampling
  3. Spawn visual updates
  4. Core engine run
  5. Market manager run (throttled internally)
  6. Periodic analytics/dashboard cleanup

### Core decision engine

- `engine.core.js`
- Produces game-state evaluation and strategy, then executes room-level and creep-level operations.

- `evaluator.js`
- Scores each owned room (resources, military, economy, infrastructure, controller).

- `decision.tree.js`
- Converts evaluation into priorities and spawn queue:
  - Emergency economy protection
  - RCL-aware creep composition
  - Defense-aware spawn logic
  - Expansion consideration

### Room-level controllers

- `spawn.controller.js`
  - Spawns highest-priority creeps per room
  - Falls back to reduced body when energy constrained

- `tower.controller.js`
  - Priority: attack > heal > repair
  - Uses throttle and caching for CPU control

- `structure.planner.js`
  - Every 100 ticks, places construction sites by priority
  - Includes RCL5 links and RCL6 extractor/terminal/labs planning

- `link.manager.js`
  - Every 3 ticks (from engine), routes source-link energy to spawn/controller links

- `expansion.manager.js`
  - Optional expansion pipeline with queue, claimer/pioneer orchestration, and colony bootstrap

### Creep behavior layer

- `role.manager.js`
  - Dispatches creeps to role modules with guarded execution

- Economy roles:
  - `role.harvester.js` (mobile and static/container mode)
  - `role.hauler.js` (container and logistics aware)
  - `role.upgrader.js`
  - `role.builder.js`

- Security role:
  - `role.defender.js`

- RCL6 economy expansion:
  - `role.miner.js`

- Expansion operations:
  - `role.scout.js`
  - `role.claimer.js`
  - `role.pioneer.js`

### Telemetry and memory

- `memory.manager.js`
  - Dead creep cleanup and stat retention windows

- `analytics.js`
  - Samples KPI data, computes simple trends, emits recommendations
  - Writes dashboard snapshots to `Memory.dashboard`

- `console.helper.js`
  - Operator command surface
  - Added maintenance/telemetry commands: `ticks()`, `telemetry()`, `spatial()`, `releaseAudit()`

### Market automation

- `market.manager.js`
  - Price snapshots
  - Sell-order generation for surplus minerals
  - Order competitiveness checks
  - Transaction reporting

## 3) Runtime Trigger Cadence (Plain English)

- Every tick:
  - Clear dead creep memory
  - Sample lightweight analytics (if tick modulo 10 == 0)
  - Render spawn role visuals
  - Run engine core
  - Run market manager (manager decides if this tick is a market cycle)
  - Store per-module CPU profiling data

- Every 3 ticks:
  - Link transfer logic
  - Tower healing checks

- Every 10 ticks:
  - KPI sampling in analytics
  - Tower repair checks

- Every 100 ticks:
  - High-level analytics and recommendations
  - Dashboard telemetry snapshot
  - Structure planner attempt
  - Periodic status summary log

- Every 1000 ticks and beyond:
  - Market cycle executes
  - Long-window data cleanup and order refresh windows progress

## 4) SDLC Maintenance Workflow (Owner-Centric)

Use this as your default release cycle:

1. Baseline capture
- Run `status()`, `profile()`, `telemetry(500)`, `spatial()` and store outputs in release notes.
- Record current room KPIs (RCL, energy throughput, CPU average, bucket floor).

2. Define scope and acceptance
- Pick a narrow objective (example: RCL5 logistics stabilization).
- Define 3-5 measurable acceptance tests before coding.

3. Implement behind clear module boundaries
- Keep strategy changes in `decision.tree.js`.
- Keep room logistics changes in `structure.planner.js`, `link.manager.js`, `spawn.controller.js`.
- Keep role behavior changes in individual role files.

4. Soak test window
- Observe for at least 1000-3000 ticks.
- Confirm no CPU regressions and no role starvation.

5. Post-change telemetry review
- Compare pre/post trends using `telemetry(500)`.
- Verify infrastructure readiness with `releaseAudit()`.

6. Release gate decision
- Promote only if all acceptance criteria pass and no major regressions are seen.

## 5) Success Criteria and Expectations

Minimum success criteria for each release:

- Stability:
  - No persistent error spam in console for 1000+ ticks
  - CPU bucket remains above 3000 except during transient spikes

- Economy:
  - No room sits below 30% available energy for prolonged windows (>150 ticks)
  - Spawn idle time decreases or stays stable while core demand is met

- Defense:
  - Hostile detection and response works without role deadlocks

- Infrastructure progression:
  - Construction throughput tracks RCL goals
  - Links/containers/towers align with intended milestone

- Observability:
  - Operator can explain current state using runbook commands in under 2 minutes

## 6) Immediate Next-Release Focus (From Current RCL5 State)

Recommended target: "RCL5 logistics hardening and RCL6 readiness"

- Confirm two-source link network is complete and used effectively.
- Ensure hauler counts drop automatically when links are operational.
- Ensure storage buffers are healthy before market/expansion pressure.
- Prepare extractor + terminal placement path so RCL6 transition is smooth.

See detailed milestone plan in `docs/RCL5_TO_RCL10_ROADMAP.md`.

## 7) Risk Register (Current)

- Strategic depth vs CPU budget: richer planning can increase CPU spikes.
- Memory growth risk: historical arrays are bounded but still require monitoring.
- Expansion complexity: claimer/pioneer pipeline can strain economy if prerequisites are too loose.
- Market assumptions: static thresholds may not match current shard economics.

## 8) Owner Control Model

As human owner, keep these controls explicit:

- Expansion switch: `enableExpansion()` / `disableExpansion()`
- Expansion queue: `queueExpansion("ROOM")`
- Emergency cleanup: `killAll("role")`
- Layout forcing: `planStructures()`
- Continuous visibility: `telemetry(500)` and `releaseAudit()`

This keeps the system collaborative but owner-directed.
