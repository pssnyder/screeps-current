/**
 * LINK MANAGER
 * 
 * Automated link-to-link energy transfers for RCL 5+
 * Transfers energy from source links to spawn/controller links
 * v3.1.0: Initial implementation
 */

class LinkManager {
    /**
     * Run link management for a room
     * Should be called from main loop (throttled to avoid CPU waste)
     */
    static run(room) {
        // Only run at RCL 5+ when links exist
        if (room.controller.level < 5) return;
        
        // Find all links in room
        const links = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK
        });
        
        if (links.length < 2) return; // Need at least 2 links
        
        // Categorize links by location
        const sourceLinks = [];
        const spawnLinks = [];
        const controllerLinks = [];
        
        for (const link of links) {
            // Skip links on cooldown
            if (link.cooldown > 0) continue;
            
            // Categorize by proximity
            const nearSources = link.pos.findInRange(FIND_SOURCES, 2);
            const nearSpawns = link.pos.findInRange(FIND_MY_SPAWNS, 3);
            const nearController = link.pos.getRangeTo(room.controller);
            
            if (nearSources.length > 0) {
                sourceLinks.push(link);
            } else if (nearSpawns.length > 0) {
                spawnLinks.push(link);
            } else if (nearController <= 3) {
                controllerLinks.push(link);
            }
        }
        
        // Transfer logic: Source links → Spawn/Controller links
        for (const sourceLink of sourceLinks) {
            // Only transfer if source link has significant energy
            if (sourceLink.store[RESOURCE_ENERGY] < 400) continue;
            
            // Find best receiving link
            let target = null;
            
            // Priority 1: Spawn link (if low on energy)
            if (spawnLinks.length > 0) {
                const emptySpawnLinks = spawnLinks.filter(
                    l => l.store.getFreeCapacity(RESOURCE_ENERGY) >= 400
                );
                if (emptySpawnLinks.length > 0) {
                    target = emptySpawnLinks[0];
                }
            }
            
            // Priority 2: Controller link (if spawn is full)
            if (!target && controllerLinks.length > 0) {
                const emptyControllerLinks = controllerLinks.filter(
                    l => l.store.getFreeCapacity(RESOURCE_ENERGY) >= 400
                );
                if (emptyControllerLinks.length > 0) {
                    target = emptyControllerLinks[0];
                }
            }
            
            // Execute transfer
            if (target) {
                const result = sourceLink.transferEnergy(target);
                if (result === OK) {
                    const amount = Math.min(sourceLink.store[RESOURCE_ENERGY], 800);
                    console.log(`🔗 Link transfer: ${amount} energy from source link → ${target.pos}`);
                } else if (result === ERR_TIRED) {
                    // Link on cooldown, skip this tick
                } else {
                    console.log(`⚠️ Link transfer failed: ${result}`);
                }
            }
        }
    }
    
    /**
     * Get link transfer statistics for analytics
     */
    static getStats(room) {
        const links = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK
        });
        
        if (links.length === 0) return null;
        
        let totalEnergy = 0;
        let totalCapacity = 0;
        let activeLinks = 0;
        
        for (const link of links) {
            totalEnergy += link.store[RESOURCE_ENERGY];
            totalCapacity += link.store.getCapacity(RESOURCE_ENERGY);
            if (link.store[RESOURCE_ENERGY] > 100) activeLinks++;
        }
        
        return {
            count: links.length,
            energy: totalEnergy,
            capacity: totalCapacity,
            utilization: (totalEnergy / totalCapacity * 100).toFixed(0),
            active: activeLinks
        };
    }
}

module.exports = LinkManager;
