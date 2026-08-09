/**
 * STRUCTURE PLANNER
 * 
 * Automatically plans and places construction sites for optimal room layout
 * v2.0.1 - Priority-based planning (critical structures first)
 */

class StructurePlanner {
    /**
     * Plan and place construction sites for a room
     * v2.0.1: Plan critical structures (extensions, towers) before roads
     * v3.1.0: Added link support for RCL 5+
     */
    static run(room) {
        // Only plan once every 100 ticks
        if (Game.time % 100 !== 0) return;
        
        const rcl = room.controller.level;
        const existingSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        
        // PRIORITY 1: Extensions (critical for energy capacity)
        if (rcl >= 2 && existingSites.length < 10) {
            this.planExtensions(room);
        }
        
        // PRIORITY 2: Towers (critical for defense at RCL 3+)
        if (rcl >= 3 && existingSites.length < 10) {
            this.planTower(room);
        }
        
        // PRIORITY 2.5: Links (GAME-CHANGER at RCL 5+)
        if (rcl >= 5 && existingSites.length < 10) {
            this.planLinks(room);
        }
        
        // PRIORITY 3: Containers (important for economy)
        if (rcl >= 2 && existingSites.length < 10) {
            this.planContainers(room);
        }
        
        // PRIORITY 4: Storage (game-changer at RCL 4+)
        if (rcl >= 4 && existingSites.length < 10) {
            this.planStorage(room);
        }
        
        // PRIORITY 4.5: RCL 6 Critical Infrastructure
        if (rcl >= 6 && existingSites.length < 10) {
            this.planExtractor(room);    // Required for minerals
            this.planTerminal(room);      // Required for market
        }
        
        // PRIORITY 4.8: Labs (RCL 6+ advanced)
        if (rcl >= 6 && existingSites.length < 5) {
            this.planLabs(room);
        }
        
        // PRIORITY 5: Roads (nice to have, but not critical)
        // Only plan roads if we have < 5 sites total
        if (existingSites.length < 5) {
            this.planRoads(room);
        }
    }
    
