/**
 * DECISION TREE
 * 
 * Chess-engine style move generation and search
 * Generates possible strategies and selects the best one
 */

class DecisionTree {
    /**
     * Generate strategic decisions based on game state
     * Similar to move generation in chess engines
     */
    static generateStrategy(gameState) {
        const strategy = {
            priority: this.determinePriority(gameState),
            spawning: this.generateSpawnDecisions(gameState),
            assignments: this.generateRoleAssignments(gameState),
            defense: this.generateDefenseStrategy(gameState),
            expansion: this.shouldExpandRoom(gameState)
        };
        
        // Store decision for learning
        if (!Memory.engine.decisions) {
            Memory.engine.decisions = [];
        }
        Memory.engine.decisions.push({
            tick: Game.time,
            strategy: strategy,
            score: gameState.score
        });
        
        // Keep only last 1000 decisions
        if (Memory.engine.decisions.length > 1000) {
            Memory.engine.decisions.shift();
        }
        
        return strategy;
    }
    
    /**
     * Determine strategic priority based on evaluation
     * Like determining game phase in chess (opening, middlegame, endgame)
     */
    static determinePriority(gameState) {
        const priorities = [];
        
        // Defense is always highest priority if threatened
        if (gameState.threats.length > 0) {
            priorities.push({ type: 'DEFENSE', weight: 10 });
        }
        
        // Economic development priority
        const avgRoomLevel = Object.values(gameState.rooms).reduce(
            (sum, room) => sum + (room.control && room.control.level ? room.control.level : 0), 0
        ) / Object.keys(gameState.rooms).length;

        const recoveryActive = this.anyRecoveryActive();
        
        if (recoveryActive) {
            priorities.push({ type: 'ECONOMY', weight: 10 });
        } else if (avgRoomLevel < 4) {
            priorities.push({ type: 'ECONOMY', weight: 8 });
        } else {
            priorities.push({ type: 'ECONOMY', weight: 5 });
        }
        
        // Upgrade priority based on controller level
        priorities.push({ 
            type: 'UPGRADE', 
            weight: recoveryActive ? 3 : (avgRoomLevel < 8 ? 7 : 9)
        });
        
        // Building priority if construction sites exist
        const sites = (typeof Game !== 'undefined' && Game.constructionSites) ? 
            Object.keys(Game.constructionSites).length : 0;
        if (sites > 0) {
            priorities.push({ type: 'BUILD', weight: 6 });
        }
        
        // Expansion priority for higher levels
        if (avgRoomLevel >= 4 && Object.keys(gameState.rooms).length < 3) {
            priorities.push({ type: 'EXPAND', weight: 4 });
        }
        
        // Sort by weight
        priorities.sort((a, b) => b.weight - a.weight);
        
        return priorities;
    }
    
    /**
     * Generate optimal spawn decisions
     * Like piece development in chess - what pieces to develop and when
     */
    static generateSpawnDecisions(gameState) {
        const decisions = [];
        
        for (const roomName in gameState.rooms) {
            const roomEval = gameState.rooms[roomName];
            const room = (typeof Game !== 'undefined' && Game.rooms) ? Game.rooms[roomName] : null;
            
            // Calculate optimal creep composition
            const creepCounts = room ? this.countCreepsByRole(room) : {};
            const sourceCount = roomEval.resources && roomEval.resources.sources ? 
                roomEval.resources.sources.length : 2;
            const rcl = room ? room.controller.level : 1;
            const energyPercent = room ? (room.energyAvailable / room.energyCapacityAvailable) : 0;
            const recovery = room ? this.updateRecoveryState(room, rcl) : { active: false, emergency: false, stateChanged: false };
            const isEmergencyEnergy = recovery.emergency;
            const isRecoveryMode = recovery.active;
            
            // v2.0.3: Smart creep composition based on RCL and energy state
            // At RCL 4+, we have containers - need more haulers, fewer harvesters
            const hasContainers = room && room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            }).length > 0;
            
            // Harvester count: 1 per source (sits on container) at RCL 4+
            // At lower RCL, 2 per source for flexibility
            let targetHarvesters;
            if (rcl >= 4 && hasContainers) {
                targetHarvesters = sourceCount; // 1 per source (static harvesters)
            } else if (rcl >= 3) {
                targetHarvesters = sourceCount + 1; // 2-3 harvesters
            } else {
                targetHarvesters = sourceCount * 2; // 4 harvesters early game
            }
            
