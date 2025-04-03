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

// Define HAND_TYPES constant (used for calculations)
const HAND_TYPES = Object.keys(HAND_RANKS).sort((a, b) => HAND_RANKS[b] - HAND_RANKS[a]);

// Constants for hand evaluation
const RANKS_NUM = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };

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

// Get remaining deck after removing excluded cards
function getDeck(excludedCards = []) {
    const deck = [];
    const suits = ['s', 'h', 'd', 'c'];
    const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
    
    // Create a Set of excluded cards for O(1) lookup
    const excludedSet = new Set(excludedCards.map(card => card.toLowerCase()));
    
    // Generate deck minus excluded cards
    for (const suit of suits) {
        for (const rank of ranks) {
            const card = rank + suit;
            if (!excludedSet.has(card.toLowerCase())) {
                deck.push(card);
            }
        }
    }
    
    return deck;
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
        return { type: 'High Card', rank: 0 };
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
         return { type: 'Straight Flush', rank: HAND_RANKS['Straight Flush'] };
    }

    // Check for rank counts (pairs, trips, quads)
    const rankCounts = values.reduce((acc, value) => {
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});
    const counts = Object.values(rankCounts).sort((a, b) => b - a); // [4, 1], [3, 2], [3, 1, 1], [2, 2, 1], [2, 1, 1, 1]

    // Check for Four of a Kind
    if (counts[0] === 4) {
        return { type: 'Four of a Kind', rank: HAND_RANKS['Four of a Kind'] };
    }

    // Check for Full House
    if (counts[0] === 3 && counts[1] === 2) {
         return { type: 'Full House', rank: HAND_RANKS['Full House'] };
    }

    // Return Flush (if not Straight Flush)
    if (isFlush) {
         return { type: 'Flush', rank: HAND_RANKS['Flush'] };
    }

    // Return Straight (if not Straight Flush)
    if (isStraight) {
         return { type: 'Straight', rank: HAND_RANKS['Straight'] };
    }

    // Check for Three of a Kind
    if (counts[0] === 3) { // Implies counts = [3, 1, 1]
        return { type: 'Three of a Kind', rank: HAND_RANKS['Three of a Kind'] };
    }

    // Check for Two Pair
    if (counts[0] === 2 && counts[1] === 2) { // Implies counts = [2, 2, 1]
        return { type: 'Two Pair', rank: HAND_RANKS['Two Pair'] };
    }

    // Check for Pair
    if (counts[0] === 2) { // Implies counts = [2, 1, 1, 1]
        return { type: 'Pair', rank: HAND_RANKS['Pair'] };
    }

    // Must be High Card
    return { type: 'High Card', rank: HAND_RANKS['High Card'] };
}

// Find the best 5-card hand from a set of cards
function findBestHand(cards) {
    if (cards.length < 5) {
        throw new Error("At least 5 cards are required to find the best hand");
    }
    
    // Get all possible 5-card combinations
    const combinations = getCombinations(cards, 5);
    
    // Evaluate each combination and find the best one
    let bestCombination = null;
    let bestRank = -1;
    let bestType = null;
    
    for (const combo of combinations) {
        const { type, rank } = evaluate5CardHand(combo);
        if (rank > bestRank) {
            bestRank = rank;
            bestType = type;
            bestCombination = combo;
        }
    }
    
    return {
        type: bestType,
        rank: bestRank,
        handName: bestType,
        bestHand: bestCombination
    };
}

