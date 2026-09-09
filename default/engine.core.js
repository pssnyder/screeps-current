/**
 * SCREEPS ENGINE - Core Decision Making System
 * 
 * Inspired by chess engine architecture:
 * - Position evaluation
 * - Move generation
 * - Search algorithms
 * - Best move selection
 * 
 * v4.0.0 - Traffic-aware road planning (pheromone layer system)
 */

const Evaluator = require('./evaluator');
const DecisionTree = require('./decision.tree');
const RoleManager = require('./role.manager');
const SpawnController = require('./spawn.controller');
const TowerController = require('./tower.controller');
const StructurePlanner = require('./structure.planner');
const LinkManager = require('./link.manager');
const ExpansionManager = require('./expansion.manager');
const MemoryManager = require('./memory.manager');
const TrafficTracker = require('./traffic.tracker');

class EngineCore {
    /**
     * Main engine execution loop
     * This is called every game tick
     */
    static run() {
        // BIO-INSPIRED: Initialize colony-wide pheromone registry (the "nest")
        MemoryManager.initColonyRegistry();
        
        // Phase 1: Evaluate current position (like chess position evaluation)
        const gameState = this.evaluateGameState();
        
        // Phase 2: Generate and execute strategic decisions
        const strategy = DecisionTree.generateStrategy(gameState);
        
        // Phase 3: Execute room-level operations
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            
            if (!room.controller || !room.controller.my) continue;
            
            // ★ NEW: Update traffic heatmap for intelligent road planning
            // This runs every tick and is lightweight (decays over time)
            TrafficTracker.updateTraffic(room);
            
            // Evaluate room position
            const roomEval = Evaluator.evaluateRoom(room);
            
            // Auto-plan structures (v4.0.0: includes traffic-aware roads)
            StructurePlanner.run(room);
            
            // Manage link transfers (v3.1, throttled)
            if (Game.time % 3 === 0) { // Every 3 ticks
                LinkManager.run(room);
            }
            
            // Make spawn decisions
            SpawnController.run(room, roomEval, strategy);
            
            // Control towers
            TowerController.run(room, roomEval);
        }
        
        // Phase 4: Execute creep-level operations
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            RoleManager.executeCreep(creep, strategy);
        }
        
        // Phase 5: Expansion Management (every tick)
        ExpansionManager.run();
        
        // Store evaluation for learning
        Memory.engine.lastEvaluation = gameState;
    }
    
    /**
     * Evaluate overall game state
     * Similar to chess position evaluation: material, position, control
     */
    static evaluateGameState() {
        const state = {
            score: 0,
            rooms: {},
            threats: [],
            opportunities: [],
            resources: {
                energy: 0,
                minerals: {}
            },
            military: {
                offense: 0,
                defense: 0
            },
            economy: {
                income: 0,
                efficiency: 0
            }
        };
        
        // Evaluate each room
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                const roomEval = Evaluator.evaluateRoom(room);
                state.rooms[roomName] = roomEval;
                
                // Aggregate scores (like chess material counting)
                state.score += roomEval.score;
                state.resources.energy += roomEval.resources.energy;
                state.military.offense += roomEval.military.offense;
                state.military.defense += roomEval.military.defense;
                state.economy.income += roomEval.economy.income;
            }
        }
        
        // Calculate efficiency metrics
        const creepCount = Object.keys(Game.creeps).length;
        state.economy.efficiency = creepCount > 0 ? 
            state.economy.income / creepCount : 0;
        
        return state;
    }
}

module.exports = EngineCore;
