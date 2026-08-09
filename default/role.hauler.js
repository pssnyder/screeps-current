/**
 * HAULER ROLE
 * 
 * Efficient energy transportation between sources and storage
 * v2.0.3: Enhanced container awareness and priority targeting
 */

class RoleHauler {
    static run(creep, strategy) {
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
                        s.store[RESOURCE_ENERGY] > 100
        });
        
        if (containers.length > 0) {
            // Find fullest container
            containers.sort((a, b) => b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY]);
            const target = containers[0];
            
            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    visualizePathStyle: { stroke: '#ffff00' },
                    reusePath: 15
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
                    reusePath: 10
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
                    reusePath: 10
                });
            }
            return;
        }
        
        // No energy to collect, move to container to wait
        if (containers.length > 0) {
            creep.moveTo(containers[0], {
                visualizePathStyle: { stroke: '#888888' },
                reusePath: 20
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
        
        // Priority 5: Controller upgrade (last resort)
        if (!target) {
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
                reusePath: 15
            });
        } else if (result === ERR_FULL || result === ERR_INVALID_TARGET) {
            // Target full or invalid, clear memory
            delete creep.memory.targetId;
        }
    }
}

module.exports = RoleHauler;