    /**
     * Plan extensions near spawn
     */
    static planExtensions(room) {
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        
        const spawn = spawns[0];
        const rcl = room.controller.level;
        
        // Max extensions per RCL
        const maxExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][rcl];
        const existingExtensions = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        }).length;
        const extensionSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        }).length;
        
        const needed = maxExtensions - existingExtensions - extensionSites;
        
        if (needed <= 0) return;
        
        // Get sources to avoid blocking future link placement
        const sources = room.find(FIND_SOURCES);
        
        // Place extensions in a grid pattern near spawn
        const positions = [
            {dx: 2, dy: 0}, {dx: -2, dy: 0}, {dx: 0, dy: 2}, {dx: 0, dy: -2},
            {dx: 2, dy: 2}, {dx: -2, dy: 2}, {dx: 2, dy: -2}, {dx: -2, dy: -2},
            {dx: 3, dy: 0}, {dx: -3, dy: 0}, {dx: 0, dy: 3}, {dx: 0, dy: -3},
            {dx: 3, dy: 1}, {dx: 3, dy: -1}, {dx: -3, dy: 1}, {dx: -3, dy: -1},
            {dx: 1, dy: 3}, {dx: -1, dy: 3}, {dx: 1, dy: -3}, {dx: -1, dy: -3},
            {dx: 3, dy: 3}, {dx: -3, dy: 3}, {dx: 3, dy: -3}, {dx: -3, dy: -3},
            {dx: 4, dy: 0}, {dx: -4, dy: 0}, {dx: 0, dy: 4}, {dx: 0, dy: -4},
            {dx: 4, dy: 1}, {dx: 4, dy: -1}, {dx: -4, dy: 1}, {dx: -4, dy: -1}
        ];
        
        let placed = 0;
        for (const pos of positions) {
            if (placed >= needed) break;
            
            const x = spawn.pos.x + pos.dx;
            const y = spawn.pos.y + pos.dy;
            
            // Avoid placing extensions adjacent to sources (reserve for links at RCL 5)
            let tooCloseToSource = false;
            for (const source of sources) {
                const dist = Math.max(Math.abs(source.pos.x - x), Math.abs(source.pos.y - y));
                if (dist <= 1) {
                    tooCloseToSource = true;
                    break;
                }
            }
            if (tooCloseToSource) continue;
            
            const result = room.createConstructionSite(x, y, STRUCTURE_EXTENSION);
            if (result === OK) {
                placed++;
                console.log(`[Planner] Placed extension at ${x},${y}`);
            }
        }
    }
    
    /**
     * Plan containers at sources
     */
    static planContainers(room) {
        const sources = room.find(FIND_SOURCES);
        
        for (const source of sources) {
            // Check if container already exists nearby
            const nearbyContainer = source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            });
            
            const nearbySite = source.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 1, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            });
            
            if (nearbyContainer.length > 0 || nearbySite.length > 0) continue;
            
            // Find best position next to source
            const positions = [
                {dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1},
                {dx: 1, dy: 1}, {dx: -1, dy: 1}, {dx: 1, dy: -1}, {dx: -1, dy: -1}
            ];
            
            for (const pos of positions) {
                const x = source.pos.x + pos.dx;
                const y = source.pos.y + pos.dy;
                
                const result = room.createConstructionSite(x, y, STRUCTURE_CONTAINER);
                if (result === OK) {
                    console.log(`[Planner] Placed container at source ${source.id}`);
                    break;
                }
            }
        }
    }
    
    /**
     * Plan tower near spawn
     */
    static planTower(room) {
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        
        const spawn = spawns[0];
        const rcl = room.controller.level;
        const maxTowers = CONTROLLER_STRUCTURES[STRUCTURE_TOWER][rcl];
        
        const existingTowers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        }).length;
        
        const towerSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        }).length;
        
        if (existingTowers + towerSites >= maxTowers) return;
        
        // Place tower near spawn but not too close
        const positions = [
            {dx: 3, dy: 3}, {dx: -3, dy: 3}, {dx: 3, dy: -3}, {dx: -3, dy: -3},
            {dx: 4, dy: 2}, {dx: -4, dy: 2}, {dx: 4, dy: -2}, {dx: -4, dy: -2},
            {dx: 2, dy: 4}, {dx: -2, dy: 4}, {dx: 2, dy: -4}, {dx: -2, dy: -4}
        ];
        
        for (const pos of positions) {
            const x = spawn.pos.x + pos.dx;
            const y = spawn.pos.y + pos.dy;
            
            const result = room.createConstructionSite(x, y, STRUCTURE_TOWER);
            if (result === OK) {
                console.log(`[Planner] Placed tower at ${x},${y}`);
                break;
            }
        }
    }
    
    /**
     * Plan storage near spawn
     */
    static planStorage(room) {
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        
        if (room.storage) return; // Already have storage
        
        const storageSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_STORAGE
        });
        
        if (storageSites.length > 0) return;
        
        const spawn = spawns[0];
        
        // Place storage near spawn
        const positions = [
            {dx: 2, dy: 1}, {dx: -2, dy: 1}, {dx: 2, dy: -1}, {dx: -2, dy: -1},
            {dx: 1, dy: 2}, {dx: -1, dy: 2}, {dx: 1, dy: -2}, {dx: -1, dy: -2}
        ];
        
        for (const pos of positions) {
            const x = spawn.pos.x + pos.dx;
            const y = spawn.pos.y + pos.dy;
            
            const result = room.createConstructionSite(x, y, STRUCTURE_STORAGE);
            if (result === OK) {
                console.log(`[Planner] Placed storage at ${x},${y}`);
                break;
            }
        }
    }
    
    /**
     * Plan roads between key structures
     */
    static planRoads(room) {
        // Only plan roads if we have enough CPU
        if (Game.cpu.bucket < 5000) return;
        
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        
        const spawn = spawns[0];
        const sources = room.find(FIND_SOURCES);
        const controller = room.controller;
        
        // Plan roads to sources
        for (const source of sources) {
            this.planRoadPath(room, spawn.pos, source.pos);
        }
        
        // Plan road to controller
        if (controller) {
            this.planRoadPath(room, spawn.pos, controller.pos);
        }
    }
    
    /**
     * Plan a road path between two positions
     */
    static planRoadPath(room, from, to) {
        // Only plan a few roads at a time
        const roadSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_ROAD
        });
        
        if (roadSites.length > 10) return;
        
        const path = room.findPath(from, to, {
            ignoreCreeps: true,
            ignoreRoads: false
        });
        
        // Place roads on path (limit to 3 per run)
        let placed = 0;
        for (const step of path) {
            if (placed >= 3) break;
            
            // Don't place on structures
            const structures = room.lookForAt(LOOK_STRUCTURES, step.x, step.y);
            if (structures.length > 0) continue;
            
            const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, step.x, step.y);
            if (sites.length > 0) continue;
            
            const result = room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
            if (result === OK) {
                placed++;
            }
        }
    }
    
    /**
     * Plan links for energy distribution (RCL 5+)
     * Optimal placement:
     * - Link 1: Near sources (for harvesting)
     * - Link 2: Near spawn/extensions (for fast delivery)
     * - Link 3+: Near controller (RCL 7+, for upgraders)
     */
    static planLinks(room) {
        const rcl = room.controller.level;
        const maxLinks = CONTROLLER_STRUCTURES[STRUCTURE_LINK][rcl];
        
        const existingLinks = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK
        }).length;
        
        const linkSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_LINK
        }).length;
        
        if (existingLinks + linkSites >= maxLinks) return;
        
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        const spawn = spawns[0];
        
        // Find sources
        const sources = room.find(FIND_SOURCES);
        
        // Priority 1: Link near first source (for harvesting)
        // Try range 1 first, then range 2-3 if blocked
        if (existingLinks + linkSites === 0 && sources.length > 0) {
            let placed = false;
            
            for (let range = 1; range <= 3 && !placed; range++) {
                const source = sources[0];
                const positions = [];
                
                // Generate positions at this range
                for (let dx = -range; dx <= range; dx++) {
                    for (let dy = -range; dy <= range; dy++) {
                        const dist = Math.max(Math.abs(dx), Math.abs(dy));
                        if (dist === range) {
                            positions.push({ x: source.pos.x + dx, y: source.pos.y + dy });
                        }
                    }
                }
                
                for (const pos of positions) {
                    if (pos.x < 1 || pos.x > 48 || pos.y < 1 || pos.y > 48) continue;
                    
                    const terrain = room.getTerrain().get(pos.x, pos.y);
                    if (terrain === TERRAIN_MASK_WALL) continue;
                    
                    const structures = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
                    if (structures.length > 0) continue;
                    
                    const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y);
                    if (sites.length > 0) continue;
                    
                    const result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_LINK);
                    if (result === OK) {
                        console.log(`🔗 Placed link near source at ${pos.x},${pos.y} (range ${range})`);
                        placed = true;
                        return;
                    }
                }
            }
            
            // Fallback: If no source link possible, place near spawn instead
            if (!placed) {
                console.log(`⚠️ Cannot place link near source 1 (blocked), trying spawn link`);
            }
        }
        
        // Priority 2: Link near spawn (for energy distribution)
        if (existingLinks + linkSites === 1) {
            const positions = [
                { x: spawn.pos.x + 2, y: spawn.pos.y },
                { x: spawn.pos.x - 2, y: spawn.pos.y },
                { x: spawn.pos.x, y: spawn.pos.y + 2 },
                { x: spawn.pos.x, y: spawn.pos.y - 2 },
                { x: spawn.pos.x + 2, y: spawn.pos.y + 2 },
                { x: spawn.pos.x - 2, y: spawn.pos.y - 2 },
                { x: spawn.pos.x + 2, y: spawn.pos.y - 2 },
                { x: spawn.pos.x - 2, y: spawn.pos.y + 2 }
            ];
            
            for (const pos of positions) {
                const terrain = room.getTerrain().get(pos.x, pos.y);
                if (terrain === TERRAIN_MASK_WALL) continue;
                
                const structures = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
                if (structures.length > 0) continue;
                
                const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y);
                if (sites.length > 0) continue;
                
                const result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_LINK);
                if (result === OK) {
                    console.log(`🔗 Placed link near spawn at ${pos.x},${pos.y}`);
                    return;
                }
            }
        }
        
        // Priority 3: Link near second source (RCL 5+)
        if (existingLinks + linkSites === 2 && sources.length > 1 && rcl >= 5) {
            const source = sources[1];
            const positions = [
                { x: source.pos.x + 1, y: source.pos.y },
                { x: source.pos.x - 1, y: source.pos.y },
                { x: source.pos.x, y: source.pos.y + 1 },
                { x: source.pos.x, y: source.pos.y - 1 },
                { x: source.pos.x + 1, y: source.pos.y + 1 },
                { x: source.pos.x - 1, y: source.pos.y - 1 },
                { x: source.pos.x + 1, y: source.pos.y - 1 },
                { x: source.pos.x - 1, y: source.pos.y + 1 }
            ];
            
            for (const pos of positions) {
                const terrain = room.getTerrain().get(pos.x, pos.y);
                if (terrain === TERRAIN_MASK_WALL) continue;
                
                const structures = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
                if (structures.length > 0) continue;
                
                const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y);
                if (sites.length > 0) continue;
                
                const result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_LINK);
                if (result === OK) {
                    console.log(`🔗 Placed link near second source at (${pos.x},${pos.y})`);
                    return;
                }
            }
        }
    }
    
    /**
     * Plan extractor on mineral deposit (RCL 6)
     * Required for mineral harvesting
     */
    static planExtractor(room) {
        // Check if already exists
        const existingExtractors = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTRACTOR
        });
        
        const extractorSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_EXTRACTOR
        });
        
        if (existingExtractors.length > 0 || extractorSites.length > 0) return;
        
        // Find mineral deposit
        const minerals = room.find(FIND_MINERALS);
        if (minerals.length === 0) return;
        
        const mineral = minerals[0];
        const result = room.createConstructionSite(mineral.pos, STRUCTURE_EXTRACTOR);
        
        if (result === OK) {
            console.log(`⛏️ Placed extractor on ${mineral.mineralType} at (${mineral.pos.x},${mineral.pos.y})`);
        }
    }
    
    /**
     * Plan terminal near storage (RCL 6)
     * Required for market operations
     */
    static planTerminal(room) {
        // Check if already exists
        const existingTerminals = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TERMINAL
        });
        
        const terminalSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_TERMINAL
        });
        
        if (existingTerminals.length > 0 || terminalSites.length > 0) return;
        
        // Place near storage if it exists
        const storage = room.storage;
        if (!storage) {
            console.log(`⚠️ No storage found, deferring terminal placement`);
            return;
        }
        
        // Search positions adjacent to storage
        const positions = [
            { x: storage.pos.x + 1, y: storage.pos.y },
            { x: storage.pos.x - 1, y: storage.pos.y },
            { x: storage.pos.x, y: storage.pos.y + 1 },
            { x: storage.pos.x, y: storage.pos.y - 1 },
            { x: storage.pos.x + 1, y: storage.pos.y + 1 },
            { x: storage.pos.x - 1, y: storage.pos.y - 1 },
            { x: storage.pos.x + 1, y: storage.pos.y - 1 },
            { x: storage.pos.x - 1, y: storage.pos.y + 1 }
        ];
        
        for (const pos of positions) {
            const terrain = room.getTerrain().get(pos.x, pos.y);
            if (terrain === TERRAIN_MASK_WALL) continue;
            
            const structures = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
            if (structures.length > 0) continue;
            
            const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y);
            if (sites.length > 0) continue;
            
            const result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_TERMINAL);
            if (result === OK) {
                console.log(`🏪 Placed terminal at (${pos.x},${pos.y})`);
                return;
            }
        }
    }
    
    /**
     * Plan labs in cluster formation (RCL 6)
     * Labs must be within range 2 of each other for reactions
     */
    static planLabs(room) {
        const rcl = room.controller.level;
        const maxLabs = CONTROLLER_STRUCTURES[STRUCTURE_LAB][rcl];
        
        // Count existing labs
        const existingLabs = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LAB
        });
        
        const labSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_LAB
        });
        
        const totalLabs = existingLabs.length + labSites.length;
        if (totalLabs >= maxLabs) return;
        
        // Find spawn for reference position
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return;
        
        // Place labs in a tight cluster near spawn
        // Search in expanding radius from spawn
        for (let radius = 5; radius <= 10; radius++) {
            const positions = this.getPositionsInRadius(spawn.pos, radius);
            
            for (const pos of positions) {
                // Validate position
                const terrain = room.getTerrain().get(pos.x, pos.y);
                if (terrain === TERRAIN_MASK_WALL) continue;
                
                const structures = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
                if (structures.length > 0) continue;
                
                const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y);
                if (sites.length > 0) continue;
                
                // Check if within range 2 of existing labs (if any exist)
                if (existingLabs.length > 0) {
                    const nearbyLabs = existingLabs.filter(lab => 
                        Math.abs(lab.pos.x - pos.x) <= 2 && 
                        Math.abs(lab.pos.y - pos.y) <= 2
                    );
                    
                    if (nearbyLabs.length === 0) continue; // Must be near existing labs
                }
                
                const result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_LAB);
                if (result === OK) {
                    console.log(`🧪 Placed lab at (${pos.x},${pos.y})`);
                    return;
                }
            }
        }
    }
    
    /**
     * Get positions in a radius around a center point
     */
    static getPositionsInRadius(center, radius) {
        const positions = [];
        
        for (let x = center.x - radius; x <= center.x + radius; x++) {
            for (let y = center.y - radius; y <= center.y + radius; y++) {
                if (x < 0 || x > 49 || y < 0 || y > 49) continue;
                
                const dist = Math.max(Math.abs(x - center.x), Math.abs(y - center.y));
                if (dist === radius) {
                    positions.push({ x, y });
                }
            }
        }
        
        return positions;
    }
}

module.exports = StructurePlanner;
