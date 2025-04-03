// worker.js - Handles poker analytics calculation

// --- Constants and Helper Functions ---
const RANKS_STR = '23456789TJQKA'; // String for easy index lookup
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']; // For deck generation
const SUITS = ['s', 'h', 'd', 'c'];
const UI_HAND_TYPES = [
    'Straight Flush', 'Four of a Kind', 'Full House', 'Flush', 'Straight',
    'Three of a Kind', 'Two Pair', 'Pair', 'High Card'
];
// Numerical ranks for sorting results (higher is better)
const HAND_RANKS = {
    'Straight Flush': 9,
    'Four of a Kind': 8,
    'Full House': 7,
    'Flush': 6,
    'Straight': 5,
    'Three of a Kind': 4,
    'Two Pair': 3,
    'Pair': 2,
    'High Card': 1
};

// --- Deck Generation / Combination Helpers (Remain the same) ---
function generateFullDeck() {
    const fullDeck = [];
    RANKS.forEach(rank => {
        SUITS.forEach(suit => {
            fullDeck.push(rank + suit);
        });
    });
    return fullDeck;
}

function getDeck(excludedCards = []) {
    const fullDeck = generateFullDeck();
    return fullDeck.filter(card => !excludedCards.includes(card));
}

function getCombinations(arr, k) {
    if (k < 0 || k > arr.length) return [];
    if (k === 0) return [[]];
    if (k === arr.length) return [arr];
    if (k === 1) return arr.map(item => [item]);
    const combinations = [];
    for (let i = 0; i < arr.length - k + 1; i++) {
        const head = arr.slice(i, i + 1);
        const tailCombinations = getCombinations(arr.slice(i + 1), k - 1);
        for (const tail of tailCombinations) {
            combinations.push(head.concat(tail));
        }
    }
    return combinations;
}

// --- NEW: 5-Card Hand Evaluation Logic ---

function parseCard(cardStr) {
    const rank = cardStr.slice(0, -1);
    const suit = cardStr.slice(-1);
    return { rank, suit, value: RANKS_STR.indexOf(rank) };
}

function evaluate5CardHand(hand) { // Expects array of 5 card strings (e.g., ['As', 'Ks', 'Qs', 'Js', 'Ts'])
    if (!hand || hand.length !== 5) {
        return { handName: 'Invalid', handRank: 0 };
    }

    const parsedHand = hand.map(parseCard).sort((a, b) => b.value - a.value);
    const values = parsedHand.map(c => c.value);
    const suits = parsedHand.map(c => c.suit);

    // Check for Flush
    const isFlush = suits.every(s => s === suits[0]);

    // Check for Straight (Ace-low and regular)
    const uniqueValues = [...new Set(values)]; // Should always be 5 for non-pairs, but handles edge cases
    let isStraight = false;
    if (uniqueValues.length === 5) {
        // Regular straight check
        isStraight = (uniqueValues[0] - uniqueValues[4]) === 4;
        // Ace-low straight check (A, 5, 4, 3, 2 -> values 12, 3, 2, 1, 0)
        if (!isStraight && uniqueValues[0] === 12 && uniqueValues[1] === 3 && uniqueValues[2] === 2 && uniqueValues[3] === 1 && uniqueValues[4] === 0) {
            isStraight = true;
            // Note: For ranking purposes, Ace-low straight is ranked by the 5 (value 3)
        }
    }

    // Check for Straight Flush (includes Royal Flush)
    if (isStraight && isFlush) {
         return { handName: 'Straight Flush', handRank: HAND_RANKS['Straight Flush'] };
    }

    // Check for rank counts (pairs, trips, quads)
    const rankCounts = values.reduce((acc, value) => {
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});
    const counts = Object.values(rankCounts).sort((a, b) => b - a); // [4, 1], [3, 2], [3, 1, 1], [2, 2, 1], [2, 1, 1, 1]

    // Check for Four of a Kind
    if (counts[0] === 4) {
        return { handName: 'Four of a Kind', handRank: HAND_RANKS['Four of a Kind'] };
    }

    // Check for Full House
    if (counts[0] === 3 && counts[1] === 2) {
         return { handName: 'Full House', handRank: HAND_RANKS['Full House'] };
    }

    // Return Flush (if not Straight Flush)
    if (isFlush) {
         return { handName: 'Flush', handRank: HAND_RANKS['Flush'] };
    }

    // Return Straight (if not Straight Flush)
    if (isStraight) {
         return { handName: 'Straight', handRank: HAND_RANKS['Straight'] };
    }

    // Check for Three of a Kind
    if (counts[0] === 3) { // Implies counts = [3, 1, 1]
        return { handName: 'Three of a Kind', handRank: HAND_RANKS['Three of a Kind'] };
    }

    // Check for Two Pair
    if (counts[0] === 2 && counts[1] === 2) { // Implies counts = [2, 2, 1]
        return { handName: 'Two Pair', handRank: HAND_RANKS['Two Pair'] };
    }

    // Check for Pair
    if (counts[0] === 2) { // Implies counts = [2, 1, 1, 1]
        return { handName: 'Pair', handRank: HAND_RANKS['Pair'] };
    }

    // Must be High Card
    return { handName: 'High Card', handRank: HAND_RANKS['High Card'] };
}


