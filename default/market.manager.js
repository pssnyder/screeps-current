/**
 * MARKET MANAGER
 * 
 * Automated market operations for resource trading
 * Monitors prices, creates orders, executes trades
 * 
 * v3.0.0: Initial implementation for Minerals & Markets update
 * Based on MARKET_OPERATIONS.md strategic guide
 */

class MarketManager {
    constructor() {
        this.config = {
            updateInterval: 1000,           // Check market every 1000 ticks (~40 min)
            minProfitMargin: 0.15,          // 15% minimum profit
            maxTransferDistance: 10,         // Max rooms for profitable trade
            sellThreshold: {                 // Minimum stockpile before selling
                [RESOURCE_HYDROGEN]: 10000,
                [RESOURCE_OXYGEN]: 10000,
                [RESOURCE_UTRIUM]: 8000,
                [RESOURCE_LEMERGIUM]: 8000,
                [RESOURCE_KEANIUM]: 8000,
                [RESOURCE_ZYNTHIUM]: 8000,
                [RESOURCE_CATALYST]: 8000
            },
            reserveAmount: {                 // Always keep this much
                [RESOURCE_HYDROGEN]: 5000,
                [RESOURCE_OXYGEN]: 5000,
                [RESOURCE_UTRIUM]: 3000,
                [RESOURCE_LEMERGIUM]: 3000,
                [RESOURCE_KEANIUM]: 3000,
                [RESOURCE_ZYNTHIUM]: 3000,
                [RESOURCE_CATALYST]: 3000
            },
            maxOrdersPerResource: 2,         // Don't spam market
            orderRefreshInterval: 5000       // Refresh old orders every 5000 ticks
        };
    }
    
    /**
     * Main execution - called from main loop
     */
    run() {
        // Initialize market memory
        if (!Memory.market) {
            Memory.market = {
                prices: {},
                orders: {},
                transactions: [],
                lastUpdate: 0,
                credits: Game.market.credits
            };
        }
        
        // Throttle execution
        if (Game.time % this.config.updateInterval !== 0) {
            return;
        }
        
        console.log(`[Market] Running market operations (Credits: ${Game.market.credits})`);
        
        // Update market analysis
        this.updateMarketPrices();
        
        // Manage existing orders
        this.manageOrders();
        
        // Create new sell orders for surplus
        this.createSellOrders();
        
        // Monitor transactions
        this.monitorTransactions();
        
        // Clean old data
        this.cleanOldData();
    }
    
    /**
     * Update market price database
     */
    updateMarketPrices() {
        const resources = [
            RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM,
            RESOURCE_LEMERGIUM, RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM,
            RESOURCE_CATALYST, RESOURCE_ENERGY
        ];
        
        for (const resource of resources) {
            try {
                const orders = Game.market.getAllOrders({ resourceType: resource });
                
                if (orders.length === 0) continue;
                
                const buyOrders = orders.filter(o => o.type === ORDER_BUY);
                const sellOrders = orders.filter(o => o.type === ORDER_SELL);
                
                // Calculate average prices
                const avgBuyPrice = buyOrders.length > 0 ?
                    buyOrders.reduce((sum, o) => sum + o.price, 0) / buyOrders.length : 0;
                
                const avgSellPrice = sellOrders.length > 0 ?
                    sellOrders.reduce((sum, o) => sum + o.price, 0) / sellOrders.length : 0;
                
                // Find best prices
                const highestBid = buyOrders.length > 0 ?
                    Math.max(...buyOrders.map(o => o.price)) : 0;
                
                const lowestAsk = sellOrders.length > 0 ?
                    Math.min(...sellOrders.map(o => o.price)) : Infinity;
                
                // Calculate spread
                const spread = lowestAsk !== Infinity && highestBid > 0 ?
                    ((lowestAsk - highestBid) / lowestAsk * 100).toFixed(2) : 0;
                
                // Store market data
                Memory.market.prices[resource] = {
                    avgBuyPrice: avgBuyPrice.toFixed(3),
                    avgSellPrice: avgSellPrice.toFixed(3),
                    highestBid: highestBid.toFixed(3),
                    lowestAsk: lowestAsk === Infinity ? 0 : lowestAsk.toFixed(3),
                    spread: spread,
                    volume: orders.reduce((sum, o) => sum + o.amount, 0),
                    timestamp: Game.time
                };
                
            } catch (error) {
                console.log(`[Market] Error updating ${resource} prices: ${error}`);
            }
        }
        
        Memory.market.lastUpdate = Game.time;
    }
    