// Calculate the best next cards (turn or river) based on current selection
function calculateBestNextCards(holeCards, flopCards, turnCard) {
    console.time('worker:calculateBestNextCards');
    
    // Determine if we're calculating best turn or river cards
    const isTurn = !turnCard;
    const title = isTurn ? "Turn" : "River";
    console.log(`Calculating best ${title} cards`);
    
    // Get all cards that are already in play
    const usedCards = [...holeCards, ...flopCards];
    if (turnCard) usedCards.push(turnCard);
    
    // Get remaining available cards in the deck
    const remainingCards = getDeck(usedCards);
    console.log(`${remainingCards.length} cards available for ${title}`);
    
    // Evaluate each possible next card
    const nextCardResults = [];
    
    remainingCards.forEach(nextCard => {
        let cardsToEvaluate = [...holeCards, ...flopCards];
        if (turnCard) cardsToEvaluate.push(turnCard);
        cardsToEvaluate.push(nextCard);
        
        // We have more than 5 cards, so find the best 5-card hand
        const result = findBestHand(cardsToEvaluate);
        
        nextCardResults.push({
            card: nextCard,
            type: result.type,
            rank: result.rank
        });
    });
    
    // Group cards by hand type
    const handGroups = {};
    
    nextCardResults.forEach(result => {
        if (!handGroups[result.type]) {
            handGroups[result.type] = {
                type: result.type,
                rank: result.rank,
                cards: []
            };
        }
        
        handGroups[result.type].cards.push(result.card);
    });
    
    // Convert to array and sort by hand rank (best first)
    const groupsArray = Object.values(handGroups)
        .sort((a, b) => b.rank - a.rank);
    
    // Format for UI: convert to the same format as flop groups
    const bestGroups = groupsArray.map(group => ({
        type: group.type,
        rank: group.rank,
        flops: group.cards.map(card => [card]), // Wrap each card in an array to match flop format
        representativeFlop: [group.cards[0]], // Use the first card as representative, not flop cards
        handName: group.type // Make sure handName is set for UI display
    }));
    
    // Calculate hand type probabilities
    const totalCards = remainingCards.length;
    const probabilities = {};
    
    Object.keys(HAND_RANKS).forEach(handType => {
        const cardsForHandType = handGroups[handType]?.cards?.length || 0;
        probabilities[handType] = (cardsForHandType / totalCards) * 100;
    });
    
    console.timeEnd('worker:calculateBestNextCards');
    
    // Return results in the same format as calculateAnalytics
    return {
        probabilities,
        bestFlopGroups: bestGroups,
        worstFlopGroups: [], // We don't need worst cards anymore
        hasTurn: !!turnCard
    };
}

// --- Analytics Calculation --- (Uses local evaluate5CardHand)

// Helper to get a grouping key (hand name + sorted ranks)
function getFlopGroupKey(flop, handName) {
    const ranks = flop.map(card => card.slice(0, -1))
                      .sort((a, b) => RANKS_STR.indexOf(b) - RANKS_STR.indexOf(a)); // Sort ranks high to low
    return `${handName}-${ranks.join('')}`;
}

function calculateAnalytics(holeCards, flopCards, turnCard, riverCard) {
    // If we have a complete flop, use the fixed board evaluation
    if (flopCards && flopCards.length === 3) {
        return calculateAnalyticsWithFixedBoard(holeCards, flopCards, turnCard, riverCard);
    }
    
    console.time('worker:calculateAnalytics');
    // We have hole cards, calculate probabilities of hitting each hand type by the river
    
    // Cards must be in format like 'Ah', 'Kd', etc.
    const deck = getDeck();
    const availableCards = deck.filter(card => !holeCards.includes(card));
    
    // Initialize counts for each hand type
    const handTypeCounts = {};
    HAND_TYPES.forEach(type => { handTypeCounts[type] = 0; });
    
    // Get all possible flop, turn, and river combinations
    // This would be too many to calculate (C(50,5) is over 2 million), so let's use sampling
    
    // Instead, we'll generate a sample of possible board combinations
    const SAMPLE_SIZE = 3000; // Adjust this for performance vs. accuracy
    const boardSamples = [];
    
    for (let i = 0; i < SAMPLE_SIZE; i++) {
        // Shuffle the available cards and take the first 5 for a board
        const shuffled = [...availableCards].sort(() => Math.random() - 0.5);
        boardSamples.push(shuffled.slice(0, 5));
    }
    
    // Evaluate each sample board
    boardSamples.forEach(board => {
        const allCards = [...holeCards, ...board];
        const { type } = findBestHand(allCards);
        handTypeCounts[type]++;
    });
    
    // Convert counts to percentages
    const probabilities = {};
    HAND_TYPES.forEach(type => {
        probabilities[type] = (handTypeCounts[type] / SAMPLE_SIZE) * 100;
    });
    
    // For the best/worst flops, we'll still use the original logic
    // but limit to fewer flops for performance
    const MAX_FLOPS_TO_EVALUATE = 1000;
    
    // Best flop groups by hand type
    const bestFlopsByType = {};
    // Worst flops by hand type
    const worstFlopsByType = {};
    
    // Get a sample of possible flops
    const flops = getCombinations(availableCards, 3).slice(0, MAX_FLOPS_TO_EVALUATE);
    
    // Evaluate each flop
    flops.forEach(flop => {
        const fiveCards = [...holeCards, ...flop];
        const { type, rank } = evaluate5CardHand(fiveCards);
        
        // Store in best/worst flops by type
        updateBestWorstFlops(bestFlopsByType, worstFlopsByType, type, flop, rank);
    });
    
    // Sort and format the best/worst flop groups for display
    const bestFlopGroups = formatFlopGroups(bestFlopsByType, true);
    const worstFlopGroups = formatFlopGroups(worstFlopsByType, false);
    
    console.timeEnd('worker:calculateAnalytics');
    
    return {
        probabilities,
        bestFlopGroups,
        worstFlopGroups,
        hasTurn: false
    };
}