// --- Analytics Calculation --- (Uses local evaluate5CardHand)

// Helper to get a grouping key (hand name + sorted ranks)
function getFlopGroupKey(flop, handName) {
    const ranks = flop.map(card => card.slice(0, -1))
                      .sort((a, b) => RANKS_STR.indexOf(b) - RANKS_STR.indexOf(a)); // Sort ranks high to low
    return `${handName}-${ranks.join('')}`;
}

function calculateAnalytics(holeCards) {
    console.time('worker:calculateAnalytics');
    if (holeCards.length !== 2) {
        return { probabilities: {}, bestFlops: [], worstFlops: [] };
    }

    const remainingDeck = getDeck(holeCards);
    const possibleFlops = getCombinations(remainingDeck, 3);
    const totalFlops = possibleFlops.length;

    let handCounts = UI_HAND_TYPES.reduce((acc, type) => {
        acc[type] = 0;
        return acc;
    }, {});
    let solvedFlops = []; // Store { flop: [...], handName: '...', handRank: ... }

    possibleFlops.forEach(flop => {
        const currentHandCards = [...holeCards, ...flop];
        try {
            const result = evaluate5CardHand(currentHandCards); 
            if (result.handRank > 0) {
                 handCounts[result.handName]++;
                 solvedFlops.push({
                     flop: flop,
                     handName: result.handName,
                     handRank: result.handRank 
                 });
            } else {
                 console.warn(`Worker: Invalid hand evaluated: ${currentHandCards.join(', ')}`);
            }
        } catch (e) {
            console.error(`Worker: Error evaluating hand: ${currentHandCards.join(', ')}`, e);
        }
    });

    let probabilities = {};
    for (const handName in handCounts) {
        probabilities[handName] = totalFlops > 0 ? (handCounts[handName] / totalFlops) * 100 : 0;
    }

    // Sort all solved flops by handRank
    solvedFlops.sort((a, b) => b.handRank - a.handRank);

    // Group Best and Worst Flops
    const numFlopExamplesToShowInitially = 3; // Show a few examples initially
    const maxGroupSize = 100; // Limit examples within a group

    const groupFlops = (flops) => {
        const groups = new Map();
        flops.forEach(solvedFlop => {
            const key = getFlopGroupKey(solvedFlop.flop, solvedFlop.handName);
            if (!groups.has(key)) {
                groups.set(key, { 
                    handName: solvedFlop.handName, 
                    representativeFlop: solvedFlop.flop, 
                    flops: [],
                    rankKey: `${solvedFlop.handName}-${solvedFlop.flop.map(c=>c[0]).sort().join('')}`
                 });
            }
            const group = groups.get(key);
            if(group.flops.length < maxGroupSize) { 
                 group.flops.push(solvedFlop.flop);
            }
        });
        
        return Array.from(groups.values());
    };

    // Take top ~50-100 best/worst results for meaningful grouping
    const sampleSize = 100; 
    const bestFlopGroups = groupFlops(solvedFlops.slice(0, sampleSize));
    const worstFlopGroups = groupFlops(solvedFlops.slice(-sampleSize).reverse()); // Reverse worst to group by lowest rank first

    // Sort groups themselves? Maybe not necessary if derived from sorted list

    console.timeEnd('worker:calculateAnalytics');
    // Return grouped data
    return { probabilities, bestFlopGroups, worstFlopGroups };
}

// --- Setup Listener ---
self.onmessage = function(event) {
    console.log('Worker received message:', event.data);
    if (event.data && event.data.holeCards) {
        // Make sure the results var name matches what's returned
        const results = calculateAnalytics(event.data.holeCards);
        if (results) {
            console.log('Worker sending results (grouped flops):', results);
            self.postMessage(results);
        }
    } else {
        console.error('Worker received invalid message data:', event.data);
    }
};

self.onerror = function(error) {
    console.error('Unhandled Error in worker:', error);
};