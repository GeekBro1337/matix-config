// Регулярное выражение для проверки или парсинга координат формата "X: число, Y: число"
const COORDINATE_REGEX = /X:\s*(\d+),\s*Y:\s*(\d+)/;

// Глобальные переменные
let canvas = null; // Холст для рисования
let ctx = null;    // Контекст рисования
let image = null;  // Загруженное изображение
let matrixPoints = []; // Точки матрицы для сетки
let paintingMode = false; // Режим рисования
let eraserMode = false;   // Режим ластика
let fillMode = false;     // Режим заливки
let autoCopyMode = false; // Режим авто копирования
let autoCopyStep = 0;     // Шаг автозаполнения (0 - верхняя левая, 1 - нижняя правая)
let isMouseDown = false;  // Зажата ли мышь

// Переменные для зума и смещения канваса
let zoomLevel = 1; // Текущий уровень зума (1 = 100%)
const zoomStep = 0.1; // Шаг изменения зума
const minZoom = 0.5; // Минимальный зум (50%)
const maxZoom = 3; // Максимальный зум (300%)
let isDragging = false; // Флаг для перетаскивания канваса
let dragStart = { x: 0, y: 0 }; // Начальная точка перетаскивания
let canvasOffset = { x: 0, y: 0 }; // Текущие смещения канваса

// Глобальные переменные для хранения параметров изображения
let imageOffsetX = 0;
let imageOffsetY = 0;
let imageScaledWidth = 0;
let imageScaledHeight = 0;

// Массив для хранения состояния ячеек
let cellStates = []; // Stores the color of each cell

// Выполняется после загрузки DOM
document.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("matrixCanvas");
    ctx = canvas.getContext("2d");

    resizeCanvas(); // Устанавливаем размер канваса
    setupEventListeners(); // Настраиваем события

    // Настройка превью цвета
    const colorPicker = document.getElementById("colorPicker");
    const colorPreview = document.getElementById("colorPreview");
    const colorPickerButton = document.getElementById("colorPickerButton");

    colorPickerButton.addEventListener("click", () => {
        colorPicker.click();
    });

    colorPicker.addEventListener("input", () => {
        colorPreview.style.backgroundColor = colorPicker.value;
    });

    colorPreview.style.backgroundColor = colorPicker.value;
    updateCursor(); // Устанавливаем курсор при загрузке
});

// Устанавливает размеры канваса, чтобы он соответствовал родительскому элементу
function resizeCanvas() {
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();

    // Устанавливаем размеры канваса в соответствии с размером контейнера
    canvas.width = rect.width;
    canvas.height = rect.height;

    drawCanvas(); // Перерисовываем канвас после изменения размера
}

// Настраивает события на элементы интерфейса и канвас
function setupEventListeners() {
    document.getElementById("imageUpload").addEventListener("change", handleImageUpload);
    document.getElementById("drawMatrixButton").addEventListener("click", drawMatrix);
    document.getElementById("toggleModeButton").addEventListener("click", toggleMode);
    document.getElementById("toggleEraserButton").addEventListener("click", toggleEraserMode);
    document.getElementById("toggleFillModeButton").addEventListener("click", toggleFillMode);
    document.getElementById("toggleAutoCopyButton").addEventListener("click", toggleAutoCopyMode);
    document.getElementById("zoomInButton").addEventListener("click", zoomIn);
    document.getElementById("zoomOutButton").addEventListener("click", zoomOut);

    // События мыши на канвасе
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleCanvasClick);
}

// Обрабатывает загрузку изображения
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            image = new Image();
            image.src = reader.result;
            image.onload = () => {
                scaleImageToCanvas(image);
                drawCanvas();
            };
        };
        reader.readAsDataURL(file);
    }
}

// Масштабирует изображение, чтобы оно поместилось на канвас
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

// Перерисовывает канвас
function drawCanvas() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Применяем смещение и масштаб
    ctx.translate(canvasOffset.x, canvasOffset.y);
    ctx.scale(zoomLevel, zoomLevel);

    // Рисуем изображение
    if (image) {
        drawImage();
    }

    // Рисуем сетку
    if (matrixPoints.length > 0) {
        drawGrid(matrixPoints, matrixPoints.length - 1, matrixPoints[0].length - 1);

        // Рисуем закрашенные ячейки
        drawPaintedCells();
    }

    ctx.restore();
}

// Рисует изображение
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

// Рисует закрашенные ячейки из cellStates
function drawPaintedCells() {
    for (let row = 0; row < cellStates.length; row++) {
        for (let col = 0; col < cellStates[row].length; col++) {
            const color = cellStates[row][col];
            if (color) {
                const topLeft = matrixPoints[row][col];
                const bottomRight = matrixPoints[row + 1][col + 1];
                const cellWidth = bottomRight.x - topLeft.x;
                const cellHeight = bottomRight.y - topLeft.y;
                const borderThickness = 1 / zoomLevel;

                const cellX = topLeft.x + borderThickness;
                const cellY = topLeft.y + borderThickness;
                const cellWidthAdjusted = cellWidth - 2 * borderThickness;
                const cellHeightAdjusted = cellHeight - 2 * borderThickness;

                ctx.fillStyle = color;
                ctx.fillRect(cellX, cellY, cellWidthAdjusted, cellHeightAdjusted);

                // Перерисовываем границу ячейки
                ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
                ctx.lineWidth = 1 / zoomLevel;
                ctx.strokeRect(
                    topLeft.x,
                    topLeft.y,
                    cellWidth,
                    cellHeight
                );
            }
        }
    }
}

