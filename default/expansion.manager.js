/**
 * EXPANSION MANAGER
 * 
 * Coordinates multi-room expansion strategy
 * Manages claimer and pioneer spawning
 * Monitors new room development
 * Places initial structures in optimal locations
 */

class ExpansionManager {
    
    /**
     * Main execution - called every tick
     */
    static run() {
        // Initialize expansion memory
        if (!Memory.expansion) {
            Memory.expansion = {
                enabled: false,
                ownedRooms: {},
                targets: [],
                activeOperations: []
            };
        }
        
        // Skip if expansion disabled
        if (!Memory.expansion.enabled) {
            return;
        }
        
        // Process each active expansion operation
        this.processOperations();
        
        // Check if we can start new operations
        this.checkNewExpansions();
        
        // Manage new rooms (structure planning, pioneer spawning)
        this.manageNewRooms();
    }
    
    /**
     * Process active expansion operations
     */
    static processOperations() {
        if (!Memory.expansion.activeOperations) return;
        
        for (let i = Memory.expansion.activeOperations.length - 1; i >= 0; i--) {
            const op = Memory.expansion.activeOperations[i];
            
            // Check if claimer exists
            const claimer = Game.creeps[op.claimerName];
            if (!claimer && !op.claimed) {
                console.log(`⚠️ Claimer ${op.claimerName} died before claiming ${op.targetRoom}`);
                Memory.expansion.activeOperations.splice(i, 1);
                continue;
            }
            
            // Check if room is claimed
            const room = Game.rooms[op.targetRoom];
            if (room && room.controller && room.controller.my) {
                if (!op.claimed) {
                    console.log(`✅ Successfully claimed ${op.targetRoom}!`);
                    op.claimed = true;
                    op.claimedAt = Game.time;
                    
                    // Record in ownedRooms
                    if (!Memory.expansion.ownedRooms[op.targetRoom]) {
                        Memory.expansion.ownedRooms[op.targetRoom] = {
                            claimedAt: Game.time,
                            status: 'colonizing'
                        };
                    }
                    
                    // Place initial spawn construction site
                    this.placeInitialSpawn(op.targetRoom);
                    
                    // Spawn pioneers
                    this.requestPioneers(op.targetRoom, op.pioneerCount || 3);
                }
            }
            
            // Check pioneer status
            const pioneers = Object.values(Game.creeps).filter(c => 
                c.memory.role === 'pioneer' && c.memory.targetRoom === op.targetRoom
            );
            
            op.pioneersAlive = pioneers.length;
            
            // Check if room has spawn
            if (room && room.find(FIND_MY_SPAWNS).length > 0) {
                if (!op.spawnBuilt) {
                    console.log(`🎉 Spawn completed in ${op.targetRoom}! Room is now self-sufficient.`);
                    op.spawnBuilt = true;
                    op.spawnBuiltAt = Game.time;
                    
                    // Update status
                    if (Memory.expansion.ownedRooms[op.targetRoom]) {
                        Memory.expansion.ownedRooms[op.targetRoom].status = 'established';
                    }
                }
            }
            
            // Clean up completed operations after 1000 ticks
            if (op.spawnBuilt && Game.time - op.spawnBuiltAt > 1000) {
                console.log(`✅ Expansion to ${op.targetRoom} complete - removing from active operations`);
                Memory.expansion.activeOperations.splice(i, 1);
            }
        }
    }
    
    /**
     * Check if we should start new expansion operations
     */
    static checkNewExpansions() {
        // Don't start new operations if one is already active
        if (Memory.expansion.activeOperations && Memory.expansion.activeOperations.length > 0) {
            return;
        }
        
        // Check if we have targets queued
        if (!Memory.expansion.targets || Memory.expansion.targets.length === 0) {
            return;
        }
        
        // Get next target
        const target = Memory.expansion.targets[0];
        
        // Validate prerequisites
        const canExpand = this.checkExpansionPrerequisites(target);
        if (!canExpand.ready) {
            if (Game.time % 100 === 0) {
                console.log(`⏳ Cannot expand to ${target.room} yet: ${canExpand.reason}`);
            }
            return;
        }
        
        // Start expansion operation
        console.log(`🚀 Starting expansion to ${target.room}!`);
        this.startExpansion(target);
    }
    
