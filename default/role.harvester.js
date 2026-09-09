/**
 * HARVESTER ROLE
 * 
 * Intelligent energy harvesting with optimal source selection
 * v2.0.3: Static harvester mode at RCL 4+ (sits on container)
 */

class RoleHarvester {
    static run(creep, strategy) {
        // Initialize stats if missing
        if (!creep.memory.stats) {
            creep.memory.stats = {
                energyHarvested: 0,
                energyDelivered: 0,
                upgraded: 0,
                built: 0,
                repaired: 0
            };
        }
        
        // BIO-INSPIRED: Reference the colony pheromone nest (global home room)
        // All workers use this shared home room registry
        const colonyHomeRoom = Memory.colony && Memory.colony.homeRoom;
        if (!colonyHomeRoom) return;  // Colony not initialized
        
        // Set individual homeRoom from colony registry (pheromone trail)
        if (!creep.memory.homeRoom) {
            creep.memory.homeRoom = colonyHomeRoom;
        }
        
        // PHASE 1: Check for hostile creeps and flee if detected (throttled every 3 ticks)
        if (Game.time % 3 === 0) {
            if (this.checkForHostiles(creep)) {
                this.flee(creep);
                return; // Abort all other actions
            }
        }
        
        // v2.0.3: Check if we should be a static harvester (RCL 4+)
        const room = creep.room;
        const rcl = room.controller.level;
        
        if (rcl >= 4 && !creep.memory.staticHarvester) {
            // Try to find a container near a source to claim
            const containers = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            });
            
