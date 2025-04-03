# Poker Tool TODO List

## Phase 1: Basic Setup (Complete)

*   [x] Create `index.html` with basic structure (Card Selector, Analytics Display).
*   [x] Create `style.css` with initial Flexbox layout and basic styling.
*   [x] Create `script.js` with card generation and basic selection logic (max 2 cards).
*   [x] Add placeholder functions for displaying probabilities and flops.
*   [x] Create `TODO.md`.

## Phase 2: Core Logic Implementation

*   [x] Find or implement a Texas Hold'em hand evaluation library/logic. (Using `pokersolver` via CDN).
*   [x] Implement logic to calculate hand probabilities given two hole cards.
    *   [x] Iterate through all possible flops (19600 combinations: C(50, 3)).
    *   [x] For each flop, evaluate the best 5-card hand from the 5 available cards (2 hole + 3 flop).
    *   [x] Aggregate counts for each hand type (Pair, Two Pair, etc.).
    *   [x] Convert counts to percentages (based on frequency out of 19600 flops).
*   [x] Implement logic to determine "Best Flops".
    *   [x] Define criteria for "best" (highest rank of the 5-card hand made with the flop).
    *   [x] Evaluate hand strength for each possible flop using `pokersolver`.
    *   [x] Rank flops and display the top N (currently 10).
*   [x] Implement logic to determine "Worst Flops".
    *   [x] Define criteria for "worst" (lowest rank of the 5-card hand made with the flop).
    *   [x] Rank flops and display the bottom N (currently 10).

## Phase 3: Integration and Display

*   [x] Integrate calculation logic into `script.js`.
*   [x] Call calculation functions when 2 cards are selected.
*   [x] Update the `displayProbabilities` function to show real data with accurate progress bars.
*   [x] Update the `displayFlops` function to show real best/worst flops with proper card formatting.
*   [x] Ensure dynamic updates work correctly on card selection/deselection.

## Phase 4: Styling and Refinements

*   [x] Refine CSS for a look closer to the mockup (fonts, colors, spacing, progress bar appearance).
*   [x] Improve card display formatting (suits, colors) - *Done*.
*   [x] Add visual feedback for interactions (e.g., button clicks, loading states if calculations are slow) - *CSS Spinner added*.
*   [x] Add explanation toggle for probability calculation.
*   [ ] Ensure responsiveness and usability - *Basic flex layout handles some cases, further testing/refinement needed.*
*   [x] Consider edge cases and error handling (e.g., library loading) - *Addressed by using internal evaluation logic.*
*   [x] **Optimization:** Calculation moved to Web Worker. - *Done.*

## Potential Libraries/Resources

*   Using internal 5-card hand evaluation logic in Web Worker (Replaced external libraries due to loading issues).
*   Need a robust way to iterate through combinations efficiently - *Current recursive `getCombinations` okay for C(50,3)*.
*   Need to find a suitable JavaScript poker hand evaluation library or implement one. Options:
    *   `hand-evaluator` (npm)
    *   `pokersolver` (npm)
    *   Custom implementation. 