            // Hauler count: scale with RCL and containers
            // v3.1: Increased haulers at RCL 5 until links are operational
            let targetHaulers = 0;
            if (hasContainers && rcl >= 5) {
                // RCL 5: 3 haulers to handle 30 extensions before links kick in
                const hasLinks = room && room.find(FIND_MY_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_LINK
                }).length >= 2;
                targetHaulers = hasLinks ? 1 : 3; // 3 until links operational, then 1
            } else if (hasContainers && rcl >= 3) {
                targetHaulers = Math.max(2, sourceCount); // 2+ haulers with containers
            } else if (rcl >= 2) {
                targetHaulers = 1; // 1 hauler at RCL 2-3
            }

            // Emergency logistics recovery: add a bounded boost, never "current + N"
            // to avoid runaway over-spawning.
            if (isRecoveryMode) {
                const recoveryBoost = hasContainers ? 2 : 0;
                const hardCap = Math.max(2, sourceCount * 2 + 1);
                targetHaulers = Math.min(targetHaulers + recoveryBoost, hardCap);
            }
            
            // Builder count: scale with construction sites and energy
            const sites = room ? room.find(FIND_MY_CONSTRUCTION_SITES).length : 0;
            let targetBuilders = 0;
            if (sites > 0) {
                if (energyPercent < 0.3) {
                    targetBuilders = 1; // Low energy: only 1 builder
                } else if (sites > 5 && rcl >= 4) {
                    targetBuilders = 3; // Many sites: 3 builders
                } else {
                    targetBuilders = 2; // Normal: 2 builders
                }
            }
            
            // Upgrader count: scale with RCL
            let targetUpgraders = 3;
            if (rcl >= 5) {
                targetUpgraders = 4; // More upgraders at higher RCL
            } else if (energyPercent < 0.3 && rcl <= 3) {
                targetUpgraders = 2; // Low energy early game: fewer upgraders
            }

            // Recovery mode: throttle upgraders until room energy buffer recovers.
            if (isRecoveryMode) {
                targetUpgraders = 1;
            }
            
            // v3.0: Miner count for mineral harvesting (RCL 6+)
            let targetMiners = 0;
            if (rcl >= 6) {
                // Check if we have extractor and terminal/storage
                const extractor = room && room.find(FIND_MY_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_EXTRACTOR
                }).length > 0;
                
                const hasStorage = room && (room.terminal || room.storage);
                
                // Check if mineral is available
                const mineral = room && room.find(FIND_MINERALS)[0];
                const mineralAvailable = mineral && mineral.mineralAmount > 0;
                
                // Only spawn miner if we have infrastructure and minerals
                if (extractor && hasStorage && mineralAvailable) {
                    targetMiners = 1; // One miner per room
                }
            }
            
            // Determine what to spawn based on needs
            const needs = {
                harvester: Math.max(0, targetHarvesters - (creepCounts.harvester || 0)),
                hauler: Math.max(0, targetHaulers - (creepCounts.hauler || 0)),
                upgrader: Math.max(0, targetUpgraders - (creepCounts.upgrader || 0)),
                builder: Math.max(0, targetBuilders - (creepCounts.builder || 0)),
                miner: Math.max(0, targetMiners - (creepCounts.miner || 0))
            };

            // In critical starvation, do not add more builders to spawn queue.
            if (isEmergencyEnergy) {
                needs.builder = 0;
            }
            
            // EMERGENCY: If we have less than 1 harvester, CRITICAL PRIORITY
            if ((creepCounts.harvester || 0) < 1) {
                needs.harvester = 2; // Emergency spawn
            }
            
            // Note: Builder scaling now handled above in needs calculation
            
            // Debug logging
            if (Game.time % 100 === 0) {
                const totalCreeps = Object.values(creepCounts).reduce((sum, n) => sum + n, 0);
                console.log(`[Strategy] ${roomName} (RCL ${rcl}): ${totalCreeps} creeps - needs H:${needs.harvester} Hauler:${needs.hauler} U:${needs.upgrader} B:${needs.builder}`);
                if (energyPercent < 0.3) {
                    console.log(`  ⚠️ Low energy (${(energyPercent*100).toFixed(0)}%) - reduced builder/upgrader spawns`);
                }
                if (isRecoveryMode) {
                    console.log('  🩺 Recovery mode active: upgrader throttled, hauler surge enabled');
                }
                if (recovery.stateChanged) {
                    console.log(`  🔁 Recovery mode ${recovery.active ? 'ENABLED' : 'DISABLED'} (${recovery.reason})`);
                }
            }
            
            // Defense needs - v2.0 smart defense (capped)
            if (roomEval.military && roomEval.military.threats && roomEval.military.threats.length > 0) {
                const currentDefenders = creepCounts.defender || 0;
                const hostileCount = roomEval.military.threats.length;
                const rcl = room ? room.controller.level : 1;
                
                // At RCL 3+, towers can handle defense - reduce defender need
                const hasTowers = room && room.find(FIND_MY_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_TOWER
                }).length > 0;
                
                let targetDefenders;
                if (hasTowers) {
                    // With towers, only spawn 1 defender for cleanup
                    targetDefenders = Math.min(1, hostileCount);
                } else {
                    // Without towers, cap defenders at 3
                    targetDefenders = Math.min(3, hostileCount + 1);
                }
                
                needs.defender = Math.max(0, targetDefenders - currentDefenders);
                
                // CRITICAL: Don't spawn defenders if economy is failing
                // If we have < 2 harvesters, defenders will starve anyway
                if ((creepCounts.harvester || 0) < 2) {
                    needs.defender = 0;
                    console.log(`[Defense] Skipping defender spawn - economy too weak (${creepCounts.harvester || 0} harvesters)`);
                }
            }

            // Cross-room expansion: detect harvesters working in adjacent rooms
            if (room) {
                const harvestersInAdjacentRooms = this.findHarvestersInAdjacentRooms(room);
                
                if (harvestersInAdjacentRooms.length > 0) {
                    // Spawn sentinels to protect harvesters (1 per 2 harvesters)
                    const currentSentinels = creepCounts.sentinel || 0;
                    const targetSentinels = Math.ceil(harvestersInAdjacentRooms.length / 2);
                    needs.sentinel = Math.max(0, targetSentinels - currentSentinels);
                    
                    // Find the adjacent room and check if we should claim it
                    const adjacentRoomName = harvestersInAdjacentRooms[0].memory.room || harvestersInAdjacentRooms[0].room.name;
                    const adjacentRoom = Game.rooms[adjacentRoomName];
                    
                    if (adjacentRoom && adjacentRoom.controller) {
                        const shouldClaimAdjacentRoom = !adjacentRoom.controller.my && !adjacentRoom.controller.owner;
                        
                        if (shouldClaimAdjacentRoom) {
                            // Only claim if we have stable economy (energy > 30%)
                            if (energyPercent > 0.30 && !isRecoveryMode) {
                                const currentClaimers = creepCounts.claimer || 0;
                                needs.claimer = Math.max(0, 1 - currentClaimers);
                                
                                if (Game.time % 50 === 0) {
                                    console.log(`[Expansion] Harvesters in ${adjacentRoomName} - spawning claimer to claim room`);
                                }
                            }
                        }
                    }
                }
            }
            
            // Convert needs to spawn queue
            for (const role in needs) {
                if (needs[role] > 0) {
                    const decision = {
                        room: roomName,
                        role: role,
                        priority: this.getSpawnPriority(role, needs),
                        body: room ? this.generateOptimalBody(role, room) : [WORK, CARRY, MOVE]
                    };
                    
                    // For claimers, set the target room
                    if (role === 'claimer' && room) {
                        const adjacent = this.findHarvestersInAdjacentRooms(room);
                        if (adjacent.length > 0) {
                            decision.targetRoom = adjacent[0].room.name;
                        }
                    }
                    
                    decisions.push(decision);
                }
            }
        }
        
        // Sort by priority
        decisions.sort((a, b) => b.priority - a.priority);
        
        return decisions;
    }
    
    /**
     * Find harvesters that are working in adjacent rooms (cross-room harvesting)
     */
    static findHarvestersInAdjacentRooms(room) {
        const adjacent = [];
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.memory.role === 'harvester' && creep.memory.room === room.name) {
                // Creep is assigned to this room, but check if physically elsewhere
                if (creep.room.name !== room.name) {
                    adjacent.push(creep);
                }
            }
        }
        return adjacent;
    }

    /**
     * Count creeps by role assigned to a room
     * Counts ALL creeps assigned to the room, not just those physically in it
     */
    static countCreepsByRole(room) {
        const counts = {};
        
        // Count ALL creeps assigned to this room
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.memory.room === room.name || (!creep.memory.room && creep.room.name === room.name)) {
                const role = creep.memory.role || 'unknown';
                counts[role] = (counts[role] || 0) + 1;
            }
        }
        
        return counts;
    }
    
    /**
     * Determine spawn priority for a role
     * v2.0.3: Boost hauler priority at RCL 4+ (containers need haulers)
     * v3.0: Add miner priority (medium-low, after economy stabilizes)
     * v3.2: Add sentinel and claimer priorities for expansion
     */
    static getSpawnPriority(role, needs) {
        const priorities = {
            harvester: 10,  // Highest - economy is critical
            sentinel: 9.5,  // v3.2: High priority - protect harvesters in danger
            defender: 9,    // Defense is crucial
            claimer: 8.5,   // v3.2: High - claim rooms for expansion
            miner: 4,       // v3.0: Medium-low priority (after economy stable)
            hauler: 8,      // v2.0.3: Increased from 7 (critical at RCL 4+)
            upgrader: 6,    // Important but not urgent
            builder: 5      // Lowest - can wait if needed
        };
        
        // Boost priority if critical shortage
        let priority = priorities[role] || 1;
        
        // EMERGENCY: No harvesters = critical
        if (role === 'harvester' && needs[role] >= 2) {
            priority = 100; // Emergency priority
        }
        
        // Boost other roles if shortage
        if (needs[role] >= 3) priority += 2;
        
        return priority;
    }
    
    /**
     * Generate optimal body configuration for a role
     * Like choosing piece types in chess based on position
     * v3.0: Added miner body generation
     */
    static generateOptimalBody(role, room) {
        const energyAvailable = room.energyCapacityAvailable;
        
        // Body templates
        const templates = {
            harvester: () => this.buildBody(energyAvailable, [WORK, WORK, CARRY, MOVE]),
            upgrader: () => this.buildBody(energyAvailable, [WORK, CARRY, MOVE]),
            builder: () => this.buildBody(energyAvailable, [WORK, CARRY, MOVE, MOVE]),
            // 1:1 ratio improves speed on long source-to-base routes.
            hauler: () => this.buildBody(energyAvailable, [CARRY, MOVE]),
            defender: () => this.buildBody(energyAvailable, [TOUGH, ATTACK, MOVE]),
            sentinel: () => this.buildBody(energyAvailable, [RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, TOUGH, TOUGH]),
            claimer: () => this.buildBody(energyAvailable, [TOUGH, TOUGH, CLAIM, MOVE, MOVE]),
            miner: () => this.buildBody(energyAvailable, [WORK, WORK, CARRY, MOVE]) // v3.0: Miner pattern
        };
        
        return templates[role] ? templates[role]() : [WORK, CARRY, MOVE];
    }

    /**
     * Stateful recovery mode with hysteresis and cooldown.
     * Prevents rapid mode flapping when room energy hovers around thresholds.
     */
    static updateRecoveryState(room, rcl) {
        const defaults = {
            active: false,
            enteredAt: 0,
            lastChange: 0,
            cooldownUntil: 0,
            lowEnergyStreak: 0,
            highEnergyStreak: 0,
            reason: 'initial'
        };

        if (!Memory.engine.recoveryRooms) {
            Memory.engine.recoveryRooms = {};
        }

        const state = Memory.engine.recoveryRooms[room.name] || { ...defaults };
        const energyPercent = room.energyCapacityAvailable > 0 ? room.energyAvailable / room.energyCapacityAvailable : 0;
        const spawnFill = this.getSpawnExtensionFillRatio(room);

        const enterEnergyPercent = 0.45;
        const enterAbsoluteEnergy = 200;
        const exitEnergyPercent = 0.80;
        const exitFillPercent = 0.85;
        const lowStreakNeeded = 5;
        const highStreakNeeded = 20;
        const cooldownTicks = 100;
        const maxRecoveryTicks = 1500;

        // Overcorrection guard: if room is very full for sustained period, force disable.
        const overfillEnergyPercent = 0.95;
        const overfillFillPercent = 0.95;
        const overfillStreakNeeded = 10;

        const lowCondition = rcl >= 5 && (energyPercent < enterEnergyPercent || room.energyAvailable < enterAbsoluteEnergy);
        const highCondition = energyPercent > exitEnergyPercent && spawnFill > exitFillPercent;
        const overfillCondition = energyPercent > overfillEnergyPercent && spawnFill > overfillFillPercent;

        state.lowEnergyStreak = lowCondition ? state.lowEnergyStreak + 1 : 0;
        state.highEnergyStreak = (highCondition || overfillCondition) ? state.highEnergyStreak + 1 : 0;

        let stateChanged = false;
        let reason = state.reason || 'steady';

        if (!state.active) {
            if (Game.time >= state.cooldownUntil && state.lowEnergyStreak >= lowStreakNeeded) {
                state.active = true;
                state.enteredAt = Game.time;
                state.lastChange = Game.time;
                stateChanged = true;
                reason = `energy low for ${state.lowEnergyStreak} ticks`;
                console.log(`[Recovery] ${room.name}: ENABLED (${reason})`);
            }
        } else {
            const activeDuration = Game.time - state.enteredAt;
            const timedOut = activeDuration >= maxRecoveryTicks;
            const recovered = state.highEnergyStreak >= highStreakNeeded;
            const overcorrected = state.highEnergyStreak >= overfillStreakNeeded && overfillCondition;

            if (overcorrected) {
                state.active = false;
                state.lastChange = Game.time;
                state.cooldownUntil = Game.time + cooldownTicks;
                stateChanged = true;
                reason = `overcorrection guard (${Math.round(energyPercent * 100)}% energy, ${Math.round(spawnFill * 100)}% fill)`;
                console.log(`[Recovery] ${room.name}: DISABLED (${reason})`);
            } else if (recovered || timedOut) {
                state.active = false;
                state.lastChange = Game.time;
                state.cooldownUntil = Game.time + cooldownTicks;
                stateChanged = true;
                reason = timedOut ? `timeout ${activeDuration} ticks` : `stable recovery for ${state.highEnergyStreak} ticks`;
                console.log(`[Recovery] ${room.name}: DISABLED (${reason})`);
            }
        }

        state.reason = reason;
        Memory.engine.recoveryRooms[room.name] = state;

        return {
            active: state.active,
            emergency: room.energyAvailable < 100,
            stateChanged,
            reason,
            energyPercent,
            spawnFill,
            lowEnergyStreak: state.lowEnergyStreak,
            highEnergyStreak: state.highEnergyStreak,
            cooldownUntil: state.cooldownUntil,
            enteredAt: state.enteredAt,
            lastChange: state.lastChange
        };
    }

    static getSpawnExtensionFillRatio(room) {
        const structures = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION
        });

        if (structures.length === 0) return 1;

        const totalCap = structures.reduce((sum, s) => sum + s.store.getCapacity(RESOURCE_ENERGY), 0);
        if (totalCap <= 0) return 1;

        const totalEnergy = structures.reduce((sum, s) => sum + s.store[RESOURCE_ENERGY], 0);
        return totalEnergy / totalCap;
    }
    
    /**
     * Build body parts array within energy constraints
     */
    static buildBody(energy, pattern) {
        const body = [];
        const cost = pattern.reduce((sum, part) => sum + BODYPART_COST[part], 0);
        
        let iterations = Math.floor(energy / cost);
        iterations = Math.min(iterations, Math.floor(50 / pattern.length)); // Max 50 parts
        
        for (let i = 0; i < iterations; i++) {
            body.push(...pattern);
        }
        
        return body.length > 0 ? body : [WORK, CARRY, MOVE];
    }
    
    /**
     * Generate role assignments for creeps
     */
    static generateRoleAssignments(gameState) {
        // Dynamic role reassignment based on needs
        // This could be expanded to reassign creeps mid-game
        return {};
    }
    
    /**
     * Generate defense strategy
     */
    static generateDefenseStrategy(gameState) {
        const strategy = {
            active: false,
            defenders: 0,
            towerTargets: []
        };
        
        if (gameState.threats.length > 0) {
            strategy.active = true;
            strategy.defenders = gameState.threats.length * 2;
        }
        
        return strategy;
    }
    
    /**
     * Evaluate if room should expand to new rooms
     */
    static shouldExpandRoom(gameState) {
        // Expansion logic - similar to chess expansion/space control
        for (const roomName in gameState.rooms) {
            const roomEval = gameState.rooms[roomName];
            if (roomEval.control.level >= 4 && roomEval.resources.stored > 50000) {
                return true;
            }
        }
        return false;
    }

    static anyRecoveryActive() {
        if (!Memory.engine || !Memory.engine.recoveryRooms) return false;
        for (const roomName in Memory.engine.recoveryRooms) {
            if (Memory.engine.recoveryRooms[roomName].active) {
                return true;
            }
        }
        return false;
    }
}

module.exports = DecisionTree;
