const app = document.querySelector<HTMLElement>("#app")!;

type Point = {
  x: number;
  y: number;
};

type StrokeAppearance = {
  color: string;
  width: number;
  cap: CanvasLineCap;
  join: CanvasLineJoin;
};

type Stroke = {
  id: string;
  points: Point[];
  appearance: StrokeAppearance;
};

type DocumentCollection = {
  width: number;
  height: number;
  coordinateSystem: "canvas pixels";
  strokes: Stroke[];
};

const toolAppearance: StrokeAppearance = {
  color: "#111827",
  width: 4,
  cap: "round",
  join: "round",
};

const documentCollection: DocumentCollection = {
  width: 640,
  height: 480,
  coordinateSystem: "canvas pixels",
  strokes: [],
};

const canvas = document.createElement("canvas");
canvas.width = documentCollection.width;
canvas.height = documentCollection.height;
canvas.setAttribute("aria-label", "Drawing Canvas");
canvas.style.display = "block";
canvas.style.width = `${documentCollection.width}px`;
canvas.style.height = `${documentCollection.height}px`;
canvas.style.background = "#ffffff";
canvas.style.border = "2px solid #111827";
canvas.style.borderRadius = "16px";
canvas.style.boxShadow = "0 20px 50px rgba(15, 23, 42, 0.18)";
canvas.style.cursor = "crosshair";
canvas.style.touchAction = "none";

const context = canvas.getContext("2d")!;

app.style.display = "grid";
app.style.placeItems = "center";
app.style.gap = "1rem";
app.style.padding = "2rem";
app.append(canvas);

const controls = document.createElement("div");
controls.style.display = "flex";
controls.style.gap = "0.75rem";
controls.style.justifyContent = "center";
controls.style.flexWrap = "wrap";

const clearButton = document.createElement("button");
clearButton.type = "button";
clearButton.textContent = "Clear Pixels";
clearButton.addEventListener("click", () => {
  activeStroke = null;
  isDrawing = false;
  lastPoint = null;
  context.clearRect(0, 0, canvas.width, canvas.height);
});

const clearDocumentButton = document.createElement("button");
clearDocumentButton.type = "button";
clearDocumentButton.textContent = "Clear Document";
clearDocumentButton.addEventListener("click", () => {
  documentCollection.strokes = [];
  activeStroke = null;
  isDrawing = false;
  lastPoint = null;
  context.clearRect(0, 0, canvas.width, canvas.height);
});

const redrawButton = document.createElement("button");
redrawButton.type = "button";
redrawButton.textContent = "Redraw";
redrawButton.addEventListener("click", () => {
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of documentCollection.strokes) {
    drawStroke(stroke);
  }
});

controls.append(clearButton, clearDocumentButton, redrawButton);
app.append(controls);

let isDrawing = false;
let activeStroke: Stroke | null = null;
let lastPoint: Point | null = null;

function getCanvasPoint(event: PointerEvent): Point {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
  };
}

function drawStroke(stroke: Stroke) {
  if (stroke.points.length === 0) {
    return;
  }

  context.beginPath();
  context.moveTo(stroke.points[0].x, stroke.points[0].y);

  for (let index = 1; index < stroke.points.length; index += 1) {
    context.lineTo(stroke.points[index].x, stroke.points[index].y);
  }

  context.lineCap = stroke.appearance.cap;
  context.lineJoin = stroke.appearance.join;
  context.lineWidth = stroke.appearance.width;
  context.strokeStyle = stroke.appearance.color;
  context.stroke();
}

function redrawDocument() {
  if (activeStroke && activeStroke.points.length > 0) {
    drawStroke(activeStroke);
  }
}

function finishStroke(event: PointerEvent) {
  if (!isDrawing || !activeStroke) {
    return;
  }

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  if (activeStroke.points.length > 1) {
    documentCollection.strokes.push(activeStroke);
  }

  isDrawing = false;
  activeStroke = null;
  lastPoint = null;
  redrawDocument();
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();

  const point = getCanvasPoint(event);
  activeStroke = {
    id: crypto.randomUUID(),
    points: [point],
    appearance: { ...toolAppearance },
  };
  isDrawing = true;
  lastPoint = point;
  canvas.setPointerCapture(event.pointerId);
  redrawDocument();
});

canvas.addEventListener("pointermove", (event) => {
  if (!isDrawing || !activeStroke || !lastPoint) {
    return;
  }

  const point = getCanvasPoint(event);
  activeStroke.points.push(point);
  lastPoint = point;
  redrawDocument();
});

canvas.addEventListener("pointerup", finishStroke);

canvas.addEventListener("pointerleave", (event) => {
  if (isDrawing && !canvas.hasPointerCapture(event.pointerId)) {
    finishStroke(event);
  }
});

canvas.addEventListener("pointercancel", (event) => {
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  isDrawing = false;
  activeStroke = null;
  lastPoint = null;
  redrawDocument();
});

app.setAttribute(
  "aria-label",
  "Drawing application with retained document model",
);

redrawDocument();
