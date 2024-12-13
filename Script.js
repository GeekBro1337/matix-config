// Регулярное выражение для проверки или парсинга координат формата "X: число, Y: число"
const COORDINATE_REGEX = /X:\s*(\d+),\s*Y:\s*(\d+)/;

// Глобальные переменные
let canvas = null; 
let ctx = null;    
let image = null;  
let imageBase64 = null; 
let matrixPoints = []; 
let paintingMode = false;
let eraserMode = false;   
let fillMode = false;     
let autoCopyMode = false; 
let submatrixMode = false;
let autoCopyStep = 0;     
let isMouseDown = false;  

// Зум и панорамирование
let zoomLevel = 1;
const zoomStep = 0.1;
const minZoom = 0.5; 
const maxZoom = 3;   

let isDragging = false;
let dragStart = { x: 0, y: 0 };
let canvasOffset = { x: 0, y: 0 };

// Параметры изображения
let imageOffsetX = 0;
let imageOffsetY = 0;
let imageScaledWidth = 0;
let imageScaledHeight = 0;

// Состояния ячеек
let cellStates = [];

// Подматрицы
let selectedSubmatrixStart = null; 
let selectedSubmatrixEnd = null;   

// Undo/Redo стеки
let historyStack = [];
let redoStack = [];

document.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("matrixCanvas");
    ctx = canvas.getContext("2d");

    resizeCanvas();
    setupEventListeners();

    const colorPicker = document.getElementById("colorPicker");
    const colorPreview = document.getElementById("colorPreview");
    const colorPickerButton = document.getElementById("colorPickerButton");

    if (colorPickerButton) {
      colorPickerButton.addEventListener("click", () => {
          colorPicker.click();
      });
    }

    colorPicker.addEventListener("input", () => {
        colorPreview.style.backgroundColor = colorPicker.value;
    });

    colorPreview.style.backgroundColor = colorPicker.value;
    updateCursor(); 
});

// Устанавливает размеры канваса
function resizeCanvas() {
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;

    drawCanvas();
}

function setupEventListeners() {
    document.getElementById("imageUpload").addEventListener("change", handleImageUpload);
    document.getElementById("drawMatrixButton").addEventListener("click", drawMatrix);
    document.getElementById("toggleModeButton").addEventListener("click", toggleMode);
    document.getElementById("toggleEraserButton").addEventListener("click", toggleEraserMode);
    document.getElementById("toggleFillModeButton").addEventListener("click", toggleFillMode);
    document.getElementById("toggleAutoCopyButton").addEventListener("click", toggleAutoCopyMode);

    const submatrixButton = document.createElement("button");
    submatrixButton.id = "toggleSubmatrixModeButton";
    submatrixButton.textContent = "Enable Submatrix Mode";
    document.getElementById("settingsPanel").appendChild(submatrixButton);
    submatrixButton.addEventListener("click", toggleSubmatrixMode);

    document.getElementById("zoomInButton").addEventListener("click", zoomIn);
    document.getElementById("zoomOutButton").addEventListener("click", zoomOut);

    document.getElementById("importJsonButton").addEventListener("click", importJsonHandler);
    document.getElementById("exportJsonButton").addEventListener("click", exportJsonHandler);

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleCanvasClick);

    window.addEventListener("resize", () => {
        resizeCanvas();
        if (image) {
            scaleImageToCanvas(image);
        }
        updateCursor();
    });

    // Обработка Ctrl+Z и Ctrl+Y
    document.addEventListener("keydown", handleKeyDown);
}

// Обработка загрузки изображения
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            image = new Image();
            image.src = reader.result;
            imageBase64 = reader.result;
            image.onload = () => {
                scaleImageToCanvas(image);
                drawCanvas();
            };
        };
        reader.readAsDataURL(file);
    }
}

// Масштабирование изображения под канвас
function scaleImageToCanvas(img) {
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const canvasRatio = canvasWidth / canvasHeight;
    const imageRatio = img.width / img.height;

    if (imageRatio > canvasRatio) {
        imageScaledWidth = canvasWidth;
        imageScaledHeight = canvasWidth / imageRatio;
    } else {
        imageScaledWidth = canvasHeight * imageRatio;
        imageScaledHeight = canvasHeight;
    }

    imageOffsetX = (canvasWidth - imageScaledWidth) / 2;
    imageOffsetY = (canvasHeight - imageScaledHeight) / 2;
}