    /**
     * Check if prerequisites for expansion are met
     */
    static checkExpansionPrerequisites(target) {
        const homeRoom = Object.values(Game.rooms).find(r => r.controller && r.controller.my);
        if (!homeRoom) {
            return { ready: false, reason: 'No home room found' };
        }
        
        // Check GCL
        const currentRoomCount = Object.keys(Game.rooms).filter(r => 
            Game.rooms[r].controller && Game.rooms[r].controller.my
        ).length;
        
        if (currentRoomCount >= Game.gcl.level) {
            return { ready: false, reason: `GCL ${Game.gcl.level} - need level ${currentRoomCount + 1}` };
        }
        
        // Check energy reserves (need at least 50k for claimer + pioneers)
        const storage = homeRoom.storage;
        const energyAvailable = storage ? storage.store[RESOURCE_ENERGY] : 0;
        
        if (energyAvailable < (target.minEnergy || 50000)) {
            return { 
                ready: false, 
                reason: `Only ${energyAvailable} energy (need ${target.minEnergy || 50000})` 
            };
        }
        
        // Check CPU headroom
        if (Game.cpu.bucket < 5000) {
            return { ready: false, reason: `CPU bucket too low (${Game.cpu.bucket})` };
        }
        
        return { ready: true };
    }
    
    /**
     * Start an expansion operation
     */
    static startExpansion(target) {
        const homeRoom = Object.values(Game.rooms).find(r => r.controller && r.controller.my);
        if (!homeRoom) return;
        
        // Spawn claimer
        const claimerName = this.spawnClaimer(homeRoom, target.room, target.signText);
        if (!claimerName) {
            console.log(`❌ Failed to spawn claimer for ${target.room}`);
            return;
        }
        
        // Create operation record
        const operation = {
            targetRoom: target.room,
            claimerName: claimerName,
            pioneerCount: target.pioneerCount || 3,
            startedAt: Game.time,
            claimed: false,
            spawnBuilt: false,
            pioneersAlive: 0
        };
        
        Memory.expansion.activeOperations.push(operation);
        
        // Remove from targets queue
        Memory.expansion.targets.shift();
        
        console.log(`✅ Expansion operation started for ${target.room}`);
    }
    
    /**
     * Spawn a claimer creep
     */
    static spawnClaimer(homeRoom, targetRoom, signText) {
        const spawns = homeRoom.find(FIND_MY_SPAWNS).filter(s => !s.spawning);
        if (spawns.length === 0) return null;
        
        const spawn = spawns[0];
        const RoleClaimer = require('./role.claimer');
        
        const body = RoleClaimer.generateBody(homeRoom.energyCapacityAvailable);
        if (!body) {
            console.log(`❌ Not enough energy for claimer (need 650)`);
            return null;
        }
        
        const name = `claimer_${targetRoom}_${Game.time}`;
        const memory = {
            role: 'claimer',
            targetRoom: targetRoom,
            signText: signText || `Claimed by AI on ${new Date().toISOString()}`
        };
        
        const result = spawn.spawnCreep(body, name, { memory: memory });
        
        if (result === OK) {
            console.log(`✅ Spawning claimer: ${name} → ${targetRoom}`);
            return name;
        } else {
            console.log(`❌ Failed to spawn claimer: ${result}`);
            return null;
        }
    }
    
    /**
     * Request pioneer spawns for a target room
     */
    static requestPioneers(targetRoom, count) {
        if (!Memory.expansion.pioneerRequests) {
            Memory.expansion.pioneerRequests = [];
        }
        
        Memory.expansion.pioneerRequests.push({
            targetRoom: targetRoom,
            count: count,
            spawned: 0,
            requestedAt: Game.time
        });
        
        console.log(`📋 Requested ${count} pioneers for ${targetRoom}`);
    }
    
