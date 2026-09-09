/**
 * BUILDER ROLE
 * 
 * Intelligent construction with prioritized site selection
 */

class RoleBuilder {
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
        const colonyHomeRoom = Memory.colony && Memory.colony.homeRoom;
        if (!colonyHomeRoom) return;  // Colony not initialized
        
        // Initialize homeRoom from colony registry
        if (!creep.memory.homeRoom) {
            creep.memory.homeRoom = colonyHomeRoom;
        }

        if (creep.room.name !== creep.memory.homeRoom) {
            this.returnToHomeRoom(creep);
            return;  // Do NOT work in wrong room
        }

        // Nudge border creeps inward to prevent accidental room transitions.
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(new RoomPosition(25, 25, creep.memory.homeRoom), {
                visualizePathStyle: { stroke: '#ffaa00' },
                reusePath: 5
            });
            return;
        }
        
        // PHASE 1: Check for hostile creeps and flee if detected (throttled every 3 ticks)
        if (Game.time % 3 === 0) {
            if (this.checkForHostiles(creep)) {
                this.flee(creep);
                return; // Abort all other actions
            }
        }
        
        // State machine
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.memory.targetId = null;
            creep.say('🔄 harvest');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🚧 build');
        }

        // BIO-INSPIRED: During recovery, prioritize CRITICAL infrastructure
        // (containers, storage, links) over refueling
        // Only pause if we don't have critical construction sites to work on
        const hasCriticalSites = this.hasCriticalConstructionSites(creep.room);
        
        // Emergency fallback: pause builder task allocation while economy is starved
        // UNLESS there are critical infrastructure sites to build (containers, storage, links)
        if (this.shouldPauseBuilding(creep.room) && !hasCriticalSites) {
            this.emergencyRefuel(creep);
            return;
        }
        
        if (creep.memory.working) {
            this.build(creep);
        } else {
            this.collectEnergy(creep);
        }
    }
    
    /**
     * BIO-INSPIRED: Check if room has critical infrastructure sites
     * These are built even during recovery to bootstrap the economy
     */
    static hasCriticalConstructionSites(room) {
        const criticalSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER ||
                        s.structureType === STRUCTURE_STORAGE ||
                        s.structureType === STRUCTURE_LINK
        });
        return criticalSites.length > 0;
    }
    
    /**
     * Build construction sites or repair structures
     */
    static build(creep) {
        let target = null;
        
        if (creep.memory.targetId) {
            target = Game.getObjectById(creep.memory.targetId);
        }
        
        if (!target) {
            // Find construction sites with priority
            const sites = creep.room.find(FIND_CONSTRUCTION_SITES);
            
            if (sites.length > 0) {
                // Prioritize logistics-critical construction before roads.
                const priority = {
                    [STRUCTURE_SPAWN]: 10,
                    [STRUCTURE_EXTENSION]: 9,
                    [STRUCTURE_TOWER]: 8,
                    [STRUCTURE_LINK]: 8,
                    [STRUCTURE_CONTAINER]: 8,
                    [STRUCTURE_STORAGE]: 7,
                    [STRUCTURE_ROAD]: 4,
                    [STRUCTURE_RAMPART]: 4,
                    [STRUCTURE_WALL]: 3
                };
                
                sites.sort((a, b) => {
                    const priorityA = priority[a.structureType] || 1;
                    const priorityB = priority[b.structureType] || 1;
                    return priorityB - priorityA;
                });
                
                target = sites[0];
            }
        }
        
        if (!target) {
            // No construction sites, repair damaged structures
            creep.say('🔧 repair');
            const damaged = creep.room.find(FIND_STRUCTURES, {
                filter: s => {
                    // Don't repair walls/ramparts (too much HP, towers handle it)
                    if (s.structureType === STRUCTURE_WALL || 
                        s.structureType === STRUCTURE_RAMPART) {
                        return false;
                    }
                    return s.hits < s.hitsMax * 0.75;
                }
            });
            
            if (damaged.length > 0) {
                // Sort by health percentage
                damaged.sort((a, b) => {
                    const healthA = a.hits / a.hitsMax;
                    const healthB = b.hits / b.hitsMax;
                    return healthA - healthB;
                });
                target = damaged[0];
            }
        }
        
        if (!target) {
            // Nothing to build/repair, upgrade controller
            creep.say('⚡ upgrade');
            target = creep.room.controller;
        }
        
        if (!target) return;
        
        let result;
        if (target instanceof ConstructionSite) {
            result = creep.build(target);
            if (result === OK) {
                creep.memory.stats.built += creep.body.filter(p => p.type === WORK).length * 5;
            }
        } else if (target.structureType === STRUCTURE_CONTROLLER) {
            result = creep.upgradeController(target);
        } else {
            result = creep.repair(target);
            if (result === OK) {
                creep.memory.stats.repaired += creep.body.filter(p => p.type === WORK).length * 100;
            }
        }
        
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                visualizePathStyle: { stroke: '#00ffff' },
                reusePath: 10,
                avoidExits: true
            });
        } else if (result === OK) {
            creep.memory.targetId = target.id;
        }
    }
    
    /**
     * Collect energy
     */

    static collectEnergy(creep) {
        // Similar to upgrader logic
        let target = null;
        
        if (creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] > 1000) {
            target = creep.room.storage;
        }
        
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER &&
                            s.store[RESOURCE_ENERGY] > 0
            });
        }
        
        if (!target) {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (source) {
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#00ffff' }, avoidExits: true });
                }
            }
            return;
        }
        
        const result = creep.withdraw(target, RESOURCE_ENERGY);
        
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                visualizePathStyle: { stroke: '#00ffff' },
                reusePath: 10,
                avoidExits: true
            });
        }
    }

    /**
     * Pause builder construction during critical room starvation.
     */
    static shouldPauseBuilding(room) {
        const hasCriticalEnergy = room.energyAvailable >= 100;
        const spawnAndExt = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION
        });

        const totalCap = spawnAndExt.reduce((sum, s) => sum + s.store.getCapacity(RESOURCE_ENERGY), 0);
        const totalEnergy = spawnAndExt.reduce((sum, s) => sum + s.store[RESOURCE_ENERGY], 0);
        const fillRatio = totalCap > 0 ? (totalEnergy / totalCap) : 1;

        return !hasCriticalEnergy || fillRatio < 0.5;
    }

    /**
     * In incident mode, builders behave like emergency refuelers.
     */
    static emergencyRefuel(creep) {
        if (creep.store[RESOURCE_ENERGY] === 0) {
            this.collectEnergy(creep);
            creep.say('🩺 collect');
            return;
        }

        const target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                         s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        if (!target) {
            creep.say('🩺 hold');
            return;
        }

        const result = creep.transfer(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                visualizePathStyle: { stroke: '#ffaa00' },
                reusePath: 10,
                avoidExits: true
            });
        }
        creep.say('🩺 refuel');
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
     * Builders prioritize survival and keeping construction progress safe
     */
    static flee(creep) {
        // If not in home room, flee to home room exit
        if (creep.room.name !== creep.memory.homeRoom) {
            this.returnToHomeRoom(creep);
            creep.say('🏃 flee!');
            return;
        }
        
        // In home room - flee to spawn or storage
        let target = creep.room.storage || creep.pos.findClosestByPath(FIND_MY_SPAWNS);
        
        if (target) {
            creep.moveTo(target, {
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

module.exports = RoleBuilder;
