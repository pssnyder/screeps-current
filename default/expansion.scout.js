/**
 * EXPANSION SCOUT
 * 
 * Analyzes nearby rooms for expansion opportunities
 * Run from console: require('expansion.scout').scanNearby('W13N57', 2)
 */

class ExpansionScout {
    /**
     * Scan rooms around a center point
     * @param {string} centerRoom - Starting room (e.g., 'W13N57')
     * @param {number} range - How many rooms out to scan (1-3 recommended)
     */
    static scanNearby(centerRoom, range = 1) {
        const targets = this.getRoomsInRange(centerRoom, range);
        const results = [];
        
        console.log(`═══════════════════════════════════════════`);
        console.log(`🔍 EXPANSION SCOUT - Scanning ${targets.length} rooms`);
        console.log(`═══════════════════════════════════════════\n`);
        
        for (const roomName of targets) {
            const analysis = this.analyzeRoom(roomName);
            results.push(analysis);
        }
        
        // Sort by score (best first)
        results.sort((a, b) => b.score - a.score);
        
        // Display results
        results.forEach((result, index) => {
            const rank = index + 1;
            const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
            
            console.log(`${emoji} ${rank}. ${result.room} (Score: ${result.score})`);
            console.log(`   Status: ${result.status}`);
            console.log(`   Distance: ${result.distance} rooms`);
            
            if (result.visible) {
                console.log(`   Sources: ${result.sources} | Mineral: ${result.mineral}`);
                console.log(`   Controller: ${result.controllerPos}`);
                console.log(`   Hostiles: ${result.hostiles > 0 ? '⚠️ ' + result.hostiles : '✅ None'}`);
                console.log(`   Terrain: ${result.swampPercent}% swamp, ${result.wallPercent}% walls`);
            } else {
                console.log(`   ⚠️ Not visible - send scout creep first`);
            }
            
            if (result.recommendation) {
                console.log(`   💡 ${result.recommendation}`);
            }
            
            console.log('');
        });
        
        console.log(`═══════════════════════════════════════════`);
        console.log(`RECOMMENDATION: Expand to ${results[0].room} first`);
        console.log(`═══════════════════════════════════════════`);
        
        // Store results in memory for later use
        if (!Memory.expansion) Memory.expansion = {};
        Memory.expansion.scoutData = {
            scannedAt: Game.time,
            centerRoom: centerRoom,
            results: results
        };
        
        return results;
    }
    
