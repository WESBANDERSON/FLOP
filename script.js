document.addEventListener('DOMContentLoaded', () => {
    const cardGrid = document.querySelector('.card-grid');
    const selectedCardsDisplay = document.getElementById('selected-cards-display');
    const communityCardsDisplay = document.getElementById('community-cards-display');
    const probabilitiesContainer = document.querySelector('.probabilities');
    const bestFlopsList = document.getElementById('best-flops-list');
    const worstFlopsList = document.getElementById('worst-flops-list');
    const bestFlopsTitle = document.getElementById('best-flops-title');
    const worstFlopsTitle = document.getElementById('worst-flops-title');
    const handNameElement = document.getElementById('hand-name');
    const currentHandElement = document.getElementById('current-hand');
    const probInfoIcon = document.getElementById('prob-info-icon');
    const probabilityExplanation = document.getElementById('probability-explanation');
    const loadingSpinner = document.getElementById('loading-spinner');
    const analyticsDisplay = document.querySelector('.analytics-display');
    const cardSelector = document.querySelector('.card-selector');
    const clearAllBtn = document.getElementById('clear-all-btn');
    
    // --- Initialize Web Worker ---
    let worker;
    try {
        worker = new Worker('worker.js');
        console.log("Worker initialized successfully.");
    } catch (error) {
        console.error("Failed to create Web Worker:", error);
        cardSelector.innerHTML = '<p style="color: red; padding: 20px;">Error: Could not initialize the calculation worker. Your browser might not support Web Workers or there was a script error.</p>';
        analyticsDisplay.innerHTML = '';
        return;
    }

    // --- Constants needed for UI formatting ---
    const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']; // Keep for sorting/UI
    const SUITS = ['s', 'h', 'd', 'c']; // Keep for sorting/UI
    const SUIT_SYMBOLS = { s: '♠️', h: '♥️', d: '♦️', c: '♣️' };
    const SUIT_CLASSES = { s: 'suit-s', h: 'suit-h', d: 'suit-d', c: 'suit-c' };
    const DISPLAY_HAND_TYPES = [
        'Straight Flush', 'Four of a Kind', 'Full House', 'Flush', 'Straight',
        'Three of a Kind', 'Two Pair', 'Pair', 'High Card'
    ]; // Use the same list for display order, matching UI_HAND_TYPES in worker

    // Card selection state
    let selectedHoleCards = [];
    let selectedFlopCards = [];
    let selectedTurnCard = null;
    let selectedRiverCard = null;
    
    // Constants for max number of cards
    const MAX_HOLE_CARDS = 2;
    const MAX_FLOP_CARDS = 3;

    // --- Helper Functions (Only UI related ones remain) ---
    function generateFullDeck() { // Keep for button generation
        const fullDeck = [];
        RANKS.forEach(rank => {
            SUITS.forEach(suit => {
                fullDeck.push(rank + suit);
            });
        });
        return fullDeck;
    }

    function formatCard(cardString, useHtml = true) {
        if (!cardString || cardString.length < 2) return '';
        const rank = cardString.substring(0, cardString.length - 1);
        const suit = cardString.substring(cardString.length - 1).toLowerCase();
        const displayRank = rank === 'T' ? '10' : rank;
        const suitSymbol = SUIT_SYMBOLS[suit] || suit;
        
        if (useHtml) {
            // Use community-cards-flop for all cards for consistent styling
            return `<span class="card-text"><span class="card-rank">${displayRank}</span><span class="${SUIT_CLASSES[suit]}">${suitSymbol}</span></span>`;
        } else {
            return `${displayRank}${suitSymbol}`;
        }
    }

    // Format a hand with colored suits
    const formatHand = (hand, useHtml = true) => {
        if (!hand || !Array.isArray(hand)) return '';
        
        if (useHtml) {
            return hand.map(card => {
                // Check if card is a string or object
                let rank, suit;
                if (typeof card === 'string') {
                    rank = card.slice(0, -1);
                    suit = card.slice(-1).toLowerCase();
                } else if (card && typeof card === 'object') {
                    rank = card.rank;
                    suit = card.suit;
                } else {
                    return '';
                }
                
                const displayRank = rank === 'T' ? '10' : rank;
                const suitSymbol = SUIT_SYMBOLS[suit];
                const suitColor = (suit === 'h' || suit === 'd') ? '#FF0000' : '#000000';
                return `<span class="card-text"><span class="card-rank">${displayRank}</span><span style="color: ${suitColor}">${suitSymbol}</span></span>`;
            }).join(' ');
        } else {
            // Simple text-only version without HTML
            return hand.map(card => {
                // Check if card is a string or object
                let rank, suit;
                if (typeof card === 'string') {
                    rank = card.slice(0, -1);
                    suit = card.slice(-1).toUpperCase();
                } else if (card && typeof card === 'object') {
                    rank = card.rank;
                    suit = card.suit.toUpperCase();
                } else {
                    return '';
                }
                
                const displayRank = rank === 'T' ? '10' : rank;
                return `${displayRank}${suit}`;
            }).join(' ');
        }
    };

    // --- Card Selection Logic ---
    function createCardButtons() {
        // Create buttons for card selection
        cardGrid.innerHTML = ''; 
        const fullDeck = generateFullDeck();
        fullDeck.sort((a, b) => { 
            const rankA = RANKS.indexOf(a.slice(0, -1));
            const rankB = RANKS.indexOf(b.slice(0, -1));
            if (rankA !== rankB) return rankA - rankB;
            const suitA = SUITS.indexOf(a.slice(-1));
            const suitB = SUITS.indexOf(b.slice(-1));
            return suitA - suitB;
        });

        fullDeck.forEach(card => {
            const button = document.createElement('button');
            button.classList.add('card-button');
            button.dataset.card = card;
            button.innerHTML = formatCard(card, true);
            button.addEventListener('click', () => toggleCardSelection(button, card));
            cardGrid.appendChild(button);
        });
    }

    function toggleCardSelection(button, card) {
        // Check if this card is already selected
        const isHoleCard = selectedHoleCards.includes(card);
        const isFlopCard = selectedFlopCards.includes(card);
        const isTurnCard = selectedTurnCard === card;
        const isRiverCard = selectedRiverCard === card;
        
        // If card is already selected, remove it from its current position
        if (isHoleCard || isFlopCard || isTurnCard || isRiverCard) {
            if (isHoleCard) {
                selectedHoleCards = selectedHoleCards.filter(c => c !== card);
                
                // If we're removing a hole card, also clear any later selections
                if (selectedHoleCards.length === 0) {
                    selectedFlopCards = [];
                    selectedTurnCard = null;
                    selectedRiverCard = null;
                }
            } else if (isFlopCard) {
                selectedFlopCards = selectedFlopCards.filter(c => c !== card);
                
                // If we're removing a flop card, also clear turn and river
                if (selectedFlopCards.length < MAX_FLOP_CARDS) {
                    selectedTurnCard = null;
                    selectedRiverCard = null;
                }
            } else if (isTurnCard) {
                selectedTurnCard = null;
                selectedRiverCard = null; // Also clear river if turn is removed
            } else if (isRiverCard) {
                selectedRiverCard = null;
            }
            
            // Update button state
            button.classList.remove('hole-selected', 'flop-selected', 'turn-selected', 'river-selected');
        } else {
            // Card is not selected, so add it to the appropriate group based on our current state
            
            // Determine where this card should go
            if (selectedHoleCards.length < MAX_HOLE_CARDS) {
                // First, select hole cards
                selectedHoleCards.push(card);
                button.classList.add('hole-selected');
            } else if (selectedFlopCards.length < MAX_FLOP_CARDS) {
                // Then, select flop cards
                selectedFlopCards.push(card);
                button.classList.add('flop-selected');
            } else if (selectedTurnCard === null) {
                // Then, select turn card
                selectedTurnCard = card;
                button.classList.add('turn-selected');
            } else if (selectedRiverCard === null) {
                // Finally, select river card
                selectedRiverCard = card;
                button.classList.add('river-selected');
            } else {
                // All cards are already selected
                console.log("All cards already selected.");
                return;
            }
        }
        
        // Update displays
        updateHoleCardsDisplay();
        updateCommunityCardsDisplay();
        
        // Update analysis if we have enough cards
        if (selectedHoleCards.length === MAX_HOLE_CARDS) {
            updateAnalytics();
        } else {
            // Clear analytics if we don't have enough hole cards
            clearAnalytics();
        }
        
        // Update all button states to reflect available options
        updateCardButtonStates();
    }

    function updateCardButtonStates() {
        // Disable buttons for cards that are already selected
        const allButtons = document.querySelectorAll('.card-button');
        allButtons.forEach(button => {
            const cardValue = button.dataset.card;
            const isSelected = selectedHoleCards.includes(cardValue) || 
                              selectedFlopCards.includes(cardValue) ||
                              selectedTurnCard === cardValue ||
                              selectedRiverCard === cardValue;
            
            // Enable/disable based on selection
            if (isSelected) {
                button.classList.add('selected');
            } else {
                button.classList.remove('selected');
            }
            
            // Determine button type based on where the card is
            button.classList.remove('hole-selected', 'flop-selected', 'turn-selected', 'river-selected');
            if (selectedHoleCards.includes(cardValue)) {
                button.classList.add('hole-selected');
            } else if (selectedFlopCards.includes(cardValue)) {
                button.classList.add('flop-selected');
            } else if (selectedTurnCard === cardValue) {
                button.classList.add('turn-selected');
            } else if (selectedRiverCard === cardValue) {
                button.classList.add('river-selected');
            }
        });
    }

    function updateHoleCardsDisplay() {
        // Update the text display for hole cards
        while (selectedCardsDisplay.firstChild) {
            selectedCardsDisplay.removeChild(selectedCardsDisplay.firstChild);
        }
        
        // Add selected hole cards
        selectedHoleCards.forEach(card => {
            const span = document.createElement('span');
            span.innerHTML = formatCard(card, true);
            selectedCardsDisplay.appendChild(span);
        });
        
        // No placeholders for empty slots - leave blank
    }

    function updateCommunityCardsDisplay() {
        // Clear previous cards
        communityCardsDisplay.innerHTML = '';
        
        // Add flop cards
        selectedFlopCards.forEach(card => {
            const span = document.createElement('span');
            span.classList.add('community-card', 'flop-card');
            span.innerHTML = formatCard(card);
            communityCardsDisplay.appendChild(span);
        });
        
        // Add turn card
        if (selectedTurnCard) {
            const span = document.createElement('span');
            span.classList.add('community-card', 'turn-card');
            span.innerHTML = formatCard(selectedTurnCard);
            communityCardsDisplay.appendChild(span);
        }
        
        // Add river card
        if (selectedRiverCard) {
            const span = document.createElement('span');
            span.classList.add('community-card', 'river-card');
            span.innerHTML = formatCard(selectedRiverCard);
            communityCardsDisplay.appendChild(span);
        }
    }

    function updateAnalytics() {
        // If we don't have 2 hole cards, don't calculate
        if (selectedHoleCards.length !== MAX_HOLE_CARDS) {
            clearAnalytics();
            return;
        }
        
        // Show loading spinner
        loadingSpinner.style.display = 'flex';
        
        // Clear previous results
        probabilitiesContainer.innerHTML = '';
        bestFlopsList.innerHTML = '';
        worstFlopsList.innerHTML = '';
        
        // Update titles based on flop selection state
        if (selectedFlopCards.length === MAX_FLOP_CARDS) {
            // Flop is fully selected, change titles to "Next Cards" and hide worst cards section
            bestFlopsTitle.textContent = 'Best Turn Cards';
            worstFlopsTitle.parentElement.style.display = 'none'; // Hide worst cards section
        } else {
            // Flop is not fully selected, use default titles and show both sections
            bestFlopsTitle.textContent = 'Best Flops';
            worstFlopsTitle.textContent = 'Worst Flops';
            worstFlopsTitle.parentElement.style.display = 'block'; // Show worst cards section
        }
        
        console.log("Sending to worker for analytics:", {
            holeCards: selectedHoleCards,
            flopCards: selectedFlopCards.length === MAX_FLOP_CARDS ? selectedFlopCards : null,
            turnCard: selectedTurnCard,
            riverCard: selectedRiverCard
        });
        
        // Send message to worker
        worker.postMessage({ 
            holeCards: selectedHoleCards,
            flopCards: selectedFlopCards.length === MAX_FLOP_CARDS ? selectedFlopCards : null,
            turnCard: selectedTurnCard,
            riverCard: selectedRiverCard
        });
    }
    
    function clearAnalytics() {
        probabilitiesContainer.innerHTML = '<p>Select two hole cards to see probabilities.</p>';
        bestFlopsList.innerHTML = '';
        worstFlopsList.innerHTML = '';
        bestFlopsTitle.textContent = 'Best Flops';
        worstFlopsTitle.textContent = 'Worst Flops';
        worstFlopsTitle.parentElement.style.display = 'block';
        updateHandNameDisplay(null); // Reset hand name display
    }

    // Function to update the hand name display
    function updateHandNameDisplay(bestGroups, bestHand) {
        // Reset all styling classes
        handNameElement.className = 'hand-name';
        
        if (!bestGroups || bestGroups.length === 0) {
            handNameElement.textContent = 'Select cards to see your hand';
            currentHandElement.textContent = 'Current hand: Select cards to see your current hand';
            return;
        }
        
        // If we have a complete hand (flop + turn + river or just flop)
        if (selectedFlopCards.length === MAX_FLOP_CARDS) {
            // Get the current hand type from the first group (highest ranked)
            const handName = bestGroups[0].handName;
            
            // Add class for styling based on hand type
            const className = handName.toLowerCase().replace(/\s+/g, '-');
            handNameElement.classList.add(className);
            
            // Use the provided best hand if available, otherwise calculate it
            const cardsToDisplay = bestHand || findBestHand([...selectedHoleCards, ...selectedFlopCards, 
                                       ...(selectedTurnCard ? [selectedTurnCard] : []), 
                                       ...(selectedRiverCard ? [selectedRiverCard] : [])]);
            
            const bestHandDisplay = cardsToDisplay.map(card => formatCard(card, true)).join(' ');
            
            // Display the hand name and cards without the explanatory text
            handNameElement.innerHTML = `${handName}: ${bestHandDisplay}`;
            
            // Update current hand display
            updateCurrentHandDisplay(handName, cardsToDisplay);
        } else if (selectedHoleCards.length === MAX_HOLE_CARDS) {
            // Just hole cards - show what hands are possible
            const topHandName = bestGroups[0].handName;
            
            // For hole cards only, show the hole cards themselves
            const holeCardsDisplay = selectedHoleCards.map(card => formatCard(card, true)).join(' ');
            
            // Match the format of the complete hand display
            handNameElement.innerHTML = `Best possible: ${topHandName} ${holeCardsDisplay}`;
            
            // Add class for styling
            const className = topHandName.toLowerCase().replace(/\s+/g, '-');
            handNameElement.classList.add(className);
            
            // Update current hand display for hole cards only
            const currentHand = evaluateCurrentHand(selectedHoleCards);
            updateCurrentHandDisplay(currentHand.handName, selectedHoleCards);
        } else {
            // Default state
            handNameElement.textContent = 'Select cards to see your hand';
            currentHandElement.textContent = 'Current hand: Select cards to see your current hand';
        }
    }
    
    // Function to update the current hand display
    function updateCurrentHandDisplay(handName, cards) {
        // Reset styling classes
        currentHandElement.className = 'hand-name';
        
        // Add class for styling based on hand type
        const className = handName.toLowerCase().replace(/\s+/g, '-');
        currentHandElement.classList.add(className);
        
        // Create the display text with the cards
        const cardsDisplay = Array.isArray(cards) ? 
            cards.map(card => formatCard(card, true)).join(' ') : '';
        
        // Update the display
        currentHandElement.innerHTML = `Current hand: ${handName} ${cardsDisplay}`;
    }
    
    // Function to evaluate the current hand with just the cards we have
    function evaluateCurrentHand(cards) {
        if (!cards || cards.length < 2) {
            return { handName: 'High Card', rank: 1 };
        }
        
        // If we have 5 or more cards, find the best 5-card hand
        if (cards.length >= 5) {
            return findBestHand(cards);
        }
        
        // For fewer than 5 cards, evaluate what we have
        // Pair check
        const ranks = cards.map(card => card.substring(0, card.length - 1));
        const rankCounts = {};
        
        ranks.forEach(rank => {
            rankCounts[rank] = (rankCounts[rank] || 0) + 1;
        });
        
        const maxCount = Math.max(...Object.values(rankCounts));
        
        if (maxCount === 2) {
            return { handName: 'Pair', rank: 2 };
        }
        
        if (maxCount === 3) {
            return { handName: 'Three of a Kind', rank: 4 };
        }
        
        if (maxCount === 4) {
            return { handName: 'Four of a Kind', rank: 8 };
        }
        
        // Default to high card
        return { handName: 'High Card', rank: 1 };
    }

    // Helper function to find the best 5-card hand from the given cards
    function findBestHand(cards) {
        // Logic to find the best 5-card hand
        // This is a simplified version that just returns the first 5 cards
        // In a real implementation, we would evaluate all possible 5-card combinations
        // and return the best one according to poker hand rankings
        
        // For now, we'll just return the first 5 cards or all cards if less than 5
        return cards.slice(0, 5);
    }

    // Initialize UI
    createCardButtons();
    updateHoleCardsDisplay();
    updateCommunityCardsDisplay();
    updateCardButtonStates();
    clearAnalytics();

    // Event Listener for the Worker
    worker.onmessage = function(e) {
        // Hide loading spinner
        loadingSpinner.style.display = 'none';
        
        if (e.data.error) {
            probabilitiesContainer.innerHTML = `<p class="error">Error: ${e.data.error}</p>`;
            console.error("Worker error:", e.data.error);
            return;
        }
        
        // Process results
        const { probabilities, bestFlopGroups, worstFlopGroups, hasTurn, bestHand } = e.data;
        
        // Update hand name display if we have complete cards or best options
        updateHandNameDisplay(bestFlopGroups, bestHand);
        
        // Update titles based on selected cards
        if (selectedFlopCards.length === MAX_FLOP_CARDS) {
            // Hide worst flops section
            worstFlopsTitle.parentElement.style.display = 'none';
            
            if (selectedTurnCard) {
                // If turn is selected, show best river cards
                bestFlopsTitle.textContent = 'Best River Cards';
            } else {
                // If only flop is selected, show best turn cards
                bestFlopsTitle.textContent = 'Best Turn Cards';
            }
        } else {
            // Default titles and show both sections
            bestFlopsTitle.textContent = 'Best Flops';
            worstFlopsTitle.textContent = 'Worst Flops';
            worstFlopsTitle.parentElement.style.display = 'block';
        }
        
        displayProbabilities(probabilities);
        displayFlops(bestFlopGroups, worstFlopGroups);
    };

    worker.onerror = function(error) {
        loadingSpinner.style.display = 'none';
        probabilitiesContainer.innerHTML = `<p class="error">Worker Error: ${error.message}</p>`;
        console.error("Error in Web Worker: ", error);
    };
    
    // --- Other UI handlers ---
    // Remove the event listener for the now-removed info icon
    /*
    probInfoIcon.addEventListener('click', function() {
        const explanation = document.getElementById('probability-explanation');
        explanation.style.display = explanation.style.display === 'none' ? 'block' : 'none';
    });
    */
    
    // Add these functions where appropriate in your code
    function displayProbabilities(probabilities) {
        // Clear previous probabilities
        probabilitiesContainer.innerHTML = '';
        
        // Create header with explanation
        const header = document.createElement('div');
        header.className = 'probability-header';
        header.innerHTML = `
            <p class="prob-explanation">
                Showing the probability of hitting each hand type by the river
            </p>
        `;
        probabilitiesContainer.appendChild(header);
        
        // Filter and sort hand types by probability (descending)
        const handTypes = Object.keys(probabilities)
            .filter(type => probabilities[type] > 0.01) // Filter out near-zero probabilities
            .sort((a, b) => probabilities[b] - probabilities[a]);
        
        // Create a probability bar for each hand type
        handTypes.forEach(handType => {
            const probability = probabilities[handType];
            
            // Create container for this hand type
            const handContainer = document.createElement('div');
            handContainer.className = 'probability-item';
            
            // Create label and percentage
            const label = document.createElement('div');
            label.className = 'probability-label';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'hand-type-name';
            nameSpan.textContent = handType;
            
            const percentSpan = document.createElement('span');
            percentSpan.className = 'percentage';
            percentSpan.textContent = `${probability.toFixed(1)}%`;
            
            label.appendChild(nameSpan);
            label.appendChild(percentSpan);
            
            // Create progress bar
            const progressContainer = document.createElement('div');
            progressContainer.className = 'probability-bar-container';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'probability-bar';
            progressBar.style.width = `${Math.min(100, probability)}%`;
            // Assign color based on hand type
            progressBar.classList.add(handType.toLowerCase().replace(/\s+/g, '-'));
            
            progressContainer.appendChild(progressBar);
            
            // Add tooltip with explanation
            const tooltip = document.createElement('div');
            tooltip.className = 'probability-item-tooltip';
            tooltip.textContent = getMessage(handType, probability);
            
            // Append everything to the hand container
            handContainer.appendChild(label);
            handContainer.appendChild(progressContainer);
            handContainer.appendChild(tooltip);
            
            // Add hover behavior for tooltip
            handContainer.addEventListener('mouseenter', () => {
                tooltip.style.display = 'block';
            });
            handContainer.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
            
            // Add to the main container
            probabilitiesContainer.appendChild(handContainer);
        });
        
        // Function to generate appropriate message based on selected cards
        function getMessage(handType, probability) {
            if (selectedRiverCard) {
                return `This is your final hand.`;
            } else if (selectedTurnCard) {
                return `You have a ${probability.toFixed(1)}% chance of making a ${handType} after the river card.`;
            } else if (selectedFlopCards.length === MAX_FLOP_CARDS) {
                return `You have a ${probability.toFixed(1)}% chance of making a ${handType} by the river.`;
            } else {
                return `You have a ${probability.toFixed(1)}% chance of making a ${handType} with your hole cards.`;
            }
        }
    }
    
    function displayFlops(bestGroups = [], worstGroups = []) {
        // Clear previous results
        bestFlopsList.innerHTML = '';
        worstFlopsList.innerHTML = '';
        
        // Determine what we're showing based on selection state
        let displayType = 'flops'; // Default
        if (selectedFlopCards.length === MAX_FLOP_CARDS) {
            if (selectedTurnCard) {
                displayType = 'river';
            } else {
                displayType = 'turn';
            }
        }
        
        // Display best groups
        if (bestGroups.length > 0) {
            bestGroups.forEach(group => {
                renderGroup(group, bestFlopsList, displayType);
            });
        } else {
            bestFlopsList.innerHTML = '<li>No data available</li>';
        }
        
        // Display worst groups
        if (worstGroups.length > 0) {
            worstGroups.forEach(group => {
                renderGroup(group, worstFlopsList, displayType);
            });
        } else {
            worstFlopsList.innerHTML = '<li>No data available</li>';
        }
    }
    
    // Function to render a flop group
    function renderGroup(group, listElement, displayType = 'flops') {
        // Create the list item container
        const groupItem = document.createElement('li');
        groupItem.className = 'flop-group';
        
        // Create the group summary section
        const groupSummary = document.createElement('div');
        groupSummary.className = 'flop-group-summary';
        
        // Create and add hand name
        const handName = document.createElement('span');
        handName.className = 'flop-group-name';
        handName.textContent = group.handName;
        groupSummary.appendChild(handName);
        
        // Create and add representative cards
        const repCards = document.createElement('span');
        repCards.className = 'flop-group-rep';
        
        // Display the representative cards, handling different formats depending on the card type
        if (group.representativeFlop && group.representativeFlop.length > 0) {
            // For turn/river cards, we need to handle single card format vs flop format
            if ((displayType === 'turn' || displayType === 'river') && group.flops && group.flops[0] && group.flops[0].length === 1) {
                // This is a turn or river card (single card)
                repCards.innerHTML = formatHand([group.flops[0][0]], true);
            } else {
                // This is a flop (multiple cards)
                repCards.innerHTML = formatHand(group.representativeFlop, true);
            }
            groupSummary.appendChild(repCards);
        }
        
        // Add the number of variations if more than 1
        if (group.flops && group.flops.length > 1) {
            const variationsCount = document.createElement('span');
            variationsCount.className = 'flop-group-count';
            
            // Adjust the text based on what we're showing
            if (displayType === 'turn') {
                variationsCount.textContent = `${group.flops.length} turn options`;
            } else if (displayType === 'river') {
                variationsCount.textContent = `${group.flops.length} river options`;
            } else {
                variationsCount.textContent = `${group.flops.length} variations`;
            }
            
            groupSummary.appendChild(variationsCount);
            
            // Add dropdown icon
            const dropdownIcon = document.createElement('span');
            dropdownIcon.className = 'dropdown-icon';
            dropdownIcon.innerHTML = '▼';
            groupSummary.appendChild(dropdownIcon);
            
            // Make the whole summary clickable to toggle dropdown
            groupSummary.style.cursor = 'pointer';
            
            // First, add the summary to the group item
            groupItem.appendChild(groupSummary);
            
            // Create the dropdown container (initially hidden)
            const dropdown = document.createElement('div');
            dropdown.className = 'variations-dropdown';
            dropdown.style.display = 'none';
            
            // Add each variation to the dropdown
            group.flops.forEach(flop => {
                const variationItem = document.createElement('div');
                variationItem.className = 'variation-item';
                
                if ((displayType === 'turn' || displayType === 'river') && flop.length === 1) {
                    // For turn/river, each flop is a single card
                    variationItem.innerHTML = formatHand([flop[0]], true);
                } else {
                    // For flops, each is a set of 3 cards
                    variationItem.innerHTML = formatHand(flop, true);
                }
                
                dropdown.appendChild(variationItem);
            });
            
            // Add click handler to toggle dropdown
            groupSummary.addEventListener('click', function() {
                const isHidden = dropdown.style.display === 'none';
                dropdown.style.display = isHidden ? 'block' : 'none';
                dropdownIcon.innerHTML = isHidden ? '▲' : '▼';
            });
            
            // Add the dropdown to the group item AFTER the summary
            groupItem.appendChild(dropdown);
        } else {
            // If there's only one variation, just add the summary
            groupItem.appendChild(groupSummary);
        }
        
        // Add the group item to the list
        listElement.appendChild(groupItem);
    }

    // Add event listener for the Clear All button
    clearAllBtn.addEventListener('click', () => {
        selectedHoleCards = [];
        selectedFlopCards = [];
        selectedTurnCard = null;
        selectedRiverCard = null;
        updateHoleCardsDisplay();
        updateCommunityCardsDisplay();
        updateCardButtonStates();
        clearAnalytics();
        
        // Reset titles and make sure worst section is visible
        bestFlopsTitle.textContent = 'Best Flops';
        worstFlopsTitle.textContent = 'Worst Flops';
        worstFlopsTitle.parentElement.style.display = 'block';
        
        // Reset hand name display
        handNameElement.className = 'hand-name';
        handNameElement.textContent = 'Select cards to see your hand';
        currentHandElement.className = 'hand-name';
        currentHandElement.textContent = 'Current hand: Select cards to see your current hand';
    });
}); 