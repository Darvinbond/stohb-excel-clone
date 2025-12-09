// Simple formula parser to handle basic arithmetic and cell references

const OPERATORS = ['+', '-', '*', '/', '%', '^', '(', ')'];

export function isFormula(value) {
    return typeof value === 'string' && value.startsWith('=');
}

export function getCellId(colIndex, rowIndex) {
    // Convert col index 0->A, 1->B, 26->AA
    let colLabel = '';
    let tempCol = colIndex;

    do {
        const remainder = tempCol % 26;
        colLabel = String.fromCharCode(65 + remainder) + colLabel;
        tempCol = Math.floor(tempCol / 26) - 1;
    } while (tempCol >= 0);

    return `${colLabel}${rowIndex + 1}`;
}

export function parseCellId(cellId) {
    // Parse "A1" -> { row: 0, col: 0 }
    const match = cellId.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;

    const colStr = match[1];
    const rowStr = match[2];

    let colIndex = 0;
    for (let i = 0; i < colStr.length; i++) {
        colIndex = colIndex * 26 + (colStr.charCodeAt(i) - 64);
    }

    return {
        col: colIndex - 1,
        row: parseInt(rowStr) - 1
    };
}

// Convert "R-C" key to "A1"
export function keyToLabel(key) {
    const [row, col] = key.split('-').map(Number);
    return getCellId(col, row);
}

// Convert "A1" to "R-C" key
export function labelToKey(label) {
    const coords = parseCellId(label);
    if (!coords) return null;
    return `${coords.row}-${coords.col}`;
}

export function evaluateFormula(formula, getData) {
    if (!isFormula(formula)) return formula;

    const cleanFormula = formula.substring(1).toUpperCase();

    try {
        // 1. Resolve simplified ranges (e.g. SUM(A1:A5)) - FUTURE
        // For now, we only handle scalar references like A1, B2

        // 2. Replace cell references with values
        // Regex for cell ID like A1, ZZ123 (ignore $ for absolute refs logic in copy/paste, but eval treats same)
        const resolvedFormula = cleanFormula.replace(/(\$?[A-Z]+\$?\d+)/g, (match) => {
            const label = match.replace(/\$/g, ''); // strip $ for lookup
            const key = labelToKey(label);
            if (!key) return 0;

            const cell = getData(key);
            const val = cell?.value || cell; // Handle object or primitive

            // If value is a number, return it. If not, try to parse.
            const num = parseFloat(val);
            return isNaN(num) ? 0 : num;
        });

        // 3. Evaluate math
        // Security: Don't use raw eval(). Use logic or a math parser.
        // For this demo, using Function constructor is slightly unsafe but standard for simple JS-based sheets without a heavy lib.
        // In production, we'd write a proper RPN parser.

        // eslint-disable-next-line
        const result = new Function('return ' + resolvedFormula)();

        if (isNaN(result) || !isFinite(result)) return '#ERR';
        return result;

    } catch (err) {
        console.error("Formula eval error:", err);
        return '#ERROR';
    }
}