            for (const container of containers) {
                const nearbySource = container.pos.findInRange(FIND_SOURCES, 1);
                if (nearbySource.length > 0) {
                    // Check if another harvester already claimed this container
                    const otherHarvester = _.find(Game.creeps, c => 
                        c.memory.role === 'harvester' &&
                        c.memory.containerId === container.id &&
                        c.id !== creep.id
                    );
                    
                    if (!otherHarvester) {
                        // Claim this container and source
                        creep.memory.staticHarvester = true;
                        creep.memory.containerId = container.id;
                        creep.memory.sourceId = nearbySource[0].id;
                        console.log(`[Harvester] ${creep.name} assigned to static position at container ${container.id}`);
                        break;
                    }
                }
            }
        }
        
        // Static harvester mode: stay at container and harvest continuously
        if (creep.memory.staticHarvester) {
            this.staticHarvest(creep);
            return;
        }
        
        // Mobile harvester mode (RCL < 4 or no containers)
        // State machine: harvesting -> delivering
        if (creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🚚 deliver');
        }
        if (creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('⛏️ harvest');
        }
        
        if (!creep.memory.working) {
            this.harvest(creep);
        } else {
            this.deliver(creep);
        }
    }
    
    /**
     * Static harvester: sit on container and harvest continuously
     * Energy drops into container, haulers will move it
     */
    static staticHarvest(creep) {
        const container = Game.getObjectById(creep.memory.containerId);
        const source = Game.getObjectById(creep.memory.sourceId);
        
        // If container destroyed, switch back to mobile mode
        if (!container || !source) {
            console.log(`[Harvester] ${creep.name} lost container/source, switching to mobile mode`);
            delete creep.memory.staticHarvester;
            delete creep.memory.containerId;
            delete creep.memory.sourceId;
            return;
        }
        
        // Move to container if not on it
        if (!creep.pos.isEqualTo(container.pos)) {
            creep.moveTo(container, {
                visualizePathStyle: { stroke: '#ffaa00' },
                reusePath: 20
            });
            return;
        }
        
        // v3.1: Check for adjacent link first (RCL 5+)
        const nearbyLink = creep.pos.findInRange(FIND_MY_STRUCTURES, 1, {
            filter: s => s.structureType === STRUCTURE_LINK && 
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        // If we have energy and there's a link, transfer to it
        if (nearbyLink.length > 0 && creep.store[RESOURCE_ENERGY] > 0) {
            const link = nearbyLink[0];
            if (creep.transfer(link, RESOURCE_ENERGY) === OK) {
                creep.memory.stats.energyDelivered += creep.store[RESOURCE_ENERGY];
            }
        }
        
        // Harvest continuously
        const result = creep.harvest(source);
        if (result === OK) {
            const workParts = creep.body.filter(p => p.type === WORK).length;
            creep.memory.stats.energyHarvested += workParts * 2;
        }
        
        // If container is getting full and we're full, drop energy on ground
        if (creep.store.getFreeCapacity() === 0 && 
            container.store.getFreeCapacity(RESOURCE_ENERGY) < 100) {
            creep.drop(RESOURCE_ENERGY);
        }
    }
    
    /**
     * Harvest energy from source (mobile mode)
     */
    static harvest(creep) {
        // Find or remember source
        let source = null;
        
        if (creep.memory.sourceId) {
            source = Game.getObjectById(creep.memory.sourceId);
        }
        
        if (!source) {
            // Intelligent source selection: choose least crowded source
            const sources = creep.room.find(FIND_SOURCES_ACTIVE);
            
            if (sources.length === 0) {
                // No active sources, wait
                return;
            }
            
            // Count creeps at each source
            const sourceCrowding = sources.map(s => {
                const nearbyCreeps = s.pos.findInRange(FIND_MY_CREEPS, 1, {
                    filter: c => c.memory.sourceId === s.id || !c.memory.sourceId
                });
                return { source: s, count: nearbyCreeps.length };
            });
            
            // Select least crowded
            sourceCrowding.sort((a, b) => a.count - b.count);
            source = sourceCrowding[0].source;
            creep.memory.sourceId = source.id;
        }
        
        // Harvest
        const result = creep.harvest(source);
        
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, {
                visualizePathStyle: { stroke: '#ffaa00' },
                reusePath: 10
            });
        } else if (result === OK) {
            // Track harvested energy
            const workParts = creep.body.filter(p => p.type === WORK).length;
            creep.memory.stats.energyHarvested += workParts * 2;
        }
    }
    
    /**
     * Deliver energy to spawn/extensions (mobile mode)
     */
    static deliver(creep) {
        // Intelligent target selection
        let target = null;
        
        if (creep.memory.targetId) {
            target = Game.getObjectById(creep.memory.targetId);
            // Validate target exists and has capacity
            if (target && target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                target = null;
                creep.memory.targetId = null;
            } else if (!target) {
                // Target destroyed or invalid
                creep.memory.targetId = null;
            }
        }
        
        if (!target) {
            // Priority order: spawns, extensions, towers, storage
            const targets = creep.room.find(FIND_MY_STRUCTURES, {
                filter: s => {
                    return (s.structureType === STRUCTURE_SPAWN ||
                            s.structureType === STRUCTURE_EXTENSION ||
                            s.structureType === STRUCTURE_TOWER) &&
                           s.store &&
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            
            if (targets.length > 0) {
                target = creep.pos.findClosestByPath(targets);
            }
            
            if (!target) {
                // If no spawn/extension needs energy, deposit in storage
                const storage = creep.room.storage;
                if (storage && storage.store && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    target = storage;
                }
            }
            
            if (!target) {
                // Last resort: upgrade controller (only if it's ours)
                if (creep.room.controller && creep.room.controller.my) {
                    target = creep.room.controller;
                }
            }
            
            if (target) {
                creep.memory.targetId = target.id;
            }
        }
        
        if (!target) return;
        
        let result;
        if (target.structureType === STRUCTURE_CONTROLLER) {
            result = creep.upgradeController(target);
        } else {
            result = creep.transfer(target, RESOURCE_ENERGY);
        }
        
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                visualizePathStyle: { stroke: '#ffffff' },
                reusePath: 10
            });
        } else if (result === OK) {
            creep.memory.stats.energyDelivered += creep.store[RESOURCE_ENERGY];
            creep.memory.targetId = null; // Clear target after successful delivery
        } else if (result === ERR_INVALID_TARGET || result === ERR_FULL) {
            // Target is invalid or full, clear it
            creep.memory.targetId = null;
        }
    }

    /**
     * PHASE 1: Check for hostile creeps nearby
     * Scans 10+ squares, returns true if threat detected
     */
    static checkForHostiles(creep) {
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS, {
            filter: h => creep.pos.getRangeTo(h) <= 12
        });
        
        if (hostiles.length > 0) {
            creep.memory.fleeing = true;
            creep.memory.lastHostileTick = Game.time;
            return true;
        }
        
        return false;
    }

    /**
     * PHASE 1: Flee toward home/safety
     * Priority: 1) Spawn/Storage, 2) Room center, 3) Away from hostiles
     */
    static flee(creep) {
        // Find nearest exit or spawn to flee toward
        let target = null;
        
        // Priority 1: Spawn (safest zone)
        const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
        if (spawn) {
            target = spawn;
        } else {
            // Priority 2: Storage
            if (creep.room.storage) {
                target = creep.room.storage;
            } else {
                // Priority 3: Room center
                target = new RoomPosition(25, 25, creep.room.name);
            }
        }
        
        creep.moveTo(target, {
            visualizePathStyle: { stroke: '#ff0000' },
            reusePath: 10,
            avoidExits: true
        });
        
        creep.say('🏃 flee!');
    }

    /**
     * Return home using native pathfinding
     * moveTo() automatically handles multi-room paths - no complex state machine needed
     */
    static returnToHomeRoom(creep) {
        const homeRoom = creep.memory.homeRoom;
        if (!homeRoom || creep.room.name === homeRoom) return;
        
        // Use native pathfinding to home room position
        // This automatically finds paths across room boundaries
        creep.moveTo(new RoomPosition(25, 25, homeRoom), {
            visualizePathStyle: { stroke: '#ffaa00' },
            reusePath: 10,
            avoidExits: false  // Allow room transitions
        });
    }


}

module.exports = RoleHarvester;