function drawCanvas() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Центрируем и масштабируем
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Применяем смещение
    ctx.translate(canvasOffset.x, canvasOffset.y);

    if (image) {
        drawImage();
    }

    if (matrixPoints && matrixPoints.length > 0) {
        drawGrid(matrixPoints, matrixPoints.length - 1, matrixPoints[0].length - 1);
        drawPaintedCells();
    }

    ctx.restore();
}

function drawImage() {
    ctx.drawImage(
        image,
        0,
        0,
        image.width,
        image.height,
        imageOffsetX,
        imageOffsetY,
        imageScaledWidth,
        imageScaledHeight
    );
}

function drawPaintedCells() {
    for (let row = 0; row < cellStates.length; row++) {
        for (let col = 0; col < cellStates[row].length; col++) {
            const state = cellStates[row][col];
            if (state && state.color) {
                const topLeft = matrixPoints[row][col];
                const bottomRight = matrixPoints[row + 1][col + 1];
                const cellWidth = bottomRight.x - topLeft.x;
                const cellHeight = bottomRight.y - topLeft.y;
                const borderThickness = 1 / zoomLevel;

                const cellX = topLeft.x + borderThickness;
                const cellY = topLeft.y + borderThickness;
                const cellWidthAdjusted = cellWidth - 2 * borderThickness;
                const cellHeightAdjusted = cellHeight - 2 * borderThickness;

                ctx.fillStyle = state.color;
                ctx.fillRect(cellX, cellY, cellWidthAdjusted, cellHeightAdjusted);

                ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
                ctx.lineWidth = 1 / zoomLevel;
                ctx.strokeRect(topLeft.x, topLeft.y, cellWidth, cellHeight);
            }
        }
    }
}

function handleCanvasClick(event) {
    const pos = getMousePos(event);

    if (autoCopyMode) {
        handleAutoCopyClick(pos);
    } else if (submatrixMode) {
        handleSubmatrixClick(pos);
    } else if (!paintingMode && !eraserMode && !fillMode) {
        const coordDisplay = document.getElementById("coordinates");
        const coordText = `X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}`;
        coordDisplay.textContent = coordText;

        if (COORDINATE_REGEX.test(coordText)) {
            navigator.clipboard.writeText(coordText)
                .then(() => {
                    coordDisplay.textContent = `${coordText} (Copied!)`;
                });
        } else {
            console.error("Coordinates do not match the format.");
        }
    } else if (fillMode) {
        saveHistory();
        const color = document.getElementById("colorPicker").value;
        fillCell(pos.x, pos.y, color);
    }
}

// Auto Copy
function handleAutoCopyClick(pos) {
    const x = Math.round(pos.x);
    const y = Math.round(pos.y);

    if (autoCopyStep === 0) {
        document.getElementById("pointTopLeftX").value = x;
        document.getElementById("pointTopLeftY").value = y;
        autoCopyStep = 1;
        alert("Top-Left point set. Please click for Bottom-Right point.");
    } else if (autoCopyStep === 1) {
        document.getElementById("pointBottomRightX").value = x;
        document.getElementById("pointBottomRightY").value = y;
        autoCopyStep = 0;
        autoCopyMode = false;
        document.getElementById("toggleAutoCopyButton").textContent = "Enable Auto Copy Mode";
        alert("Bottom-Right point set. You can now draw the matrix.");
    }
}

// Подматрицы
function handleSubmatrixClick(pos) {
    const cell = findCellByPos(pos.x, pos.y);
    if (!cell) return;

    if (!selectedSubmatrixStart) {
        selectedSubmatrixStart = cell;
        alert("Submatrix start selected. Please select the end cell.");
    } else {
        selectedSubmatrixEnd = cell;
        const color = prompt("Enter submatrix color (e.g. #FF0000):", "#FF0000");

        saveHistory();

        const startRow = Math.min(selectedSubmatrixStart.row, selectedSubmatrixEnd.row);
        const startCol = Math.min(selectedSubmatrixStart.col, selectedSubmatrixEnd.col);
        const endRow = Math.max(selectedSubmatrixStart.row, selectedSubmatrixEnd.row);
        const endCol = Math.max(selectedSubmatrixStart.col, selectedSubmatrixEnd.col);

        cellStates[startRow][startCol] = {
            color: color,
            m1: `${startRow}-${startCol}`,
            m2: `${endRow}-${endCol}`
        };

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                if (r === startRow && c === startCol) continue;
                cellStates[r][c] = { color: color }; 
            }
        }

        selectedSubmatrixStart = null;
        selectedSubmatrixEnd = null;
        alert("Submatrix selected and colored!");
        drawCanvas();
    }
}

