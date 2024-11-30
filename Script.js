// Регулярное выражение для проверки или парсинга координат формата "X: число, Y: число"
const COORDINATE_REGEX = /X:\s*(\d+),\s*Y:\s*(\d+)/;
// Примеры валидных значений:
// "X: 50, Y: 100" - соответствует
// "X:123, Y:456" - соответствует
// "X: 10 ,Y: 20 " - соответствует
// "X: , Y:" - не соответствует (нет чисел)

function parsePoint(value) {
    const match = value.match(COORDINATE_REGEX); // Используем регулярку из переменной
    return match ? { x: parseInt(match[1], 10), y: parseInt(match[2], 10) } : null;
}


// Глобальные переменные
let canvas = null;
let ctx = null;
let image = null;
let matrixPoints = [];
let paintingMode = false;

// Установка размеров канваса по родителю
function resizeCanvas() {
    const parent = canvas.parentElement; // Родительский элемент
    canvas.width = parent.clientWidth;  // Ширина канваса = ширина родителя
    canvas.height = parent.clientHeight; // Высота канваса = высота родителя
}

// Масштабируем изображение под размеры канваса
function scaleImageToCanvas(img, canvas) {
    const canvasRatio = canvas.width / canvas.height; // Соотношение сторон канваса
    const imageRatio = img.width / img.height; // Соотношение сторон изображения

    let scaledWidth, scaledHeight;

    if (imageRatio > canvasRatio) {
        scaledWidth = canvas.width; // Подгоняем ширину под канвас
        scaledHeight = canvas.width / imageRatio; // Высота пропорциональна
    } else {
        scaledWidth = canvas.height * imageRatio; // Ширина пропорциональна
        scaledHeight = canvas.height; // Подгоняем высоту под канвас
    }

    const offsetX = (canvas.width - scaledWidth) / 2; // Центрируем по X
    const offsetY = (canvas.height - scaledHeight) / 2; // Центрируем по Y

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Очищаем холст
    ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight); // Рисуем изображение
}

// Добавление событий после загрузки DOM
document.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("matrixCanvas");
    ctx = canvas.getContext("2d");

    resizeCanvas(); // Устанавливаем размеры канваса
    setupEventListeners(); // Привязываем обработчики событий
});

window.onload = function () {
    alert("LOADED!");
};

// Привязка обработчиков событий
function setupEventListeners() {
    document.getElementById("imageUpload").addEventListener("change", handleImageUpload);
    document.getElementById("drawMatrixButton").addEventListener("click", drawMatrix);
    document.getElementById("toggleModeButton").addEventListener("click", toggleMode);
    canvas.addEventListener("click", handleCanvasClick);
}

// Обработчик загрузки изображения
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                image = new Image();
                image.src = reader.result;
                image.onload = () => {
                    resizeCanvas(); // Устанавливаем размеры канваса по родительскому элементу
                    scaleImageToCanvas(image, canvas); // Масштабируем изображение под канвас
                };
            } catch (error) {
                console.error("Ошибка загрузки изображения:", error);
                alert("Не удалось загрузить изображение.");
            }
        };
        reader.onerror = () => {
            alert("Ошибка чтения файла.");
        };
        reader.readAsDataURL(file);
    }
}

// Функция для кликов по канвасу
function handleCanvasClick(event) {
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

        // Проверка координат с использованием регулярки
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


// Функция для рисования матрицы
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
        alert("Please enter valid points and dimensions.");
        return;
    }

    // Очищаем холст перед рисованием
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем изображение на холсте
    if (image) {
        scaleImageToCanvas(image, canvas);
    }

    matrixPoints = calculateMatrixPoints(topLeft, bottomRight, rows, cols);
    drawGrid(matrixPoints, rows, cols);
}

// Функция для расчета точек матрицы
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

// Обработчик переключения режима
function toggleMode() {
    paintingMode = !paintingMode;
    const button = document.getElementById("toggleModeButton");
    button.textContent = paintingMode ? "Switch to Coordinate Mode" : "Switch to Paint Mode";
}



// Обработчик изменения размеров окна
window.addEventListener("resize", () => {
    // Обновляем размеры канваса
    resizeCanvas();

    // Если есть загруженное изображение, перерисовываем его
    if (image) {
        scaleImageToCanvas(image, canvas);
    }

    // Если матрица была нарисована, перерисовываем её
    if (matrixPoints.length > 0) {
        drawGrid(matrixPoints, matrixPoints.length - 1, matrixPoints[0].length - 1);
    }
});
