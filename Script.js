const canvas = document.getElementById("matrixCanvas");
const ctx = canvas.getContext("2d");
let image = null;
let matrixPoints = [];
let paintingMode = false; // Начинаем в режиме поиска координат

// Загрузка изображения
document.getElementById("imageUpload").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            image = new Image();
            image.src = reader.result;
            image.onload = () => {
                // Устанавливаем размеры канваса в зависимости от изображения
                canvas.width = image.width;
                canvas.height = image.height;
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            };
        };
        reader.readAsDataURL(file);
    }
});

// Обработчик кнопки "Draw Matrix"
document.getElementById("drawMatrixButton").addEventListener("click", drawMatrix);

// Обработчик кнопки переключения режима
document.getElementById("toggleModeButton").addEventListener("click", toggleMode);

// Функция для рисования матрицы
function drawMatrix() {
    const topLeft = {
        x: parseInt(document.getElementById("pointTopLeftX").value, 10),
        y: parseInt(document.getElementById("pointTopLeftY").value, 10)
    };
    const bottomRight = {
        x: parseInt(document.getElementById("pointBottomRightX").value, 10),
        y: parseInt(document.getElementById("pointBottomRightY").value, 10)
    };

    const rows = parseInt(document.getElementById("matrixRows").value, 10);
    const cols = parseInt(document.getElementById("matrixCols").value, 10);

    if (isNaN(topLeft.x) || isNaN(topLeft.y) || isNaN(bottomRight.x) || isNaN(bottomRight.y) || 
        isNaN(rows) || isNaN(cols) || rows <= 0 || cols <= 0) {
        alert("Please enter valid points and dimensions.");
        return;
    }

    // Очищаем холст перед рисованием
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем изображение на холсте
    if (image) {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }

    matrixPoints = calculateMatrixPoints(topLeft, bottomRight, rows, cols);
    drawGrid(matrixPoints, rows, cols);
}

// Функция для расчёта точек матрицы
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

// Функция для рисования сетки
function drawGrid(matrixPoints, rows, cols) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const topLeft = matrixPoints[row][col];
            const topRight = matrixPoints[row][col + 1];
            const bottomLeft = matrixPoints[row + 1][col];
            const bottomRight = matrixPoints[row + 1][col + 1];

            ctx.beginPath();
            ctx.moveTo(topLeft.x, topLeft.y);
            ctx.lineTo(topRight.x, topRight.y);
            ctx.lineTo(bottomRight.x, bottomRight.y);
            ctx.lineTo(bottomLeft.x, bottomLeft.y);
            ctx.closePath();
            ctx.stroke();
        }
    }
}

// Функция для переключения режима
function toggleMode() {
    paintingMode = !paintingMode;
    const button = document.getElementById("toggleModeButton");
    button.textContent = paintingMode ? "Switch to Coordinate Mode" : "Switch to Paint Mode";
}

// Функция для парсинга ввода координат
function parsePoint(value) {
    const match = value.match(/X:\s*(\d+),\s*Y:\s*(\d+)/);
    return match ? { x: parseInt(match[1], 10), y: parseInt(match[2], 10) } : null;
}

// Функция для отображения координат при клике
canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (paintingMode) {
        const color = document.getElementById("colorPicker").value;
        paintCell(x, y, color);
    } else {
        const coordDisplay = document.getElementById("coordinates");
        const coordText = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
        coordDisplay.textContent = coordText;

        // Копирование в буфер обмена
        navigator.clipboard.writeText(coordText)
            .then(() => {
                coordDisplay.textContent = `${coordText} (Copied!)`;
            });
    }
});

// Функция для покраски ячейки
function paintCell(x, y, color) {
    for (let row = 0; row < matrixPoints.length - 1; row++) {
        for (let col = 0; col < matrixPoints[row].length - 1; col++) {
            const topLeft = matrixPoints[row][col];
            const bottomRight = matrixPoints[row + 1][col + 1];

            if (x >= topLeft.x && x <= bottomRight.x && y >= topLeft.y && y <= bottomRight.y) {
                ctx.fillStyle = color;
                ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
            }
        }
    }
}