function findCellByPos(x, y) {
    for (let row = 0; row < matrixPoints.length - 1; row++) {
        for (let col = 0; col < matrixPoints[row].length - 1; col++) {
            const topLeft = matrixPoints[row][col];
            const bottomRight = matrixPoints[row + 1][col + 1];
            if (x >= topLeft.x && x <= bottomRight.x &&
                y >= topLeft.y && y <= bottomRight.y) {
                return { row, col };
            }
        }
    }
    return null;
}

// Создание матрицы
function drawMatrix() {
    const topLeft = {
        x: parseInt(document.getElementById("pointTopLeftX").value, 10),
        y: parseInt(document.getElementById("pointTopLeftY").value, 10),
    };
    const bottomRight = {
        x: parseInt(document.getElementById("pointBottomRightX").value, 10),
        y: parseInt(document.getElementById("pointBottomRightY").value, 10),
    };
    const rows = parseInt(document.getElementById("matrixRows").value, 10);
    const cols = parseInt(document.getElementById("matrixCols").value, 10);

    if (
        isNaN(topLeft.x) ||
        isNaN(topLeft.y) ||
        isNaN(bottomRight.x) ||
        isNaN(bottomRight.y) ||
        isNaN(rows) ||
        isNaN(cols) ||
        rows <= 0 ||
        cols <= 0
    ) {
        alert("Введите корректные точки и размеры.");
        return;
    }

    matrixPoints = calculateMatrixPoints(topLeft, bottomRight, rows, cols);

    cellStates = [];
    for (let i = 0; i < rows; i++) {
        cellStates[i] = new Array(cols).fill(null);
    }

    // Сбрасываем историю, добавляем начальное состояние
    historyStack = [];
    redoStack = [];
    historyStack.push(JSON.parse(JSON.stringify(cellStates)));

    drawCanvas();
}

function calculateMatrixPoints(topLeft, bottomRight, rows, cols) {
    const points = [];
    const dx = (bottomRight.x - topLeft.x) / cols;
    const dy = (bottomRight.y - topLeft.y) / rows;

    for (let row = 0; row <= rows; row++) {
        const rowPoints = [];
        for (let col = 0; col <= cols; col++) {
            rowPoints.push({
                x: topLeft.x + col * dx,
                y: topLeft.y + row * dy,
            });
        }
        points.push(rowPoints);
    }

    return points;
}

// Рисует сетку
function drawGrid(matrixPoints, rows, cols) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
    ctx.lineWidth = 1 / zoomLevel;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const topLeft = matrixPoints[row][col];
            const bottomRight = matrixPoints[row + 1][col + 1];
            ctx.strokeRect(
                topLeft.x,
                topLeft.y,
                bottomRight.x - topLeft.x,
                bottomRight.y - topLeft.y
            );
        }
    }
}

// Переключатели режимов
function toggleMode() {
    paintingMode = !paintingMode;
    eraserMode = false;
    fillMode = false;
    autoCopyMode = false;
    submatrixMode = false;
    autoCopyStep = 0;
    document.getElementById("toggleModeButton").textContent = paintingMode
        ? "Switch to Coordinate Mode"
        : "Switch to Paint Mode";
    updateCursor();
}

function toggleEraserMode() {
    eraserMode = !eraserMode;
    paintingMode = false;
    fillMode = false;
    autoCopyMode = false;
    submatrixMode = false;
    autoCopyStep = 0;
    document.getElementById("toggleEraserButton").textContent = eraserMode
        ? "Disable Eraser"
        : "Enable Eraser";
    updateCursor();
}

function toggleFillMode() {
    fillMode = !fillMode;
    paintingMode = false;
    eraserMode = false;
    autoCopyMode = false;
    submatrixMode = false;
    autoCopyStep = 0;
    document.getElementById("toggleFillModeButton").textContent = fillMode
        ? "Disable Fill Mode"
        : "Enable Fill Mode";
    updateCursor();
}

function toggleAutoCopyMode() {
    autoCopyMode = !autoCopyMode;
    paintingMode = false;
    eraserMode = false;
    fillMode = false;
    submatrixMode = false;
    autoCopyStep = 0;
    document.getElementById("toggleAutoCopyButton").textContent = autoCopyMode
        ? "Disable Auto Copy Mode"
        : "Enable Auto Copy Mode";
    updateCursor();
}

function toggleSubmatrixMode() {
    submatrixMode = !submatrixMode;
    paintingMode = false;
    eraserMode = false;
    fillMode = false;
    autoCopyMode = false;
    autoCopyStep = 0;
    selectedSubmatrixStart = null;
    selectedSubmatrixEnd = null;
    document.getElementById("toggleSubmatrixModeButton").textContent = submatrixMode
        ? "Disable Submatrix Mode"
        : "Enable Submatrix Mode";
    updateCursor();
}

