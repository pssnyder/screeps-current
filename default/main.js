/**
 * SCREEPS ENGINE - Main Entry Point
 * Author: Pat Snyder
 * 
 * Chess-engine inspired AI system for Screeps World
 * Implements search-based decision making, position evaluation, and intelligent behavior
 */

const Engine = require('./engine.core');
const MemoryManager = require('./memory.manager');
const Analytics = require('./analytics');
const SpawnHelper = require('./spawn.helper');
const ConsoleHelper = require('./console.helper');
const MarketManager = require('./market.manager');

// Expose helpers to global scope for console commands
global.SpawnHelper = SpawnHelper;
global.Analytics = Analytics;
global.Engine = Engine;
global.MarketManager = MarketManager;

// Initialize memory structure on first run
if (!Memory.engine) {
    Memory.engine = {
        version: '3.1.0',
        initialized: Game.time,
        stats: {},
        decisions: [],
        learning: {}
    };
    
    // Welcome message
    console.log('═══════════════════════════════════════════');
    console.log(`🧠 SCREEPS ENGINE v${Memory.engine.version} - INITIALIZED`);
    console.log('═══════════════════════════════════════════');
    console.log('Chess-engine inspired AI system');
    console.log('v3.0.0: Minerals & Markets - miner role, automated trading');
    console.log('+ Technical debt fixes based on TIPS optimization guide');
    console.log('Type help() for available commands');
    console.log('═══════════════════════════════════════════');
}

module.exports.loop = function() {
    // v2.0: CPU profiling - track time per module
    const cpuStart = Game.cpu.getUsed();
    const profiling = {};
    
    // Clean up dead creeps from memory
    let checkpoint = Game.cpu.getUsed();
    MemoryManager.cleanDeadCreeps();
    profiling.memoryCleanup = Game.cpu.getUsed() - checkpoint;
    
    // Collect analytics data for each tick
    checkpoint = Game.cpu.getUsed();
    Analytics.recordTick();
    profiling.analytics = Game.cpu.getUsed() - checkpoint;
    
    // Visual feedback for spawning creeps (from tutorial)
    checkpoint = Game.cpu.getUsed();
    for (const spawnName in Game.spawns) {
        const spawn = Game.spawns[spawnName];
        if (spawn.spawning) {
            const spawningCreep = Game.creeps[spawn.spawning.name];
            const role = spawningCreep ? spawningCreep.memory.role : 'unknown';
            
            // Emoji map for visual feedback
            const roleEmojis = {
                harvester: '⛏️',
                upgrader: '⚡',
                builder: '🔨',
                hauler: '🚚',
                defender: '⚔️'
            };
            
            spawn.room.visual.text(
                (roleEmojis[role] || '🛠️') + role,
                spawn.pos.x + 1,
                spawn.pos.y,
                {align: 'left', opacity: 0.8}
            );
        }
    }
    profiling.visuals = Game.cpu.getUsed() - checkpoint;
    
    // Main engine execution - evaluate position and make decisions
    try {
        checkpoint = Game.cpu.getUsed();
        Engine.run();
        profiling.engine = Game.cpu.getUsed() - checkpoint;
        
        // Warn if engine is consuming too much CPU
        if (profiling.engine > 15 && Game.time % 10 === 0) {
            console.log(`⚠️ High CPU: Engine used ${profiling.engine.toFixed(2)} CPU`);
        }
    } catch (error) {
        console.log(`[ERROR] Engine execution failed: ${error.message}`);
        console.log(error.stack);
    }
    
    // v3.0: Market operations for automated trading
    try {
        checkpoint = Game.cpu.getUsed();
        const marketManager = new MarketManager();
        marketManager.run();
        profiling.market = Game.cpu.getUsed() - checkpoint;
    } catch (error) {
        console.log(`[ERROR] Market manager failed: ${error.message}`);
    }
    
    // Store profiling data for profile() command
    profiling.total = Game.cpu.getUsed() - cpuStart;
    profiling.tick = Game.time;
    Memory.profiling = profiling;
    
    // Periodic analytics and learning
    if (Game.time % 100 === 0) {
        Analytics.analyze();
        
        // Record dashboard telemetry for Mission Control
        Analytics.recordDashboardTelemetry();
        
        // Clean old stats periodically
        MemoryManager.cleanOldStats();
    }
    
    // Display stats every 100 ticks (reduced from 10 to prevent CPU spikes)
    if (Game.time % 100 === 0) {
        const creepsByRole = {};
        for (const name in Game.creeps) {
            const role = Game.creeps[name].memory.role || 'unknown';
            creepsByRole[role] = (creepsByRole[role] || 0) + 1;
        }
        
        const totalCpu = Game.cpu.getUsed();
        const cpuPercent = ((totalCpu / Game.cpu.limit) * 100).toFixed(0);
        
        console.log(`[Tick ${Game.time}] Creeps: ${Object.keys(Game.creeps).length} | ` +
                    `Rooms: ${Object.keys(Game.rooms).length} | ` +
                    `CPU: ${totalCpu.toFixed(2)}/${Game.cpu.limit} (${cpuPercent}%) | ` +
                    `Bucket: ${Game.cpu.bucket}`);
        
        // Show creep composition
        const composition = Object.keys(creepsByRole)
            .map(role => `${role}: ${creepsByRole[role]}`)
            .join(', ');
        if (composition) {
            console.log(`  └─ ${composition}`);
        }
    }
};
