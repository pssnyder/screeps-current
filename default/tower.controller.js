/**
 * TOWER CONTROLLER
 * 
 * Automated tower defense and maintenance
 */

class TowerController {
    /**
     * Execute tower logic for a room
     * v1.1.2: CPU optimized - caching and throttled operations
     */
    static run(room, roomEval) {
        // Cache tower IDs to avoid expensive find() every tick
        if (!room.memory.towerIds || Game.time % 50 === 0) {
            const towers = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER
            });
            room.memory.towerIds = towers.map(t => t.id);
        }
        
        // Get towers from cache
        const towers = room.memory.towerIds
            .map(id => Game.getObjectById(id))
            .filter(t => t); // Remove null (destroyed towers)
        
        if (towers.length === 0) return;
        
        // Priority 1: Attack hostile creeps (always check - critical)
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        if (hostiles.length > 0) {
            // Target closest hostile to spawn/controller
            const targets = hostiles.sort((a, b) => {
                const distA = room.controller ? 
                    a.pos.getRangeTo(room.controller) : 50;
                const distB = room.controller ? 
                    b.pos.getRangeTo(room.controller) : 50;
                return distA - distB;
            });
            
            towers.forEach(tower => {
                tower.attack(targets[0]);
            });
            
            return; // Defense is priority - skip healing/repair
        }
        
        // Priority 2: Heal damaged creeps (throttled - every 3 ticks)
        if (Game.time % 3 === 0) {
            const damagedCreeps = room.find(FIND_MY_CREEPS, {
                filter: c => c.hits < c.hitsMax
            });
            
            if (damagedCreeps.length > 0) {
                towers.forEach(tower => {
                    tower.heal(damagedCreeps[0]);
                });
                return;
            }
        }
        
        // Priority 3: Repair critical structures (throttled - every 10 ticks)
        if (Game.time % 10 === 0) {
            const damagedStructures = room.find(FIND_STRUCTURES, {
                filter: s => {
                    if (s.structureType === STRUCTURE_WALL || 
                        s.structureType === STRUCTURE_RAMPART) {
                        return s.hits < 10000;
                    }
                    return s.hits < s.hitsMax * 0.5;
                }
            });
            
            if (damagedStructures.length > 0) {
                // Sort by health percentage
                damagedStructures.sort((a, b) => {
                    const healthA = a.hits / a.hitsMax;
                    const healthB = b.hits / b.hitsMax;
                    return healthA - healthB;
                });
                
                towers.forEach(tower => {
                    if (tower.store.energy > 500) { // Only repair if we have energy
                        tower.repair(damagedStructures[0]);
                    }
                });
            }
        }
    }
}

module.exports = TowerController;
