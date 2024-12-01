// Регулярное выражение для проверки или парсинга координат формата "X: число, Y: число"
const COORDINATE_REGEX = /X:\s*(\d+),\s*Y:\s*(\d+)/;

// Глобальные переменные
let canvas = null; // Холст для рисования
let ctx = null;    // Контекст рисования
let image = null;  // Загруженное изображение
let matrixPoints = []; // Точки матрицы для сетки
let paintingMode = false; // Режим рисования
let eraserMode = false;   // Режим ластика
let autoCopyMode = false; // Режим авто копирования
let autoCopyStep = 0;     // Шаг автозаполнения (0 - верхняя левая, 1 - нижняя правая)
let isMouseDown = false;  // Зажата ли мышь

// Глобальные переменные для хранения параметров изображения
let imageOffsetX = 0;
let imageOffsetY = 0;
let imageScaledWidth = 0;
let imageScaledHeight = 0;

// Выполняется после загрузки DOM
document.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("matrixCanvas");
    ctx = canvas.getContext("2d");

    resizeCanvas(); // Устанавливаем размер канваса
    setupEventListeners(); // Настраиваем события

    // Настройка превью цвета
    const colorPicker = document.getElementById("colorPicker");
    const colorPreview = document.getElementById("colorPreview");

    colorPicker.addEventListener("input", () => {
        colorPreview.style.backgroundColor = colorPicker.value;
    });

    colorPreview.style.backgroundColor = colorPicker.value;
});

// Устанавливает размеры канваса, чтобы он соответствовал родительскому элементу
function resizeCanvas() {
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();

    // Учитываем devicePixelRatio при установке размеров канваса
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;

    // Настраиваем масштабирование контекста
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

// Настраивает события на элементы интерфейса и канвас
function setupEventListeners() {
    document.getElementById("imageUpload").addEventListener("change", handleImageUpload);
    document.getElementById("drawMatrixButton").addEventListener("click", drawMatrix);
    document.getElementById("toggleModeButton").addEventListener("click", toggleMode);
    document.getElementById("toggleEraserButton").addEventListener("click", toggleEraserMode);
    document.getElementById("toggleAutoCopyButton").addEventListener("click", toggleAutoCopyMode);

    // События мыши на канвасе
    canvas.addEventListener("mousedown", () => { isMouseDown = true; });
    canvas.addEventListener("mouseup", () => { isMouseDown = false; });
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
                resizeCanvas();
                scaleImageToCanvas(image);
                if (matrixPoints.length > 0) {
                    drawGrid(matrixPoints, matrixPoints.length - 1, matrixPoints[0].length - 1);
                }
            };
        };
        reader.readAsDataURL(file);
    }
}

// Масштабирует изображение, чтобы оно поместилось на канвас
function scaleImageToCanvas(img) {
    const canvasWidth = canvas.width / window.devicePixelRatio;
    const canvasHeight = canvas.height / window.devicePixelRatio;

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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
        img,
        0,
        0,
        img.width,
        img.height,
        imageOffsetX * window.devicePixelRatio,
        imageOffsetY * window.devicePixelRatio,
        imageScaledWidth * window.devicePixelRatio,
        imageScaledHeight * window.devicePixelRatio
    );
}

// Обрабатывает движение мыши по канвасу
function handleMouseMove(event) {
    if ((paintingMode || eraserMode) && isMouseDown) {
        const pos = getMousePos(event);
        const color = eraserMode ? "erase" : document.getElementById("colorPicker").value;
        paintCell(pos.x, pos.y, color);
    }
}

// Обрабатывает клик по канвасу
function handleCanvasClick(event) {
    const pos = getMousePos(event);

    if (autoCopyMode) {
        handleAutoCopyClick(pos);
    } else if (paintingMode || eraserMode) {
        const color = eraserMode ? "erase" : document.getElementById("colorPicker").value;
        paintCell(pos.x, pos.y, color);
    } else {
        // Отображаем координаты и копируем их в буфер обмена
        const coordDisplay = document.getElementById("coordinates");
        const coordText = `X: ${Math.round(pos.x / window.devicePixelRatio)}, Y: ${Math.round(pos.y / window.devicePixelRatio)}`;
        coordDisplay.textContent = coordText;

        if (COORDINATE_REGEX.test(coordText)) {
            navigator.clipboard.writeText(coordText)
                .then(() => {
                    coordDisplay.textContent = `${coordText} (Copied!)`;
                });
        } else {
            console.error("Координаты не соответствуют формату.");
        }
    }
}