    /**
     * Get list of rooms within range
     */
    static getRoomsInRange(centerRoom, range) {
        const parsed = this.parseRoomName(centerRoom);
        const rooms = [];
        
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (dx === 0 && dy === 0) continue; // Skip center room
                
                const targetX = parsed.x + dx;
                const targetY = parsed.y + dy;
                const roomName = this.formatRoomName(targetX, targetY);
                rooms.push(roomName);
            }
        }
        
        return rooms;
    }
    
    /**
     * Analyze a specific room
     */
    static analyzeRoom(roomName) {
        const room = Game.rooms[roomName];
        const centerRoom = Object.keys(Game.rooms).find(r => Game.rooms[r].controller && Game.rooms[r].controller.my);
        const distance = this.getRoomDistance(centerRoom, roomName);
        
        const analysis = {
            room: roomName,
            visible: !!room,
            distance: distance,
            score: 0,
            status: 'Unknown',
            recommendation: null
        };
        
        if (!room) {
            analysis.status = 'Not visible';
            analysis.score = 50 - (distance * 10); // Prefer closer rooms
            analysis.recommendation = 'Send scout creep to explore';
            return analysis;
        }
        
        // Check ownership
        if (room.controller) {
            if (room.controller.my) {
                analysis.status = 'Already owned by you';
                analysis.score = 0;
                return analysis;
            } else if (room.controller.owner) {
                analysis.status = `Owned by ${room.controller.owner.username}`;
                analysis.score = 0;
                analysis.recommendation = 'Avoid - already claimed';
                return analysis;
            } else if (room.controller.reservation) {
                analysis.status = `Reserved by ${room.controller.reservation.username}`;
                analysis.score = 20 - (distance * 5);
                analysis.recommendation = 'Can claim but expect conflict';
            } else {
                analysis.status = 'Unowned - Available';
            }
        } else {
            analysis.status = 'No controller - Highway room';
            analysis.score = 0;
            return analysis;
        }
        
        // Count resources
        const sources = room.find(FIND_SOURCES);
        analysis.sources = sources.length;
        
        const minerals = room.find(FIND_MINERALS);
        analysis.mineral = minerals.length > 0 ? minerals[0].mineralType : 'Unknown';
        
        // Check for hostiles
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        analysis.hostiles = hostiles.length;
        
        const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
        analysis.hostileStructures = hostileStructures.length;
        
        // Controller position
        if (room.controller) {
            analysis.controllerPos = `(${room.controller.pos.x},${room.controller.pos.y})`;
        }
        
        // Analyze terrain
        const terrain = room.getTerrain();
        let swampCount = 0;
        let wallCount = 0;
        const total = 50 * 50;
        
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                const tile = terrain.get(x, y);
                if (tile === TERRAIN_MASK_SWAMP) swampCount++;
                if (tile === TERRAIN_MASK_WALL) wallCount++;
            }
        }
        
        analysis.swampPercent = Math.round((swampCount / total) * 100);
        analysis.wallPercent = Math.round((wallCount / total) * 100);
        
        // Calculate score
        let score = 100;
        
        // Sources (most important)
        score += sources.length * 40; // 2 sources = +80, 3 sources = +120
        
        // Distance penalty
        score -= distance * 15; // Closer is better
        
        // Terrain penalties
        score -= analysis.swampPercent * 0.5; // Swamps slow movement
        score -= analysis.wallPercent * 0.3; // Walls limit building
        
        // Hostile penalties
        score -= hostiles.length * 30;
        score -= hostileStructures.length * 20;
        
        // Mineral bonus (minor)
        const valuableMinerals = ['U', 'L', 'K', 'Z', 'X'];
        if (valuableMinerals.includes(analysis.mineral)) {
            score += 10;
        }
        
        analysis.score = Math.round(score);
        
        // Generate recommendation
        if (analysis.hostiles > 0 || analysis.hostileStructures > 0) {
            analysis.recommendation = '⚠️ Hostiles present - high risk';
        } else if (sources.length >= 2 && distance <= 2) {
            analysis.recommendation = '✅ Excellent choice - claim ASAP';
        } else if (sources.length >= 2) {
            analysis.recommendation = '✅ Good option - solid resources';
        } else if (sources.length === 1) {
            analysis.recommendation = '⚠️ Only 1 source - poor economy';
        }
        
        return analysis;
    }
    
    /**
     * Parse room name into coordinates
     */
    static parseRoomName(roomName) {
        const match = roomName.match(/^([WE])(\d+)([NS])(\d+)$/);
        if (!match) return null;
        
        const x = (match[1] === 'W' ? -1 : 1) * parseInt(match[2]);
        const y = (match[3] === 'N' ? 1 : -1) * parseInt(match[4]);
        
        return { x, y };
    }
    
    /**
     * Format coordinates back to room name
     */
    static formatRoomName(x, y) {
        const xDir = x < 0 ? 'W' : 'E';
        const yDir = y >= 0 ? 'N' : 'S';
        return `${xDir}${Math.abs(x)}${yDir}${Math.abs(y)}`;
    }
    
    /**
     * Calculate linear distance between rooms
     */
    static getRoomDistance(room1, room2) {
        const pos1 = this.parseRoomName(room1);
        const pos2 = this.parseRoomName(room2);
        
        return Math.max(
            Math.abs(pos1.x - pos2.x),
            Math.abs(pos1.y - pos2.y)
        );
    }
    
    /**
     * Quick scan of specific rooms
     */
    static quickScan(...roomNames) {
        console.log(`═══════════════════════════════════════════`);
        console.log(`🔍 QUICK SCAN - ${roomNames.length} rooms`);
        console.log(`═══════════════════════════════════════════\n`);
        
        const results = [];
        
        for (const roomName of roomNames) {
            const analysis = this.analyzeRoom(roomName);
            results.push(analysis);
            
            console.log(`📍 ${roomName}`);
            console.log(`   Score: ${analysis.score}`);
            console.log(`   ${analysis.status}`);
            
            if (analysis.visible) {
                console.log(`   Sources: ${analysis.sources} | Mineral: ${analysis.mineral}`);
                console.log(`   Hostiles: ${analysis.hostiles > 0 ? '⚠️ ' + analysis.hostiles : '✅ None'}`);
            }
            
            if (analysis.recommendation) {
                console.log(`   💡 ${analysis.recommendation}`);
            }
            console.log('');
        }
        
        return results;
    }
}

module.exports = ExpansionScout;