    /**
     * Manage existing orders - cancel unprofitable ones
     */
    manageOrders() {
        for (const orderId in Game.market.orders) {
            const order = Game.market.orders[orderId];
            
            // Skip if order recently created
            if (Game.time - order.created < this.config.orderRefreshInterval) {
                continue;
            }
            
            // Check if order is still competitive
            if (!this.isOrderCompetitive(order)) {
                console.log(`[Market] Canceling uncompetitive order: ${orderId} (${order.resourceType})`);
                Game.market.cancelOrder(orderId);
            }
            
            // Cancel if no remaining amount
            if (order.remainingAmount === 0) {
                Game.market.cancelOrder(orderId);
            }
        }
    }
    
    /**
     * Check if order is still competitive in market
     */
    isOrderCompetitive(order) {
        const marketData = Memory.market.prices[order.resourceType];
        if (!marketData) return true; // No data, assume competitive
        
        if (order.type === ORDER_SELL) {
            // Our sell order should be near market average
            const marketPrice = parseFloat(marketData.avgSellPrice);
            const priceDiff = Math.abs(order.price - marketPrice) / marketPrice;
            
            // Allow 30% variance
            return priceDiff < 0.30;
        } else {
            // Our buy order should be near market average
            const marketPrice = parseFloat(marketData.avgBuyPrice);
            const priceDiff = Math.abs(order.price - marketPrice) / marketPrice;
            
            // Allow 30% variance
            return priceDiff < 0.30;
        }
    }
    
    /**
     * Create sell orders for surplus minerals
     */
    createSellOrders() {
        // Get all rooms with terminals
        const rooms = Object.values(Game.rooms).filter(
            room => room.controller && room.controller.my && room.terminal
        );
        
        if (rooms.length === 0) {
            console.log('[Market] No terminals available for trading');
            return;
        }
        
        for (const room of rooms) {
            const terminal = room.terminal;
            
            // Check each mineral type
            for (const resourceType in this.config.sellThreshold) {
                const amount = terminal.store[resourceType] || 0;
                const threshold = this.config.sellThreshold[resourceType];
                const reserve = this.config.reserveAmount[resourceType];
                
                // Check if we have surplus
                if (amount < threshold) continue;
                
                // Check if we already have orders for this resource
                const existingOrders = Object.values(Game.market.orders).filter(
                    o => o.type === ORDER_SELL &&
                         o.resourceType === resourceType &&
                         o.roomName === room.name
                );
                
                if (existingOrders.length >= this.config.maxOrdersPerResource) {
                    continue;
                }
                
                // Calculate sell amount (keep reserve)
                const sellAmount = amount - reserve;
                if (sellAmount < 1000) continue; // Minimum 1000 units
                
                // Calculate competitive price
                const price = this.calculateSellPrice(resourceType);
                if (price === 0) {
                    console.log(`[Market] No market data for ${resourceType}, skipping`);
                    continue;
                }
                
                // Create sell order
                const result = Game.market.createOrder({
                    type: ORDER_SELL,
                    resourceType: resourceType,
                    price: price,
                    totalAmount: sellAmount,
                    roomName: room.name
                });
                
                if (result === OK) {
                    console.log(`[Market] Created sell order: ${sellAmount} ${resourceType} @ ${price} credits/unit`);
                } else {
                    console.log(`[Market] Failed to create sell order: ${result}`);
                }
            }
        }
    }
    
