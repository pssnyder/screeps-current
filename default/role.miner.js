/**
 * MINER ROLE
 * 
 * Specialized role for mineral harvesting (RCL 6+)
 * Similar to static harvester - sits on mineral and extracts continuously
 * Delivers to terminal for market operations or storage for stockpiling
 * 
 * v3.0.0: Initial implementation for Minerals & Markets update
 */

class RoleMiner {
    static run(creep) {
        // Initialize stats if missing
        if (!creep.memory.stats) {
            creep.memory.stats = {
                mineralsHarvested: 0,
                mineralsDelivered: 0
            };
        }
        
        // Check if extractor exists
        const mineral = Game.getObjectById(creep.memory.mineralId);
        if (!mineral) {
            // Find mineral in room
            const minerals = creep.room.find(FIND_MINERALS);
            if (minerals.length > 0) {
                creep.memory.mineralId = minerals[0].id;
            } else {
                console.log(`[Miner] ${creep.name} - No mineral found in room`);
                return;
            }
        }
        
        // Check for extractor on mineral
        const extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(
            s => s.structureType === STRUCTURE_EXTRACTOR
        );
        
        if (!extractor) {
            // No extractor - move to spawn and wait
            const spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
            if (spawn && !creep.pos.isNearTo(spawn)) {
                creep.moveTo(spawn, {
                    visualizePathStyle: { stroke: '#9b59b6' },
                    reusePath: 20
                });
            }
            creep.say('⏳ wait');
            return;
        }
        
        // Check if mineral is depleted
        if (mineral.mineralAmount === 0) {
            creep.say('💤 regen');
            
            // Move to spawn and wait for regeneration (50,000 ticks)
            const spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
            if (spawn && !creep.pos.isNearTo(spawn)) {
                creep.moveTo(spawn, {
                    visualizePathStyle: { stroke: '#9b59b6' },
                    reusePath: 50
                });
            }
            return;
        }
        
        // State machine: mining -> delivering
        if (creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🚚 deliver');
        }
        if (creep.store.getUsedCapacity() === 0) {
            creep.memory.working = false;
            creep.say('⛏️ mine');
        }
        
        if (!creep.memory.working) {
            this.mine(creep, mineral, extractor);
        } else {
            this.deliver(creep);
        }
    }
    
    /**
     * Mine minerals from deposit
     */
    static mine(creep, mineral, extractor) {
        // Extractor has 5 tick cooldown per harvest
        const result = creep.harvest(mineral);
        
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(mineral, {
                visualizePathStyle: { stroke: '#9b59b6' },
                reusePath: 20
            });
        } else if (result === OK) {
            // Track stats
            const workParts = creep.getActiveBodyparts(WORK);
            creep.memory.stats.mineralsHarvested += workParts; // 1 per WORK part
        } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
            // Mineral depleted
            creep.say('💤 empty');
        } else if (result === ERR_TIRED) {
            // Extractor on cooldown
            creep.say('⏳ cool');
        }
    }
    
    /**
     * Deliver minerals to terminal (priority) or storage
     * Terminal enables market operations
     */
    static deliver(creep) {
        // Get the mineral type we're carrying
        const mineralType = Object.keys(creep.store).find(
            resource => resource !== RESOURCE_ENERGY
        );
        
        if (!mineralType) {
            console.log(`[Miner] ${creep.name} - No mineral in inventory`);
            return;
        }
        
        // Priority 1: Terminal (for market operations)
        const terminal = creep.room.terminal;
        if (terminal && terminal.store.getFreeCapacity() > 0) {
            const result = creep.transfer(terminal, mineralType);
            
            if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(terminal, {
                    visualizePathStyle: { stroke: '#9b59b6' },
                    reusePath: 20
                });
            } else if (result === OK) {
                creep.memory.stats.mineralsDelivered += creep.store[mineralType];
            }
            return;
        }
        
        // Priority 2: Storage (backup storage)
        const storage = creep.room.storage;
        if (storage && storage.store.getFreeCapacity() > 0) {
            const result = creep.transfer(storage, mineralType);
            
            if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, {
                    visualizePathStyle: { stroke: '#9b59b6' },
                    reusePath: 20
                });
            } else if (result === OK) {
                creep.memory.stats.mineralsDelivered += creep.store[mineralType];
            }
            return;
        }
        
        // No storage available - drop minerals
        creep.drop(mineralType);
        console.log(`[Miner] ${creep.name} - No storage available, dropping ${mineralType}`);
    }
    
    /**
     * Generate optimal miner body based on available energy
     * Miners need WORK parts for harvesting and CARRY for transport
     */
    static generateBody(energyAvailable) {
        // Body costs: WORK = 100, CARRY = 50, MOVE = 50
        
        // Minimum viable miner: [WORK, WORK, CARRY, MOVE, MOVE] (350)
        if (energyAvailable < 350) {
            return null; // Can't spawn a miner
        }
        
        // Small miner (early RCL 6): [WORK×3, CARRY×2, MOVE×3] (500)
        if (energyAvailable < 500) {
            return [WORK, WORK, CARRY, MOVE, MOVE];
        }
        
        // Medium miner: [WORK×5, CARRY×3, MOVE×4] (950)
        if (energyAvailable < 950) {
            return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
        }
        
        // Large miner (late RCL 6+): [WORK×10, CARRY×5, MOVE×8] (1,850)
        if (energyAvailable < 1850) {
            return [WORK, WORK, WORK, WORK, WORK, 
                    CARRY, CARRY, CARRY, 
                    MOVE, MOVE, MOVE, MOVE];
        }
        
        // Maximum miner: [WORK×15, CARRY×8, MOVE×12] (2,750)
        return [
            WORK, WORK, WORK, WORK, WORK,
            WORK, WORK, WORK, WORK, WORK,
            CARRY, CARRY, CARRY, CARRY, CARRY,
            MOVE, MOVE, MOVE, MOVE, MOVE,
            MOVE, MOVE, MOVE
        ];
    }
}

module.exports = RoleMiner;
