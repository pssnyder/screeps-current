/**
 * DEFENDER ROLE
 * 
 * Intelligent military unit for room defense
 */

class RoleDefender {
    static run(creep, strategy) {
        // Find hostile creeps
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        
        if (hostiles.length > 0) {
            this.defend(creep, hostiles);
        } else {
            // No threats, patrol near controller
            this.patrol(creep);
        }
    }
    
    /**
     * Defend against hostile creeps
     */
    static defend(creep, hostiles) {
        // Target selection: prioritize by threat level
        const threats = hostiles.map(h => {
            const attackParts = h.body.filter(
                p => p.type === ATTACK || p.type === RANGED_ATTACK
            ).length;
            const distance = creep.pos.getRangeTo(h);
            
            // Higher threat = more attack parts, closer distance
            const threatLevel = attackParts * 10 - distance;
            
            return { creep: h, threat: threatLevel };
        });
        
        threats.sort((a, b) => b.threat - a.threat);
        const target = threats[0].creep;
        
        // Attack or ranged attack
        const attackResult = creep.attack(target);
        const rangedResult = creep.rangedAttack(target);
        
        if (attackResult === ERR_NOT_IN_RANGE && rangedResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                visualizePathStyle: { stroke: '#ff0000' }
            });
        }
    }
    
    /**
     * Patrol when no threats present
     */
    static patrol(creep) {
        // Patrol between controller and spawn
        const controller = creep.room.controller;
        
        if (!controller) return;
        
        if (!creep.memory.patrolTarget) {
            creep.memory.patrolTarget = 'controller';
        }
        
        if (creep.memory.patrolTarget === 'controller') {
            if (creep.pos.getRangeTo(controller) < 3) {
                creep.memory.patrolTarget = 'spawn';
            } else {
                creep.moveTo(controller);
            }
        } else {
            const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
            if (spawn) {
                if (creep.pos.getRangeTo(spawn) < 3) {
                    creep.memory.patrolTarget = 'controller';
                } else {
                    creep.moveTo(spawn);
                }
            }
        }
    }
}

module.exports = RoleDefender;
