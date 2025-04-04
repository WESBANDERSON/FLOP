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

    // Default state data
    const defaultProbabilities = DISPLAY_HAND_TYPES.reduce((acc, type) => {
        acc[type] = 0;
        return acc;
    }, {});

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
        
        // ALWAYS update analytics, which will handle placeholder state internally
        updateAnalytics();
        
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
        // Select the main display container
        const displayContainer = document.getElementById('selected-cards-display');
        if (!displayContainer) return;

        // Clear the main container
        while (displayContainer.firstChild) {
            displayContainer.removeChild(displayContainer.firstChild);
        }
        
        // Add selected hole cards directly to the main container
        selectedHoleCards.forEach(card => {
            const span = document.createElement('span');
            span.innerHTML = formatCard(card, true);
            displayContainer.appendChild(span);
        });
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
        // If we don't have 2 hole cards, display placeholder state and return
        if (selectedHoleCards.length !== MAX_HOLE_CARDS) {
            displayPlaceholderAnalytics();
            return;
        }
        
        // Proceed with calculating analytics if we have 2 hole cards
        loadingSpinner.style.display = 'flex';
        
        // Clear previous results (but keep containers)
        // Note: We are now clearing inside display functions to handle placeholders better
        // probabilitiesContainer.innerHTML = ''; 
        // bestFlopsList.innerHTML = '';
        // worstFlopsList.innerHTML = '';
        
        // Update titles based on flop selection state
        if (selectedFlopCards.length === MAX_FLOP_CARDS) {
            bestFlopsTitle.textContent = 'Best Turn Cards';
            worstFlopsTitle.parentElement.style.display = 'none'; 
        } else {
            bestFlopsTitle.textContent = 'Best Flops';
            worstFlopsTitle.textContent = 'Worst Flops';
            worstFlopsTitle.parentElement.style.display = 'block'; 
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

    // Function to display the placeholder state for analytics
    function displayPlaceholderAnalytics() {
        loadingSpinner.style.display = 'none'; // Ensure spinner is hidden
        
        // Display probabilities at 0%
        displayProbabilities(defaultProbabilities);
        
        // Display placeholder text in flop lists
        const placeholderText = 'Select 2 hole cards';
        displayFlops([{ handName: placeholderText, flops: [] }], [{ handName: placeholderText, flops: [] }]);
        
        // Reset titles to default
        bestFlopsTitle.textContent = 'Best Flops';
        worstFlopsTitle.textContent = 'Worst Flops';
        worstFlopsTitle.parentElement.style.display = 'block'; // Ensure worst is visible

        // Update hand name displays to initial state
        updateHandNameDisplay(null, null); // Will show default text
        updateCurrentHandDisplay(null, null); // Will show default text
    }

    // Event Listener for the Worker
    worker.onmessage = function(e) {
        // Hide loading spinner
        loadingSpinner.style.display = 'none';
        
        if (e.data.error) {
            probabilitiesContainer.innerHTML = `<p class="error">Error: ${e.data.error}</p>`;
            console.error("Worker error:", e.data.error);
            return;
        }
        
        // Process results from worker
        const { 
            probabilities, 
            bestFlopGroups, 
            worstFlopGroups, 
            currentHandName, 
            currentBestHandCards, 
            hasTurn, 
            hasRiver 
        } = e.data;
        
        // Update the main hand name display (best possible)
        // If we have a full board, use the current hand name
        if (hasRiver) {
            updateHandNameDisplay(currentHandName, currentBestHandCards);
        } else if (bestFlopGroups && bestFlopGroups.length > 0) {
            // Otherwise show the best potential hand from the groups
            const bestPotentialHandName = bestFlopGroups[0].handName;
            const bestPotentialCards = selectedHoleCards; // Show hole cards for potential
            updateHandNameDisplay(bestPotentialHandName, bestPotentialCards, true);
        } else {
            updateHandNameDisplay('High Card', selectedHoleCards); // Default if no groups
        }
        
        // Update the "Current Hand" display with the accurate hand from the worker
        if (currentHandName && currentBestHandCards) {
            updateCurrentHandDisplay(currentHandName, currentBestHandCards);
        } else {
            // Fallback for initial state (hole cards only) - evaluate locally
            const currentHandLocal = evaluateCurrentHand(selectedHoleCards);
            updateCurrentHandDisplay(currentHandLocal.handName, selectedHoleCards);
        }
        
        // Update titles based on selected cards
        if (hasRiver) {
            // Hide flop/turn/river sections if river is dealt
            bestFlopsTitle.parentElement.style.display = 'none';
            worstFlopsTitle.parentElement.style.display = 'none';
        } else if (hasTurn) {
            // If turn is selected, show best river cards
            bestFlopsTitle.textContent = 'Best River Cards';
            bestFlopsTitle.parentElement.style.display = 'block';
            worstFlopsTitle.parentElement.style.display = 'none'; // Hide worst
        } else if (selectedFlopCards.length === MAX_FLOP_CARDS) {
            // If only flop is selected, show best turn cards
            bestFlopsTitle.textContent = 'Best Turn Cards';
            bestFlopsTitle.parentElement.style.display = 'block';
            worstFlopsTitle.parentElement.style.display = 'none'; // Hide worst
        } else {
            // Default titles (hole cards only)
            bestFlopsTitle.textContent = 'Best Flops';
            worstFlopsTitle.textContent = 'Worst Flops';
            bestFlopsTitle.parentElement.style.display = 'block';
            worstFlopsTitle.parentElement.style.display = 'block';
        }
        
        // Display probabilities and flops/next cards
        displayProbabilities(probabilities);
        if (!hasRiver) {
            displayFlops(bestFlopGroups, worstFlopGroups); // Only display if river not dealt
        }
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
        
        // Ensure we always display all hand types, even if probability is 0
        const handTypes = DISPLAY_HAND_TYPES; // Use the constant list
        
        // Create a probability bar for each hand type
        handTypes.forEach(handType => {
            const probability = probabilities[handType] || 0; // Default to 0 if not present
            
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
            if (selectedHoleCards.length < MAX_HOLE_CARDS) {
                return 'Select 2 hole cards to see calculated odds.';
            } else if (selectedRiverCard) {
                return `This is your final hand.`;
            } else if (selectedTurnCard) {
                return `You have a ${probability.toFixed(1)}% chance of making a ${handType} after the river card.`;
            } else if (selectedFlopCards.length === MAX_FLOP_CARDS) {
                return `You have a ${probability.toFixed(1)}% chance of making a ${handType} by the river.`;
            } else {
                // This case (2 hole cards, no flop) should use probabilities from the worker
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
        
        const placeholderText = "Select 2 hole cards";
        
        // Display best groups
        if (bestGroups.length > 0 && bestGroups[0].handName !== placeholderText) {
            bestGroups.forEach(group => {
                renderGroup(group, bestFlopsList, displayType);
            });
        } else {
            bestFlopsList.innerHTML = `<li class="placeholder-text">${bestGroups[0]?.handName || placeholderText}</li>`;
        }
        
        // Display worst groups
        if (worstGroups.length > 0 && worstGroups[0].handName !== placeholderText) {
            worstGroups.forEach(group => {
                renderGroup(group, worstFlopsList, displayType);
            });
        } else {
            worstFlopsList.innerHTML = `<li class="placeholder-text">${worstGroups[0]?.handName || placeholderText}</li>`;
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
        updateAnalytics();
        
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

    // Function to update the hand name display
    function updateHandNameDisplay(handName, cards, isPotential = false) {
        handNameElement.innerHTML = ''; // Clear previous content
        handNameElement.className = 'hand-name'; // Reset class

        if (!handName || !cards) {
            handNameElement.textContent = 'Select cards to see your hand';
            return;
        }

        // Add class for styling based on hand type
        const className = handName.toLowerCase().replace(/\s+/g, '-');
        handNameElement.classList.add(className);

        // Create label span
        const labelSpan = document.createElement('span');
        labelSpan.className = 'hand-label'; // Add class for potential styling
        labelSpan.textContent = isPotential ? 'Best possible:' : handName + ':'; // Use hand name as label if not potential
        labelSpan.style.display = 'block'; // Force line break

        // Create hand details span
        const detailsSpan = document.createElement('span');
        detailsSpan.className = 'hand-details'; // Add class for potential styling
        const cardsDisplay = cards.map(card => formatCard(card, true)).join(' ');
        detailsSpan.innerHTML = isPotential ? `${handName} ${cardsDisplay}` : cardsDisplay; // Only show cards if not potential
        detailsSpan.style.display = 'block'; // Force line break
        
        // Append spans
        handNameElement.appendChild(labelSpan);
        handNameElement.appendChild(detailsSpan);
    }

    // Function to update the current hand display
    function updateCurrentHandDisplay(handName, cards) {
        currentHandElement.innerHTML = ''; // Clear previous content
        currentHandElement.className = 'hand-name'; // Reset class
        
        if (!handName || !cards) {
            currentHandElement.textContent = 'Current hand: Select cards';
            return;
        }
        
        // Add class for styling based on hand type
        const className = handName.toLowerCase().replace(/\s+/g, '-');
        currentHandElement.classList.add(className);
        
        // Create label span
        const labelSpan = document.createElement('span');
        labelSpan.className = 'hand-label';
        labelSpan.textContent = 'Current hand:';
        labelSpan.style.display = 'block';

        // Create hand details span
        const detailsSpan = document.createElement('span');
        detailsSpan.className = 'hand-details';
        const cardsDisplay = Array.isArray(cards) ? 
            cards.map(card => formatCard(card, true)).join(' ') : '';
        detailsSpan.innerHTML = `${handName} ${cardsDisplay}`;
        detailsSpan.style.display = 'block';
        
        // Append spans
        currentHandElement.appendChild(labelSpan);
        currentHandElement.appendChild(detailsSpan);
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
    updateAnalytics();
}); 