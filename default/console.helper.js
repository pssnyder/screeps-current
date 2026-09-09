/**
 * CONSOLE HELPER
 * 
 * Quick commands for testing and debugging in the console
 */

class ConsoleHelper {
    /**
     * Show all available commands
     */
    static help() {
        console.log('═══════════════════════════════════════════');
        console.log('🎮 SCREEPS ENGINE - Console Commands');
        console.log('═══════════════════════════════════════════');
        console.log('');
        console.log('📊 STATUS & INFO:');
        console.log('  help()           - Show this help');
        console.log('  status()         - Show colony status (v2.0 enhanced)');
        console.log('  profile()        - CPU profiling by module');
        console.log('  ticks()          - Show automation trigger cadence');
        console.log('  telemetry(500)   - Rolling KPI summary from Memory stats');
        console.log('  spatial()        - Room layout/pathing efficiency snapshot');
        console.log('  releaseAudit()   - RCL milestone readiness audit');
        console.log('  incidentModeStatus() - Recovery mode and anti-oscillation state');
        console.log('  creeps()         - List all creeps');
        console.log('  strategy()       - Show current strategy');
        console.log('');
        console.log('🚀 SPAWNING:');
        console.log('  SpawnHelper.quick()  - Spawn commands');
        console.log('  SpawnHelper.h()      - Spawn harvester');
        console.log('  SpawnHelper.u()      - Spawn upgrader');
        console.log('  SpawnHelper.b()      - Spawn builder');
        console.log('  SpawnHelper.auto()   - Auto-spawn');
        console.log('  scout("W12N57",...)  - Spawn scout to explore rooms');
        console.log('');
        console.log('🌍 EXPANSION:');
        console.log('  expand()             - Show expansion status');
        console.log('  queueExpansion()     - Queue room for expansion');
        console.log('  enableExpansion()    - Enable expansion system');
        console.log('  disableExpansion()   - Disable expansion system');
        console.log('');
        console.log('🧪 TESTING:');
        console.log('  testEngine.quick()   - Run quick tests');
        console.log('  Analytics.analyze()  - Force analytics');
        console.log('');
        console.log('🔧 DEBUG:');
        console.log('  debug()              - Simulation diagnostics');
        console.log('  planStructures()     - Force structure planning');
        console.log('  killAll(role)        - Kill all creeps of role');
        console.log('  resetHarvesters()    - Reset stuck harvesters to harvest mode');
        console.log('  colonyStatus()       - Show pheromone nest (colony registry)');
        console.log('  Memory.engine        - View engine memory');
        console.log('  Memory.colony        - View colony pheromone registry');
        console.log('  clear()              - Clear screen');
        console.log('═══════════════════════════════════════════');
    }
    
