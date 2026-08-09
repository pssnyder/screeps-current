/**
 * Role: Pioneer
 * Purpose: Self-sufficient colonist for new rooms
 * Body: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] (600 energy)
 *       Scales up with available energy
 * 
 * Pioneers can harvest, build, and upgrade in remote rooms.
 * They prioritize building spawn first, then other infrastructure.
 */

class RolePioneer {
    
    /**
     * Run pioneer behavior
     */
    static run(creep) {
        // Validate target room is set
        if (!creep.memory.targetRoom) {
            console.log(`⚠️ Pioneer ${creep.name} has no target room assigned`);
            return;
        }
        
        const targetRoom = creep.memory.targetRoom;
        
        // If not in target room, move there
        if (creep.room.name !== targetRoom) {
            const exit = creep.room.findExitTo(targetRoom);
            if (exit === ERR_NO_PATH || exit === ERR_INVALID_ARGS) {
                console.log(`❌ Pioneer ${creep.name} cannot path to ${targetRoom}`);
                creep.memory.stuck = true;
                return;
            }
            
            const exitPos = creep.pos.findClosestByRange(exit);
            creep.moveTo(exitPos, {
                visualizePathStyle: {stroke: '#00ff00'},
                reusePath: 50
            });
            
            creep.say('🚀 Pioneer');
            return;
        }
        
        // We're in the target room - operate as self-sufficient worker
        
        // Toggle working state based on energy
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🔄 Harvest');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🔨 Build');
        }
        
        // Execute behavior based on state
        if (creep.memory.working) {
            this.doWork(creep);
        } else {
            this.collectEnergy(creep);
        }
    }
    
    /**
     * Collect energy from sources
     */
    static collectEnergy(creep) {
        // Find sources in room
        let source = null;
        
        if (creep.memory.sourceId) {
            source = Game.getObjectById(creep.memory.sourceId);
        }
        
        if (!source) {
            const sources = creep.room.find(FIND_SOURCES_ACTIVE);
            if (sources.length === 0) {
                creep.say('⏳ Wait');
                return;
            }
            
            // Pick closest source
            source = creep.pos.findClosestByPath(sources);
            if (source) {
                creep.memory.sourceId = source.id;
            }
        }
        
        if (source) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    reusePath: 10
                });
            }
        }
    }
    
    /**
     * Do work: prioritize spawn, then construction, then upgrade
     */
    static doWork(creep) {
        const room = creep.room;
        
        // PRIORITY 1: Build spawn if it doesn't exist
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) {
            const spawnSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: s => s.structureType === STRUCTURE_SPAWN
            });
            
            if (spawnSites.length > 0) {
                // Build the spawn
                if (creep.build(spawnSites[0]) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(spawnSites[0], {
                        visualizePathStyle: {stroke: '#ffffff'}
                    });
                }
                creep.say('🏗️ Spawn');
                return;
            } else {
                // No spawn construction site - wait for it to be placed
                // Upgrade controller while waiting
                this.upgradeController(creep);
                creep.say('⏳ Spawn');
                return;
            }
        }
        
        // PRIORITY 2: Build extensions (need energy capacity)
        const extensionSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        });
        
        if (extensionSites.length > 0) {
            const closest = creep.pos.findClosestByPath(extensionSites);
            if (closest) {
                if (creep.build(closest) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(closest, {
                        visualizePathStyle: {stroke: '#ffffff'}
                    });
                }
                creep.say('🔋 Ext');
                return;
            }
        }
        
        // PRIORITY 3: Build containers (for energy storage)
        const containerSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        
        if (containerSites.length > 0) {
            const closest = creep.pos.findClosestByPath(containerSites);
            if (closest) {
                if (creep.build(closest) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(closest, {
                        visualizePathStyle: {stroke: '#ffffff'}
                    });
                }
                creep.say('📦 Container');
                return;
            }
        }
        
        // PRIORITY 4: Build other construction sites
        const otherSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        if (otherSites.length > 0) {
            const closest = creep.pos.findClosestByPath(otherSites);
            if (closest) {
                if (creep.build(closest) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(closest, {
                        visualizePathStyle: {stroke: '#ffffff'}
                    });
                }
                creep.say('🔨 Build');
                return;
            }
        }
        
        // PRIORITY 5: Upgrade controller (always useful)
        this.upgradeController(creep);
    }
    
    /**
     * Upgrade the room controller
     */
    static upgradeController(creep) {
        const controller = creep.room.controller;
        if (!controller) return;
        
        if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, {
                visualizePathStyle: {stroke: '#00ff00'}
            });
        }
        creep.say('⚡ Upgrade');
    }
    
    /**
     * Generate optimal body based on energy available
     */
    static generateBody(energyAvailable) {
        // Minimum viable: [WORK, CARRY, MOVE, MOVE] = 300 energy
        if (energyAvailable < 300) {
            return null;
        }
        
        const body = [];
        let remainingEnergy = energyAvailable;
        
        // Target ratio: 2 WORK, 2 CARRY, 4 MOVE (balanced for efficiency)
        // Cost per unit: 100 + 50 + 50 = 200 energy
        
        const workCost = 100;
        const carryCost = 50;
        const moveCost = 50;
        
        // Add parts in balanced ratios
        while (remainingEnergy >= 200 && body.length < 50) {
            // Add 1 WORK
            if (remainingEnergy >= workCost) {
                body.push(WORK);
                remainingEnergy -= workCost;
            }
            
            // Add 1 CARRY
            if (remainingEnergy >= carryCost) {
                body.push(CARRY);
                remainingEnergy -= carryCost;
            }
            
            // Add 2 MOVE (to maintain speed with WORK + CARRY)
            for (let i = 0; i < 2 && remainingEnergy >= moveCost && body.length < 50; i++) {
                body.push(MOVE);
                remainingEnergy -= moveCost;
            }
            
            // Break if we can't afford another full cycle
            if (remainingEnergy < 200) break;
        }
        
        // Ensure minimum viable body
        if (body.filter(p => p === WORK).length === 0) body.push(WORK);
        if (body.filter(p => p === CARRY).length === 0) body.push(CARRY);
        if (body.filter(p => p === MOVE).length < 2) {
            body.push(MOVE);
            if (body.filter(p => p === MOVE).length < 2) body.push(MOVE);
        }
        
        return body;
    }
    
    /**
     * Calculate cost of pioneer body
     */
    static calculateCost(body) {
        return body.reduce((sum, part) => sum + BODYPART_COST[part], 0);
    }
}

module.exports = RolePioneer;
