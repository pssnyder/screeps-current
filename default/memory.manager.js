/**
 * MEMORY MANAGER
 * 
 * Manages persistent state and cleans up dead objects
 * Bio-inspired: Uses pheromone-like memory trails for colony-wide communication
 */

class MemoryManager {
    /**
     * Initialize colony-wide pheromone registry (the "nest")
     * All workers reference this to know home room
     */
    static initColonyRegistry() {
        if (!Memory.colony) {
            Memory.colony = {};
        }
        
        // The "pheromone nest" - all workers know this is home
        if (!Memory.colony.homeRoom) {
            const mySpawns = Object.values(Game.spawns);
            if (mySpawns.length > 0) {
                Memory.colony.homeRoom = mySpawns[0].room.name;
                console.log(`🏠 [Colony] Home room registry established: ${Memory.colony.homeRoom}`);
            }
        }
        
        // Track worker rooms (where we actively harvest)
        if (!Memory.colony.workerRooms) {
            Memory.colony.workerRooms = {};
        }
        
        // Track pheromone trails (good paths discovered by workers)
        if (!Memory.colony.pheromones) {
            Memory.colony.pheromones = {};  // routeName: {path: [], lastUsed: tick, efficiency: 0-1}
        }
    }
    
    /**
     * Clean up memory of dead creeps - v3.0 enhanced
     * TIPS: "The creep memory is saved upon death, so clear Memory.creeps.* to prevent overflowing."
     * TIPS: "The more small objects in the Memory, the more CPU spent on its parsing."
     */
    static cleanDeadCreeps() {
        // Throttle full memory scan to reduce CPU overhead in stable states.
        // Deleted creep entries persist safely for a short interval.
        if (Game.time % 20 !== 0) return;
        
        // Fast cleanup: only iterate Memory.creeps once
        for (const name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
    }
    
    /**
     * Initialize creep memory with defaults
     */
    static initCreep(creep, role, targetRoom = null) {
        // Determine home room: for workers, it's the spawn room they're being created in
        let homeRoom = creep.room.name;
        const mySpawns = Object.values(Game.spawns);
        if (mySpawns.length > 0) {
            homeRoom = mySpawns[0].room.name;  // Use main spawn room
        }
        
        creep.memory = {
            role: role,
            working: false,
            targetRoom: targetRoom,
            sourceId: null,
            targetId: null,
            homeRoom: homeRoom,  // Set home room immediately
            born: Game.time,
            stats: {
                energyHarvested: 0,
                energyDelivered: 0,
                upgraded: 0,
                built: 0,
                repaired: 0
            }
        };
    }
    
    /**
     * Store analytics data - v2.0 optimized
     */
    static recordStat(category, key, value) {
        if (!Memory.engine.stats[category]) {
            Memory.engine.stats[category] = {};
        }
        
        if (!Memory.engine.stats[category][key]) {
            Memory.engine.stats[category][key] = [];
        }
        
        Memory.engine.stats[category][key].push({
            tick: Game.time,
            value: value
        });
        
        // Keep only last 100 entries (reduced from 1000 for v2.0)
        const maxEntries = 100;
        if (Memory.engine.stats[category][key].length > maxEntries) {
            Memory.engine.stats[category][key].shift();
        }
    }
    
    /**
     * Clean old stats - run periodically
     */
    static cleanOldStats() {
        // Only run every 1000 ticks
        if (Game.time % 1000 !== 0) return;
        
        const cutoffTick = Game.time - 10000; // Keep last 10k ticks
        
        for (const category in Memory.engine.stats) {
            for (const key in Memory.engine.stats[category]) {
                Memory.engine.stats[category][key] = 
                    Memory.engine.stats[category][key].filter(s => s.tick > cutoffTick);
            }
        }
    }
    
    /**
     * Get historical stat data
     */
    static getStat(category, key, ticksBack = 100) {
        if (!Memory.engine.stats[category] || 
            !Memory.engine.stats[category][key]) {
            return [];
        }
        
        const stats = Memory.engine.stats[category][key];
        const cutoff = Game.time - ticksBack;
        
        return stats.filter(s => s.tick >= cutoff);
    }
}

module.exports = MemoryManager;
