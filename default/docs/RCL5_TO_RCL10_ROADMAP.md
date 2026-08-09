# RCL5 to RCL10 Roadmap

This roadmap translates your current RCL5 state into staged milestones with concrete module expectations and acceptance checks.

## RCL5 (Now): Logistics Stabilization

Primary outcomes:

- Source container harvesting is stable.
- Link network (source -> spawn/controller) is operational.
- Spawn uptime remains high without energy starvation.

Module focus:

- `decision.tree.js`: Ensure hauler count scales down when links become operational.
- `structure.planner.js`: Confirm link placement completes quickly.
- `link.manager.js`: Verify frequent successful transfers and low idle source-link energy.

Acceptance checks:

- `releaseAudit()` shows link progress matching RCL5 cap.
- `spatial()` shows source logistics structures in place.
- `telemetry(500)` shows non-degrading room energy trend.

## RCL6: Mineral and Market Activation

Primary outcomes:

- Extractor and terminal are online.
- Miner role activates only when infrastructure and mineral availability are valid.
- Market automation starts producing safe sell orders.

Module focus:

- `structure.planner.js`: Extractor, terminal, first lab placements.
- `role.miner.js`: Safe mine/deliver behavior and fallback handling.
- `market.manager.js`: Price sampling, order competitiveness, controlled order volume.

Acceptance checks:

- `releaseAudit()` shows extractor + terminal present.
- `status()` confirms mineral visibility and storage state.
- Market logs show no repeated error states.

## RCL7: Throughput and Upgrade Speed

Primary outcomes:

- Logistics and upgrade pipeline support faster control progression.
- Repair/defense automation remains stable under greater infrastructure load.

Module focus:

- `tower.controller.js`: Repair throttles and defense priority balance.
- `decision.tree.js`: Upgrader and builder ratios tuned for growth without starvation.
- `structure.planner.js`: Additional links/labs as allowed.

Acceptance checks:

- Controller progress trend improves over previous window.
- CPU remains within target envelope under higher creep counts.

## RCL8: Maturity and Multi-Room Expansion Foundation

Primary outcomes:

- Home room infrastructure is effectively complete and resilient.
- Expansion system can be safely enabled without destabilizing economy.

Module focus:

- `expansion.manager.js`: Tight prerequisites and operation health tracking.
- `role.claimer.js` / `role.pioneer.js`: Deterministic colonization workflow.
- `expansion.scout.js` + `role.scout.js`: Better target quality filtering.

Acceptance checks:

- `expand()` shows clean operation lifecycle.
- New-room bootstrap reaches self-sufficient spawn state.

## RCL9-RCL10 (Planning Horizon)

Note: In official Screeps, room controller max is RCL8. Treat RCL9-RCL10 as program milestones for portfolio-scale automation maturity.

RCL9 milestone definition (portfolio milestone):

- Two-room+ stable operation with no chronic CPU or energy crises.
- Expansion, scouting, and market loops coexist without starvation.

RCL10 milestone definition (portfolio milestone):

- Standardized release process and automated health gates.
- Strategy layer supports rule profiles (economy, defense, expansion modes).
- Repeatable owner dashboard workflow for any room in under 2 minutes.

## Suggested Next Release Backlog

1. Add lightweight transfer metrics in `link.manager.js` to quantify throughput over time.
2. Extend `analytics.js` with role-level population trends (sampled, not every tick).
3. Add simple release gate flags to memory (pass/fail checks for CPU, energy, infra).
4. Add room-level mode toggles (`economy`, `defense`, `expansion`) consumed by `decision.tree.js`.

## Release Gate Template

Before promoting a release:

1. `telemetry(1000)` shows stable or improved CPU and economy metrics.
2. `spatial()` confirms no major logistics gaps.
3. `releaseAudit()` confirms expected infra for current milestone.
4. No repeating high-severity console errors for 1000+ ticks.