    /**
     * Show current colony status - v2.0 enhanced
     */
    static status() {
        console.log('═══════════════════════════════════════════');
        console.log(`🧠 SCREEPS ENGINE v${Memory.engine.version} - COLONY STATUS`);
        console.log('═══════════════════════════════════════════');
        
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;
            
            console.log(`\n🏰 Room: ${roomName} (RCL ${room.controller.level})`);
            
            // Energy Economy
            const energyPercent = (room.energyAvailable / room.energyCapacityAvailable * 100).toFixed(0);
            console.log(`  ⚡ Energy: ${room.energyAvailable}/${room.energyCapacityAvailable} (${energyPercent}%)`);
            
            if (room.storage) {
                const storageEnergy = room.storage.store[RESOURCE_ENERGY];
                const storageTotal = room.storage.store.getUsedCapacity();
                const storageCap = room.storage.store.getCapacity();
                console.log(`  📦 Storage: ${storageEnergy.toLocaleString()} energy (${storageTotal.toLocaleString()}/${storageCap.toLocaleString()} total)`);
                
                // Show other resources
                const otherResources = [];
                for (const resource in room.storage.store) {
                    if (resource !== RESOURCE_ENERGY && room.storage.store[resource] > 0) {
                        otherResources.push(`${resource}: ${room.storage.store[resource]}`);
                    }
                }
                if (otherResources.length > 0) {
                    console.log(`     Resources: ${otherResources.join(', ')}`);
                }
            }
            
            // Minerals
            const minerals = room.find(FIND_MINERALS);
            if (minerals.length > 0) {
                const m = minerals[0];
                const available = m.mineralAmount > 0 ? m.mineralAmount.toLocaleString() : 'depleted';
                const regen = m.mineralAmount === 0 ? ` (regen in ${m.ticksToRegeneration})` : '';
                console.log(`  💎 Mineral: ${m.mineralType} - ${available}${regen}`);
            }
            
            // Construction Progress
            const sites = room.find(FIND_MY_CONSTRUCTION_SITES);
            if (sites.length > 0) {
                console.log(`  🏗️  Construction: ${sites.length} site(s) active`);
                sites.forEach(s => {
                    const percent = (s.progress / s.progressTotal * 100).toFixed(0);
                    console.log(`     ${s.structureType}: ${percent}%`);
                });
            } else {
                console.log(`  🏗️  Construction: None`);
            }
            
            // Infrastructure
            const towers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
            const extensions = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION });
            const maxExt = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][room.controller.level];
            const maxTower = CONTROLLER_STRUCTURES[STRUCTURE_TOWER][room.controller.level];
            console.log(`  🏢 Infrastructure: ${extensions.length}/${maxExt} ext, ${towers.length}/${maxTower} tower`);
            
            // Creep Population
            const creeps = room.find(FIND_MY_CREEPS);
            const byRole = {};
            creeps.forEach(c => {
                byRole[c.memory.role] = (byRole[c.memory.role] || 0) + 1;
            });
            console.log(`  🤖 Creeps: ${creeps.length} total`);
            for (const role in byRole) {
                console.log(`     ${role}: ${byRole[role]}`);
            }

            // Incident mode summary (recovery controller state)
            const recoveryState = Memory.engine && Memory.engine.recoveryRooms ?
                Memory.engine.recoveryRooms[roomName] : null;
            const recoveryOn = !!(recoveryState && recoveryState.active);
            const cooldownRemaining = recoveryState ? Math.max(0, (recoveryState.cooldownUntil || 0) - Game.time) : 0;
            const upgraderCount = byRole.upgrader || 0;
            const activeUpgraders = recoveryOn ? Math.min(1, upgraderCount) : upgraderCount;
            console.log(`  🩺 Recovery: ${recoveryOn ? 'ON' : 'OFF'} | Cooldown: ${cooldownRemaining} | Active Upgraders: ${activeUpgraders}/${upgraderCount}`);
            
            // Defense
            const hostiles = room.find(FIND_HOSTILE_CREEPS);
            if (hostiles.length > 0) {
                console.log(`  ⚔️  THREAT: ${hostiles.length} hostile(s)!`);
            } else {
                console.log(`  🛡️  Defense: All clear`);
            }
            
            // Controller
            const ctrlPercent = (room.controller.progress / room.controller.progressTotal * 100).toFixed(2);
            console.log(`  📈 Controller: ${ctrlPercent}% to RCL ${room.controller.level + 1}`);
            const downgrade = room.controller.ticksToDowngrade.toLocaleString();
            console.log(`     Downgrade: ${downgrade} ticks`);
        }
        
        // Performance
        console.log('\n⚙️  PERFORMANCE:');
        const cpuUsed = Game.cpu.getUsed().toFixed(2);
        const cpuPercent = (Game.cpu.getUsed() / Game.cpu.limit * 100).toFixed(0);
        console.log(`  CPU: ${cpuUsed}/${Game.cpu.limit} (${cpuPercent}%)`);
        console.log(`  Bucket: ${Game.cpu.bucket}/10000`);
        const memoryKB = (RawMemory.get().length / 1024).toFixed(0);
        console.log(`  Memory: ${memoryKB} KB`);
        
        // Alerts
        console.log('\n⚠️  ALERTS:');
        const alerts = [];
        
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;
            
            if (room.energyAvailable < room.energyCapacityAvailable * 0.3) {
                alerts.push(`${roomName}: Low energy (${(room.energyAvailable / room.energyCapacityAvailable * 100).toFixed(0)}%)`);
            }
            if (room.controller.ticksToDowngrade < 5000) {
                alerts.push(`${roomName}: Downgrade risk (${room.controller.ticksToDowngrade} ticks)`);
            }
            const creeps = room.find(FIND_MY_CREEPS);
            if (creeps.length < 4) {
                alerts.push(`${roomName}: Low creep count (${creeps.length})`);
            }
        }
        
        if (Game.cpu.bucket < 2000) {
            alerts.push('CRITICAL: CPU bucket low!');
        }
        if (Game.cpu.getUsed() > Game.cpu.limit * 0.9) {
            alerts.push('WARNING: CPU usage > 90%');
        }
        
        if (alerts.length === 0) {
            console.log('  ✅ All systems nominal');
        } else {
            alerts.forEach(alert => console.log(`  🔴 ${alert}`));
        }
        
        console.log('═══════════════════════════════════════════');
    }
    
    /**
     * CPU profiling by module - v2.0 new
     */
    static profile() {
        console.log('═══════════════════════════════════════════');
        console.log('⚡ CPU PROFILING - Last Tick');
        console.log('═══════════════════════════════════════════');
        
        if (!Memory.profiling) {
            console.log('\nProfiling not enabled.');
            console.log('Enable in main.js to see module CPU breakdown.');
            console.log('═══════════════════════════════════════════');
            return;
        }
        
        const profile = Memory.profiling;
        const total = profile.total || Game.cpu.getUsed();
        
        console.log(`\nTotal: ${total.toFixed(2)} CPU\n`);
        
        const modules = [];
        for (const key in profile) {
            if (key !== 'total' && key !== 'tick') {
                modules.push({
                    name: key,
                    cpu: profile[key],
                    percent: (profile[key] / total * 100)
                });
            }
        }
        
        modules.sort((a, b) => b.cpu - a.cpu);
        
        modules.forEach(m => {
            const bar = '█'.repeat(Math.ceil(m.percent / 5));
            console.log(`  ${m.name.padEnd(20)} ${m.cpu.toFixed(2).padStart(6)} CPU  ${m.percent.toFixed(1).padStart(5)}%  ${bar}`);
        });
        
        console.log('═══════════════════════════════════════════');
    }

    /**
     * Show trigger cadence for the automation workflow
     */
    static ticks() {
        console.log('═══════════════════════════════════════════');
        console.log('⏱️  AUTOMATION CADENCE');
        console.log('═══════════════════════════════════════════');
        console.log('Every tick:');
        console.log('  Memory cleanup, visuals, Engine.run(), Role execution, expansion manager');
        console.log('Every 3 ticks:');
        console.log('  LinkManager transfer logic, tower healing checks');
        console.log('Every 10 ticks:');
        console.log('  Analytics.recordTick(), tower repair checks');
        console.log('Every 100 ticks:');
        console.log('  Analytics.analyze(), dashboard telemetry, structure planning, status log');
        console.log('Every 1000 ticks:');
        console.log('  Market manager run cycle');
        console.log('Every 1000/5000/10000 ticks:');
        console.log('  Stats pruning / order refresh windows / market memory cleanup');
        console.log('═══════════════════════════════════════════');
    }

    /**
     * Rolling KPI summary from Memory.engine.stats
     */
    static telemetry(window = 500) {
        const safeWindow = Math.max(50, Math.min(5000, window));
        const stats = Memory.engine && Memory.engine.stats ? Memory.engine.stats : {};

        const cpu = this.getSeries(stats, 'performance', 'cpu', safeWindow);
        const energy = this.getSeries(stats, 'economy', 'totalEnergy', safeWindow);
        const storage = this.getSeries(stats, 'economy', 'totalStorage', safeWindow);
        const creeps = this.getSeries(stats, 'population', 'totalCreeps', safeWindow);

        console.log('═══════════════════════════════════════════');
        console.log(`📈 TELEMETRY (${safeWindow} ticks)`);
        console.log('═══════════════════════════════════════════');
        console.log(`Samples: CPU ${cpu.length}, Energy ${energy.length}, Storage ${storage.length}, Creeps ${creeps.length}`);

        this.printSeriesSummary('CPU', cpu, v => v.toFixed(2));
        this.printSeriesSummary('Room Energy', energy, v => Math.round(v).toString());
        this.printSeriesSummary('Stored Energy', storage, v => Math.round(v).toString());
        this.printSeriesSummary('Creep Count', creeps, v => Math.round(v).toString());

        if (Memory.profiling) {
            console.log('\nLast Tick Module CPU:');
            const p = Memory.profiling;
            const keys = Object.keys(p).filter(k => k !== 'total' && k !== 'tick');
            keys.sort((a, b) => p[b] - p[a]);
            keys.forEach(k => console.log(`  ${k}: ${p[k].toFixed(2)}`));
        }

        console.log('═══════════════════════════════════════════');
    }

    /**
     * Spatial diagnostics for pathing and logistics in a room
     */
    static spatial(roomName = null) {
        const room = roomName ? Game.rooms[roomName] : Object.values(Game.rooms).find(r => r.controller && r.controller.my);
        if (!room) {
            console.log('❌ Room not visible. Pass a visible room name: spatial("W0N0")');
            return;
        }

        const spawn = room.find(FIND_MY_SPAWNS)[0];
        const sources = room.find(FIND_SOURCES);
        const containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
        const links = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK });

        console.log('═══════════════════════════════════════════');
        console.log(`🗺️  SPATIAL SNAPSHOT: ${room.name}`);
        console.log('═══════════════════════════════════════════');

        if (!spawn) {
            console.log('No spawn in room; limited diagnostics available.');
        }

        sources.forEach((source, index) => {
            const toSpawn = spawn ? room.findPath(spawn.pos, source.pos, { ignoreCreeps: true }).length : 'n/a';
            const nearContainer = source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            })[0];
            const nearLink = source.pos.findInRange(FIND_MY_STRUCTURES, 2, {
                filter: s => s.structureType === STRUCTURE_LINK
            })[0];

            const containerEnergy = nearContainer ? nearContainer.store[RESOURCE_ENERGY] : 0;
            const containerCap = nearContainer ? nearContainer.store.getCapacity(RESOURCE_ENERGY) : 0;

            console.log(`Source ${index + 1} (${source.pos.x},${source.pos.y})`);
            console.log(`  Path to spawn: ${toSpawn}`);
            console.log(`  Container: ${nearContainer ? `${containerEnergy}/${containerCap}` : 'none'}`);
            console.log(`  Link: ${nearLink ? `${nearLink.store[RESOURCE_ENERGY]}/${nearLink.store.getCapacity(RESOURCE_ENERGY)}` : 'none'}`);
        });

        const extensions = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION });
        const fullExtensions = extensions.filter(e => e.store.getFreeCapacity(RESOURCE_ENERGY) === 0).length;
        const avgContainerFill = containers.length > 0
            ? Math.round((containers.reduce((sum, c) => sum + c.store[RESOURCE_ENERGY], 0) /
                containers.reduce((sum, c) => sum + c.store.getCapacity(RESOURCE_ENERGY), 0)) * 100)
            : 0;

        console.log(`\nLogistics:`);
        console.log(`  Containers: ${containers.length} (avg fill ${avgContainerFill}%)`);
        console.log(`  Links: ${links.length}`);
        console.log(`  Extensions full: ${fullExtensions}/${extensions.length}`);
        console.log('═══════════════════════════════════════════');
    }

    /**
     * RCL milestone audit for release planning
     */
    static releaseAudit() {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 RELEASE READINESS AUDIT (RCL 5-10)');
        console.log('═══════════════════════════════════════════');

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            const rcl = room.controller.level;
            const ext = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION }).length;
            const towers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER }).length;
            const links = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK }).length;
            const labs = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB }).length;
            const terminal = room.terminal ? 'yes' : 'no';
            const storage = room.storage ? 'yes' : 'no';
            const extractor = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR }).length;

            console.log(`\n${roomName} (RCL ${rcl})`);
            console.log(`  Extensions: ${ext}/${CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][rcl]}`);
            console.log(`  Towers: ${towers}/${CONTROLLER_STRUCTURES[STRUCTURE_TOWER][rcl]}`);
            console.log(`  Links: ${links}/${CONTROLLER_STRUCTURES[STRUCTURE_LINK][rcl]}`);
            console.log(`  Storage: ${storage} | Terminal: ${terminal} | Extractor: ${extractor > 0 ? 'yes' : 'no'}`);
            if (rcl >= 6) {
                console.log(`  Labs: ${labs}/${CONTROLLER_STRUCTURES[STRUCTURE_LAB][rcl]}`);
            }
        }

        console.log('═══════════════════════════════════════════');
    }

    /**
     * Show live incident/recovery mode state and guard rails.
     */
    static incidentModeStatus() {
        console.log('═══════════════════════════════════════════');
        console.log('🩺 INCIDENT MODE STATUS');
        console.log('═══════════════════════════════════════════');

        const recoveryMap = Memory.engine && Memory.engine.recoveryRooms ? Memory.engine.recoveryRooms : {};

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            const state = recoveryMap[roomName] || {
                active: false,
                enteredAt: 0,
                cooldownUntil: 0,
                lowEnergyStreak: 0,
                highEnergyStreak: 0,
                reason: 'not initialized'
            };

            const energyPercent = room.energyCapacityAvailable > 0
                ? room.energyAvailable / room.energyCapacityAvailable
                : 0;

            const spawnAndExt = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION
            });

            const totalCap = spawnAndExt.reduce((sum, s) => sum + s.store.getCapacity(RESOURCE_ENERGY), 0);
            const totalEnergy = spawnAndExt.reduce((sum, s) => sum + s.store[RESOURCE_ENERGY], 0);
            const fillRatio = totalCap > 0 ? totalEnergy / totalCap : 1;

            const cooldownRemaining = Math.max(0, (state.cooldownUntil || 0) - Game.time);
            const activeFor = state.active ? (Game.time - (state.enteredAt || Game.time)) : 0;

            console.log(`\n${roomName} (RCL ${room.controller.level})`);
            console.log(`  Recovery: ${state.active ? 'ON' : 'OFF'} | Reason: ${state.reason || 'n/a'}`);
            console.log(`  Energy: ${room.energyAvailable}/${room.energyCapacityAvailable} (${(energyPercent * 100).toFixed(0)}%)`);
            console.log(`  Spawn+Ext Fill: ${(fillRatio * 100).toFixed(0)}%`);
            console.log(`  Low streak: ${state.lowEnergyStreak || 0} | High streak: ${state.highEnergyStreak || 0}`);
            console.log(`  Active for: ${activeFor} ticks | Cooldown remaining: ${cooldownRemaining}`);

            const currentHaulers = room.find(FIND_MY_CREEPS, { filter: c => c.memory.role === 'hauler' }).length;
            const currentUpgraders = room.find(FIND_MY_CREEPS, { filter: c => c.memory.role === 'upgrader' }).length;
            console.log(`  Roles: haulers=${currentHaulers}, upgraders=${currentUpgraders}`);
        }

        console.log('\nThresholds: enter<45% or <200 energy for 5 ticks | exit>80% and fill>85% for 20 ticks');
        console.log('Guard: force disable on >95% energy and >95% fill for 10 ticks | cooldown 100 ticks');
        console.log('═══════════════════════════════════════════');
    }

    static getSeries(stats, category, key, ticksBack) {
        if (!stats[category] || !stats[category][key]) return [];
        const cutoff = Game.time - ticksBack;
        return stats[category][key].filter(s => s.tick >= cutoff).map(s => s.value);
    }

    static printSeriesSummary(label, values, formatter) {
        if (!values || values.length === 0) {
            console.log(`${label}: no data yet`);
            return;
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        const trend = values.length > 1 ? values[values.length - 1] - values[0] : 0;
        const trendLabel = trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat';

        console.log(`${label}: avg ${formatter(avg)} | min ${formatter(min)} | max ${formatter(max)} | trend ${trendLabel}`);
    }
    
    /**
     * Show current strategy decisions
     */
    static strategy() {
        const lastDecision = Memory.engine.decisions ? 
            Memory.engine.decisions[Memory.engine.decisions.length - 1] : null;
        
        if (!lastDecision) {
            console.log('No strategy decisions yet!');
            return;
        }
        
        console.log('═══════════════════════════════════════════');
        console.log(`🎯 CURRENT STRATEGY - Tick ${lastDecision.tick}`);
        console.log('═══════════════════════════════════════════');
        console.log('');
        console.log('📋 PRIORITIES:');
        lastDecision.strategy.priority.forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.type} (weight: ${p.weight})`);
        });
        
        console.log('');
        console.log('🚀 SPAWN QUEUE:');
        if (lastDecision.strategy.spawning.length === 0) {
            console.log('  No spawn needs');
        } else {
            lastDecision.strategy.spawning.slice(0, 5).forEach((s, i) => {
                console.log(`  ${i + 1}. ${s.role} in ${s.room} (priority: ${s.priority})`);
            });
        }
        
        console.log('');
        console.log(`📊 Score: ${lastDecision.score.toFixed(2)}`);
        console.log('═══════════════════════════════════════════');
    }
    
    /**
     * List all creeps with details
     */
    static creeps() {
        console.log('═══════════════════════════════════════════');
        console.log('👥 CREEP LIST');
        console.log('═══════════════════════════════════════════');
        
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            const role = creep.memory.role || 'unknown';
            const working = creep.memory.working ? '🔨' : '🔄';
            const capacity = creep.store.getCapacity(RESOURCE_ENERGY);
            const energy = capacity !== null ? `${creep.store.energy}/${capacity}` : 'spawning';
            const ttl = creep.ticksToLive;
            
            console.log(`${working} ${name}:`);
            console.log(`    Role: ${role} | Energy: ${energy} | TTL: ${ttl}`);
        }
        console.log('═══════════════════════════════════════════');
    }
    
    /**
     * Clear console (just log separator)
     */
    static clear() {
        console.log('\n\n\n\n\n\n\n\n\n\n');
    }
    
    /**
     * Kill a problematic creep
     */
    static kill(creepName) {
        const creep = Game.creeps[creepName];
        if (!creep) {
            console.log(`❌ Creep ${creepName} not found`);
            return;
        }
        creep.suicide();
        console.log(`💀 Killed ${creepName}`);
    }
    
    /**
     * Debug simulation environment
     * Use this to diagnose issues in simulation mode
     */
    static debug() {
        console.log('═══════════════════════════════════════════');
        console.log('🔍 SIMULATION DEBUG');
        console.log('═══════════════════════════════════════════');
        
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            console.log(`\n🏰 Room: ${roomName}`);
            
            // Controller info
            if (room.controller) {
                console.log(`  Controller: RCL ${room.controller.level}, ${room.controller.my ? 'MY' : 'NOT MINE'}`);
                console.log(`  Progress: ${room.controller.progress}/${room.controller.progressTotal}`);
            } else {
                console.log(`  ❌ No controller`);
            }
            
            // Sources
            const sources = room.find(FIND_SOURCES);
            console.log(`  Sources: ${sources.length}`);
            sources.forEach((s, i) => {
                console.log(`    Source ${i}: ${s.energy}/${s.energyCapacity} at (${s.pos.x},${s.pos.y})`);
            });
            
            // Structures
            const spawns = room.find(FIND_MY_SPAWNS);
            const extensions = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_EXTENSION});
            const towers = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_TOWER});
            const containers = room.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER});
            
            console.log(`  Structures:`);
            console.log(`    Spawns: ${spawns.length}`);
            console.log(`    Extensions: ${extensions.length}`);
            console.log(`    Towers: ${towers.length}`);
            console.log(`    Containers: ${containers.length}`);
            
            // Construction sites
            const sites = room.find(FIND_MY_CONSTRUCTION_SITES);
            console.log(`  Construction: ${sites.length} sites`);
            const siteCounts = {};
            sites.forEach(s => {
                siteCounts[s.structureType] = (siteCounts[s.structureType] || 0) + 1;
            });
            for (const type in siteCounts) {
                console.log(`    ${type}: ${siteCounts[type]}`);
            }
            
            // Hostiles
            const hostiles = room.find(FIND_HOSTILE_CREEPS);
            console.log(`  Hostiles: ${hostiles.length}`);
            hostiles.forEach(h => {
                const parts = h.body.map(p => p.type).join(',');
                console.log(`    ${h.owner.username}: [${parts}] at (${h.pos.x},${h.pos.y})`);
            });
            
            // Creeps by role
            const creeps = room.find(FIND_MY_CREEPS);
            const roleCounts = {};
            creeps.forEach(c => {
                const role = c.memory.role || 'unknown';
                roleCounts[role] = (roleCounts[role] || 0) + 1;
            });
            console.log(`  Creeps: ${creeps.length} total`);
            for (const role in roleCounts) {
                console.log(`    ${role}: ${roleCounts[role]}`);
            }
            
            // Energy
            console.log(`  Energy: ${room.energyAvailable}/${room.energyCapacityAvailable}`);
        }
        
        console.log('\n📊 Memory Engine State:');
        if (Memory.engine) {
            console.log(`  Version: ${Memory.engine.version || 'unknown'}`);
            console.log(`  Decisions: ${Memory.engine.decisions ? Memory.engine.decisions.length : 0}`);
        } else {
            console.log(`  ❌ Memory.engine not initialized`);
        }
        
        console.log('═══════════════════════════════════════════');
    }
    
    /**
     * Force structure planning (useful for simulation/debugging)
     * v2.0.1: Enhanced with detailed diagnostics
     */
    static planStructures() {
        const StructurePlanner = require('structure.planner');
        
        console.log('🏗️  Forcing structure planning...');
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;
            
            const rcl = room.controller.level;
            console.log(`\n📐 Planning for ${roomName} (RCL ${rcl})...`);
            
            // Check existing structures
            const extensions = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_EXTENSION
            }).length;
            const towers = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER
            }).length;
            const storage = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_STORAGE
            }).length;
            
            // Check existing construction sites
            const extSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: s => s.structureType === STRUCTURE_EXTENSION
            }).length;
            const towerSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: s => s.structureType === STRUCTURE_TOWER
            }).length;
            
            console.log(`  Current: ${extensions} ext, ${towers} tower, ${storage} storage`);
            console.log(`  Building: ${extSites} ext sites, ${towerSites} tower sites`);
            
            // Calculate what's needed
            const maxExt = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][rcl];
            const maxTower = CONTROLLER_STRUCTURES[STRUCTURE_TOWER][rcl];
            
            console.log(`  Target: ${maxExt} ext (need ${maxExt - extensions - extSites}), ${maxTower} tower (need ${maxTower - towers - towerSites})`);
            
            // Run planner (bypasses throttling by calling directly)
            const beforeSites = room.find(FIND_MY_CONSTRUCTION_SITES).length;
            StructurePlanner.planExtensions(room);
            StructurePlanner.planTower(room);
            StructurePlanner.planContainers(room);
            const afterSites = room.find(FIND_MY_CONSTRUCTION_SITES).length;
            
            console.log(`  Placed: ${afterSites - beforeSites} new sites`);
            
            // Show final state
            const sites = room.find(FIND_MY_CONSTRUCTION_SITES);
            console.log(`  ✅ Total construction sites: ${sites.length}`);
            
            const siteCounts = {};
            sites.forEach(s => {
                siteCounts[s.structureType] = (siteCounts[s.structureType] || 0) + 1;
            });
            for (const type in siteCounts) {
                console.log(`    ${type}: ${siteCounts[type]}`);
            }
        }
        
        console.log('\n✅ Structure planning complete!');
    }
    
    /**
     * Kill all creeps of a specific role
     */
    static killAll(role) {
        if (!role) {
            console.log('❌ Usage: killAll("role")');
            console.log('   Example: killAll("defender")');
            return;
        }
        
        let killed = 0;
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.memory.role === role) {
                creep.suicide();
                killed++;
            }
        }
        
        console.log(`💀 Killed ${killed} ${role}(s)`);
    }

    /**
     * Reset stuck harvester memories (clears working state, targetId, forces harvest mode)
     * Usage: resetHarvesters() - resets all stuck harvesters
     */
    static resetHarvesters() {
        let reset = 0;
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.memory.role === 'harvester') {
                // Force harvest mode
                creep.memory.working = false;
                creep.memory.targetId = null;
                creep.say('🔄 RESET');
                reset++;
            }
        }
        
        console.log(`🔧 Reset ${reset} harvester(s) to harvest mode`);
        console.log('   - Cleared working flag');
        console.log('   - Cleared targetId');
        console.log('   - They will return home on next tick if in wrong room');
    }

    /**
     * Show colony-wide pheromone registry (nest location & worker rooms)
     */
    static colonyStatus() {
        const colony = Memory.colony;
        
        console.log('═══════════════════════════════════════════');
        console.log('🐜 COLONY PHEROMONE REGISTRY (Bio-Inspired)');
        console.log('═══════════════════════════════════════════');
        
        if (!colony) {
            console.log('❌ Colony registry not initialized');
            return;
        }
        
        console.log(`🏠 Home Room (Pheromone Nest): ${colony.homeRoom || 'UNKNOWN'}`);
        console.log('');
        
        if (colony.workerRooms && Object.keys(colony.workerRooms).length > 0) {
            console.log(`👷 Worker Rooms (${Object.keys(colony.workerRooms).length}):`);
            for (const room in colony.workerRooms) {
                console.log(`   - ${room}`);
            }
        } else {
            console.log('👷 Worker Rooms: None configured');
        }
        
        console.log('');
        
        // Show creeps referencing the registry
        let harvesterCount = 0, haulerCount = 0, builderCount = 0;
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.memory.homeRoom === colony.homeRoom) {
                if (creep.memory.role === 'harvester') harvesterCount++;
                if (creep.memory.role === 'hauler') haulerCount++;
                if (creep.memory.role === 'builder') builderCount++;
            }
        }
        
        console.log('📊 Creeps Using Pheromone Registry:');
        console.log(`   Harvesters: ${harvesterCount}`);
        console.log(`   Haulers: ${haulerCount}`);
        console.log(`   Builders: ${builderCount}`);
    }
    
    /**
     * Spawn a scout creep to explore rooms
     * Usage: scout('W12N57', 'W13N56', 'W12N56')
     */
    static scout(...roomNames) {
        if (roomNames.length === 0) {
            console.log('❌ Usage: scout("W12N57", "W13N56", ...)');
            console.log('   Spawns a scout to explore specified rooms');
            return;
        }
        
        const spawn = Object.values(Game.spawns).find(s => !s.spawning);
        if (!spawn) {
            console.log('❌ No available spawns');
            return;
        }
        
        const body = [MOVE]; // Cheap and fast
        const name = `scout_${Game.time}`;
        const memory = {
            role: 'scout',
            targets: roomNames
        };
        
        const result = spawn.spawnCreep(body, name, { memory: memory });
        
        if (result === OK) {
            console.log(`✅ Spawning scout: ${name}`);
            console.log(`   Targets: ${roomNames.join(', ')}`);
        } else {
            console.log(`❌ Failed to spawn scout: ${result}`);
        }
    }
    
    /**
     * Show expansion status
     */
    static expand() {
        if (!Memory.expansion) {
            console.log('❌ Expansion system not initialized');
            return;
        }
        
        console.log('═══════════════════════════════════════════');
        console.log('🌍 EXPANSION STATUS');
        console.log('═══════════════════════════════════════════');
        console.log(`Status: ${Memory.expansion.enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log(`GCL: ${Game.gcl.level} (${Game.gcl.progress}/${Game.gcl.progressTotal})`);
        
        const ownedRoomCount = Object.keys(Game.rooms).filter(r => 
            Game.rooms[r].controller && Game.rooms[r].controller.my
        ).length;
        console.log(`Rooms: ${ownedRoomCount}/${Game.gcl.level}`);
        
        console.log('\n📋 QUEUED TARGETS:');
        if (Memory.expansion.targets && Memory.expansion.targets.length > 0) {
            Memory.expansion.targets.forEach((t, i) => {
                console.log(`  ${i + 1}. ${t.room} (${t.pioneerCount || 3} pioneers)`);
            });
        } else {
            console.log('  None');
        }
        
        console.log('\n🚀 ACTIVE OPERATIONS:');
        if (Memory.expansion.activeOperations && Memory.expansion.activeOperations.length > 0) {
            Memory.expansion.activeOperations.forEach(op => {
                console.log(`  ${op.targetRoom}:`);
                console.log(`    Claimed: ${op.claimed ? '✅' : '⏳'}`);
                console.log(`    Spawn: ${op.spawnBuilt ? '✅' : '⏳'}`);
                console.log(`    Pioneers: ${op.pioneersAlive}`);
            });
        } else {
            console.log('  None');
        }
        
        console.log('\n🏠 OWNED ROOMS:');
        if (Memory.expansion.ownedRooms) {
            for (const roomName in Memory.expansion.ownedRooms) {
                const info = Memory.expansion.ownedRooms[roomName];
                const room = Game.rooms[roomName];
                const rcl = room && room.controller ? room.controller.level : '?';
                console.log(`  ${roomName} - RCL ${rcl} - ${info.status}`);
            }
        }
        
        console.log('═══════════════════════════════════════════');
    }
    
    /**
     * Queue a room for expansion
     * Usage: queueExpansion('W12N57', { pioneerCount: 3, minEnergy: 50000, signText: 'Hello!' })
     */
    static queueExpansion(roomName, options = {}) {
        if (!Memory.expansion) {
            Memory.expansion = {
                enabled: false,
                targets: [],
                ownedRooms: {},
                activeOperations: []
            };
        }
        
        // Check if already queued
        const existing = Memory.expansion.targets.find(t => t.room === roomName);
        if (existing) {
            console.log(`⚠️ ${roomName} already queued`);
            return;
        }
        
        const target = {
            room: roomName,
            pioneerCount: options.pioneerCount || 3,
            minEnergy: options.minEnergy || 50000,
            signText: options.signText || `Claimed by AI - ${new Date().toISOString().split('T')[0]}`
        };
        
        Memory.expansion.targets.push(target);
        console.log(`✅ Queued ${roomName} for expansion`);
        console.log(`   Pioneers: ${target.pioneerCount}`);
        console.log(`   Min Energy: ${target.minEnergy}`);
    }
    
    /**
     * Enable expansion system
     */
    static enableExpansion() {
        if (!Memory.expansion) {
            Memory.expansion = {
                enabled: true,
                targets: [],
                ownedRooms: {},
                activeOperations: []
            };
        } else {
            Memory.expansion.enabled = true;
        }
        console.log('✅ Expansion system ENABLED');
        console.log('   Queue targets with: queueExpansion("W12N57")');
    }
    
    /**
     * Disable expansion system
     */
    static disableExpansion() {
        if (Memory.expansion) {
            Memory.expansion.enabled = false;
        }
        console.log('❌ Expansion system DISABLED');
    }
}