// Main entry point - receives message from main thread
self.onmessage = function(e) {
    try {
        // Extract message data
        const { holeCards, flopCards, turnCard, riverCard } = e.data;
        
        // Validate input
        if (!holeCards || holeCards.length !== 2) {
            throw new Error("Two hole cards are required");
        }
        
        let result;
        
        // If we have a complete flop, use the specific board evaluation
        if (flopCards && flopCards.length === 3) {
            if (turnCard && riverCard) {
                // Complete 7-card hand (2 hole + 3 flop + turn + river)
                result = calculateAnalyticsWithFixedBoard(holeCards, flopCards, turnCard, riverCard);
            } else if (turnCard) {
                // 6-card hand (2 hole + 3 flop + turn)
                result = calculateAnalyticsWithFixedBoard(holeCards, flopCards, turnCard, null);
            } else {
                // 5-card hand (2 hole + 3 flop)
                result = calculateAnalyticsWithFixedBoard(holeCards, flopCards, null, null);
            }
        } else {
            // No specific flop selected, run full flop simulation
            result = calculateAnalytics(holeCards);
        }
        
        // Return the result to the main thread
        self.postMessage(result);
    } catch (error) {
        console.error("Worker error:", error);
        self.postMessage({ error: error.message });
    }
};

// Function to calculate analytics with a fixed board
function calculateAnalyticsWithFixedBoard(holeCards, flopCards, turnCard, riverCard) {
    console.time('worker:calculateFixedBoard');
    
    // If we have river card, we have a complete hand - no further probability
    if (riverCard) {
        // Combine all cards present
        const allCards = [...holeCards, ...flopCards, turnCard, riverCard];
        
        // Find the best 5-card hand from these cards
        const { type: handType, rank: handRank, bestHand } = findBestHand(allCards);
        
        // Set 100% probability for the actual hand type
        const probabilities = {};
        for (const type of HAND_TYPES) {
            probabilities[type] = (type === handType) ? 100 : 0;
        }
        
        // Create a 'group' for the current hand
        const currentHand = {
            handType,
            handName: handType,
            representativeFlop: flopCards,
            flops: [{ cards: flopCards, handRank }]
        };
        
        console.timeEnd('worker:calculateFixedBoard');
        
        // Return all analytics data including the best hand cards
        return {
            probabilities,
            bestFlopGroups: [currentHand],
            worstFlopGroups: [],
            bestHand,
            hasTurn: true
        };
    }
    
    // If we have turn card but no river, calculate best possible river cards
    if (turnCard) {
        // Use the dedicated function to find best next cards (river cards)
        const result = calculateBestNextCards(holeCards, flopCards, turnCard);
        
        // Get the current hand evaluation for display
        const currentCards = [...holeCards, ...flopCards, turnCard];
        const { type: currentHandType, rank: currentHandRank, bestHand } = findBestHand(currentCards);
        
        console.timeEnd('worker:calculateFixedBoard');
        
        // Add the best hand to the result
        result.bestHand = bestHand;
        
        return result;
    }
    
    // If we just have flop cards, calculate best possible turn cards
    if (flopCards) {
        // Use the dedicated function to find best next cards (turn cards)
        const result = calculateBestNextCards(holeCards, flopCards, null);
        
        // Get the current hand evaluation for display
        const currentCards = [...holeCards, ...flopCards];
        const { type: currentHandType, rank: currentHandRank, bestHand } = findBestHand(currentCards);
        
        console.timeEnd('worker:calculateFixedBoard');
        
        // Add the best hand to the result
        result.bestHand = bestHand;
        
        return result;
    }
    
    // Should not reach here
    return calculateAnalytics(holeCards);
}