// Зум
function zoomIn() {
    const oldZoom = zoomLevel;
    zoomLevel = Math.min(zoomLevel + zoomStep, maxZoom);
    applyZoomCenterFix(oldZoom);
}

function zoomOut() {
    const oldZoom = zoomLevel;
    zoomLevel = Math.max(zoomLevel - zoomStep, minZoom);
    applyZoomCenterFix(oldZoom);
}

function applyZoomCenterFix(oldZoom) {
    document.getElementById("zoomLevelDisplay").textContent = Math.round(zoomLevel * 100) + "%";

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const centerX = (cx - canvasOffset.x) / oldZoom;
    const centerY = (cy - canvasOffset.y) / oldZoom;

    canvasOffset.x = cx - centerX * zoomLevel;
    canvasOffset.y = cy - centerY * zoomLevel;

    drawCanvas();
}

// Обработчики мыши
function handleMouseDown(event) {
    isMouseDown = true;
    const pos = getMousePos(event);

    if (paintingMode || eraserMode) {
        saveHistory();
        const color = eraserMode ? "erase" : document.getElementById("colorPicker").value;
        paintCell(pos.x, pos.y, color);
    } else if (!autoCopyMode && !fillMode && !submatrixMode) {
        isDragging = true;
        dragStart.x = pos.x;
        dragStart.y = pos.y;
    }
    updateCursor();
}

function handleMouseUp() {
    isMouseDown = false;
    if (isDragging) {
        isDragging = false;
        updateCursor();
    }
}

function handleMouseMove(event) {
    const pos = getMousePos(event);
    if (isDragging) {
        canvasOffset.x += (pos.x - dragStart.x);
        canvasOffset.y += (pos.y - dragStart.y);
        dragStart.x = pos.x;
        dragStart.y = pos.y;
        drawCanvas();
    } else if ((paintingMode || eraserMode) && isMouseDown) {
        const color = eraserMode ? "erase" : document.getElementById("colorPicker").value;
        paintCell(pos.x, pos.y, color);
    }
}

// Закрашивает ячейку или стирает её
function paintCell(x, y, color) {
    for (let row = 0; row < matrixPoints.length - 1; row++) {
        for (let col = 0; col < matrixPoints[row].length - 1; col++) {
            const topLeft = matrixPoints[row][col];
            const bottomRight = matrixPoints[row + 1][col + 1];

            if (x >= topLeft.x && x <= bottomRight.x &&
                y >= topLeft.y && y <= bottomRight.y) {

                if (color === "erase") {
                    cellStates[row][col] = null;
                } else {
                    if (cellStates[row][col] && (cellStates[row][col].m1 || cellStates[row][col].m2)) {
                        cellStates[row][col].color = color;
                    } else {
                        cellStates[row][col] = { color: color };
                    }
                }

                drawCanvas();
                return;
            }
        }
    }
}

// Заливка
function fillCell(x, y, newColor) {
    for (let row = 0; row < matrixPoints.length - 1; row++) {
        for (let col = 0; col < matrixPoints[row].length - 1; col++) {
            const topLeft = matrixPoints[row][col];
            const bottomRight = matrixPoints[row + 1][col + 1];

            if (x >= topLeft.x && x <= bottomRight.x &&
                y >= topLeft.y && y <= bottomRight.y) {

                const targetColor = cellStates[row][col] ? cellStates[row][col].color : null;
                if (targetColor === newColor) return;

                floodFill(row, col, targetColor, newColor);
                drawCanvas();
                return;
            }
        }
    }
}

// Алгоритм заливки
function floodFill(row, col, targetColor, newColor) {
    if (row < 0 || row >= cellStates.length || col < 0 || col >= cellStates[0].length) return;
    const cell = cellStates[row][col];
    const cellColor = cell ? cell.color : null;

    if (cellColor !== targetColor) return;

    cellStates[row][col] = cellStates[row][col] || {};
    cellStates[row][col].color = newColor;

    floodFill(row + 1, col, targetColor, newColor);
    floodFill(row - 1, col, targetColor, newColor);
    floodFill(row, col + 1, targetColor, newColor);
    floodFill(row, col - 1, targetColor, newColor);
}

// Возвращает позицию мыши с учётом трансформаций
function getMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left; 
    const y = event.clientY - rect.top;  

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Обратное преобразование координат
    const worldX = cx + (x - cx - canvasOffset.x) / zoomLevel;
    const worldY = cy + (y - cy - canvasOffset.y) / zoomLevel;

    return { x: worldX, y: worldY };
}

