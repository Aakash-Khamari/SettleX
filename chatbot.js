/**
 * ATLAS CHATBOT BACKEND (SettleX AI) - v4.0 ENTERPRISE NEURAL CORE
 * ------------------------------------------------
 * A sophisticated, context-aware NLP engine for the SettleX platform.
 * Handles intent recognition, entity extraction, multi-turn conversations,
 * and integrates with SettleXBackend for live financial data.
 * * UPGRADE NOTES (v4.0):
 * - Added Deep Knowledge Base (Trade Dictionary, Regulatory Codes).
 * - Added Sentiment Analysis Engine.
 * - Added Multi-Step Workflow Manager (Onboarding, Support Tickets).
 * - Added Strict Validation Logic (PAN, IEC, GSTIN).
 * - Expanded Intent Library to 100+ variations.
 */

const AtlasBackend = {
    // --- STATE MANAGEMENT ---
    state: {
        context: null, // current conversation flow (e.g., 'awaiting_currency')
        subContext: null, // For multi-step workflows
        step: 0, // Current step in a workflow
        lastIntent: null,
        userName: null,
        userSentiment: 'neutral', // neutral, positive, negative, urgent
        tempData: {}, // Temporary storage for multi-turn data (e.g., form inputs)
        history: [],
        sessionStart: Date.now()
    },

    // --- CONFIGURATION ---
    config: {
        botName: "Atlas",
        version: "4.0.0-Enterprise",
        supportEmail: "priority.desk@settlex.com",
        minConfidenceThreshold: 0.4,
        maxHistorySize: 50
    },

    // --- KNOWLEDGE BASE (Static Definitions) ---
    knowledge: {
        // EXISTING FAQ (Preserved)
        faq: {
            "rodtep": "RoDTEP (Remission of Duties and Taxes on Exported Products) is a scheme for exporters. Since we generate e-FIRAs in T+1 days, you can claim these benefits approx. 10 days faster than with traditional banks.",
            "fira": "An e-FIRA (Foreign Inward Remittance Advice) is proof of foreign payment. We automate this via our partner banks (YES Bank/DBS) so you don't have to chase relationship managers.",
            "boe": "Bill of Entry (BoE) is required for imports. Upload it to the 'Compliance Vault', and our OCR will auto-match it with your payment within 15 minutes.",
            "limit": "Under OPGSP/PA-CB guidelines, the per-transaction limit is generally USD 10,000 equivalent for imports, though SettleX supports higher volumes via direct AD-I partnerships for specific goods.",
            "security": "We are ISO 27001 certified and compliant with RBI's PA-CB (Payment Aggregator - Cross Border) guidelines. Your funds are held in escrow, never in our working capital.",
            "onboarding": "Getting started is paperless. You'll need your IEC, PAN, and GSTIN. Head to the 'Open Account' button to complete your Video KYC in under 10 minutes."
        },

        // NEW: TRADE DICTIONARY (Expanded Definitions)
        dictionary: {
            "ad_code": "Authorized Dealer Code. A 14-digit code assigned by the bank where you have a current account. You must register this at every customs port where you export/import.",
            "brc": "Bank Realization Certificate. A legacy term, now largely replaced by e-FIRA and EDPMS status updates. It certifies that export proceeds have been realized.",
            "edpms": "Export Data Processing and Monitoring System. An RBI platform where banks report export realizations. SettleX updates this automatically.",
            "idpms": "Import Data Processing and Monitoring System. The RBI platform for tracking import remittances against Bills of Entry.",
            "fema": "Foreign Exchange Management Act, 1999. The primary law governing FX in India. SettleX ensures all transactions comply with FEMA guidelines automatically.",
            "swift": "Society for Worldwide Interbank Financial Telecommunication. The legacy messaging network. We bypass this using DBS Intra-Bank rails for 80% lower costs.",
            "nostro": "An account held by an Indian bank in a foreign country (e.g., YES BANK's account with Wells Fargo US).",
            "vostro": "An account held by a foreign bank in India (e.g., DBS Singapore's INR account in India).",
            "eefc": "Exchange Earners' Foreign Currency Account. An account where exporters can retain 100% of their earnings in foreign currency to hedge against future payments.",
            "hs_code": "Harmonized System Code. A standardized numerical method of classifying traded products. Crucial for RoDTEP claims.",
            "opgsp": "Online Payment Gateway Service Provider. The older regulatory framework for small value exports, now being superseded by PA-CB.",
            "pa_cb": "Payment Aggregator - Cross Border. The new RBI master direction (2025) regulating fintechs like SettleX.",
            "kyc": "Know Your Customer. Mandatory verification involving PAN, Aadhaar, and business registration docs.",
            "aml": "Anti-Money Laundering. SettleX uses real-time screening against OFAC and UN lists to prevent illicit flows.",
            "neft": "National Electronic Funds Transfer. Used for domestic INR payouts under ₹2 Lakhs.",
            "rtgs": "Real Time Gross Settlement. Used for domestic INR payouts over ₹2 Lakhs."
        },

        // NEW: TROUBLESHOOTING GUIDES
        troubleshooting: {
            "payment_failed": "If your payment failed, check: 1) Is the beneficiary account active? 2) Does the purpose code match the invoice? 3) Do you have sufficient balance? If all look good, raise a priority ticket.",
            "login_issue": "Ensure you are using your registered corporate email. If you forgot your password, click 'Forgot Password' on the login screen. Accounts are locked after 5 failed attempts.",
            "doc_rejected": "Documents are usually rejected due to: Blurry scans, Name mismatch between Invoice and IEC, or Expired validity. Please re-upload a clear PDF.",
            "fira_missing": "If you haven't received an e-FIRA after 48 hours, the funds might be held for AML review. Check your email for a 'Request for Information' (RFI) from our compliance team."
        },

        // NEW: CURRENCY META DATA
        currencies: {
            "USD": { name: "United States Dollar", region: "USA", symbol: "$", type: "Major" },
            "SGD": { name: "Singapore Dollar", region: "Singapore", symbol: "S$", type: "Major" },
            "GBP": { name: "British Pound", region: "UK", symbol: "£", type: "Major" },
            "EUR": { name: "Euro", region: "Eurozone", symbol: "€", type: "Major" },
            "AED": { name: "UAE Dirham", region: "UAE", symbol: "dh", type: "Minor" },
            "VND": { name: "Vietnamese Dong", region: "Vietnam", symbol: "₫", type: "Exotic" },
            "THB": { name: "Thai Baht", region: "Thailand", symbol: "฿", type: "Exotic" },
            "JPY": { name: "Japanese Yen", region: "Japan", symbol: "¥", type: "Major" },
            "AUD": { name: "Australian Dollar", region: "Australia", symbol: "A$", type: "Major" },
            "CAD": { name: "Canadian Dollar", region: "Canada", symbol: "C$", type: "Major" }
        }
    },

    // --- ADVANCED NATURAL LANGUAGE PROCESSOR (NLP) ---
    nlp: {
        // Weighted keywords for Intent Scoring
        intents: {
            'greeting': {
                keywords: ['hello', 'hi', 'hey', 'greetings', 'morning', 'evening', 'start', 'begin'],
                weight: 1
            },
            'goodbye': {
                keywords: ['bye', 'goodbye', 'see ya', 'exit', 'quit', 'end', 'close'],
                weight: 1
            },
            'thanks': {
                keywords: ['thank', 'thanks', 'cool', 'awesome', 'great', 'helpful', 'cheers'],
                weight: 1
            },
            'calculator': {
                keywords: ['convert', 'calculator', 'how much', 'change', 'swap', 'calculate', 'exchange', 'value of'],
                weight: 2
            },
            'rate_inquiry': {
                keywords: ['rate', 'price', 'cost', 'spread', 'margin', 'fees', 'charges', 'commission', 'fx rate', 'dollar rate'],
                weight: 2
            },
            'compliance_fira': {
                keywords: ['fira', 'advice', 'certificate', 'proof', 'remittance advice', 'efira', 'download fira'],
                weight: 3
            },
            'compliance_rodtep': {
                keywords: ['rodtep', 'incentive', 'benefit', 'claim', 'duty', 'drawback', 'rebate', 'government scheme'],
                weight: 3
            },
            'compliance_boe': {
                keywords: ['boe', 'bill of entry', 'import doc', 'customs', 'clearance', 'idpms', 'entry bill'],
                weight: 3
            },
            'onboarding': {
                keywords: ['sign up', 'register', 'account', 'kyc', 'join', 'open account', 'documents needed', 'iec', 'gstin'],
                weight: 2
            },
            'speed': {
                keywords: ['time', 'speed', 'fast', 'how long', 'days', 'settlement', 'duration', 'when', 'timeline'],
                weight: 1
            },
            'security': {
                keywords: ['safe', 'secure', 'trust', 'fraud', 'rbi', 'license', 'audit', 'iso', 'escrow', 'money safe'],
                weight: 2
            },
            'support': {
                keywords: ['help', 'support', 'contact', 'human', 'agent', 'representative', 'call', 'email', 'issue', 'problem', 'error', 'ticket', 'complain'],
                weight: 2
            },
            'troubleshoot': {
                keywords: ['failed', 'rejected', 'declined', 'stuck', 'pending', 'not received', 'missing', 'issue', 'bug'],
                weight: 2
            },
            'explain_concept': {
                keywords: ['what is', 'define', 'meaning', 'explain', 'definition', 'term'],
                weight: 1
            }
        },

        // Sentiment Keywords
        sentiment: {
            negative: ['bad', 'slow', 'fail', 'error', 'angry', 'waiting', 'stuck', 'useless', 'broken', 'waste', 'lost'],
            positive: ['good', 'fast', 'great', 'amazing', 'thanks', 'love', 'easy', 'smooth', 'best'],
            urgent: ['urgent', 'emergency', 'asap', 'immediately', 'now', 'critical', 'blocked', 'money stuck']
        }
    },

    /**
     * Main processing entry point called by frontend
     * @param {string} message - User input
     */
    process: function(message) {
        if (!message) return "";
        const cleanMsg = message.trim();
        
        // 0. Update Activity Log
        this.updateAnalytics(cleanMsg);

        // 1. Check Connectivity to Logic Core
        if (typeof SettleXBackend === 'undefined' || !SettleXBackend.isReady) {
             return "I'm currently establishing a secure handshake with the GIFT City server to get live rates. Please try again in 2 seconds.";
        }

        // 2. Check for Active Workflows (State Machine)
        if (this.state.context === 'workflow') {
            return this.workflowManager.handleStep(cleanMsg);
        }

        // 3. Analyze (Intent & Entities)
        const analysis = this.advancedAnalyze(cleanMsg);
        
        // Update Sentiment State
        this.state.userSentiment = analysis.sentiment;

        // 4. Handle Context (Multi-turn conversations)
        if (this.state.context) {
            return this.handleContext(analysis, cleanMsg);
        }

        // 5. Generate Response based on Intent
        const response = this.generateResponse(analysis);

        // 6. Append Sentiment Adjustments
        return this.sentimentAdjust(response, analysis.sentiment);
    },

    /**
     * ADVANCED NLP ENGINE: Replaces basic regex matching with scored intent classification
     */
    advancedAnalyze: function(text) {
        const lower = text.toLowerCase();
        let bestIntent = 'unknown';
        let maxScore = 0;

        // 1. Intent Scoring
        for (const [intent, data] of Object.entries(this.nlp.intents)) {
            let score = 0;
            data.keywords.forEach(word => {
                if (lower.includes(word)) score += data.weight;
            });
            if (score > maxScore) {
                maxScore = score;
                bestIntent = intent;
            }
        }

        // 2. Entity Extraction (Currency)
        // Fuzzy match common currency names
        const currencyMatch = lower.match(/(usd|sgd|gbp|eur|aed|vnd|thb|jpy|aud|cad|dollar|pound|euro|dong|baht|yen|rupee|inr)/);
        let detectedCurrency = null;
        if (currencyMatch) {
            detectedCurrency = this.normalizeCurrency(currencyMatch[0]);
        }

        // 3. Entity Extraction (Amount)
        // Handles "10k", "10,000", "10.5M"
        let detectedAmount = null;
        const amountStr = lower.match(/(\d+(?:,\d{3})*(?:\.\d+)?)(k|m|b)?/i);
        if (amountStr) {
            let val = parseFloat(amountStr[1].replace(/,/g, ''));
            const multiplier = amountStr[2];
            if (multiplier === 'k') val *= 1000;
            if (multiplier === 'm') val *= 1000000;
            if (multiplier === 'b') val *= 1000000000;
            detectedAmount = val;
        }

        // 4. Sentiment Analysis
        let sentiment = 'neutral';
        let sentimentScore = 0;
        this.nlp.sentiment.negative.forEach(w => { if(lower.includes(w)) sentimentScore--; });
        this.nlp.sentiment.positive.forEach(w => { if(lower.includes(w)) sentimentScore++; });
        this.nlp.sentiment.urgent.forEach(w => { if(lower.includes(w)) sentimentScore -= 2; });

        if (sentimentScore > 0) sentiment = 'positive';
        if (sentimentScore < 0) sentiment = 'negative';
        if (lower.match(/urgent|asap|now/)) sentiment = 'urgent';

        // 5. Contextual Override
        // If "workflow" or "ticket" is mentioned, boost support intent
        if (lower.includes('ticket') || lower.includes('complaint')) bestIntent = 'support';

        return { 
            intent: maxScore > 0 ? bestIntent : 'unknown', 
            score: maxScore,
            currency: detectedCurrency, 
            amount: detectedAmount,
            sentiment: sentiment,
            raw: text
        };
    },

    /**
     * Handle inputs when the bot is waiting for specific info (Context Awareness)
     */
    handleContext: function(analysis, rawText) {
        const ctx = this.state.context;
        this.state.context = null; // Clear context after handling (unless re-set)

        // Context: User asked for rate but didn't specify currency
        if (ctx === 'awaiting_currency_for_rate') {
            const currency = this.normalizeCurrency(rawText);
            if (currency) {
                return this.getRateString(currency);
            }
            // If they still fail, check for exit intent
            if (analysis.intent === 'goodbye') return "No problem. Let me know if you need rates later.";
            return "I didn't catch that currency. We support USD, SGD, GBP, EUR, and AED. Which one are you interested in?";
        }

        // Context: User wants to calculate but missing details
        if (ctx === 'awaiting_calculation_details') {
            // Check if analysis found what we needed
            const amount = analysis.amount || this.state.tempData.pendingAmount;
            const currency = analysis.currency || this.state.tempData.pendingCurrency;

            if (amount && currency) {
                return this.calculateConversion(amount, currency);
            } else if (amount) {
                this.state.tempData.pendingAmount = amount;
                this.state.context = 'awaiting_calculation_details'; // Loop back
                return "Got the amount (" + amount + "). Now, which currency? (e.g. USD)";
            } else if (currency) {
                this.state.tempData.pendingCurrency = currency;
                this.state.context = 'awaiting_calculation_details'; // Loop back
                return "Got the currency (" + currency + "). How much do you want to convert?";
            }
            return "I still need an amount and a currency to help (e.g., '1000 USD').";
        }
        
        // Context: User asked for definition
        if (ctx === 'awaiting_term_definition') {
             // Try to lookup the term in dictionary
             const term = rawText.toLowerCase().replace(/[^a-z_]/g, '');
             if (this.knowledge.dictionary[term]) {
                 return `📖 **${term.toUpperCase()}**: ${this.knowledge.dictionary[term]}`;
             }
             return "I couldn't find a definition for that specific term in my trade dictionary. Try 'FEMA', 'HS Code', or 'BRC'.";
        }

        return this.generateResponse(analysis); // Fallback to standard processing
    },

    /**
     * Response Generator
     */
    generateResponse: function(analysis) {
        // --- GREETINGS ---
        if (analysis.intent === 'greeting') {
            return this.pickRandom([
                "Hello! I'm Atlas, your SettleX Trade Assistant. I'm connected to the Live Interbank Market. How can I optimize your cash flow?",
                "Hi there! Ready to save on FX spreads? Ask me about live rates, compliance, or transfers.",
                "Greetings from the SettleX team. What can I help you clear today?"
            ]);
        }

        // --- RATES (Dynamic) ---
        if (analysis.intent === 'rate_inquiry') {
            if (analysis.currency) {
                return this.getRateString(analysis.currency);
            } else {
                this.state.context = 'awaiting_currency_for_rate';
                return "I can check live wholesale rates for you. Which currency? (USD, SGD, GBP, EUR)";
            }
        }

        // --- CALCULATOR (Dynamic) ---
        if (analysis.intent === 'calculator') {
            if (analysis.amount && analysis.currency) {
                return this.calculateConversion(analysis.amount, analysis.currency);
            }
            this.state.context = 'awaiting_calculation_details';
            // Store partials if found
            if(analysis.amount) this.state.tempData.pendingAmount = analysis.amount;
            if(analysis.currency) this.state.tempData.pendingCurrency = analysis.currency;

            return "I can calculate that instant savings for you. How much do you want to convert? (e.g., '5000 USD')";
        }

        // --- COMPLIANCE (Static Knowledge) ---
        if (analysis.intent === 'compliance_fira') return this.knowledge.faq.fira;
        if (analysis.intent === 'compliance_rodtep') return this.knowledge.faq.rodtep;
        if (analysis.intent === 'compliance_boe') return this.knowledge.faq.boe;

        // --- SPEED ---
        if (analysis.intent === 'speed') {
            return "We move at the speed of data. Using DBS 'Golden Rail' intra-bank transfers, payments from major hubs (SG, US, UK) settle T+0 (Same Day) if booked before 2:00 PM IST. Traditional SWIFT takes T+3.";
        }

        // --- SECURITY ---
        if (analysis.intent === 'security') return this.knowledge.faq.security;

        // --- ONBOARDING ---
        if (analysis.intent === 'onboarding') {
             // Suggest starting the workflow
             this.startWorkflow('onboarding');
             return "Opening an account is fully digital. Would you like me to guide you through the requirements? (Type 'Yes' to start)";
        }

        // --- SUPPORT / TROUBLESHOOTING ---
        if (analysis.intent === 'support' || analysis.intent === 'troubleshoot') {
            if (analysis.sentiment === 'urgent' || analysis.sentiment === 'negative') {
                this.startWorkflow('ticket');
                return "I detect this is urgent. Would you like to raise a **Priority Support Ticket** right now? (Type 'Yes')";
            }
            // Check specific troubleshooting keywords
            if (analysis.raw.includes('fail') || analysis.raw.includes('reject')) return this.knowledge.troubleshooting.payment_failed;
            if (analysis.raw.includes('login') || analysis.raw.includes('password')) return this.knowledge.troubleshooting.login_issue;
            
            return "You can reach our human Ops Team at " + this.config.supportEmail + ". Or I can help you debug 'failed payments' or 'login issues' here.";
        }

        // --- EXPLAIN CONCEPTS (Dictionary Lookup) ---
        if (analysis.intent === 'explain_concept') {
            // Try to extract term
            const words = analysis.raw.split(' ');
            const term = words[words.length - 1].toLowerCase(); // heuristic
            if (this.knowledge.dictionary[term]) {
                 return `📖 **${term.toUpperCase()}**: ${this.knowledge.dictionary[term]}`;
            }
            this.state.context = 'awaiting_term_definition';
            return "I have a full trade dictionary. Which term do you want defined? (e.g., 'EEFC', 'HS Code', 'FEMA')";
        }

        // --- PERSONALITY/MISC ---
        if (analysis.intent === 'thanks') return "You're very welcome! SettleX is always here to help.";
        if (analysis.intent === 'goodbye') return "Goodbye! Keep your margins high and your compliance clean. 👋";
        if (analysis.intent === 'personality') return "I'm Atlas, a digital assistant built on the SettleX infrastructure. I process trade data faster than you can say 'Letter of Credit'.";

        // --- FALLBACK ---
        return "I'm trained on Trade Finance, Live FX Rates, and Compliance rules. You can ask: 'Current USD Rate', 'What is RoDTEP?', 'Convert 5000 SGD', or 'Help with login'.";
    },

    /**
     * Adjusts response based on user sentiment
     */
    sentimentAdjust: function(response, sentiment) {
        if (sentiment === 'negative') {
            return "I apologize if you're facing issues. " + response;
        }
        if (sentiment === 'urgent') {
            return "🚨 **Priority Response**: " + response;
        }
        return response;
    },

    // --- WORKFLOW MANAGER (Multi-Step Logic) ---
    workflowManager: {
        
        handleStep: function(msg) {
            const flow = AtlasBackend.state.subContext;
            const step = AtlasBackend.state.step;
            const lower = msg.toLowerCase();

            // Cancel check
            if (lower === 'cancel' || lower === 'stop' || lower === 'exit') {
                AtlasBackend.state.context = null;
                AtlasBackend.state.subContext = null;
                return "Workflow cancelled. How else can I help?";
            }

            if (flow === 'onboarding') return this.flowOnboarding(step, msg);
            if (flow === 'ticket') return this.flowTicket(step, msg);
            
            return "Workflow Error. Resetting.";
        },

        flowOnboarding: function(step, msg) {
            if (step === 0) { // Confirmation
                if (msg.toLowerCase().includes('yes')) {
                    AtlasBackend.state.step++;
                    return "Great! Step 1: Do you have a valid **IEC (Import Export Code)**? (Yes/No)";
                }
                AtlasBackend.state.context = null;
                return "No problem. You can start anytime via the 'Open Account' button.";
            }
            if (step === 1) { // IEC Check
                if (msg.toLowerCase().includes('yes')) {
                    AtlasBackend.state.step++;
                    return "Perfect. Step 2: Please enter your **10-digit PAN Number** for validation simulation.";
                }
                AtlasBackend.state.context = null;
                return "You need an IEC to operate on SettleX. Please apply via the DGFT portal first.";
            }
            if (step === 2) { // PAN Validation
                if (AtlasBackend.validators.pan(msg)) {
                    AtlasBackend.state.step++;
                    return "✅ PAN Validated. Step 3: Enter your Company Name.";
                }
                return "❌ Invalid PAN format. It should be 5 letters, 4 numbers, 1 letter (e.g., ABCDE1234F). Try again.";
            }
            if (step === 3) { // Name Capture
                AtlasBackend.state.tempData.companyName = msg;
                AtlasBackend.state.step++;
                return `Thanks. Last Step: Enter your GSTIN for ${msg}.`;
            }
            if (step === 4) { // GSTIN Validation
                if (AtlasBackend.validators.gstin(msg)) {
                    AtlasBackend.state.context = null;
                    return `🎉 **Pre-Check Complete!**\n\nCompany: ${AtlasBackend.state.tempData.companyName}\nPAN: Verified\nGSTIN: Verified\n\nPlease click the 'Open Account' button in the top right to upload your docs and go live.`;
                }
                 return "❌ Invalid GSTIN format. It typically starts with state code (e.g., 29ABCDE1234F1Z5). Try again.";
            }
        },

        flowTicket: function(step, msg) {
            if (step === 0) {
                if (msg.toLowerCase().includes('yes')) {
                    AtlasBackend.state.step++;
                    return "Okay, I'm opening a priority ticket. Please describe the issue in one sentence.";
                }
                AtlasBackend.state.context = null;
                return "Understood. Let me know if you need anything else.";
            }
            if (step === 1) {
                AtlasBackend.state.tempData.ticketIssue = msg;
                AtlasBackend.state.step++;
                return "Got it. Please provide a valid **Transaction ID** (if applicable) or type 'NA'.";
            }
            if (step === 2) {
                const ticketId = 'TKT-' + Math.floor(Math.random() * 10000);
                AtlasBackend.state.context = null;
                return `✅ **Ticket Created: ${ticketId}**\n\nIssue: ${AtlasBackend.state.tempData.ticketIssue}\nRef: ${msg}\n\nOur Ops Team has been alerted. ETA: < 2 hours.`;
            }
        }
    },

    startWorkflow: function(name) {
        this.state.context = 'workflow';
        this.state.subContext = name;
        this.state.step = 0;
        this.state.tempData = {};
    },

    // --- VALIDATORS (Simulation) ---
    validators: {
        pan: function(text) {
            // Regex for Indian PAN: 5 chars, 4 digits, 1 char
            return /[A-Z]{5}[0-9]{4}[A-Z]{1}/i.test(text.trim());
        },
        gstin: function(text) {
            // Simple regex for GSTIN: 2 digits, 10 char PAN, 3 chars
            return /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/i.test(text.trim());
        },
        iec: function(text) {
            // IEC is 10 digits
            return /\d{10}/.test(text.trim());
        },
        email: function(text) {
            return /\S+@\S+\.\S+/.test(text);
        }
    },

    // --- UTILITIES & LIVE DATA CONNECTORS ---

    /**
     * Fetches formatted rate string from backend.js
     */
    getRateString: function(currency) {
        // We use a dummy amount (1000) just to get the rate object
        const quote = SettleXBackend.getQuote(1000, currency, 'OUTFLOW');
        
        if (!quote) return `I don't have live data for ${currency} right now. Please try USD, SGD, GBP, or EUR.`;
        
        return `🎯 **${currency} Live Wholesale**: ₹${quote.rates.settlex.toFixed(2)} \n\n` +
               `Compare that to your bank's rate (approx ₹${quote.rates.bank.toFixed(2)}). ` +
               `We save you ~2.3% per unit.`;
    },

    /**
     * Performs live calculation using backend.js
     */
    calculateConversion: function(amount, currency) {
        const quote = SettleXBackend.getQuote(amount, currency, 'OUTFLOW');
        
        if (!quote) return "Currency not supported or live data unavailable.";
        
        const savingsFormatted = SettleXBackend.formatCurrency(quote.financials.savings);
        const bankTotalFormatted = SettleXBackend.formatCurrency(quote.financials.bank_total);
        const settlexTotalFormatted = SettleXBackend.formatCurrency(quote.financials.settlex_total);

        return `🧮 **Cost Analysis for ${amount} ${currency}**\n` + 
               `• Traditional Bank Cost: ${bankTotalFormatted}\n` +
               `• SettleX Wholesale Cost: ${settlexTotalFormatted}\n` + 
               `----------------------------------\n` +
               `✅ **Total Profit Recovered: ${savingsFormatted}**`;
    },

    normalizeCurrency: function(text) {
        if (!text) return null;
        const lower = text.toLowerCase();
        // Extended Mapping
        if (lower.match(/dollar|usd|greenback/)) return 'USD';
        if (lower.match(/singapore|sgd/)) return 'SGD';
        if (lower.match(/pound|gbp|sterling/)) return 'GBP';
        if (lower.match(/euro|eur/)) return 'EUR';
        if (lower.match(/dirham|aed/)) return 'AED';
        if (lower.match(/dong|vnd/)) return 'VND';
        if (lower.match(/yen|jpy/)) return 'JPY';
        if (lower.match(/baht|thb/)) return 'THB';
        return null;
    },

    pickRandom: function(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    updateAnalytics: function(msg) {
        this.state.history.push({ ts: Date.now(), msg: msg });
        if (this.state.history.length > this.config.maxHistorySize) {
            this.state.history.shift();
        }
        // Simulated Analytics Event
        console.log(`[Atlas Analytics] Processing: "${msg}" | Sentiment: ${this.state.userSentiment}`);
    },

    /**
     * analyzeText (Legacy wrapper for backward compatibility if index.html calls it directly)
     */
    analyzeText: function(text) {
        return this.advancedAnalyze(text);
    }
};

// Export for environment compatibility
if (typeof module !== 'undefined') {
    module.exports = AtlasBackend;
}
if (typeof window !== 'undefined') {
    window.AtlasBackend = AtlasBackend;
}