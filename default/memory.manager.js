/**
 * MEMORY MANAGER
 * 
 * Manages persistent state and cleans up dead objects
 */

class MemoryManager {
    /**
     * Clean up memory of dead creeps - v3.0 enhanced
     * TIPS: "The creep memory is saved upon death, so clear Memory.creeps.* to prevent overflowing."
     * TIPS: "The more small objects in the Memory, the more CPU spent on its parsing."
     */
    static cleanDeadCreeps() {
        // Clean every tick for immediate memory reclamation
        // v3.0: Changed from every 10 ticks to every tick based on TIPS
        
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
        creep.memory = {
            role: role,
            working: false,
            targetRoom: targetRoom,
            sourceId: null,
            targetId: null,
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