// Evaluate a specific flop (used for fixed flop scenarios)
function evaluateFixedFlop(holeCards, flopCards, turnCard, riverCard) {
    // Build the 5-card hand
    let currentHandCards = [...holeCards];
    
    // Add flop cards if provided
    if (flopCards) {
        currentHandCards = currentHandCards.concat(flopCards);
    }
    
    // Add turn if provided
    if (turnCard) currentHandCards.push(turnCard);
    
    // Add river if provided
    if (riverCard) currentHandCards.push(riverCard);
    
    // Ensure we have the best 5 cards if we have more than 5
    let result;
    if (currentHandCards.length > 5) {
        // Find the best 5-card hand from all available cards
        result = findBestHand(currentHandCards);
    } else {
        // Just evaluate the 5 cards directly
        result = evaluate5CardHand(currentHandCards);
    }
    
    return {
        flop: flopCards || [],
        handName: result.handName,
        handRank: result.rank,
        fullHand: currentHandCards
    };
}

// Handle worker errors
self.onerror = function(error) {
    console.error("Worker script error:", error);
};

// Helper function to update the best and worst flops for each hand type
function updateBestWorstFlops(bestFlopsByType, worstFlopsByType, handType, flop, handRank) {
    // Initialize if this hand type hasn't been seen before
    if (!bestFlopsByType[handType]) {
        bestFlopsByType[handType] = { handType, handRank, flops: [] };
    }
    if (!worstFlopsByType[handType]) {
        worstFlopsByType[handType] = { handType, handRank, flops: [] };
    }
    
    // Store the flop in the appropriate collection
    bestFlopsByType[handType].flops.push({ cards: flop, handRank });
    worstFlopsByType[handType].flops.push({ cards: flop, handRank });
    
    // Limit the number of stored flops per type (to avoid excessive memory usage)
    const MAX_FLOPS_PER_TYPE = 10;
    if (bestFlopsByType[handType].flops.length > MAX_FLOPS_PER_TYPE) {
        bestFlopsByType[handType].flops = bestFlopsByType[handType].flops.slice(0, MAX_FLOPS_PER_TYPE);
    }
    if (worstFlopsByType[handType].flops.length > MAX_FLOPS_PER_TYPE) {
        worstFlopsByType[handType].flops = worstFlopsByType[handType].flops.slice(0, MAX_FLOPS_PER_TYPE);
    }
}

// Helper function to format flop groups for display
function formatFlopGroups(flopsByType, isBest) {
    // Convert to array and sort
    const groups = Object.values(flopsByType);
    
    // Sort based on whether we want best or worst flops
    if (isBest) {
        groups.sort((a, b) => b.handRank - a.handRank); // Best first (high to low)
    } else {
        groups.sort((a, b) => a.handRank - b.handRank); // Worst first (low to high)
    }
    
    // Format each group for display
    return groups.map(group => ({
        handType: group.handType,
        handName: group.handType,
        representativeFlop: group.flops[0]?.cards || [],
        flops: group.flops.map(f => f.cards),
        handRank: group.handRank
    }));
}