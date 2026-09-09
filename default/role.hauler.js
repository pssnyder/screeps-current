/**
 * HAULER ROLE
 * 
 * Efficient energy transportation between sources and storage
 * v2.0.3: Enhanced container awareness and priority targeting
 */

class RoleHauler {
    static run(creep, strategy) {
        // BIO-INSPIRED: Reference the colony pheromone nest (global home room)
        const colonyHomeRoom = Memory.colony && Memory.colony.homeRoom;
        if (!colonyHomeRoom) return;  // Colony not initialized
        
        // Initialize homeRoom from colony registry
        if (!creep.memory.homeRoom) {
            creep.memory.homeRoom = colonyHomeRoom;
        }
        
        // CRITICAL: Mandatory home-room enforcement - haulers only work in home room
        if (creep.room.name !== creep.memory.homeRoom) {
            this.returnToHomeRoom(creep);
            return; // CRITICAL: Do not proceed with any other logic
        }
        
        // PHASE 1: Check for hostile creeps and flee if detected (throttled every 3 ticks)
        if (Game.time % 3 === 0) {
            if (this.checkForHostiles(creep)) {
                this.flee(creep);
                return; // Abort all other actions
            }
        }

        // Nudge border creeps inward to prevent accidental room transitions.
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.memory.homeRoom), {
                visualizePathStyle: { stroke: '#ffaa00' },
                reusePath: 5
            });
            return;
        }

        // State machine
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🔄 collect');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🚚 deliver');
        }
        
        if (creep.memory.working) {
            this.deliver(creep);
        } else {
            this.collect(creep);
        }
    }
    
    /**
     * Collect energy from containers or ground
     * v2.0.3: Prioritize containers > tombstones > dropped energy
     */
    static collect(creep) {
        // Priority 1: Containers near sources (static harvesters fill these)
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER &&
                        s.store[RESOURCE_ENERGY] > 20
        });
        
        if (containers.length > 0) {
            // Find fullest container
            containers.sort((a, b) => b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY]);
            const target = containers[0];
            
            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    visualizePathStyle: { stroke: '#ffff00' },
                    reusePath: 15,
                    avoidExits: true
                });
            }
            return;
        }
        
        // Priority 2: Dropped resources (from dead creeps or static harvesters)
        const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
        });
        
        if (droppedEnergy) {
            if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                creep.moveTo(droppedEnergy, {
                    visualizePathStyle: { stroke: '#ffff00' },
                    reusePath: 10,
                    avoidExits: true
                });
            }
            return;
        }
        
        // Priority 3: Tombstones (dead creeps)
        const tombstones = creep.room.find(FIND_TOMBSTONES, {
            filter: t => t.store[RESOURCE_ENERGY] > 0
        });
        
        if (tombstones.length > 0) {
            const target = creep.pos.findClosestByPath(tombstones);
            if (target && creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    visualizePathStyle: { stroke: '#ffff00' },
                    reusePath: 10,
                    avoidExits: true
                });
            }
            return;
        }
        
        // Recovery fallback: assist harvesting when logistics sources are empty.
        if (this.isRecoveryMode(creep.room)) {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (source) {
                const harvestResult = creep.harvest(source);
                if (harvestResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, {
                        visualizePathStyle: { stroke: '#ffaa00' },
                        reusePath: 10,
                        avoidExits: true
                    });
                }
                creep.say('⛏️ assist');
                return;
            }
        }

        // No work currently available: loiter near spawn for fast reaction.
        const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
        if (spawn) {
            creep.moveTo(spawn, {
                visualizePathStyle: { stroke: '#888888' },
                reusePath: 20,
                avoidExits: true
            });
        }
    }
    
    /**
     * Deliver energy to storage or spawn structures
     * v2.0.3: Smart priority targeting
     */
    static deliver(creep) {
        let target = null;
        const room = creep.room;
        
        // Priority 1: Critical spawn/extension if energy is low
        const energyPercent = room.energyAvailable / room.energyCapacityAvailable;
        
        if (energyPercent < 0.5) {
            // Low energy - prioritize spawns and extensions
            target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                filter: s => {
                    return (s.structureType === STRUCTURE_SPAWN ||
                            s.structureType === STRUCTURE_EXTENSION) &&
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
        }
        
        // Priority 2: Towers if they're low
        if (!target) {
            const towers = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER &&
                           s.store[RESOURCE_ENERGY] < s.store.getCapacity(RESOURCE_ENERGY) * 0.5
            });
            
            if (towers.length > 0) {
                target = creep.pos.findClosestByPath(towers);
            }
        }
        
        // Priority 3: Storage (main depot)
        if (!target && room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            target = room.storage;
        }
        
        // Priority 4: Any spawn/extension with capacity
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                filter: s => {
                    return (s.structureType === STRUCTURE_SPAWN ||
                            s.structureType === STRUCTURE_EXTENSION) &&
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
        }
        
        // Priority 5: Controller upgrade (last resort) - ONLY if it's our own controller
        if (!target && room.controller && room.controller.my) {
            target = room.controller;
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
                visualizePathStyle: { stroke: '#ffff00' },
                reusePath: 15,
                avoidExits: true
            });
        } else if (result === ERR_FULL || result === ERR_INVALID_TARGET) {
            // Target full or invalid, clear memory
            delete creep.memory.targetId;
        }
    }

    static isRecoveryMode(room) {
        if (!Memory.engine || !Memory.engine.recoveryRooms) return false;
        return !!(Memory.engine.recoveryRooms[room.name] && Memory.engine.recoveryRooms[room.name].active);
    }

    static returnToHomeRoom(creep) {
        const targetRoom = creep.memory.homeRoom;
        const exitDir = creep.room.findExitTo(targetRoom);
        if (exitDir === ERR_NO_PATH || exitDir === ERR_INVALID_ARGS) {
            creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                visualizePathStyle: { stroke: '#ffaa00' },
                reusePath: 10
            });
            return;
        }

        const exit = creep.pos.findClosestByPath(exitDir);
        if (exit) {
            creep.moveTo(exit, {
                visualizePathStyle: { stroke: '#ffaa00' },
                reusePath: 15
            });
            creep.say('🏠 return');
        }
    }

    /**
     * PHASE 1: Check for hostile creeps nearby
     * Scans 12 squares, returns true if threat detected
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
     * PHASE 1: Flee toward home room
     * Haulers prioritize returning to home room with energy
     */
    static flee(creep) {
        // If not in home room, flee to home room exit
        if (creep.room.name !== creep.memory.homeRoom) {
            this.returnToHomeRoom(creep);
            creep.say('🏃 flee!');
            return;
        }
        
        // In home room - flee to spawn
        const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
        if (spawn) {
            creep.moveTo(spawn, {
                visualizePathStyle: { stroke: '#ff0000' },
                reusePath: 10,
                avoidExits: true
            });
        } else {
            // Fallback to room center
            creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                visualizePathStyle: { stroke: '#ff0000' },
                reusePath: 10,
                avoidExits: true
            });
        }
        
        creep.say('🏃 flee!');
    }
}

module.exports = RoleHauler;
