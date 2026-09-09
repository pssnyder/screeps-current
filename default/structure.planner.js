/**
 * STRUCTURE PLANNER
 * 
 * Automatically plans and places construction sites for optimal room layout
 * v4.0.0 - Traffic-aware road planning (pheromone arteries)
 * 
 * Road design:
 * - PathFinder prefers roads (cost 1) over plain (cost 1) and swamp (cost 5)
 * - Main arteries: spawn→sources, spawn→storage, storage→controller
 * - Roads on swamp save 5x energy compared to roads on plain
 * - Traffic tracker identifies high-traffic corridors for optimal placement
 */

const TrafficTracker = require('./traffic.tracker');

class StructurePlanner {
    /**
     * Plan and place construction sites for a room
     * v4.0.0: Intelligent road planning based on traffic patterns
     * 
     * NEW PRIORITY ORDER:
     * 1. Extensions (energy capacity)
     * 2. Towers (defense)
     * 2.5. Traffic-aware arteries (spawn↔sources↔storage↔controller)
     * 3. Links (RCL 5+)
     * 4. Containers (energy logistics)
     * 5. Storage (game-changer at RCL 4+)
     * 6. RCL 6+ infrastructure
     * 7. Random optimization roads
     */
    static run(room) {
        // Only plan once every 100 ticks (but roads more often if needed)
        const planFrequency = Game.time % 100 === 0;
        const planRoadsFrequency = Game.time % 25 === 0; // Check roads more often
        
        if (!planFrequency && !planRoadsFrequency) return;
        
        // Update traffic heatmap every tick (lightweight operation)
        TrafficTracker.updateTraffic(room);
        
        const rcl = room.controller.level;
        const existingSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        
        // PRIORITY 1: Extensions (critical for energy capacity)
        if (planFrequency && rcl >= 2 && existingSites.length < 10) {
            this.planExtensions(room);
        }
        
        // PRIORITY 2: Towers (critical for defense at RCL 3+)
        if (planFrequency && rcl >= 3 && existingSites.length < 10) {
            this.planTower(room);
        }
        
        // ★ PRIORITY 2.5: STRATEGIC ROADS (ARTERIES - THE PHEROMONE LAYER)
        // These are the main highways - pathfinder naturally prefers them
        // Plan MORE FREQUENTLY than other structures (every 25 ticks, not 100)
        if (planRoadsFrequency && existingSites.length < 8) {
            this.planStrategicRoads(room);  // Main arteries first!
        }
        
        // PRIORITY 3: Links (GAME-CHANGER at RCL 5+)
        if (planFrequency && rcl >= 5 && existingSites.length < 10) {
            this.planLinks(room);
        }
        
        // PRIORITY 4: Containers (important for economy)
        if (planFrequency && rcl >= 2 && existingSites.length < 10) {
            this.planContainers(room);
        }
        
        // PRIORITY 5: Storage (game-changer at RCL 4+)
        if (planFrequency && rcl >= 4 && existingSites.length < 10) {
            this.planStorage(room);
        }
        
        // PRIORITY 5.5: RCL 6 Critical Infrastructure
        if (planFrequency && rcl >= 6 && existingSites.length < 10) {
            this.planExtractor(room);    // Required for minerals
            this.planTerminal(room);      // Required for market
        }
        
        // PRIORITY 5.8: Labs (RCL 6+ advanced)
        if (planFrequency && rcl >= 6 && existingSites.length < 5) {
            this.planLabs(room);
        }
        
        // PRIORITY 6: Optimization roads (fill in gaps after arteries)
        if (planRoadsFrequency && existingSites.length < 5) {
            this.planOptimizationRoads(room);
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
     * Plan STRATEGIC ROADS (Arteries)
     * 
     * These are high-priority roads on main traffic corridors:
     * - Spawn ↔ Sources (energy collection)
     * - Spawn/Sources ↔ Storage (energy logistics)
     * - Storage ↔ Controller (upgrading)
     * 
     * PathFinder naturally prefers roads, so these become the pheromone layer
     */
    static planStrategicRoads(room) {
        if (Game.cpu.bucket < 3000) return;
        
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        
        const spawn = spawns[0];
        const sources = room.find(FIND_SOURCES);
        const storage = room.storage;
        const controller = room.controller;
        
        // Get existing road count
        const roadSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_ROAD
        });
        
        if (roadSites.length > 15) return; // Don't plan too many at once
        
        // Arteries by priority
        const arteries = [];
        
        // Artery 1: Spawn → Each Source (critical for energy)
        // Priority: 100 (highest)
        for (const source of sources) {
            arteries.push({from: spawn.pos, to: source.pos, priority: 100, label: `spawn→src`});
        }
        
        // Artery 2: Sources → Storage (if storage exists)
        // Priority: 90
        if (storage) {
            for (const source of sources) {
                arteries.push({from: source.pos, to: storage.pos, priority: 90, label: `src→storage`});
            }
            // Also direct spawn → storage
            arteries.push({from: spawn.pos, to: storage.pos, priority: 85, label: `spawn→storage`});
        }
        
        // Artery 3: Storage → Controller (if both exist)
        // Priority: 80
        if (storage && controller) {
            arteries.push({from: storage.pos, to: controller.pos, priority: 80, label: `storage→ctrl`});
        }
        
        // Sort by priority
        arteries.sort((a, b) => b.priority - a.priority);
        
        // Plan roads on each artery (skip ones that already have enough roads)
        let placed = 0;
        for (const artery of arteries) {
            if (placed >= 2) break; // Only place 2 per tick to avoid spam
            if (roadSites.length + placed >= 15) break;
            
            placed += this.planRoadPath(room, artery.from, artery.to, artery.label);
        }
    }
    
