/**
 * SETTLEX LIVE BACKEND CORE
 * ------------------------------------------------
 * Connects to public Exchange Rate APIs to fetch REAL-TIME market data.
 * Implements the proprietary "Wholesale vs Retail" logic.
 * * Source: Frankfurter API (ECB Data)
 */

const SettleXBackend = {
    
    // API CONFIGURATION
    apiBase: "https://api.frankfurter.app/latest",
    
    // STATE
    rates: {
        USD: null,
        SGD: null,
        GBP: null,
        EUR: null,
        VND: null // Note: Frankfurter might not support VND, we fallback if needed
    },
    isReady: false,
    listeners: [],

    /**
     * Initialize and fetch live rates
     */
    init: async function() {
        console.log("🚀 SettleX Backend: Connecting to Global Markets...");
        
        try {
            // Fetch major currencies against INR
            // We have to fetch individually or use a base. Frankfurter base is EUR by default.
            // Strategy: Fetch USD base to get USD->INR, then derive others or fetch parallel.
            
            const [usdData, sgdData, gbpData, eurData] = await Promise.all([
                fetch(`${this.apiBase}?from=USD&to=INR`).then(r => r.json()),
                fetch(`${this.apiBase}?from=SGD&to=INR`).then(r => r.json()),
                fetch(`${this.apiBase}?from=GBP&to=INR`).then(r => r.json()),
                fetch(`${this.apiBase}?from=EUR&to=INR`).then(r => r.json())
            ]);

            this.rates.USD = usdData.rates.INR;
            this.rates.SGD = sgdData.rates.INR;
            this.rates.GBP = gbpData.rates.INR;
            this.rates.EUR = eurData.rates.INR;
            
            // Manual fallback/est for VND as it's often missing in free Euro-centric APIs
            // standard approx cross rate via USD
            this.rates.VND = this.rates.USD / 24500; 

            this.isReady = true;
            console.log("✅ Live Rates Acquired:", this.rates);
            this.notifyListeners();

        } catch (error) {
            console.error("⚠️ API Error, switching to backup Offline Mode:", error);
            // Fallback to recent hardcoded averages if API fails (Safety Net)
            this.rates = { USD: 83.50, SGD: 62.40, GBP: 106.20, EUR: 90.50, VND: 0.0034 };
            this.isReady = true;
            this.notifyListeners();
        }
    },

    /**
     * Register a callback to be notified when rates change
     */
    onUpdate: function(callback) {
        this.listeners.push(callback);
        if (this.isReady) callback(); // Fire immediately if already ready
    },

    notifyListeners: function() {
        this.listeners.forEach(cb => cb());
    },

    /**
     * THE LOGIC ENGINE: Calculates SettleX vs Bank Savings
     * @param {number} amount - The invoice value
     * @param {string} currency - 'USD', 'SGD', etc.
     * @param {string} type - 'INFLOW' (Export) or 'OUTFLOW' (Import)
     */
    getQuote: function(amount, currency, type = 'OUTFLOW') {
        if (!this.rates[currency]) return null;

        const midRate = this.rates[currency];

        // LOGIC FROM PROPOSAL:
        // Retail Bank: ~2.5% Spread + ₹2,500 SWIFT Fees
        // SettleX: 0.20% Wholesale Spread + ₹0 Fees
        
        const bankSpread = 0.025; // 2.5%
        const settlexSpread = 0.0020; // 0.20%
        const bankFixedFee = 2500;
        const settlexFixedFee = 0;

        let bankRate, settlexRate;

        if (type === 'OUTFLOW') {
            // Import: You buy Foreign Currency. Rate = Higher is worse.
            bankRate = midRate * (1 + bankSpread);
            settlexRate = midRate * (1 + settlexSpread);
        } else {
            // Inflow: You sell Foreign Currency. Rate = Lower is worse.
            bankRate = midRate * (1 - bankSpread);
            settlexRate = midRate * (1 - settlexSpread);
        }

        const bankTotalCost = (type === 'OUTFLOW') 
            ? (amount * bankRate) + bankFixedFee 
            : (amount * bankRate) - bankFixedFee; // For inflow, fees reduce what you get

        const settlexTotalCost = (type === 'OUTFLOW')
            ? (amount * settlexRate) + settlexFixedFee
            : (amount * settlexRate) - settlexFixedFee;

        // Savings is always positive (Better outcome)
        const savings = Math.abs(bankTotalCost - settlexTotalCost);

        return {
            live_mid_rate: midRate,
            rates: {
                bank: bankRate,
                settlex: settlexRate
            },
            financials: {
                bank_total: bankTotalCost,
                settlex_total: settlexTotalCost,
                savings: savings
            }
        };
    },

    formatCurrency: (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    }
};

// Auto-start
SettleXBackend.init();