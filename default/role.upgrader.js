/**
 * UPGRADER ROLE
 * 
 * Intelligent controller upgrading with energy management
 */

class RoleUpgrader {
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
        
        // State machine
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🔄 harvest');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('⚡ upgrade');
        }
        
        if (creep.memory.working) {
            this.upgrade(creep);
        } else {
            this.collectEnergy(creep);
        }
    }
    
    /**
     * Upgrade the controller
     */
    static upgrade(creep) {
        const controller = creep.room.controller;
        
        if (!controller) return;
        
        const result = creep.upgradeController(controller);
        
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, {
                visualizePathStyle: { stroke: '#00ff00' },
                reusePath: 20
            });
        } else if (result === OK) {
            const workParts = creep.body.filter(p => p.type === WORK).length;
            creep.memory.stats.upgraded += workParts;
        }
    }
    
    /**
     * Collect energy from storage or containers
     */
    static collectEnergy(creep) {
        // Prefer storage/containers over sources
        let target = null;
        
        // Try storage first
        if (creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] > 1000) {
            target = creep.room.storage;
        }
        
        // Try containers
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER &&
                            s.store[RESOURCE_ENERGY] > 0
            });
        }
        
        // Fall back to dropped resources
        if (!target) {
            const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType === RESOURCE_ENERGY
            });
            if (droppedEnergy) {
                if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(droppedEnergy);
                }
                return;
            }
        }
        
        // Last resort: harvest from source
        if (!target) {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (source) {
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#00ff00' } });
                }
            }
            return;
        }
        
        const result = creep.withdraw(target, RESOURCE_ENERGY);
        
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                visualizePathStyle: { stroke: '#00ff00' },
                reusePath: 10
            });
        }
    }
}

module.exports = RoleUpgrader;
