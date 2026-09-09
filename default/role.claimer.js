/**
 * Role: Claimer
 * Purpose: Claim remote room controllers to expand territory
 * Body: [CLAIM, MOVE] (650 energy) or [CLAIM, CLAIM, MOVE, MOVE] (1,300 energy)
 * 
 * Claimers travel to target rooms and claim the controller.
 * After successful claim, they suicide to free up creep capacity.
 */

class RoleClaimer {
    
    /**
     * Run claimer behavior
     * PHASE 2: After claiming, switch to martyr mode (decoy)
     */
    static run(creep) {
        // Validate target room is set
        if (!creep.memory.targetRoom) {
            console.log(`⚠️ Claimer ${creep.name} has no target room assigned`);
            return;
        }
        
        // PHASE 2: If in martyr mode, handle it here
        if (creep.memory.martyr) {
            this.executeMartyr(creep);
            return;
        }
        
        const targetRoom = creep.memory.targetRoom;
        
        // If not in target room, move there
        if (creep.room.name !== targetRoom) {
            const exit = creep.room.findExitTo(targetRoom);
            if (exit === ERR_NO_PATH || exit === ERR_INVALID_ARGS) {
                console.log(`❌ Claimer ${creep.name} cannot path to ${targetRoom}`);
                creep.memory.stuck = true;
                return;
            }
            
            const exitPos = creep.pos.findClosestByRange(exit);
            creep.moveTo(exitPos, {
                visualizePathStyle: {stroke: '#ffffff'},
                reusePath: 50 // Long paths, reuse heavily
            });
            
            // Visual feedback
            creep.say('🚀 Claim!');
            return;
        }
        
        // We're in the target room
        const controller = creep.room.controller;
        
        if (!controller) {
            console.log(`❌ Room ${targetRoom} has no controller (highway room?)`);
            creep.suicide();
            return;
        }
        
        // Check if already owned
        if (controller.my) {
            console.log(`✅ Controller in ${targetRoom} already claimed!`);
            
            // PHASE 2: Switch to martyr mode instead of suiciding
            if (!creep.memory.martyr) {
                console.log(`💀 Claimer ${creep.name} entering martyr mode to protect workers`);
                creep.memory.martyr = true;
                creep.memory.martyrStartedAt = Game.time;
            }
            
            // Sign the controller with custom message
            if (creep.memory.signText && !controller.sign) {
                if (creep.signController(controller, creep.memory.signText) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, {
                        visualizePathStyle: {stroke: '#ffffff'}
                    });
                }
            } else {
                // Switch to martyr mode (continue to executeMartyr)
                this.executeMartyr(creep);
            }
            return;
        }
        
        // Check if owned by someone else
        if (controller.owner) {
            console.log(`⚠️ Controller in ${targetRoom} owned by ${controller.owner.username}`);
            console.log(`   Cannot claim - need to destroy their spawn first!`);
            creep.memory.failed = true;
            return;
        }
        
        // Check if reserved
        if (controller.reservation) {
            console.log(`⚠️ Controller in ${targetRoom} reserved by ${controller.reservation.username}`);
            console.log(`   Proceeding with claim anyway...`);
        }
        
        // Attempt to claim
        const result = creep.claimController(controller);
        
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, {
                visualizePathStyle: {stroke: '#ffffff'}
            });
            creep.say('🎯 Claim');
        } else if (result === OK) {
            console.log(`✅ Successfully claimed ${targetRoom}!`);
            console.log(`   Controller level: ${controller.level}`);
            console.log(`   Progress: ${controller.progress}/${controller.progressTotal}`);
            
            // Record in memory
            if (!Memory.expansion) Memory.expansion = {};
            if (!Memory.expansion.ownedRooms) Memory.expansion.ownedRooms = {};
            Memory.expansion.ownedRooms[targetRoom] = {
                claimedAt: Game.time,
                claimerName: creep.name,
                status: 'claimed'
            };
            
            creep.say('🎉 CLAIMED');
        } else if (result === ERR_GCL_NOT_ENOUGH) {
            console.log(`❌ Cannot claim ${targetRoom} - GCL too low!`);
            console.log(`   Current GCL: ${Game.gcl.level}, Need: ${Object.keys(Game.rooms).filter(r => Game.rooms[r].controller && Game.rooms[r].controller.my).length + 1}`);
            creep.memory.failed = true;
        } else {
            console.log(`❌ Failed to claim ${targetRoom}: ${result}`);
            creep.memory.failed = true;
        }
    }
    
    /**
     * PHASE 2: Martyr mode - act as decoy to protect workers
     * Patrols claimed room and intercepts threats
     */
    static executeMartyr(creep) {
        const claimedRoom = Game.rooms[creep.memory.targetRoom];
        
        if (!claimedRoom) return; // Room not visible
        
        // Check for hostile creeps
        const hostiles = claimedRoom.find(FIND_HOSTILE_CREEPS);
        
        if (hostiles.length > 0) {
            // Move toward closest hostile to draw aggro
            const threat = creep.pos.findClosestByRange(hostiles);
            if (threat) {
                creep.moveTo(threat, {
                    visualizePathStyle: { stroke: '#ff0000' },
                    reusePath: 3
                });
                creep.say('💀 martyr');
            }
            return;
        }
        
        // No threats - patrol near claimed room center
        if (!creep.memory.martyrPatrolTarget) {
            creep.memory.martyrPatrolTarget = { x: 25, y: 25 };
        }
        
        // Move to patrol position
        if (creep.room.name !== creep.memory.targetRoom) {
            // Move to claimed room
            const exitDir = creep.room.findExitTo(creep.memory.targetRoom);
            if (exitDir !== ERR_NO_PATH) {
                const exit = creep.pos.findClosestByPath(exitDir);
                if (exit) {
                    creep.moveTo(exit, {
                        visualizePathStyle: { stroke: '#ffaa00' },
                        reusePath: 15
                    });
                    creep.say('🏃 patrol');
                }
            }
        } else {
            // In claimed room - patrol
            const patrolPos = new RoomPosition(25, 25, creep.room.name);
            if (creep.pos.getRangeTo(patrolPos) > 3) {
                creep.moveTo(patrolPos, {
                    visualizePathStyle: { stroke: '#0088ff' },
                    reusePath: 15
                });
                creep.say('🚔 patrol');
            } else {
                creep.say('💀 ready');
            }
        }
    }
    
    /**
     * Generate optimal body based on energy available
     */
    static generateBody(energyAvailable) {
        // Minimum: [CLAIM, MOVE] = 650 energy
        if (energyAvailable < 650) {
            return null; // Cannot spawn
        }
        
        // Optimal: [CLAIM, CLAIM, MOVE, MOVE] = 1,300 energy (faster claiming)
        if (energyAvailable >= 1300) {
            return [CLAIM, CLAIM, MOVE, MOVE];
        }
        
        // Basic: [CLAIM, MOVE] = 650 energy
        return [CLAIM, MOVE];
    }
    
    /**
     * Calculate cost of claimer body
     */
    static calculateCost(body) {
        return body.reduce((sum, part) => sum + BODYPART_COST[part], 0);
    }
}

module.exports = RoleClaimer;