    /**
     * Calculate competitive sell price
     * Price slightly below market average to ensure sale
     */
    calculateSellPrice(resourceType) {
        const marketData = Memory.market.prices[resourceType];
        if (!marketData) return 0;
        
        const avgPrice = parseFloat(marketData.avgSellPrice);
        const lowestAsk = parseFloat(marketData.lowestAsk);
        
        if (avgPrice === 0) return 0;
        
        // Price 5% below average to be competitive
        let price = avgPrice * 0.95;
        
        // But also check lowest ask - don't go too far below
        if (lowestAsk > 0 && price < lowestAsk * 0.8) {
            price = lowestAsk * 0.8;
        }
        
        // Minimum price floor (don't sell too cheap)
        const minPrices = {
            [RESOURCE_HYDROGEN]: 0.05,
            [RESOURCE_OXYGEN]: 0.05,
            [RESOURCE_UTRIUM]: 0.10,
            [RESOURCE_LEMERGIUM]: 0.10,
            [RESOURCE_KEANIUM]: 0.10,
            [RESOURCE_ZYNTHIUM]: 0.10,
            [RESOURCE_CATALYST]: 0.10
        };
        
        const minPrice = minPrices[resourceType] || 0.05;
        price = Math.max(price, minPrice);
        
        return parseFloat(price.toFixed(3));
    }
    
    /**
     * Monitor recent transactions for analytics
     */
    monitorTransactions() {
        // Track incoming transactions (sales)
        const recentIncoming = Game.market.incomingTransactions.filter(
            tx => tx.time > Game.time - this.config.updateInterval
        );
        
        if (recentIncoming.length > 0) {
            let revenue = 0;
            for (const tx of recentIncoming) {
                const price = (tx.order && tx.order.price) ? tx.order.price : 0;
                revenue += price * tx.amount;
                
                console.log(`[Market] SALE: ${tx.amount} ${tx.resourceType} @ ${price} = ${revenue.toFixed(2)} credits`);
            }
            
            if (revenue > 0) {
                console.log(`[Market] Total revenue from sales: ${revenue.toFixed(2)} credits`);
            }
        }
        
        // Track outgoing transactions (purchases)
        const recentOutgoing = Game.market.outgoingTransactions.filter(
            tx => tx.time > Game.time - this.config.updateInterval
        );
        
        if (recentOutgoing.length > 0) {
            let cost = 0;
            for (const tx of recentOutgoing) {
                const price = (tx.order && tx.order.price) ? tx.order.price : 0;
                cost += price * tx.amount;
                
                console.log(`[Market] PURCHASE: ${tx.amount} ${tx.resourceType} @ ${price} = ${cost.toFixed(2)} credits`);
            }
            
            if (cost > 0) {
                console.log(`[Market] Total cost from purchases: ${cost.toFixed(2)} credits`);
            }
        }
        
        // Update credits tracking
        Memory.market.credits = Game.market.credits;
    }
    
    /**
     * Clean old data from memory
     */
    cleanOldData() {
        // Only run every 10000 ticks
        if (Game.time % 10000 !== 0) return;
        
        // Clean old price data (older than 50,000 ticks)
        const cutoff = Game.time - 50000;
        
        for (const resource in Memory.market.prices) {
            if (Memory.market.prices[resource].timestamp < cutoff) {
                delete Memory.market.prices[resource];
            }
        }
        
        console.log('[Market] Cleaned old market data');
    }
    
    /**
     * Console helper: Show market status
     */
    static status() {
        console.log('=== MARKET STATUS ===');
        console.log(`Credits: ${Game.market.credits}`);
        console.log(`Active Orders: ${Object.keys(Game.market.orders).length}`);
        
        // Show orders
        for (const orderId in Game.market.orders) {
            const order = Game.market.orders[orderId];
            console.log(`  ${order.type} ${order.remainingAmount}/${order.totalAmount} ${order.resourceType} @ ${order.price} (${order.roomName})`);
        }
        
        // Show recent transactions
        const recentTx = Game.market.incomingTransactions.filter(
            tx => tx.time > Game.time - 1000
        );
        
        if (recentTx.length > 0) {
            console.log(`Recent Sales: ${recentTx.length}`);
            for (const tx of recentTx) {
                const price = (tx.order && tx.order.price) ? tx.order.price : 0;
                console.log(`  ${tx.amount} ${tx.resourceType} @ ${price}`);
            }
        }
        
        // Show market prices
        if (Memory.market && Memory.market.prices) {
            console.log('\nMarket Prices:');
            for (const resource in Memory.market.prices) {
                const data = Memory.market.prices[resource];
                console.log(`  ${resource}: Buy ${data.highestBid} | Sell ${data.lowestAsk} | Spread ${data.spread}%`);
            }
        }
    }
}

module.exports = MarketManager;
