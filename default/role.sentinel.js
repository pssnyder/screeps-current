/**
 * SENTINEL ROLE
 * 
 * Defensive bodyguard for harvesters in contested/adjacent rooms
 * v1.0: Rules of engagement - Only attack if fired upon
 * 
 * Body: [RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, TOUGH, TOUGH]
 * Purpose: Protect harvesters from hostiles via defensive counter-attack
 */

class RoleSentinel {
    static run(creep, strategy) {
        // Initialize memory if needed
        if (!creep.memory.assignment) {
            creep.memory.assignment = 'patrol'; // 'patrol' or 'defend'
            creep.memory.lastAttackedBy = null;
            creep.memory.lastAttackTick = -100;
        }

        // Track if this sentinel was attacked recently (enables retaliation window)
        const wasRecentlyAttacked = (Game.time - (creep.memory.lastAttackTick || 0)) < 5;

        // Scan for hostile creeps in nearby rooms
        const hostiles = this.findNearbyHostiles(creep);
        
        // Rules of engagement:
        // 1. If harvesters are in danger, engage
        // 2. If we were attacked in last 5 ticks, retaliate
        // 3. Otherwise, patrol/observe
        
        if (hostiles.length > 0 && (this.alliedCreepInDanger(creep, hostiles) || wasRecentlyAttacked)) {
            this.defend(creep, hostiles);
        } else if (hostiles.length > 0) {
            // Hostiles present but not attacking - maintain defensive stance
            this.observeHostiles(creep, hostiles);
        } else {
            // No threats - patrol near harvesters
            this.patrol(creep);
        }
    }

    /**
     * Defend against hostile creeps
     * Priority: Highest threat first (closest attackers)
     * PHASE 2 Integration: Check if claimer is martyr-ing, hold fire if so
     */
    static defend(creep, hostiles) {
        // Check if there's an active claimer martyr-ing in this room
        const claimers = creep.room.find(FIND_MY_CREEPS, {
            filter: c => c.memory.role === 'claimer' && c.memory.martyr === true && c.hits > 0
        });
        
        if (claimers.length > 0 && creep.pos.getRangeTo(claimers[0]) < 15) {
            // Claimer is actively sacrificing - hold fire and observe
            creep.say('👁️ cover');
            return;
        }
        
        // Filter to only those that can attack us or our allies
        const threats = hostiles.filter(h => {
            const hasAttackParts = h.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK);
            return hasAttackParts;
        });

        if (threats.length === 0) return; // No actual threats

        // Target closest threat
        const target = creep.pos.findClosestByRange(threats);
        
        if (!target) return;

        // Only ranged attack - keep distance for safety
        const rangedResult = creep.rangedAttack(target);
        
        if (rangedResult === ERR_NOT_IN_RANGE) {
            // Move to range (5-8 squares away for safety)
            const range = creep.pos.getRangeTo(target);
            if (range < 5) {
                // Too close - back away
                const dx = target.pos.x - creep.pos.x;
                const dy = target.pos.y - creep.pos.y;
                creep.moveTo(creep.pos.x - (dx > 0 ? 2 : -2), creep.pos.y - (dy > 0 ? 2 : -2), {
                    visualizePathStyle: { stroke: '#ff0000' },
                    reusePath: 5
                });
            } else {
                // Close to range
                creep.moveTo(target, {
                    visualizePathStyle: { stroke: '#ff0000' },
                    reusePath: 8
                });
            }
            creep.say('🛡️ defend');
        } else if (rangedResult === OK) {
            creep.say('⚔️ firing');
        }
    }

    /**
     * Observe hostiles without attacking - defensive stance
     */
    static observeHostiles(creep, hostiles) {
        const target = creep.pos.findClosestByRange(hostiles);
        
        if (target && creep.pos.getRangeTo(target) > 8) {
            // Move closer to maintain watch, but stay safe
            creep.moveTo(target, {
                visualizePathStyle: { stroke: '#ffaa00' },
                reusePath: 10
            });
            creep.say('👁️ watch');
        } else {
            creep.say('🚨 alert');
        }
    }

    /**
     * Patrol near assigned harvesters
     */
    static patrol(creep) {
        // Find nearby allied creeps (harvesters, haulers)
        const alliedWorkers = creep.room.find(FIND_MY_CREEPS, {
            filter: c => {
                const role = c.memory.role;
                return role === 'harvester' || role === 'hauler' || role === 'builder';
            }
        });

        if (alliedWorkers.length === 0) {
            // No workers to protect - patrol center of room
            if (!creep.memory.patrolCenter) {
                creep.memory.patrolCenter = { x: 25, y: 25 };
            }
            creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                visualizePathStyle: { stroke: '#0088ff' },
                reusePath: 15
            });
            creep.say('🔵 patrol');
            return;
        }

        // Find closest worker and patrol nearby
        const worker = creep.pos.findClosestByRange(alliedWorkers);
        if (!worker) return;

        const range = creep.pos.getRangeTo(worker);
        
        if (range > 10) {
            // Too far from workers - move closer
            creep.moveTo(worker, {
                visualizePathStyle: { stroke: '#0088ff' },
                reusePath: 10
            });
        } else if (range < 5) {
            // Too close - give workers space
            const dx = creep.pos.x - worker.pos.x;
            const dy = creep.pos.y - worker.pos.y;
            const norm = Math.sqrt(dx * dx + dy * dy);
            if (norm > 0) {
                const newX = creep.pos.x + (dx / norm) * 3;
                const newY = creep.pos.y + (dy / norm) * 3;
                creep.moveTo(newX, newY, {
                    visualizePathStyle: { stroke: '#0088ff' },
                    reusePath: 8
                });
            }
        }
        
        creep.say('🔵 patrol');
    }

    /**
     * Find hostile creeps within 10 squares
     */
    static findNearbyHostiles(creep) {
        return creep.room.find(FIND_HOSTILE_CREEPS, {
            filter: h => creep.pos.getRangeTo(h) <= 15
        });
    }

    /**
     * Check if any allied creep is under attack
     */
    static alliedCreepInDanger(creep, hostiles) {
        const allies = creep.room.find(FIND_MY_CREEPS);
        
        for (const ally of allies) {
            if (ally.id === creep.id) continue; // Skip self
            
            // Check if any hostile is close to this ally
            for (const hostile of hostiles) {
                const range = ally.pos.getRangeTo(hostile);
                
                // If hostile is very close (adjacent) or actively attacking-range
                if (range <= 3) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Called when sentinel takes damage (track for retaliation window)
     */
    static recordDamage(creep) {
        creep.memory.lastAttackTick = Game.time;
    }
}

module.exports = RoleSentinel;