// Expose to global scope
global.help = () => ConsoleHelper.help();
global.status = () => ConsoleHelper.status();
global.profile = () => ConsoleHelper.profile();
global.ticks = () => ConsoleHelper.ticks();
global.telemetry = (window) => ConsoleHelper.telemetry(window);
global.spatial = (roomName) => ConsoleHelper.spatial(roomName);
global.releaseAudit = () => ConsoleHelper.releaseAudit();
global.incidentModeStatus = () => ConsoleHelper.incidentModeStatus();
global.strategy = () => ConsoleHelper.strategy();
global.creeps = () => ConsoleHelper.creeps();
global.debug = () => ConsoleHelper.debug();
global.planStructures = () => ConsoleHelper.planStructures();
global.killAll = (role) => ConsoleHelper.killAll(role);
global.resetHarvesters = () => ConsoleHelper.resetHarvesters();
global.colonyStatus = () => ConsoleHelper.colonyStatus();
global.clear = () => ConsoleHelper.clear();
global.kill = (name) => ConsoleHelper.kill(name);
global.scout = (...rooms) => ConsoleHelper.scout(...rooms);
global.expand = () => ConsoleHelper.expand();
global.queueExpansion = (room, opts) => ConsoleHelper.queueExpansion(room, opts);
global.enableExpansion = () => ConsoleHelper.enableExpansion();
global.disableExpansion = () => ConsoleHelper.disableExpansion();

module.exports = ConsoleHelper;
