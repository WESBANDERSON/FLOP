document.addEventListener('DOMContentLoaded', () => {
    const cardGrid = document.querySelector('.card-grid');
    const selectedCardsDisplay = document.getElementById('selected-cards-display');
    const probabilitiesContainer = document.querySelector('.probabilities');
    const bestFlopsList = document.getElementById('best-flops-list');
    const worstFlopsList = document.getElementById('worst-flops-list');
    const probInfoIcon = document.getElementById('prob-info-icon');
    const probabilityExplanation = document.getElementById('probability-explanation');
    const loadingSpinner = document.getElementById('loading-spinner');
    const analyticsDisplay = document.querySelector('.analytics-display');
    const cardSelector = document.querySelector('.card-selector');

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

    let selectedCards = [];

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
             return `${displayRank}<span class="${SUIT_CLASSES[suit]}">${suitSymbol}</span>`;
        } else {
            return `${displayRank}${suitSymbol}`;
        }
    }

    function formatHand(handArray, useHtml = true) {
        return handArray.map(card => formatCard(card, useHtml)).join(' ');
    }

    // --- Card Selection Logic (Remains the same) ---
    function createCardButtons() {
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
        if (selectedCards.includes(card)) {
            selectedCards = selectedCards.filter(c => c !== card);
            button.classList.remove('selected');
        } else {
            if (selectedCards.length < 2) {
                selectedCards.push(card);
                button.classList.add('selected');
            } else {
                console.log("Maximum 2 cards can be selected.");
                return;
            }
        }
        updateSelectedCardsDisplay();
        updateAnalytics();
    }

    function updateSelectedCardsDisplay() {
        selectedCardsDisplay.innerHTML = '';
        
        const displayCard = (card) => {
            const cardSpan = document.createElement('span');
            cardSpan.innerHTML = formatCard(card, true);
            selectedCardsDisplay.appendChild(cardSpan);
        };

        const displayPlaceholder = () => {
             const placeholderSpan = document.createElement('span');
             placeholderSpan.textContent = '?'; // Placeholder character
             placeholderSpan.classList.add('placeholder-span'); // Add class for styling
             selectedCardsDisplay.appendChild(placeholderSpan);
        };

        if (selectedCards.length === 0) {
            // Optional: Show two placeholders?
            // displayPlaceholder();
            // displayPlaceholder();
            // Or just leave it empty
        } else if (selectedCards.length === 1) {
            displayCard(selectedCards[0]);
            displayPlaceholder();
        } else { // selectedCards.length === 2
             displayCard(selectedCards[0]);
             displayCard(selectedCards[1]);
        }
    }

    // --- Analytics Calculation (REMOVED - Handled by Worker) ---
    // function calculateAnalytics(holeCards) { ... }
    // function getDeck(excludedCards = []) { ... }
    // function getCombinations(arr, k) { ... }

    // --- UI Update Functions ---
    function updateAnalytics() {
        // Clear previous results or text immediately
        // probabilitiesContainer.innerHTML = ''; // Let displayProbabilities handle clearing
        // bestFlopsList.innerHTML = '';
        // worstFlopsList.innerHTML = '';

        if (selectedCards.length === 2) {
            loadingSpinner.style.display = 'flex';
            // Clear actual flop list content, but keep titles
            bestFlopsList.innerHTML = '';
            worstFlopsList.innerHTML = ''; 

            // Send data to the worker
            console.log('Sending to worker:', selectedCards);
            worker.postMessage({ holeCards: selectedCards });

        } else {
             loadingSpinner.style.display = 'none';
             // Call display functions with null to show placeholder state
             displayProbabilities(null);
             displayFlops(null, null); 
        }
    }

    // --- Worker Message Handling ---
    worker.onmessage = function(event) {
        console.log('Message received from worker:', event.data);
        loadingSpinner.style.display = 'none'; // Hide spinner when results arrive

        if (event.data.error) {
            console.error("Error message from worker:", event.data.error);
            probabilitiesContainer.innerHTML = `<p style="color: red;">Error from worker: ${event.data.error}</p>`;
            bestFlopsList.innerHTML = '<li>Error</li>';
            worstFlopsList.innerHTML = '<li>Error</li>';
        } else if (event.data.probabilities && event.data.bestFlopGroups && event.data.worstFlopGroups) {
            // Received valid results
            try {
                 displayProbabilities(event.data.probabilities);
                 displayFlops(event.data.bestFlopGroups, event.data.worstFlopGroups);
            } catch(displayError) {
                console.error("Error displaying results from worker:", displayError);
                 probabilitiesContainer.innerHTML = '<p style="color: red;">Error displaying results. See console.</p>';
                 bestFlopsList.innerHTML = '<li>Error</li>';
                 worstFlopsList.innerHTML = '<li>Error</li>';
            }
        } else {
             console.error("Received unexpected data format from worker:", event.data);
             probabilitiesContainer.innerHTML = '<p style="color: red;">Received invalid data from worker.</p>';
             bestFlopsList.innerHTML = '<li>Error</li>';
             worstFlopsList.innerHTML = '<li>Error</li>';
        }
    };

    worker.onerror = function(error) {
         console.error("Error in Web Worker: ", error.message, error);
         loadingSpinner.style.display = 'none'; // Hide spinner on worker error
         probabilitiesContainer.innerHTML = `<p style="color: red;">Critical Worker Error: ${error.message}. See console.</p>`;
         bestFlopsList.innerHTML = '<li>Error</li>';
         worstFlopsList.innerHTML = '<li>Error</li>';
         // Optionally, try to terminate and recreate the worker, or disable functionality
    };

    // Display functions remain largely the same, but ensure they clear previous state properly
    function displayProbabilities(probabilities) {
         const existingItemsContainer = probabilitiesContainer.querySelector('.columns-container');
         const isUpdate = existingItemsContainer !== null;

         let handTypesData;
         let isPlaceholder = false; // Flag for placeholder state

         if (probabilities === null) {
             // Data for placeholder state (0%)
             isPlaceholder = true;
             handTypesData = DISPLAY_HAND_TYPES.map(name => ({ name: name, value: 0 }));
         } else if (Object.keys(probabilities).length === 0) {
             // Handle cases where calculation returns empty unexpectedly
             console.log("Received empty probabilities object - displaying error.")
             probabilitiesContainer.innerHTML = '<p>No probabilities calculated.</p>'; // Clear everything
             return;
         } else {
              // Real data
              handTypesData = DISPLAY_HAND_TYPES.map(name => ({
                  name: name,
                  value: probabilities[name] || 0
              }));
         }

        if (isUpdate) {
             // --- UPDATE --- (Handles both real data and null/placeholder data)
             const updateType = isPlaceholder ? "to placeholder" : "with new data";
             console.log(`Updating existing probability bars ${updateType}`);
             handTypesData.forEach(hand => {
                 // Find the corresponding item using the data attribute
                 const itemDiv = existingItemsContainer.querySelector(`[data-hand-name="${hand.name}"]`);
                 if (itemDiv) {
                     const valueSpan = itemDiv.querySelector('.probability-value');
                     const bar = itemDiv.querySelector('.probability-bar');
                     // Update text
                     if (valueSpan) {
                         valueSpan.textContent = `${hand.value.toFixed(2)}%`;
                     }
                     // Update bar width (will be 0% if placeholder)
                     if (bar) {
                         // Setting style directly triggers the CSS transition
                         bar.style.width = `${Math.min(hand.value, 100)}%`; 
                     }
                 } else {
                     console.warn(`Could not find existing item for ${hand.name} to update.`);
                 }
             });
         } else {
             // --- CREATE --- (Handles initial load or creation after error clear)
             const createType = isPlaceholder ? "placeholder" : "initial data";
             console.log(`Creating new ${createType} probability bars`);
             probabilitiesContainer.innerHTML = ''; // Clear container ONLY when creating

             // Create the columns container
             const columnsContainer = document.createElement('div');
             columnsContainer.classList.add('columns-container');
             columnsContainer.style.display = 'flex';
             columnsContainer.style.gap = '20px';

             // Split data for columns
             const half = Math.ceil(handTypesData.length / 2);
             const leftColumnHands = handTypesData.slice(0, half);
             const rightColumnHands = handTypesData.slice(half);

             const leftColumn = document.createElement('div');
             leftColumn.style.flex = '1';
             const rightColumn = document.createElement('div');
             rightColumn.style.flex = '1';

             // Function to create a single probability item
             const createProbabilityItem = (hand) => {
                 const itemDiv = document.createElement('div');
                 itemDiv.classList.add('probability-item');
                 itemDiv.dataset.handName = hand.name;

                 const label = document.createElement('span');
                 label.classList.add('probability-label');
                 label.textContent = hand.name;

                 const value = document.createElement('span');
                 value.classList.add('probability-value');
                 value.textContent = `${hand.value.toFixed(2)}%`;

                 const barContainer = document.createElement('div');
                 barContainer.classList.add('probability-bar-container');

                 const bar = document.createElement('div');
                 bar.classList.add('probability-bar');
                 bar.style.width = `${Math.min(hand.value, 100)}%`; // Will be 0% if placeholder

                 barContainer.appendChild(bar);
                 itemDiv.appendChild(label);
                 itemDiv.appendChild(value);
                 itemDiv.appendChild(barContainer);
                 return itemDiv;
             };

             // Populate columns
             leftColumnHands.forEach(hand => leftColumn.appendChild(createProbabilityItem(hand)));
             rightColumnHands.forEach(hand => rightColumn.appendChild(createProbabilityItem(hand)));

             // Append columns to container and container to page
             columnsContainer.appendChild(leftColumn);
             columnsContainer.appendChild(rightColumn);
             probabilitiesContainer.appendChild(columnsContainer);
         }
     }
    
    function displayFlops(bestGroups = [], worstGroups = []) {
        // Define placeholder text here
        const placeholderText = "Select 2 cards";

        // --- Helper to render/update a single list (best or worst) ---
        const updateFlopList = (listElement, groupsData, placeholderText) => {
            const existingGroups = listElement.querySelectorAll('li.flop-group');
            const isUpdate = existingGroups.length > 0; 
            const groupDataMap = new Map(); // For efficient lookup of new data
            
            if (groupsData !== null) {
                  groupsData.forEach(group => {
                      const key = group.rankKey || getGroupKeyFromRep(group.representativeFlop, group.handName);
                      groupDataMap.set(key, group);
                  });
             }

            if (groupsData === null) {
                // --- Placeholder State --- 
                listElement.innerHTML = ''; // Clear previous
                const li = document.createElement('li');
                li.textContent = placeholderText;
                li.style.color = '#aaa';
                listElement.appendChild(li);
                return;
            }
            
            if (isUpdate) {
                 // --- UPDATE EXISTING GROUPS --- 
                 console.log(`Updating existing flop groups in ${listElement.id}`);
                 const groupsToRemove = [];
                 existingGroups.forEach(groupLi => {
                      const groupKey = groupLi.dataset.groupKey;
                      const newData = groupDataMap.get(groupKey);

                      if (newData) {
                          // Group still exists, mark as processed
                          groupDataMap.delete(groupKey);
                      } else {
                           // Group exists in DOM but not in new data - mark for removal
                           groupsToRemove.push(groupLi);
                      }
                 });
                 
                 // Remove old groups
                 groupsToRemove.forEach(groupLi => groupLi.remove());

                 // --- ADD NEW GROUPS --- 
                 groupDataMap.forEach(newGroupData => {
                     console.log("Adding new group:", newGroupData);
                      renderGroup(newGroupData, listElement); // Add groups not previously in DOM
                 });

            } else {
                 // --- CREATE INITIAL LIST --- 
                 listElement.innerHTML = ''; // Clear previous placeholders
                  if (groupsData.length === 0) {
                       listElement.innerHTML = '<li>N/A</li>';
                  } else {
                      groupsData.forEach(group => renderGroup(group, listElement));
                  }
            }
        };

        // --- Main function logic ---
        updateFlopList(bestFlopsList, bestGroups, placeholderText);
        updateFlopList(worstFlopsList, worstGroups, placeholderText);
    }

    const getGroupKeyFromRep = (flop, handName) => {
        const ranks = flop.map(card => card.slice(0, -1))
                          .sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b)); // Consistent sort
        return `${handName}-${ranks.join('')}`;
    };

    const renderGroup = (group, listElement) => {
        const groupLi = document.createElement('li');
        groupLi.classList.add('flop-group');
        groupLi.dataset.groupKey = group.rankKey || getGroupKeyFromRep(group.representativeFlop, group.handName);

        const summaryDiv = document.createElement('div');
        summaryDiv.classList.add('flop-group-summary');
        summaryDiv.style.cursor = 'pointer';
        summaryDiv.innerHTML = `
            <span class="flop-group-rep">${formatHand(group.representativeFlop)}</span> 
            <span class="flop-group-name">(${group.handName})</span>
            <span class="flop-group-count">(${group.flops.length})</span> 
            <span class="expand-icon">▶</span>
        `;
        
        const variationsUl = document.createElement('ul');
        variationsUl.classList.add('flop-variations');
        variationsUl.style.display = 'none';
        variationsUl.style.marginLeft = '20px';
        variationsUl.style.listStyle = 'none';
        variationsUl.style.paddingLeft = '0';

        group.flops.forEach(flop => {
             const variationLi = document.createElement('li');
             variationLi.innerHTML = formatHand(flop);
             variationsUl.appendChild(variationLi);
        });
        
        summaryDiv.addEventListener('click', () => {
            const isHidden = variationsUl.style.display === 'none';
            variationsUl.style.display = isHidden ? 'block' : 'none';
            summaryDiv.querySelector('.expand-icon').textContent = isHidden ? '▼' : '▶';
        });

        groupLi.appendChild(summaryDiv);
        groupLi.appendChild(variationsUl);
        listElement.appendChild(groupLi);
    };

    // --- Event Listeners (Remains the same) ---
    probInfoIcon.addEventListener('click', () => {
        const isVisible = probabilityExplanation.style.display === 'block';
        probabilityExplanation.style.display = isVisible ? 'none' : 'block';
    });

    // --- Initial Setup ---
    createCardButtons();
    updateAnalytics();
}); 