// Обрабатывает клики на канвасе
function handleCanvasClick(event) {
    const pos = getMousePos(event);

    if (autoCopyMode) {
        handleAutoCopyClick(pos);
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
        const color = document.getElementById("colorPicker").value;
        fillCell(pos.x, pos.y, color);
    }
}

// Функция для выбора координат в режиме Auto Copy
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

// Строит матрицу
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

    // Инициализируем cellStates
    cellStates = [];
    for (let i = 0; i < rows; i++) {
        cellStates[i] = new Array(cols).fill(null);
    }

    drawCanvas();
}

// Вычисляет точки матрицы
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
    ctx.lineWidth = 1 / zoomLevel; // Корректируем толщину линии

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

// Управление режимами (Рисование, Ластик, Заливка, Auto Copy)
function toggleMode() {
    paintingMode = !paintingMode;
    eraserMode = false;
    fillMode = false;
    autoCopyMode = false;
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
    autoCopyStep = 0;
    document.getElementById("toggleAutoCopyButton").textContent = autoCopyMode
        ? "Disable Auto Copy Mode"
        : "Enable Auto Copy Mode";
    updateCursor();
}

// Управление зумом
function zoomIn() {
    zoomLevel = Math.min(zoomLevel + zoomStep, maxZoom);
    updateZoom();
}

function zoomOut() {
    zoomLevel = Math.max(zoomLevel - zoomStep, minZoom);
    updateZoom();
}

function updateZoom() {
    document.getElementById("zoomLevelDisplay").textContent = Math.round(zoomLevel * 100) + "%";
    drawCanvas();
}

// Обработчики мыши
function handleMouseDown(event) {
    isMouseDown = true;
    const pos = getMousePos(event);

    if (paintingMode || eraserMode) {
        const color = eraserMode ? "erase" : document.getElementById("colorPicker").value;
        paintCell(pos.x, pos.y, color); // Закрашиваем ячейку при нажатии мыши
    } else if (!autoCopyMode && !fillMode) {
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

// Закрашивает ячейку или стирает её содержимое
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
                    cellStates[row][col] = color;
                }

                drawCanvas(); // Перерисовываем канвас
                return;
            }
        }
    }
}

// Функция заливки ячеек
function fillCell(x, y, newColor) {
    for (let row = 0; row < matrixPoints.length - 1; row++) {
        for (let col = 0; col < matrixPoints[row].length - 1; col++) {
            const topLeft = matrixPoints[row][col];
            const bottomRight = matrixPoints[row + 1][col + 1];

            if (x >= topLeft.x && x <= bottomRight.x &&
                y >= topLeft.y && y <= bottomRight.y) {

                const targetColor = cellStates[row][col];
                if (targetColor === newColor) return;

                floodFill(row, col, targetColor, newColor);
                drawCanvas(); // Перерисовываем канвас
                return;
            }
        }
    }
}

// Реализация алгоритма заливки
function floodFill(row, col, targetColor, newColor) {
    if (row < 0 || row >= cellStates.length || col < 0 || col >= cellStates[0].length) return;
    if (cellStates[row][col] !== targetColor) return;

    cellStates[row][col] = newColor;

    floodFill(row + 1, col, targetColor, newColor);
    floodFill(row - 1, col, targetColor, newColor);
    floodFill(row, col + 1, targetColor, newColor);
    floodFill(row, col - 1, targetColor, newColor);
}

// Возвращает позицию мыши с учётом масштаба и смещения
function getMousePos(event) {
    const rect = canvas.getBoundingClientRect();

    // Координаты мыши относительно канваса
    const x = (event.clientX - rect.left);
    const y = (event.clientY - rect.top);

    // Учитываем зум и смещение
    const transformedX = (x - canvasOffset.x) / zoomLevel;
    const transformedY = (y - canvasOffset.y) / zoomLevel;

    return {
        x: transformedX,
        y: transformedY
    };
}

// Обновляет стиль курсора в зависимости от текущего режима
function updateCursor() {
    const canvasContainer = document.getElementById("canvasContainer");

    if (paintingMode || eraserMode || fillMode) {
        canvasContainer.style.cursor = "crosshair";
    } else if (autoCopyMode) {
        canvasContainer.style.cursor = "default";
    } else if (isDragging) {
        canvasContainer.style.cursor = "grabbing";
    } else {
        canvasContainer.style.cursor = "grab";
    }
}

// Изменяет размеры канваса при изменении окна
window.addEventListener("resize", () => {
    resizeCanvas();
    if (image) {
        scaleImageToCanvas(image);
    }
    updateCursor();
});