// Обновляет курсор
function updateCursor() {
    const canvasContainer = document.getElementById("canvasContainer");

    if (paintingMode || eraserMode || fillMode || submatrixMode) {
        canvasContainer.style.cursor = "crosshair";
    } else if (autoCopyMode) {
        canvasContainer.style.cursor = "default";
    } else if (isDragging) {
        canvasContainer.style.cursor = "grabbing";
    } else {
        canvasContainer.style.cursor = "grab";
    }
}

// Экспорт в JSON
function exportToJSON() {
    if (!imageBase64) {
        alert("No image loaded to export.");
        return;
    }

    const rows = cellStates.length;
    if (rows === 0) {
        alert("No matrix to export.");
        return;
    }
    const cols = cellStates[0].length;

    const topLeftX = parseInt(document.getElementById("pointTopLeftX").value, 10);
    const topLeftY = parseInt(document.getElementById("pointTopLeftY").value, 10);
    const bottomRightX = parseInt(document.getElementById("pointBottomRightX").value, 10);
    const bottomRightY = parseInt(document.getElementById("pointBottomRightY").value, 10);

    const cells = {};
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const state = cellStates[r][c];
            if (state && (state.color || state.m1 || state.m2)) {
                const key = `${r}-${c}`;
                cells[key] = {};
                if (state.m1) cells[key].m1 = state.m1;
                if (state.m2) cells[key].m2 = state.m2;
                if (state.color) cells[key].color = state.color;
            }
        }
    }

    const jsonData = {
        image: imageBase64,
        matrix: {
            rows: rows,
            cols: cols,
            topLeft: [topLeftX, topLeftY],
            bottomRight: [bottomRightX, bottomRightY],
            cells: cells
        }
    };

    return JSON.stringify(jsonData);
}

function exportJsonHandler() {
    const jsonString = exportToJSON();
    if (!jsonString) return;

    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'matrix_config.json';
    a.click();
    URL.revokeObjectURL(url);
}

// Импорт из JSON
function importFromJSON(jsonData) {
    if (jsonData.image) {
        image = new Image();
        image.src = jsonData.image;
        imageBase64 = jsonData.image;
        image.onload = () => {
            scaleImageToCanvas(image);
            drawCanvas();
        };
    }

    const m = jsonData.matrix;
    const rows = m.rows;
    const cols = m.cols;

    document.getElementById("pointTopLeftX").value = m.topLeft[0];
    document.getElementById("pointTopLeftY").value = m.topLeft[1];
    document.getElementById("pointBottomRightX").value = m.bottomRight[0];
    document.getElementById("pointBottomRightY").value = m.bottomRight[1];

    matrixPoints = calculateMatrixPoints(
        { x: m.topLeft[0], y: m.topLeft[1] },
        { x: m.bottomRight[0], y: m.bottomRight[1] },
        rows,
        cols
    );

    cellStates = [];
    for (let r = 0; r < rows; r++) {
        cellStates[r] = new Array(cols).fill(null);
    }

    for (const key in m.cells) {
        const cellData = m.cells[key];
        const [row, col] = key.split('-').map(Number);
        cellStates[row][col] = {
            color: cellData.color || null,
            m1: cellData.m1 || null,
            m2: cellData.m2 || null
        };
    }

    historyStack = [];
    redoStack = [];
    historyStack.push(JSON.parse(JSON.stringify(cellStates)));

    drawCanvas();
}

function importJsonHandler() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const jsonData = JSON.parse(reader.result);
            importFromJSON(jsonData);
        };
        reader.readAsText(file);
    };
    fileInput.click();
}

// Undo/Redo
function handleKeyDown(event) {
    if (event.ctrlKey && event.key === 'z') {
        undo();
    } else if (event.ctrlKey && event.key === 'y') {
        redo();
    }
}

// Сохранить текущее состояние для Undo
function saveHistory() {
    historyStack.push(JSON.parse(JSON.stringify(cellStates)));
    redoStack = []; // После нового действия нельзя сразу redo
}

// Undo
function undo() {
    if (historyStack.length > 1) {
        redoStack.push(JSON.parse(JSON.stringify(cellStates)));
        cellStates = historyStack.pop();
        drawCanvas();
    }
}

// Redo
function redo() {
    if (redoStack.length > 0) {
        historyStack.push(JSON.parse(JSON.stringify(cellStates)));
        cellStates = redoStack.pop();
        drawCanvas();
    }
}
