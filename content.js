console.log("OSRS Tax Extension: Optimized Performance Version Loaded.");

const TAX_RATE = 0.02;
const STORAGE_KEY = 'OSRS_HIDDEN_ITEMS';

// --- State Management ---
const STATE = {
    sortBy: null,
    sortDir: 'desc',
    hiddenItems: new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')),
    needsSort: false // New flag to prevent constant re-sorting
};

// --- Helper: Parse Numbers ---
function parseRunescapeNumber(text) {
    if (!text) return 0;
    let cleanText = text.trim().replace(/,/g, '').toLowerCase();
    let multiplier = 1;
    if (cleanText.endsWith('k')) multiplier = 1_000;
    else if (cleanText.endsWith('m')) multiplier = 1_000_000;
    else if (cleanText.endsWith('b')) multiplier = 1_000_000_000;
    cleanText = cleanText.replace(/[kmb]/g, '');
    const num = parseFloat(cleanText);
    return isNaN(num) ? 0 : Math.floor(num * multiplier);
}

// --- Main Loop ---
function processTable() {
    const tables = document.querySelectorAll('table');
    let targetTable = null;
    let idx = {};

    // 1. Locate Table
    for (const table of tables) {
        const headers = Array.from(table.querySelectorAll('thead th'));
        idx.name = headers.findIndex(th => th.textContent.toLowerCase().includes("name"));
        idx.sell = headers.findIndex(th => th.textContent.toLowerCase().includes("sell price"));
        idx.margin = headers.findIndex(th => th.textContent.toLowerCase().trim() === "margin");
        idx.limit = headers.findIndex(th => th.textContent.toLowerCase().includes("buy limit"));
        idx.profit = headers.findIndex(th => th.textContent.toLowerCase().includes("potential profit"));
        
        if (idx.sell !== -1 && idx.margin !== -1 && idx.name !== -1) {
            targetTable = table;
            break;
        }
    }

    if (!targetTable) return;

    const hasHideHeader = targetTable.querySelector('.header-remove') !== null;

    // 2. Inject "Unhide All" Button
    if (!document.getElementById('osrs-unhide-btn')) {
        const btn = document.createElement('button');
        btn.id = 'osrs-unhide-btn';
        btn.textContent = `Unhide All Items (${STATE.hiddenItems.size})`;
        btn.style.marginBottom = '10px';
        btn.style.padding = '5px 15px';
        btn.style.backgroundColor = '#444';
        btn.style.color = '#fff';
        btn.style.border = '1px solid #666';
        btn.style.cursor = 'pointer';
        btn.style.borderRadius = '4px';
        
        btn.addEventListener('click', () => {
            if (confirm("Unhide all items?")) {
                STATE.hiddenItems.clear();
                localStorage.removeItem(STORAGE_KEY);
                btn.textContent = `Unhide All Items (0)`;
                STATE.needsSort = true; // Force update
                processTable();
            }
        });
        targetTable.parentNode.insertBefore(btn, targetTable);
    } else {
        const btn = document.getElementById('osrs-unhide-btn');
        btn.textContent = `Unhide All Items (${STATE.hiddenItems.size})`;
    }

    // 3. Inject Headers
    const headerRow = targetTable.querySelector('thead tr');
    
    // -- Header 0: Hide --
    let hRemove = targetTable.querySelector('.header-remove');
    if (!hRemove) {
        hRemove = document.createElement('th');
        hRemove.className = 'header-remove';
        hRemove.textContent = 'Hide';
        hRemove.style.width = '50px';
        hRemove.style.textAlign = 'center';
        if (headerRow.firstChild) headerRow.insertBefore(hRemove, headerRow.firstChild);
        else headerRow.appendChild(hRemove);
    }

    // -- Header A: Margin --
    let h1 = targetTable.querySelector('.header-tax-margin');
    if (!h1) {
        h1 = document.createElement('th');
        h1.className = 'header-tax-margin';
        h1.style.cursor = 'pointer';
        h1.style.backgroundColor = 'rgba(0, 230, 0, 0.1)';
        h1.title = "Click to sort";
        
        const allHeaders = Array.from(headerRow.querySelectorAll('th'));
        const marginTh = allHeaders.find(th => th.textContent.toLowerCase().trim() === 'margin');
        if (marginTh && marginTh.nextSibling) headerRow.insertBefore(h1, marginTh.nextSibling);
        else headerRow.appendChild(h1);
        
        h1.addEventListener('click', () => { handleHeaderClick('margin'); });
    }

    // -- Header B: Profit --
    let h2 = targetTable.querySelector('.header-tax-profit');
    if (!h2) {
        h2 = document.createElement('th');
        h2.className = 'header-tax-profit';
        h2.style.cursor = 'pointer';
        h2.style.backgroundColor = 'rgba(0, 230, 0, 0.1)';
        
        const allHeaders = Array.from(headerRow.querySelectorAll('th'));
        const profitTh = allHeaders.find(th => th.textContent.toLowerCase().includes('potential profit'));
        if (profitTh && profitTh.nextSibling) headerRow.insertBefore(h2, profitTh.nextSibling);
        else headerRow.appendChild(h2);

        h2.addEventListener('click', () => { handleHeaderClick('profit'); });
    }

    updateHeaderVisuals(h1, 'margin');
    updateHeaderVisuals(h2, 'profit');


    // 4. Process Rows
    const rows = Array.from(targetTable.querySelectorAll('tbody tr'));
    const finalHeaders = Array.from(headerRow.children);
    const idxMarginHeader = finalHeaders.indexOf(h1);
    const idxProfitHeader = finalHeaders.indexOf(h2);
    
    // Track if any data actually changed
    let dataChanged = false;

    rows.forEach(row => {
        const cells = row.children;
        if (cells.length < 5) return;

        // Dynamic Index Correction
        const rowHasHide = row.querySelector('.cell-remove') !== null;
        let offset = 0;
        if (hasHideHeader && !rowHasHide) offset = -1;

        const trueIdxName = idx.name + offset;
        const trueIdxSell = idx.sell + offset;
        const trueIdxMargin = idx.margin + offset;
        const trueIdxLimit = idx.limit + offset;

        // -- Hiding Logic --
        const itemName = cells[trueIdxName]?.textContent.trim();
        if (!itemName) return;

        const isHidden = STATE.hiddenItems.has(itemName);
        if (isHidden && row.style.display !== 'none') {
            row.style.display = 'none';
            dataChanged = true; // Visibility changed, might need layout update
        } else if (!isHidden && row.style.display === 'none') {
            row.style.display = '';
            dataChanged = true;
        }

        // -- Inject Hide Button --
        if (!rowHasHide) {
            const removeCell = document.createElement('td');
            removeCell.className = 'cell-remove';
            removeCell.style.textAlign = 'center';
            removeCell.style.cursor = 'pointer';
            
            const btn = document.createElement('span');
            btn.innerHTML = '⛔'; 
            btn.title = "Hide this item";
            btn.style.fontSize = '1.2em';
            
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (itemName) {
                    STATE.hiddenItems.add(itemName);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify([...STATE.hiddenItems]));
                    row.style.display = 'none'; // Instant hide for responsiveness
                    STATE.needsSort = true; // Queue a sort for next tick
                }
            });

            removeCell.appendChild(btn);
            if (row.firstChild) row.insertBefore(removeCell, row.firstChild);
            else row.appendChild(removeCell);
            dataChanged = true; // Structure changed
        }

        // -- Math --
        const sellPrice = parseRunescapeNumber(cells[trueIdxSell]?.textContent);
        const margin = parseRunescapeNumber(cells[trueIdxMargin]?.textContent);
        const limit = parseRunescapeNumber(cells[trueIdxLimit]?.textContent) || 0;

        const tax = Math.floor(sellPrice * TAX_RATE);
        const marginPostTax = margin - tax;
        const profitPostTax = marginPostTax * limit;

        // -- Update Cells (Returns true if value CHANGED) --
        const mChanged = updateCell(row, 'cell-tax-margin', marginPostTax, idxMarginHeader);
        const pChanged = updateCell(row, 'cell-tax-profit', profitPostTax, idxProfitHeader);

        if (mChanged || pChanged) dataChanged = true;
    });

    // 5. Apply Sorting (ONLY if necessary)
    if (STATE.sortBy && (dataChanged || STATE.needsSort)) {
        applySort(targetTable, rows);
        STATE.needsSort = false; // Reset flag
    }
}

