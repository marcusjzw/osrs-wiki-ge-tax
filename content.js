console.log("OSRS Tax Extension: Reactive Version Loaded.");

const TAX_RATE = 0.02;

// --- Helper: Parse "2.4m", "100k", "1,200" ---
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
    // 1. Find the table
    const tables = document.querySelectorAll('table');
    let targetTable = null;
    let idx = {};

    for (const table of tables) {
        const headers = Array.from(table.querySelectorAll('thead th'));
        
        idx.sell = headers.findIndex(th => th.textContent.toLowerCase().includes("sell price"));
        idx.margin = headers.findIndex(th => th.textContent.toLowerCase().trim() === "margin");
        idx.limit = headers.findIndex(th => th.textContent.toLowerCase().includes("buy limit"));
        idx.profit = headers.findIndex(th => th.textContent.toLowerCase().includes("potential profit"));

        if (idx.sell !== -1 && idx.margin !== -1) {
            targetTable = table;
            break;
        }
    }

    if (!targetTable) return;

    // 2. Ensure Headers Exist
    const headerRow = targetTable.querySelector('thead tr');
    
    // Header A: Margin (Post-Tax)
    let h1 = targetTable.querySelector('.header-tax-margin');
    if (!h1) {
        h1 = document.createElement('th');
        h1.textContent = 'Margin (Post-Tax)';
        h1.className = 'header-tax-margin';
        h1.style.cursor = 'pointer';
        h1.title = "Click to sort by Per-Item Margin";
        h1.style.backgroundColor = 'rgba(0, 230, 0, 0.1)';
        
        // Insert after Margin
        const marginHeader = headerRow.children[idx.margin];
        if (marginHeader && marginHeader.nextSibling) {
            headerRow.insertBefore(h1, marginHeader.nextSibling);
        } else {
            headerRow.appendChild(h1);
        }

        h1.addEventListener('click', () => sortTable(targetTable, '.cell-tax-margin', h1));
    }

    // Header B: Total Profit (Post-Tax)
    let h2 = targetTable.querySelector('.header-tax-profit');
    if (!h2) {
        h2 = document.createElement('th');
        h2.textContent = 'Total Profit (Post-Tax)';
        h2.className = 'header-tax-profit';
        h2.style.cursor = 'pointer';
        h2.style.backgroundColor = 'rgba(0, 230, 0, 0.1)'; 

        // Insert after Potential Profit (or at end)
        // We recalculate index because inserting h1 shifted things
        const currentHeaders = Array.from(headerRow.children);
        const profitIdx = currentHeaders.findIndex(th => th.textContent.toLowerCase().includes("potential profit"));
        
        if (profitIdx !== -1 && currentHeaders[profitIdx + 1]) {
             headerRow.insertBefore(h2, currentHeaders[profitIdx + 1]);
        } else {
             headerRow.appendChild(h2);
        }

        h2.addEventListener('click', () => sortTable(targetTable, '.cell-tax-profit', h2));
    }

    // 3. Process Rows (The Reactive Part)
    const rows = targetTable.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const cells = row.children;
        if (cells.length <= idx.margin) return;

        // --- Extract Data (Every Loop) ---
        const sellPrice = parseRunescapeNumber(cells[idx.sell]?.textContent);
        const margin = parseRunescapeNumber(cells[idx.margin]?.textContent);
        const limit = parseRunescapeNumber(cells[idx.limit]?.textContent) || 0;

        // --- Math ---
        const tax = Math.floor(sellPrice * TAX_RATE);
        const marginPostTax = margin - tax;
        const profitPostTax = marginPostTax * limit;

        // --- Update or Create Cells ---
        updateOrCreateCell(row, 'cell-tax-margin', marginPostTax, idx.margin + 1);
        
        // For the Profit column, we find where to insert it relative to "Potential Profit"
        // Since we modified the DOM, finding indices is tricky. 
        // We just find the header index of our column and match that position.
        const profitHeaderIdx = Array.from(headerRow.children).findIndex(c => c.classList.contains('header-tax-profit'));
        updateOrCreateCell(row, 'cell-tax-profit', profitPostTax, profitHeaderIdx);
    });
}

function updateOrCreateCell(row, className, value, insertIndex) {
    // 1. Check if cell exists
    let cell = row.querySelector(`.${className}`);

    // 2. If NOT exists, create it
    if (!cell) {
        cell = document.createElement('td');
        cell.className = className;
        cell.style.textAlign = 'right';
        cell.style.fontWeight = 'bold';
        
        // Insert at correct index
        const target = row.children[insertIndex];
        if (target) {
            row.insertBefore(cell, target);
        } else {
            row.appendChild(cell);
        }
    }

    // 3. ALWAYS Update Data (This fixes the "stagnant" bug)
    // We only touch the DOM if the value actually changed to save performance
    if (cell.dataset.val != value) {
        cell.textContent = value.toLocaleString();
        cell.dataset.val = value;
        cell.style.color = value > 0 ? '#00e600' : '#ff3333';
    }
}

// --- Sorting Logic ---
function sortTable(table, cellClassSelector, headerElement) {
    const tbody = table.querySelector('tbody');
    
    // 1. Determine Sort Order
    // If currently 'desc', go 'asc'. Otherwise (undefined or 'asc'), go 'desc'.
    // Defaulting to DESC first is better for profit (High -> Low).
    const currentOrder = headerElement.dataset.order; 
    const isAscending = currentOrder === 'desc'; // Toggle logic

    // 2. Save new state
    headerElement.dataset.order = isAscending ? 'asc' : 'desc';

    // 3. Update Visuals
    // Clear arrows from other custom headers
    table.querySelectorAll('.header-tax-margin, .header-tax-profit').forEach(h => {
        if (h !== headerElement) h.textContent = h.textContent.replace(/[▲▼]/g, '').trim();
    });

    const baseText = headerElement.textContent.replace(/[▲▼]/g, '').trim();
    headerElement.textContent = `${baseText} ${isAscending ? '▲' : '▼'}`;

    // 4. Sort Rows
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    rows.sort((a, b) => {
        const cellA = a.querySelector(cellClassSelector);
        const cellB = b.querySelector(cellClassSelector);

        // Sort items with no data to the bottom always
        const valA = cellA ? parseFloat(cellA.dataset.val) : -Infinity;
        const valB = cellB ? parseFloat(cellB.dataset.val) : -Infinity;

        return isAscending ? valA - valB : valB - valA;
    });

    rows.forEach(row => tbody.appendChild(row));
}

// Run frequently to catch the 60s auto-refresh
setInterval(processTable, 500);