/**
 * ROLE MANAGER
 * 
 * Intelligent role-based behavior system
 * Routes creeps to their role-specific AI modules
 */

const RoleHarvester = require('./role.harvester');
const RoleUpgrader = require('./role.upgrader');
const RoleBuilder = require('./role.builder');
const RoleHauler = require('./role.hauler');
const RoleDefender = require('./role.defender');
const RoleMiner = require('./role.miner');
const RoleScout = require('./role.scout');
const RoleClaimer = require('./role.claimer');
const RolePioneer = require('./role.pioneer');
const RoleSentinel = require('./role.sentinel');

class RoleManager {
    /**
     * Execute creep behavior based on role
     */
    static executeCreep(creep, strategy) {
        // Ensure creep has a role
        if (!creep.memory.role) {
            console.log(`[Warning] Creep ${creep.name} has no role assigned`);
            creep.memory.role = 'harvester';
        }
        
        // Route to appropriate role handler
        const role = creep.memory.role;
        
        try {
            switch (role) {
                case 'harvester':
                    RoleHarvester.run(creep, strategy);
                    break;
                case 'upgrader':
                    RoleUpgrader.run(creep, strategy);
                    break;
                case 'builder':
                    RoleBuilder.run(creep, strategy);
                    break;
                case 'hauler':
                    RoleHauler.run(creep, strategy);
                    break;
                case 'defender':
                    RoleDefender.run(creep, strategy);
                    break;
                case 'miner':
                    RoleMiner.run(creep, strategy);
                    break;
                case 'scout':
                    RoleScout.run(creep);
                    break;
                case 'claimer':
                    RoleClaimer.run(creep);
                    break;
                case 'pioneer':
                    RolePioneer.run(creep);
                    break;
                case 'sentinel':
                    RoleSentinel.run(creep, strategy);
                    break;
                default:
                    console.log(`[Warning] Unknown role: ${role} for ${creep.name}`);
                    RoleHarvester.run(creep, strategy); // Default to harvester
            }
        } catch (error) {
            console.log(`[Error] Role ${role} execution failed for ${creep.name}: ${error.message}`);
        }
    }
    
    /**
     * Reassign creep to new role dynamically
     */
    static reassignRole(creep, newRole) {
        console.log(`[RoleManager] Reassigning ${creep.name} from ${creep.memory.role} to ${newRole}`);
        creep.memory.role = newRole;
        creep.memory.working = false;
        creep.memory.targetId = null;
        creep.memory.sourceId = null;
    }
}

module.exports = RoleManager;
