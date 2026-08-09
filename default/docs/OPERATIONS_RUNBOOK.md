# Screeps Engine Operations Runbook

This runbook gives you practical day-to-day commands and interpretation rules.

## 1) Fast Start (2-minute owner check)

Run these in order:

1. `status()`
2. `profile()`
3. `telemetry(500)`
4. `spatial()`
5. `releaseAudit()`

If all look healthy, keep system in autonomous mode.

## 2) Command Reference

### Core status and analysis

- `help()`
  - Lists command surface

- `status()`
  - Full room operational status
  - Use for RCL, energy, infra counts, threats, and alerts

- `profile()`
  - Last tick CPU module breakdown
  - Use after changes to identify CPU hotspots

- `strategy()`
  - Shows latest strategy priority ordering and spawn queue

- `creeps()`
  - Lists all creeps and role allocations

### Maintenance telemetry (new)

- `ticks()`
  - Human-readable trigger cadence map
  - Use to understand when each subsystem is expected to run

- `telemetry(window)`
  - Rolling KPI summary from memory stats
  - Example: `telemetry(500)`
  - Shows average/min/max/trend for CPU, room energy, stored energy, creep count

- `spatial(roomName?)`
  - Spatial and logistics diagnostics per room
  - Shows source path lengths, container/link adjacency and fill states
  - Use `spatial()` for first owned room or `spatial("W0N0")`

- `releaseAudit()`
  - RCL milestone readiness per room
  - Checks extension/tower/link capacity plus storage/terminal/extractor/lab progress

- `incidentModeStatus()`
  - Shows recovery mode state, streak counters, cooldown, and anti-oscillation guard status
  - Use to verify when incident mode enters/exits and why

### Expansion and scouting

- `expand()`
  - Expansion status and active operations

- `enableExpansion()` / `disableExpansion()`
  - Turn expansion subsystem on/off

- `queueExpansion("ROOM", options)`
  - Queue a target room for claim operation

- `scout("ROOM_A", "ROOM_B")`
  - Spawn scout creep to gather room intel

### Structure and emergency controls

- `planStructures()`
  - Forces structure planner cycle immediately

- `kill("creepName")`
  - Kill one creep

- `killAll("role")`
  - Kill all creeps of role (for reset/recomposition)

- `debug()`
  - Deep room diagnostics for troubleshooting

## 3) Telemetry Interpretation Guide

### CPU health

- Good:
  - Average CPU consistently below 70% limit
  - Bucket generally recovering or stable above 5000

- Watch:
  - Average CPU 70-90%
  - Bucket drifting downward over long windows

- Critical:
  - Frequent >90% CPU
  - Bucket below 2000 and falling

Actions:
- Reduce non-critical planners/scanners.
- Verify role counts are not inflated.
- Check `profile()` for dominant modules.

### Energy economy health

- Good:
  - Room energy trends stable/up with storage growing

- Watch:
  - Energy trend down but storage compensates

- Critical:
  - Room energy below 30% for long stretches and storage not recovering

Actions:
- Increase harvester/hauler priority.
- Reduce builders/upgraders temporarily.
- Re-check source containers and links with `spatial()`.

### Spatial efficiency health

- Good:
  - Sources have adjacent container or link and reasonable spawn path lengths

- Watch:
  - High container overfill or consistently empty links despite miner activity

- Critical:
  - Missing source logistics structures at RCL5+, extension grid underfed

Actions:
- Force `planStructures()`.
- Validate link placement and transfer activity.
- Tune spawn role mix (hauler vs harvester) via strategy logic if needed.

## 4) Weekly Maintenance Checklist

1. Capture baseline telemetry snapshots with `telemetry(1000)`.
2. Validate RCL readiness with `releaseAudit()`.
3. Review strategy output with `strategy()` and compare to room needs.
4. Verify no persistent warnings/errors in console.
5. Confirm expansion queue is intentional and prerequisites are still valid.
6. Review market status if RCL6+ rooms are active in trade.

## 5) Incident Playbook

### Symptom: Spawn starvation

- Check `status()` and `strategy()`
- Confirm at least one active harvester and hauler route
- If needed: `killAll("builder")` and allow economy recovery

### Symptom: CPU runaway

- Check `profile()` and `telemetry(500)`
- Disable expansion temporarily
- Validate no excessive construction or scout churn

### Symptom: RCL progress stalls

- Check energy flow in `spatial()`
- Ensure upgrader count is appropriate
- Confirm controller access and pathing are clear

### Symptom: New room colonization stalls

- Check `expand()` for active operation state
- Verify claimer/pioneer alive counts
- Confirm initial spawn site exists in target room
