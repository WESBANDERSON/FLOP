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

// --- NEW: Global variable to store pre-computed probabilities ---
let holeCardProbabilities = null;

// --- NEW: Function to load probabilities ---
async function loadHoleCardProbabilities() {
    if (holeCardProbabilities) {
        return holeCardProbabilities;
    }
    try {
        const response = await fetch('hole_card_probs.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        holeCardProbabilities = await response.json();
        console.log("Successfully loaded hole_card_probs.json");
        return holeCardProbabilities;
    } catch (error) {
        console.error("Error loading hole_card_probs.json:", error);
        // Return a default structure or throw error to indicate failure
        return null; 
    }
}

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

// --- Simulation Functions ---

// Calculates EXACT probabilities BY THE RIVER given hole cards and a partial board
function simulateRemainingStreets(holeCards, boardCards) {
    console.log("Calculating exact river probabilities from partial board...");
    console.time('worker:simulateRemainingStreets');

    const knownCards = [...holeCards, ...boardCards];
    const deck = getDeck(knownCards);
    const cardsNeeded = 5 - boardCards.length; // 2 if flop, 1 if turn

    if (deck.length < cardsNeeded) {
        console.error("Not enough cards left in deck to simulate remaining streets.");
        return HAND_TYPES.reduce((acc, type) => { acc[type] = 0; return acc; }, {});
    }

    const handTypeCounts = {};
    HAND_TYPES.forEach(type => { handTypeCounts[type] = 0; });

    const remainingCombinations = getCombinations(deck, cardsNeeded);
    const totalCombinations = remainingCombinations.length;

    if (totalCombinations === 0) {
         console.error("No remaining card combinations found.");
         return HAND_TYPES.reduce((acc, type) => { acc[type] = 0; return acc; }, {});
    }

    remainingCombinations.forEach(combo => {
        const finalBoard = [...boardCards, ...combo];
        const allCards = [...holeCards, ...finalBoard];
        const { type } = findBestHand(allCards); // Evaluate final 7-card hand
        if (type) {
            handTypeCounts[type]++;
        }
    });

    // Convert counts to percentages
    const probabilities = {};
    HAND_TYPES.forEach(type => {
        probabilities[type] = (handTypeCounts[type] / totalCombinations) * 100;
    });

    console.timeEnd('worker:simulateRemainingStreets');
    console.log("Exact calculation complete.", probabilities);
    return probabilities;
}

// --- Function to calculate best NEXT card (for Best Turn/River lists) ---
// Renamed for clarity, logic remains similar
function calculateBestNextSingleCard(holeCards, currentBoard) {
    console.time('worker:calculateBestNextSingleCard');
    const isTurn = currentBoard.length === 3;
    const title = isTurn ? "Turn" : "River";
    console.log(`Calculating best single ${title} card`);

    const usedCards = [...holeCards, ...currentBoard];
    const remainingCards = getDeck(usedCards);

    if (remainingCards.length === 0) return []; // No cards left

    const nextCardResults = [];
    remainingCards.forEach(nextCard => {
        const cardsToEvaluate = [...usedCards, nextCard]; // Evaluate hand with the next card added
        const result = findBestHand(cardsToEvaluate); // Best hand with 6 or 7 cards
        nextCardResults.push({
            card: nextCard,
            type: result.type,
            rank: result.rank
        });
    });

    // Group cards by hand type achieved
    const handGroups = {};
    nextCardResults.forEach(result => {
        if (!handGroups[result.type]) {
            handGroups[result.type] = { type: result.type, rank: result.rank, cards: [] };
        }
        handGroups[result.type].cards.push(result.card);
    });

    // Sort groups by rank
    const groupsArray = Object.values(handGroups).sort((a, b) => b.rank - a.rank);

    // Format for UI
    const bestGroups = groupsArray.map(group => ({
        type: group.type,
        rank: group.rank,
        flops: group.cards.map(card => [card]), // Wrap card in array
        representativeFlop: [group.cards[0]], // Show the best card as representative
        handName: group.type
    }));

    console.timeEnd('worker:calculateBestNextSingleCard');
    return bestGroups;
}

// --- Main Analytics Calculation Logic ---

// --- UPDATED: Use lookup table for hole card probabilities ---
function getHoleCardKey(holeCards) {
    if (!holeCards || holeCards.length !== 2) return null;

    const card1Rank = holeCards[0].slice(0, -1);
    const card2Rank = holeCards[0].slice(0, -1);
    const card1Suit = holeCards[0].slice(-1);
    const card2Suit = holeCards[1].slice(-1);
    
    const rank1Value = RANKS_NUM[card1Rank];
    const rank2Value = RANKS_NUM[card2Rank];
    
    let key;
    if (rank1Value === rank2Value) { // Pocket pair
        key = card1Rank + card2Rank; 
    } else {
        const suited = card1Suit === card2Suit ? 's' : 'o';
        // Ensure consistent order (higher rank first)
        if (rank1Value > rank2Value) {
            key = card1Rank + card2Rank + suited;
        } else {
            key = card2Rank + card1Rank + suited;
        }
    }
    return key;
}

// Calculates analytics when only hole cards are known
async function calculateAnalyticsFromHoleCards(holeCards) {
    console.time('worker:calculateAnalyticsFromHoleCards');

    // 1. Load or get pre-computed probabilities
    const probsData = await loadHoleCardProbabilities();
    let probabilities = HAND_TYPES.reduce((acc, type) => { acc[type] = 0; return acc; }, {}); // Default

    if (probsData) {
        const key = getHoleCardKey(holeCards);
        if (key && probsData[key]) {
            probabilities = probsData[key];
            console.log(`Using pre-computed probabilities for ${key}`);
        } else {
            console.warn(`Could not find pre-computed probabilities for key: ${key}. Using defaults.`);
            // Optionally, you could fall back to calculation here, but we'll use defaults for now.
        }
    } else {
        console.error("Failed to load probability data. Using defaults.");
    }
    
    // 2. Calculate Best/Worst FLOPs based on immediate 5-card hand strength
    const deck = getDeck(holeCards); // Use deck excluding hole cards
    const availableCards = deck;
    const bestFlopsByType = {};
    const worstFlopsByType = {};
    const MAX_FLOPS_TO_EVALUATE = 1000; // Keep flop evaluation manageable
    const flops = getCombinations(availableCards, 3).slice(0, MAX_FLOPS_TO_EVALUATE);

    flops.forEach(flop => {
        const fiveCards = [...holeCards, ...flop];
        const { type, rank } = evaluate5CardHand(fiveCards); // Use 5-card eval for flops
        updateBestWorstFlops(bestFlopsByType, worstFlopsByType, type, flop, rank);
    });

    const bestFlopGroups = formatFlopGroups(bestFlopsByType, true);
    const worstFlopGroups = formatFlopGroups(worstFlopsByType, false);

    // Evaluate current hand (just hole cards)
    let currentHandResult = { handName: 'High Card', rank: 1, bestHand: holeCards };
    if (holeCards.length === 2) {
         const ranks = holeCards.map(c => c.slice(0,-1));
         if (ranks[0] === ranks[1]) {
             currentHandResult = { handName: 'Pair', rank: HAND_RANKS['Pair'], bestHand: holeCards };
         }
    }

    console.timeEnd('worker:calculateAnalyticsFromHoleCards');
    return {
        probabilities,
        bestFlopGroups, // Represents best/worst actual flops
        worstFlopGroups,
        currentHandName: currentHandResult.handName,
        currentBestHandCards: currentHandResult.bestHand,
        hasTurn: false,
        hasRiver: false
    };
}

// Calculates analytics when flop or turn is known
function calculateAnalyticsWithFixedBoard(holeCards, flopCards, turnCard, riverCard) {
    console.time('worker:calculateFixedBoard');
    
    let currentBoard = flopCards ? [...flopCards] : [];
    if (turnCard) currentBoard.push(turnCard);
    if (riverCard) currentBoard.push(riverCard);

    // 1. Evaluate the CURRENT best hand
    let currentCards = [...holeCards, ...currentBoard];
    let currentHandResult = { handName: 'High Card', rank: 1, bestHand: holeCards }; // Default for <5 cards
    if (currentCards.length >= 5) {
        currentHandResult = findBestHand(currentCards);
    }
    
    // 2. Calculate EXACT probabilities BY THE RIVER
    let probabilities = {};
    let bestNextCardGroups = [];
    let worstNextCardGroups = []; // Worst list is not typically shown after flop

    if (riverCard) {
        // River is dealt - probabilities are 100% for the final hand
        for (const type of HAND_TYPES) {
            probabilities[type] = (type === currentHandResult.handName) ? 100 : 0;
        }
        // No "best next card" groups needed
    } else {
        // Flop or Turn is dealt - simulate remaining cards for probabilities
        probabilities = simulateRemainingStreets(holeCards, currentBoard);
        // Calculate best SINGLE card for the next street display
        bestNextCardGroups = calculateBestNextSingleCard(holeCards, currentBoard);
    }
        
    console.timeEnd('worker:calculateFixedBoard');
    return {
        probabilities, // Now represents accurate river probabilities
        bestFlopGroups: bestNextCardGroups, // Represents best *next single card*
        worstFlopGroups: worstNextCardGroups, // Empty after flop
        currentHandName: currentHandResult.handName, 
        currentBestHandCards: currentHandResult.bestHand, 
        hasTurn: !!turnCard, 
        hasRiver: !!riverCard 
    };
}

// --- Worker Message Handling ---
self.onmessage = async function(e) { // Make this async to handle await
    try {
        const { holeCards, flopCards, turnCard, riverCard } = e.data;
        
        if (!holeCards || holeCards.length < 2) {
            // Handle case where calculation is requested before 2 hole cards are selected
            // This might happen if the main thread logic changes
            console.log("Worker called with fewer than 2 hole cards.");
            // Send back default/empty data
            const defaultProbs = HAND_TYPES.reduce((acc, type) => { acc[type] = 0; return acc; }, {});
             self.postMessage({ 
                probabilities: defaultProbs, 
                bestFlopGroups: [], 
                worstFlopGroups: [],
                currentHandName: 'High Card',
                currentBestHandCards: holeCards,
                hasTurn: false,
                hasRiver: false
            });
            return;
        }
        
        let result;
        if (flopCards && flopCards.length === 3) {
            // Flop, Turn, or River is known
            result = calculateAnalyticsWithFixedBoard(holeCards, flopCards, turnCard, riverCard);
        } else {
            // Only Hole Cards are known - NOW USES LOOKUP
            result = await calculateAnalyticsFromHoleCards(holeCards); // await the async function
        }
        
        self.postMessage(result);
    } catch (error) {
        console.error("Worker error:", error);
        self.postMessage({ error: error.message });
    }
};

// --- Helper functions for formatting/updating flop groups (remain the same) ---
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

// Handle worker errors
self.onerror = function(error) {
    console.error("Worker script error:", error);
};