    /**
     * Spawn pioneers (called from spawn controller)
     */
    static spawnPioneer(homeRoom, targetRoom) {
        const spawns = homeRoom.find(FIND_MY_SPAWNS).filter(s => !s.spawning);
        if (spawns.length === 0) return null;
        
        const spawn = spawns[0];
        const RolePioneer = require('./role.pioneer');
        
        const body = RolePioneer.generateBody(homeRoom.energyCapacityAvailable);
        if (!body) {
            console.log(`❌ Not enough energy for pioneer`);
            return null;
        }
        
        const name = `pioneer_${targetRoom}_${Game.time}`;
        const memory = {
            role: 'pioneer',
            targetRoom: targetRoom
        };
        
        const result = spawn.spawnCreep(body, name, { memory: memory });
        
        if (result === OK) {
            console.log(`✅ Spawning pioneer: ${name} → ${targetRoom}`);
            return name;
        } else {
            return null;
        }
    }
    
    /**
     * Place initial spawn construction site in optimal location
     */
    static placeInitialSpawn(roomName) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller) return;
        
        // Check if spawn site already exists
        const existingSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_SPAWN
        });
        if (existingSites.length > 0) return;
        
        // Find optimal spawn location near controller
        const controller = room.controller;
        const spawnPos = this.findOptimalSpawnPosition(room, controller);
        
        if (spawnPos) {
            const result = room.createConstructionSite(spawnPos.x, spawnPos.y, STRUCTURE_SPAWN);
            if (result === OK) {
                console.log(`✅ Placed spawn construction site at (${spawnPos.x},${spawnPos.y}) in ${roomName}`);
            } else {
                console.log(`⚠️ Failed to place spawn in ${roomName}: ${result}`);
            }
        }
    }
    
    /**
     * Find optimal spawn position
     */
    static findOptimalSpawnPosition(room, controller) {
        // Look for position near controller but also near sources
        const sources = room.find(FIND_SOURCES);
        
        // Target: 4-6 tiles from controller, 4-8 tiles from sources
        const terrain = room.getTerrain();
        
        for (let range = 4; range <= 8; range++) {
            const positions = this.getPositionsAtRange(controller.pos, range);
            
            for (const pos of positions) {
                // Check if valid terrain
                if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) continue;
                
                // Check if not on exit
                if (pos.x <= 1 || pos.x >= 48 || pos.y <= 1 || pos.y >= 48) continue;
                
                // Check distance to sources (prefer 5-10 tiles)
                let goodSourceDistance = true;
                for (const source of sources) {
                    const dist = Math.max(
                        Math.abs(source.pos.x - pos.x),
                        Math.abs(source.pos.y - pos.y)
                    );
                    if (dist < 4) goodSourceDistance = false; // Too close
                }
                
                if (goodSourceDistance) {
                    return pos;
                }
            }
        }
        
        // Fallback: just find any valid position near controller
        for (let range = 3; range <= 10; range++) {
            const positions = this.getPositionsAtRange(controller.pos, range);
            for (const pos of positions) {
                if (terrain.get(pos.x, pos.y) !== TERRAIN_MASK_WALL) {
                    return pos;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Get positions at specific range from center
     */
    static getPositionsAtRange(center, range) {
        const positions = [];
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) === range) {
                    const x = center.x + dx;
                    const y = center.y + dy;
                    if (x >= 2 && x <= 47 && y >= 2 && y <= 47) {
                        positions.push(new RoomPosition(x, y, center.roomName));
                    }
                }
            }
        }
        return positions;
    }
    
    /**
     * Manage newly claimed rooms
     */
    static manageNewRooms() {
        // Process pioneer requests
        if (Memory.expansion.pioneerRequests && Memory.expansion.pioneerRequests.length > 0) {
            const homeRoom = Object.values(Game.rooms).find(r => r.controller && r.controller.my && r.find(FIND_MY_SPAWNS).length > 0);
            if (!homeRoom) return;
            
            for (let i = Memory.expansion.pioneerRequests.length - 1; i >= 0; i--) {
                const request = Memory.expansion.pioneerRequests[i];
                
                if (request.spawned >= request.count) {
                    Memory.expansion.pioneerRequests.splice(i, 1);
                    continue;
                }
                
                // Try to spawn a pioneer
                const name = this.spawnPioneer(homeRoom, request.targetRoom);
                if (name) {
                    request.spawned++;
                }
            }
        }
    }
}

module.exports = ExpansionManager;
