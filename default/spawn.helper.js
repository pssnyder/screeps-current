/**
 * SPAWN HELPER
 * 
 * Simple spawning logic for testing/simulation
 * Use this when you want manual control or testing without the full engine
 */

class SpawnHelper {
    /**
     * Simple auto-spawn logic based on role counts
     */
    static autoSpawn(spawn) {
        // Count creeps by role
        const creeps = _.filter(Game.creeps, (creep) => creep.room.name === spawn.room.name);
        const harvesters = _.filter(creeps, (creep) => creep.memory.role === 'harvester');
        const upgraders = _.filter(creeps, (creep) => creep.memory.role === 'upgrader');
        const builders = _.filter(creeps, (creep) => creep.memory.role === 'builder');
        
        // Count sources in room
        const sources = spawn.room.find(FIND_SOURCES);
        const numSources = sources.length;
        
        // Minimum creep counts
        const MIN_HARVESTERS = numSources * 2;  // 2 per source
        const MIN_UPGRADERS = 2;
        const MIN_BUILDERS = 1;
        
        // Spawn priority: harvesters > upgraders > builders
        if (harvesters.length < MIN_HARVESTERS) {
            this.spawnCreep(spawn, 'harvester');
        } else if (upgraders.length < MIN_UPGRADERS) {
            this.spawnCreep(spawn, 'upgrader');
        } else if (builders.length < MIN_BUILDERS) {
            this.spawnCreep(spawn, 'builder');
        }
    }
    
    /**
     * Spawn a creep of the specified role
     */
    static spawnCreep(spawn, role) {
        // Generate unique name
        const newName = `${role}_${Game.time}`;
        
        // Get body based on available energy
        const body = this.getBody(role, spawn.room.energyAvailable);
        
        if (body.length === 0) {
            return ERR_NOT_ENOUGH_ENERGY;
        }
        
        // Spawn the creep
        const result = spawn.spawnCreep(body, newName, {
            memory: { 
                role: role,
                working: false
            }
        });
        
        if (result === OK) {
            console.log(`[Spawn] Creating ${role}: ${newName} (${body.length} parts)`);
        }
        
        return result;
    }
    
    /**
     * Get optimal body for role based on available energy
     */
    static getBody(role, energy) {
        // Body templates
        const bodies = {
            harvester: [
                [WORK, WORK, CARRY, CARRY, MOVE, MOVE],  // 500 energy
                [WORK, CARRY, MOVE, MOVE],               // 300 energy
                [WORK, CARRY, MOVE]                      // 200 energy
            ],
            upgrader: [
                [WORK, WORK, WORK, CARRY, MOVE, MOVE],   // 550 energy
                [WORK, WORK, CARRY, MOVE],               // 350 energy
                [WORK, CARRY, MOVE]                      // 200 energy
            ],
            builder: [
                [WORK, WORK, CARRY, CARRY, MOVE, MOVE],  // 500 energy
                [WORK, CARRY, MOVE, MOVE],               // 300 energy
                [WORK, CARRY, MOVE]                      // 200 energy
            ],
            defender: [
                [ATTACK, ATTACK, MOVE, MOVE],            // 260 energy
                [ATTACK, MOVE, MOVE],                    // 210 energy
                [ATTACK, MOVE]                           // 130 energy
            ]
        };
        
        const roleBody = bodies[role] || bodies.harvester;
        
        // Find largest body that fits energy budget
        for (const body of roleBody) {
            const cost = body.reduce((sum, part) => sum + BODYPART_COST[part], 0);
            if (cost <= energy) {
                return body;
            }
        }
        
        return [];
    }
    
    /**
     * Quick console commands for testing in simulation room
     */
    static quick() {
        const spawn = Game.spawns[Object.keys(Game.spawns)[0]];
        if (!spawn) {
            console.log('❌ No spawn found!');
            return;
        }
        
        console.log('🚀 Quick Spawn Commands:');
        console.log('  SpawnHelper.h() - Spawn harvester');
        console.log('  SpawnHelper.u() - Spawn upgrader');
        console.log('  SpawnHelper.b() - Spawn builder');
        console.log('  SpawnHelper.d() - Spawn defender');
        console.log('  SpawnHelper.auto() - Auto-spawn balanced team');
    }
    
    static h() { return this.spawnCreep(Game.spawns[Object.keys(Game.spawns)[0]], 'harvester'); }
    static u() { return this.spawnCreep(Game.spawns[Object.keys(Game.spawns)[0]], 'upgrader'); }
    static b() { return this.spawnCreep(Game.spawns[Object.keys(Game.spawns)[0]], 'builder'); }
    static d() { return this.spawnCreep(Game.spawns[Object.keys(Game.spawns)[0]], 'defender'); }
    static auto() { return this.autoSpawn(Game.spawns[Object.keys(Game.spawns)[0]]); }
}

module.exports = SpawnHelper;
