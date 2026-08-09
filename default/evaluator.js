/**
 * POSITION EVALUATOR
 * 
 * Chess-inspired position evaluation system
 * Assigns numeric scores to game state for decision making
 */

class Evaluator {
    /**
     * Evaluate a room's position and strength
     * Returns a comprehensive evaluation object with scores
     */
    static evaluateRoom(room) {
        const evaluation = {
            score: 0,
            resources: {
                energy: 0,
                stored: 0,
                capacity: 0,
                sources: []
            },
            military: {
                offense: 0,
                defense: 0,
                threats: []
            },
            economy: {
                income: 0,
                harvesters: 0,
                upgraders: 0,
                builders: 0
            },
            infrastructure: {
                controller: 0,
                spawns: 0,
                extensions: 0,
                towers: 0,
                storage: false
            },
            control: {
                level: 0,
                progress: 0,
                progressPercent: 0
            }
        };
        
        // Controller evaluation (like king safety in chess)
        if (room.controller && room.controller.my) {
            evaluation.control.level = room.controller.level;
            evaluation.control.progress = room.controller.progress;
            evaluation.control.progressPercent = room.controller.progress / 
                room.controller.progressTotal * 100;
            evaluation.infrastructure.controller = room.controller.level * 1000;
            evaluation.score += evaluation.infrastructure.controller;
        }
        
        // Resource evaluation (like material in chess)
        if (room.storage) {
            evaluation.resources.stored = room.storage.store.energy;
            evaluation.resources.capacity = room.storage.store.getCapacity();
            evaluation.infrastructure.storage = true;
            evaluation.score += Math.min(evaluation.resources.stored / 1000, 500); // Cap contribution
        }
        
        // Energy sources evaluation
        const sources = room.find(FIND_SOURCES);
        evaluation.resources.sources = sources.map(s => ({
            id: s.id,
            energy: s.energy,
            energyCapacity: s.energyCapacity,
            pos: s.pos
        }));
        evaluation.score += sources.length * 500;
        
        // Infrastructure evaluation (like piece development)
        const spawns = room.find(FIND_MY_SPAWNS);
        const extensions = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        });
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        });
        
        evaluation.infrastructure.spawns = spawns.length;
        evaluation.infrastructure.extensions = extensions.length;
        evaluation.infrastructure.towers = towers.length;
        
        evaluation.score += spawns.length * 500;
        evaluation.score += extensions.length * 50;
        evaluation.score += towers.length * 300;
        
        // Military evaluation (like attack/defense in chess)
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        if (hostiles.length > 0) {
            evaluation.military.threats = hostiles.map(h => ({
                id: h.id,
                owner: h.owner.username,
                parts: h.body.length,
                pos: h.pos
            }));
            evaluation.score -= hostiles.length * 500; // Penalty for threats
        }
        
        // Count military creeps
        const myCreeps = room.find(FIND_MY_CREEPS);
        myCreeps.forEach(creep => {
            const role = creep.memory.role;
            if (role === 'warrior' || role === 'defender') {
                evaluation.military.defense += creep.body.filter(
                    p => p.type === ATTACK || p.type === RANGED_ATTACK
                ).length * 100;
            }
        });
        
        evaluation.score += evaluation.military.defense;
        
        // Economic evaluation
        myCreeps.forEach(creep => {
            const role = creep.memory.role;
            if (role === 'harvester') {
                evaluation.economy.harvesters++;
                const workParts = creep.body.filter(p => p.type === WORK).length;
                evaluation.economy.income += workParts * 2; // 2 energy per WORK part per tick
            } else if (role === 'upgrader') {
                evaluation.economy.upgraders++;
            } else if (role === 'builder') {
                evaluation.economy.builders++;
            }
        });
        
        evaluation.score += evaluation.economy.income * 10;
        
        return evaluation;
    }
    
    /**
     * Evaluate a specific creep's effectiveness
     */
    static evaluateCreep(creep) {
        const bodyValue = creep.body.reduce((sum, part) => {
            const costs = {
                [WORK]: 100,
                [MOVE]: 50,
                [CARRY]: 50,
                [ATTACK]: 80,
                [RANGED_ATTACK]: 150,
                [HEAL]: 250,
                [TOUGH]: 10,
                [CLAIM]: 600
            };
            return sum + (costs[part.type] || 0);
        }, 0);
        
        const efficiency = creep.ticksToLive / CREEP_LIFE_TIME;
        
        return {
            value: bodyValue,
            efficiency: efficiency,
            score: bodyValue * efficiency
        };
    }
}

module.exports = Evaluator;
