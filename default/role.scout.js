/**
 * Role: Scout
 * Purpose: Explore distant rooms to gather intelligence
 * Body: [MOVE] - 50 energy, fast and cheap
 * 
 * Scouts move to target rooms, report findings, then move to next target.
 * Dies after visiting all assigned rooms or after 1500 ticks.
 */

class RoleScout {
    
    /**
     * Run scout behavior
     */
    static run(creep) {
        // Initialize target list if not set
        if (!creep.memory.targets) {
            console.log(`🔍 Scout ${creep.name} has no targets - needs assignment`);
            return;
        }
        
        // Get current target
        if (!creep.memory.currentTarget || creep.memory.currentTarget === creep.room.name) {
            // We've reached current target, move to next
            if (creep.memory.currentTarget === creep.room.name) {
                this.reportRoom(creep);
            }
            
            const nextTarget = creep.memory.targets.shift();
            if (!nextTarget) {
                console.log(`✅ Scout ${creep.name} completed all targets - suiciding`);
                creep.suicide();
                return;
            }
            
            creep.memory.currentTarget = nextTarget;
            console.log(`🔍 Scout ${creep.name} heading to ${nextTarget}`);
        }
        
        // Move to target room
        const targetRoom = creep.memory.currentTarget;
        if (creep.room.name !== targetRoom) {
            const exit = creep.room.findExitTo(targetRoom);
            if (exit === ERR_NO_PATH || exit === ERR_INVALID_ARGS) {
                console.log(`⚠️ Scout ${creep.name} cannot path to ${targetRoom}`);
                creep.memory.currentTarget = null; // Skip this room
                return;
            }
            const exitPos = creep.pos.findClosestByRange(exit);
            creep.moveTo(exitPos, {
                visualizePathStyle: {stroke: '#00ffff'},
                reusePath: 20
            });
        } else {
            // We're in the target room, move to center to ensure visibility
            const center = new RoomPosition(25, 25, targetRoom);
            if (creep.pos.getRangeTo(center) > 10) {
                creep.moveTo(center, {
                    visualizePathStyle: {stroke: '#00ffff'},
                    reusePath: 10
                });
            }
        }
    }
    
    /**
     * Report findings from current room
     */
    static reportRoom(creep) {
        const room = creep.room;
        const roomName = room.name;
        
        // Initialize Memory.rooms if needed
        if (!Memory.rooms) Memory.rooms = {};
        if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
        
        const report = {
            scoutedAt: Game.time,
            scoutName: creep.name
        };
        
        // Check ownership
        if (room.controller) {
            if (room.controller.owner) {
                report.owner = room.controller.owner.username;
                report.level = room.controller.level;
            } else if (room.controller.reservation) {
                report.reserved = room.controller.reservation.username;
                report.reserveEnd = room.controller.reservation.ticksToEnd;
            } else {
                report.available = true;
            }
            
            // Check for sign
            if (room.controller.sign) {
                report.sign = {
                    username: room.controller.sign.username,
                    text: room.controller.sign.text,
                    time: room.controller.sign.time
                };
            }
            
            report.controllerPos = {
                x: room.controller.pos.x,
                y: room.controller.pos.y
            };
        } else {
            report.highway = true;
        }
        
        // Count resources
        const sources = room.find(FIND_SOURCES);
        report.sources = sources.length;
        report.sourcePositions = sources.map(s => ({x: s.pos.x, y: s.pos.y}));
        
        const minerals = room.find(FIND_MINERALS);
        if (minerals.length > 0) {
            report.mineral = minerals[0].mineralType;
            report.mineralPos = {x: minerals[0].pos.x, y: minerals[0].pos.y};
        }
        
        // Check for hostiles
        const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
        report.hostileCreeps = hostileCreeps.length;
        
        const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES, {
            filter: s => s.structureType !== STRUCTURE_CONTROLLER
        });
        report.hostileStructures = hostileStructures.length;
        
        // Analyze terrain
        const terrain = room.getTerrain();
        let swampCount = 0;
        let wallCount = 0;
        
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                const tile = terrain.get(x, y);
                if (tile === TERRAIN_MASK_SWAMP) swampCount++;
                if (tile === TERRAIN_MASK_WALL) wallCount++;
            }
        }
        
        report.terrain = {
            swamp: Math.round((swampCount / 2500) * 100),
            wall: Math.round((wallCount / 2500) * 100)
        };
        
        // Calculate score
        report.score = this.calculateScore(report, roomName);
        
        // Store in memory
        Memory.rooms[roomName].scout = report;
        
        // Console output
        console.log(`📋 Scout Report: ${roomName}`);
        console.log(`   Sources: ${report.sources} | Mineral: ${report.mineral || 'None'}`);
        if (report.owner) {
            console.log(`   ⚠️ OWNED by ${report.owner} (RCL ${report.level})`);
        } else if (report.reserved) {
            console.log(`   ⚠️ RESERVED by ${report.reserved}`);
        } else if (report.available) {
            console.log(`   ✅ AVAILABLE for claiming`);
        }
        if (report.sign) {
            console.log(`   📝 Sign: "${report.sign.text}" - ${report.sign.username}`);
        }
        if (report.hostileCreeps > 0 || report.hostileStructures > 0) {
            console.log(`   ⚠️ Hostiles: ${report.hostileCreeps} creeps, ${report.hostileStructures} structures`);
        }
        console.log(`   Terrain: ${report.terrain.swamp}% swamp, ${report.terrain.wall}% walls`);
        console.log(`   💯 Score: ${report.score}`);
    }
    
    /**
     * Calculate expansion score for a room
     */
    static calculateScore(report, roomName) {
        if (report.highway) return 0;
        if (report.owner) return 0;
        
        let score = 100;
        
        // Sources are most important (40 points each)
        score += (report.sources || 0) * 40;
        
        // Distance penalty (calculate from home room)
        const homeRoom = Object.keys(Game.rooms).find(r => 
            Game.rooms[r].controller && Game.rooms[r].controller.my
        );
        if (homeRoom) {
            const distance = Game.map.getRoomLinearDistance(homeRoom, roomName);
            score -= distance * 15;
        }
        
        // Hostile penalties
        score -= (report.hostileCreeps || 0) * 30;
        score -= (report.hostileStructures || 0) * 20;
        
        // Reservation penalty
        if (report.reserved) score -= 40;
        
        // Terrain penalties
        if (report.terrain) {
            score -= report.terrain.swamp * 0.5;
            score -= report.terrain.wall * 0.3;
        }
        
        // Mineral bonus (minor)
        if (report.mineral && ['U', 'L', 'K', 'Z', 'X'].includes(report.mineral)) {
            score += 10;
        }
        
        return Math.round(score);
    }
}

module.exports = RoleScout;