// Обрабатывает клики для режима Auto Copy
function handleAutoCopyClick(pos) {
    const x = Math.round(pos.x / window.devicePixelRatio);
    const y = Math.round(pos.y / window.devicePixelRatio);

    if (autoCopyStep === 0) {
        document.getElementById("pointTopLeftX").value = x;
        document.getElementById("pointTopLeftY").value = y;
        autoCopyStep = 1;
        alert("Top-Left point set. Please click for Bottom-Right point.");
    } else if (autoCopyStep === 1) {
        document.getElementById("pointBottomRightX").value = x;
        document.getElementById("pointBottomRightY").value = y;

        const topLeftX = parseInt(document.getElementById("pointTopLeftX").value, 10);
        const topLeftY = parseInt(document.getElementById("pointTopLeftY").value, 10);
        const bottomRightX = parseInt(document.getElementById("pointBottomRightX").value, 10);
        const bottomRightY = parseInt(document.getElementById("pointBottomRightY").value, 10);

        if (bottomRightX <= topLeftX || bottomRightY <= topLeftY) {
            alert("Invalid points. Bottom-Right point must be below and to the right of Top-Left point. Please try again.");
            autoCopyStep = 0;
        } else {
            autoCopyStep = 0;
            autoCopyMode = false;
            document.getElementById("toggleAutoCopyButton").textContent = "Enable Auto Copy Mode";
            alert("Bottom-Right point set. You can now draw the matrix.");
            drawMatrix();
        }
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (image) {
        scaleImageToCanvas(image);
    }

    matrixPoints = calculateMatrixPoints(topLeft, bottomRight, rows, cols);
    drawGrid(matrixPoints, rows, cols);
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
    ctx.lineWidth = 1 * window.devicePixelRatio;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const topLeft = matrixPoints[row][col];
            const bottomRight = matrixPoints[row + 1][col + 1];

            ctx.strokeRect(
                topLeft.x * window.devicePixelRatio,
                topLeft.y * window.devicePixelRatio,
                (bottomRight.x - topLeft.x) * window.devicePixelRatio,
                (bottomRight.y - topLeft.y) * window.devicePixelRatio
            );
        }
    }
}

// Закрашивает ячейку или стирает её содержимое
function paintCell(x, y, color) {
    for (let row = 0; row < matrixPoints.length - 1; row++) {
        for (let col = 0; col < matrixPoints[row].length - 1; col++) {
            const topLeft = matrixPoints[row][col];
            const bottomRight = matrixPoints[row + 1][col + 1];

            if (x >= topLeft.x * window.devicePixelRatio && x <= bottomRight.x * window.devicePixelRatio &&
                y >= topLeft.y * window.devicePixelRatio && y <= bottomRight.y * window.devicePixelRatio) {

                const cellWidth = (bottomRight.x - topLeft.x) * window.devicePixelRatio;
                const cellHeight = (bottomRight.y - topLeft.y) * window.devicePixelRatio;
                const borderThickness = 1 * window.devicePixelRatio;

                const cellX = topLeft.x * window.devicePixelRatio + borderThickness;
                const cellY = topLeft.y * window.devicePixelRatio + borderThickness;
                const cellWidthAdjusted = cellWidth - 2 * borderThickness;
                const cellHeightAdjusted = cellHeight - 2 * borderThickness;

                if (color === "erase") {
                    if (image) {
                        const sx = ((cellX / window.devicePixelRatio - imageOffsetX) / imageScaledWidth) * image.width;
                        const sy = ((cellY / window.devicePixelRatio - imageOffsetY) / imageScaledHeight) * image.height;
                        const sWidth = (cellWidthAdjusted / window.devicePixelRatio / imageScaledWidth) * image.width;
                        const sHeight = (cellHeightAdjusted / window.devicePixelRatio / imageScaledHeight) * image.height;

                        ctx.drawImage(
                            image,
                            sx,
                            sy,
                            sWidth,
                            sHeight,
                            cellX,
                            cellY,
                            cellWidthAdjusted,
                            cellHeightAdjusted
                        );
                    } else {
                        ctx.clearRect(cellX, cellY, cellWidthAdjusted, cellHeightAdjusted);
                    }
                } else {
                    ctx.fillStyle = color;
                    ctx.fillRect(cellX, cellY, cellWidthAdjusted, cellHeightAdjusted);
                }

                ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
                ctx.lineWidth = 1 * window.devicePixelRatio;
                ctx.strokeRect(
                    topLeft.x * window.devicePixelRatio,
                    topLeft.y * window.devicePixelRatio,
                    cellWidth,
                    cellHeight
                );

                return;
            }
        }
    }
}

// Переключает режим рисования
function toggleMode() {
    paintingMode = !paintingMode;
    eraserMode = false;
    autoCopyMode = false;
    autoCopyStep = 0;
    document.getElementById("toggleAutoCopyButton").textContent = "Enable Auto Copy Mode";
    const button = document.getElementById("toggleModeButton");
    button.textContent = paintingMode ? "Switch to Coordinate Mode" : "Switch to Paint Mode";
}

// Переключает режим ластика
function toggleEraserMode() {
    eraserMode = !eraserMode;
    paintingMode = false;
    autoCopyMode = false;
    autoCopyStep = 0;
    document.getElementById("toggleAutoCopyButton").textContent = "Enable Auto Copy Mode";
    const button = document.getElementById("toggleEraserButton");
    button.textContent = eraserMode ? "Disable Eraser" : "Enable Eraser";
}

// Переключает режим Auto Copy
function toggleAutoCopyMode() {
    autoCopyMode = !autoCopyMode;
    paintingMode = false;
    eraserMode = false;
    autoCopyStep = 0;
    const button = document.getElementById("toggleAutoCopyButton");
    button.textContent = autoCopyMode ? "Disable Auto Copy Mode" : "Enable Auto Copy Mode";

    document.getElementById("toggleModeButton").textContent = "Switch to Paint Mode";
    document.getElementById("toggleEraserButton").textContent = "Enable Eraser";
}

// Возвращает позицию мыши с учётом масштаба
function getMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

// Изменяет размеры канваса при изменении окна
window.addEventListener("resize", () => {
    resizeCanvas();
    if (image) {
        scaleImageToCanvas(image);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (matrixPoints.length > 0) {
        drawGrid(matrixPoints, matrixPoints.length - 1, matrixPoints[0].length - 1);
    }
});