// --- Interaction Logic ---
function handleHeaderClick(columnType) {
    if (STATE.sortBy === columnType) {
        STATE.sortDir = STATE.sortDir === 'desc' ? 'asc' : 'desc';
    } else {
        STATE.sortBy = columnType;
        STATE.sortDir = 'desc';
    }
    STATE.needsSort = true; // User clicked, FORCE a sort immediately
    processTable();
}

function updateHeaderVisuals(element, columnType) {
    if (!element) return;
    let label = columnType === 'margin' ? 'Margin (Post-Tax)' : 'Total Profit (Post-Tax)';
    if (STATE.sortBy === columnType) {
        const arrow = STATE.sortDir === 'asc' ? '▲' : '▼';
        element.textContent = `${label} ${arrow}`;
        element.style.color = '#fff';
        element.style.textDecoration = 'underline';
    } else {
        element.textContent = label;
        element.style.color = '';
        element.style.textDecoration = '';
    }
}

// --- DOM Manipulation ---
function updateCell(row, className, value, targetIndex) {
    let cell = row.querySelector(`.${className}`);
    let changed = false;

    if (!cell) {
        cell = document.createElement('td');
        cell.className = className;
        cell.style.textAlign = 'right';
        cell.style.fontWeight = 'bold';
        
        const currentCells = row.children;
        if (currentCells[targetIndex]) {
            row.insertBefore(cell, currentCells[targetIndex]);
        } else {
            row.appendChild(cell);
        }
        changed = true; // New cell created
    }

    // Only update DOM if value is different (Performance Saver)
    if (cell.dataset.val != value) {
        cell.textContent = value.toLocaleString();
        cell.dataset.val = value;
        cell.style.color = value > 0 ? '#00e600' : '#ff3333';
        changed = true; // Value changed
    }
    return changed;
}

function applySort(table, rows) {
    const tbody = table.querySelector('tbody');
    const selector = STATE.sortBy === 'margin' ? '.cell-tax-margin' : '.cell-tax-profit';
    const isAscending = STATE.sortDir === 'asc';

    rows.sort((a, b) => {
        const cellA = a.querySelector(selector);
        const cellB = b.querySelector(selector);
        const valA = cellA ? parseFloat(cellA.dataset.val) : -Infinity;
        const valB = cellB ? parseFloat(cellB.dataset.val) : -Infinity;

        if (valA === valB) return 0;
        return isAscending ? valA - valB : valB - valA;
    });

    const frag = document.createDocumentFragment();
    rows.forEach(row => frag.appendChild(row));
    tbody.appendChild(frag);
}

// Run fast (200ms) but only act if necessary
setInterval(processTable, 200);