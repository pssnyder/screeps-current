/**
 * TRAFFIC TRACKER
 * 
 * Tracks creep movements to identify high-traffic pheromone paths
 * Enables intelligent road planning on frequently traveled routes
 * 
 * v1.0 - Bio-inspired traffic heatmap for road planning
 */

class TrafficTracker {
    /**
     * Update traffic heatmap based on current creep positions
     * This is called once per tick to build a heat map of movement
     */
    static updateTraffic(room) {
        if (!Memory.colony) return;
        
        // Initialize room heatmap if needed
        if (!Memory.colony.trafficHeatmap) {
            Memory.colony.trafficHeatmap = {};
        }
        
        const heatmap = Memory.colony.trafficHeatmap;
        if (!heatmap[room.name]) {
            heatmap[room.name] = {};
        }
        
        const roomHeat = heatmap[room.name];
        
        // Decay all heat values (memory conservation)
        // This makes recent traffic more important than old traffic
        for (const key in roomHeat) {
            roomHeat[key] = Math.floor(roomHeat[key] * 0.95);
            if (roomHeat[key] < 1) delete roomHeat[key];
        }
        
        // Track all creeps in this room
        const creeps = room.find(FIND_MY_CREEPS);
        for (const creep of creeps) {
            const key = `${creep.pos.x},${creep.pos.y}`;
            roomHeat[key] = (roomHeat[key] || 0) + 10;
        }
    }
    
    /**
     * Get high-traffic positions in a room (positions visited frequently)
     * Returns array of {x, y, heat} sorted by heat (highest first)
     */
    static getHotspots(room, minHeat = 50) {
        if (!Memory.colony?.trafficHeatmap?.[room.name]) return [];
        
        const roomHeat = Memory.colony.trafficHeatmap[room.name];
        const hotspots = [];
        
        for (const key in roomHeat) {
            const heat = roomHeat[key];
            if (heat >= minHeat) {
                const [x, y] = key.split(',').map(Number);
                hotspots.push({x, y, heat});
            }
        }
        
        return hotspots.sort((a, b) => b.heat - a.heat);
    }
    
    /**
     * Get critical arteries (main high-traffic corridors)
     * Identifies paths between spawn, sources, storage, and controller
     */
    static getArteries(room) {
        const spawns = room.find(FIND_MY_SPAWNS);
        const sources = room.find(FIND_SOURCES);
        const storage = room.storage;
        const controller = room.controller;
        
        if (!spawns.length) return [];
        
        const arteries = [];
        const spawn = spawns[0];
        
        // Artery 1: Spawn → Sources (critical for energy collection)
        for (const source of sources) {
            arteries.push({
                from: spawn.pos,
                to: source.pos,
                priority: 100,
                label: `spawn→source`
            });
        }
        
        // Artery 2: Spawn/Sources → Storage (critical for energy flow)
        if (storage) {
            arteries.push({
                from: spawn.pos,
                to: storage.pos,
                priority: 95,
                label: `spawn→storage`
            });
            
            for (const source of sources) {
                arteries.push({
                    from: source.pos,
                    to: storage.pos,
                    priority: 90,
                    label: `source→storage`
                });
            }
        }
        
        // Artery 3: Storage → Controller (for upgrading)
        if (storage && controller) {
            arteries.push({
                from: storage.pos,
                to: controller.pos,
                priority: 80,
                label: `storage→controller`
            });
        }
        
        return arteries;
    }
    
    /**
     * Get positions along a path from A to B
     * Uses simple pathfinding to find intermediate points
     */
    static getPathPositions(room, from, to, maxPositions = 50) {
        const path = from.findPathTo(to, {maxOps: 200});
        
        if (!path || path.length === 0) return [];
        
        const positions = [];
        
        // Sample every N steps to avoid planning too many roads
        const step = Math.max(1, Math.ceil(path.length / maxPositions));
        
        for (let i = 0; i < path.length; i += step) {
            const p = path[i];
            positions.push({x: p.x, y: p.y});
        }
        
        return positions;
    }
}

module.exports = TrafficTracker;