    /**
     * Plan OPTIMIZATION ROADS (fill-ins)
     * After arteries are built, fill in secondary roads
     */
    static planOptimizationRoads(room) {
        if (Game.cpu.bucket < 2000) return;
        
        const sources = room.find(FIND_SOURCES);
        if (sources.length < 2) return; // Only useful with multiple sources
        
        // Connect multiple sources to each other
        for (let i = 0; i < sources.length - 1; i++) {
            for (let j = i + 1; j < sources.length; j++) {
                this.planRoadPath(room, sources[i].pos, sources[j].pos, `src→src`);
            }
        }
    }
    
    /**
     * Plan a road path between two positions
     * Prioritizes swamp tiles (5x energy savings)
     * Returns number of roads placed
     */
    static planRoadPath(room, from, to, label = '') {
        // Get existing road count
        const roadSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_ROAD
        });
        
        if (roadSites.length > 20) return 0;
        
        const path = room.findPath(from, to, {
            ignoreCreeps: true,
            ignoreRoads: false,
            maxOps: 200
        });
        
        if (!path || path.length === 0) return 0;
        
        const terrain = room.getTerrain();
        const existingRoads = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_ROAD
        });
        const roadSet = new Set();
        for (const road of existingRoads) {
            roadSet.add(`${road.pos.x},${road.pos.y}`);
        }
        
        // Separate path into swamp and plain tiles (swamp = higher priority)
        const swampPositions = [];
        const plainPositions = [];
        
        for (const step of path) {
            const key = `${step.x},${step.y}`;
            if (roadSet.has(key)) continue; // Already has road
            
            // Check for structures/sites
            const structures = room.lookForAt(LOOK_STRUCTURES, step.x, step.y);
            if (structures.length > 0) continue;
            
            const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, step.x, step.y);
            if (sites.length > 0) continue;
            
            // Separate by terrain
            const terrainType = terrain.get(step.x, step.y);
            if (terrainType === TERRAIN_MASK_SWAMP) {
                swampPositions.push(step);
            } else if (terrainType === 0) {  // Plain
                plainPositions.push(step);
            }
            // Skip walls
        }
        
        // Place roads: SWAMP FIRST (5x energy savings!)
        let placed = 0;
        const maxPerRun = 3;
        
        // Priority: swamp tiles first
        for (const pos of swampPositions) {
            if (placed >= maxPerRun) break;
            const result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
            if (result === OK) {
                placed++;
                if (label) console.log(`🛣️ [Planner] Road on swamp: ${label}`);
            }
        }
        
        // Then plain tiles
        for (const pos of plainPositions) {
            if (placed >= maxPerRun) break;
            const result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
            if (result === OK) {
                placed++;
            }
        }
        
        return placed;
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
