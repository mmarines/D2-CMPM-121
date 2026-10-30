const app = document.querySelector<HTMLElement>("#app")!;
app.style.display = "grid";
app.style.placeItems = "center";
app.style.gap = "1rem";
app.style.padding = "2rem";

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

const toolAppearance: StrokeAppearance = {
  color: "#111827",
  width: 4,
  cap: "round",
  join: "round",
};

// tool data type
type Tool = {
  id: string;
  name: string;
  type: "pen" | "sticker";
  appearance?: StrokeAppearance;
  content?: string;
  fontSize?: number;
};

// holds all the tools, is intitialized with the preset tools
const tools: Tool[] = [
  {
    id: "thin-marker",
    name: "Marker 1",
    type: "pen",
    appearance: { color: "#111827", width: 4, cap: "round", join: "round" },
  },
  {
    id: "thick-marker",
    name: "Marker 2",
    type: "pen",
    appearance: { color: "#111827", width: 12, cap: "round", join: "round" },
  },
  {
    id: "sticker-star",
    name: "",
    type: "sticker",
    content: "⭐",
    fontSize: 32,
  },
  {
    id: "sticker-heart",
    name: "",
    type: "sticker",
    content: "💖",
    fontSize: 32,
  },
  {
    id: "sticker-fire",
    name: "",
    type: "sticker",
    content: "🔥",
    fontSize: 32,
  },
];

// Track the currently selected tool (defaults to the first tool)
let activeTool: Tool = tools[0];

// two types of canvas items to be combined and stored as DrawingItems
type PathItem = {
  kind: "path";
  id: string;
  points: Point[];
  appearance: StrokeAppearance;
};
type StickerItem = {
  kind: "sticker";
  id: string;
  x: number;
  y: number;
  content: string;
  fontSize?: number;
};
type DrawingItem = PathItem | StickerItem;

type DocumentCollection = {
  width: number;
  height: number;
  coordinateSystem: "canvas pixels";
  items: DrawingItem[];
};

// drawing canvas settings
const documentCollection: DocumentCollection = {
  width: 640,
  height: 480,
  coordinateSystem: "canvas pixels",
  items: [],
};

// setup drawing canvas
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

app.append(canvas);

const historyControls = document.createElement("div");
historyControls.style.display = "flex";
historyControls.style.gap = "0.75rem";
historyControls.style.justifyContent = "center";
historyControls.style.flexWrap = "wrap";

// setup clear button and clear logic
const clearDocumentButton = document.createElement("button");
clearDocumentButton.type = "button";
clearDocumentButton.textContent = "Clear Document";
clearDocumentButton.addEventListener("click", () => {
  if (documentCollection.items.length === 0) {
    return;
  }

  undoStack.push(cloneDrawingItems(documentCollection.items));
  documentCollection.items = [];
  redoStack.length = 0;
  activeItem = null;
  isDrawing = false;
  lastPoint = null;
  renderDocument();
  updateHistoryButtons();
});

// setup undo button and undo logic
const undoButton = document.createElement("button");
undoButton.type = "button";
undoButton.textContent = "Undo";
undoButton.addEventListener("click", () => {
  if (undoStack.length === 0) {
    return;
  }

  redoStack.push(cloneDrawingItems(documentCollection.items));
  documentCollection.items = undoStack.pop()!;
  activeItem = null;
  isDrawing = false;
  lastPoint = null;
  renderDocument();
  updateHistoryButtons();
});

// setup redo button and redo logic
const redoButton = document.createElement("button");
redoButton.type = "button";
redoButton.textContent = "Redo";
redoButton.addEventListener("click", () => {
  if (redoStack.length === 0) {
    return;
  }

  undoStack.push(cloneDrawingItems(documentCollection.items));
  documentCollection.items = redoStack.pop()!;
  activeItem = null;
  isDrawing = false;
  lastPoint = null;
  renderDocument();
  updateHistoryButtons();
});

// actually add history controlls to the page
historyControls.append(clearDocumentButton, undoButton, redoButton);
app.append(historyControls);

// setup tool pallet
const toolPalette = document.createElement("div");
toolPalette.style.display = "flex";
toolPalette.style.gap = "0.5rem";
toolPalette.style.justifyContent = "center";
toolPalette.style.flexWrap = "wrap";
app.append(toolPalette);

function renderToolPalette() {
  toolPalette.innerHTML = ""; // Clear existing buttons before re-rendering

  for (const tool of tools) {
    const toolButton = document.createElement("button");
    toolButton.type = "button";

    // label buttons
    toolButton.textContent = tool.type === "sticker"
      ? `${tool.content}`
      : tool.name;

    // highlight the currently active tool visually
    if (tool === activeTool) {
      toolButton.style.border = "2px solid #2563eb";
      toolButton.style.backgroundColor = "#eff6ff";
      toolButton.style.fontWeight = "bold";
    } else {
      toolButton.style.border = "1px solid #d1d5db";
      toolButton.style.backgroundColor = "#f9fafb";
    }

    // clicking tool = select it
    toolButton.addEventListener("click", () => {
      activeTool = tool;

      // if the user clicks a pen tool, sync the slider/color picker to match it
      if (tool.type === "pen" && tool.appearance) {
        toolAppearance.width = tool.appearance.width;
        toolAppearance.color = tool.appearance.color;
        strokeWidthSlider.value = String(tool.appearance.width);
        strokeWidthText.textContent = "Stroke Thickness: " +
          tool.appearance.width;
        colorPicker.value = tool.appearance.color;
      }

      renderToolPalette(); // Re-render palette to update active highlights
    });

    toolPalette.append(toolButton);
  }
}

// setup stoke contolls
const strokeControlls = document.createElement("div");
strokeControlls.style.display = "flex";
strokeControlls.style.alignItems = "center";
strokeControlls.style.gap = "5px";

// stroke width text
const strokeWidthText = document.createElement("span");
strokeWidthText.textContent = "Stroke Thickness: 4";

// setup stroke thickness slider and its logic
const strokeWidthSlider = document.createElement("input");
strokeWidthSlider.type = "range";
strokeWidthSlider.min = "1";
strokeWidthSlider.max = "30";
strokeWidthSlider.value = "4";
strokeWidthSlider.step = "1";
strokeWidthSlider.addEventListener("input", () => {
  strokeWidthText.textContent = "Stroke Thickness: " + strokeWidthSlider.value;
  const width = parseInt(strokeWidthSlider.value, 10);
  toolAppearance.width = width;
  if (activeTool.type === "pen" && activeTool.appearance) {
    activeTool.appearance.width = width;
  }
});

// setup stroke color picker text
const colorLabel = document.createElement("span");
colorLabel.textContent = "Pen Color:";

// setup the color picker and its logic
const colorPicker = document.createElement("input");
colorPicker.type = "color";
colorPicker.value = "#000000"; // Default color (black)
toolAppearance.color = colorPicker.value; // set color to ensure no bug
colorPicker.addEventListener("input", (e) => {
  const selectedColor = (e.target as HTMLInputElement).value;
  toolAppearance.color = selectedColor;
  if (activeTool.type === "pen" && activeTool.appearance) {
    activeTool.appearance.color = selectedColor;
  }
});

// actually add stroke controlls to the page
strokeControlls.append(
  strokeWidthText,
  strokeWidthSlider,
  colorLabel,
  colorPicker,
);
app.append(strokeControlls);

// drawing vars
let isDrawing = false;
let activeItem: DrawingItem | null = null;
let lastPoint: Point | null = null;
const undoStack: DrawingItem[][] = [];
const redoStack: DrawingItem[][] = [];

function cloneDrawingItem(item: DrawingItem): DrawingItem {
  if (item.kind === "path") {
    return {
      kind: "path",
      id: item.id,
      points: item.points.map((point) => ({ ...point })),
      appearance: { ...item.appearance },
    };
  } else {
    return {
      kind: "sticker",
      id: item.id,
      x: item.x,
      y: item.y,
      content: item.content,
      fontSize: item.fontSize,
    };
  }
}

function cloneDrawingItems(items: DrawingItem[]): DrawingItem[] {
  return items.map((item) => cloneDrawingItem(item));
}

function updateHistoryButtons() {
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  undoButton.disabled = !canUndo;
  undoButton.setAttribute("aria-disabled", String(!canUndo));
  redoButton.disabled = !canRedo;
  redoButton.setAttribute("aria-disabled", String(!canRedo));
}

function getCanvasPoint(event: PointerEvent): Point {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
  };
}

function drawItem(item: DrawingItem) {
  if (item.kind === "path") {
    if (item.points.length === 0) return;

    context.beginPath();
    context.moveTo(item.points[0].x, item.points[0].y);

    for (let index = 1; index < item.points.length; index += 1) {
      context.lineTo(item.points[index].x, item.points[index].y);
    }

    context.lineCap = item.appearance.cap;
    context.lineJoin = item.appearance.join;
    context.lineWidth = item.appearance.width;
    context.strokeStyle = item.appearance.color;
    context.stroke();
  } else if (item.kind === "sticker") {
    // code for now untill there is better render stuff for stickers
    context.font = `${item.fontSize || 32}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(item.content, item.x, item.y);
  }
}

function renderDocument() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (const item of documentCollection.items) {
    drawItem(item);
  }

  if (
    activeItem && activeItem.kind === "path" && activeItem.points.length > 0
  ) {
    drawItem(activeItem);
  }
}

// finish stroke capture
function finishStroke(event: PointerEvent) {
  if (!isDrawing || !activeItem) {
    return;
  }

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  if (activeItem.kind === "path" && activeItem.points.length > 0) {
    undoStack.push(cloneDrawingItems(documentCollection.items));
    documentCollection.items = [
      ...documentCollection.items,
      cloneDrawingItem(activeItem),
    ];
    redoStack.length = 0;
  }

  isDrawing = false;
  activeItem = null;
  lastPoint = null;
  renderDocument();
  updateHistoryButtons();
}

// start stroke capture
canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const point = getCanvasPoint(event);

  if (activeTool.type === "pen") {
    // if pen start a stroke and apply all the settings
    activeItem = {
      kind: "path",
      id: crypto.randomUUID(),
      points: [point],
      appearance: activeTool.appearance
        ? { ...activeTool.appearance }
        : { ...toolAppearance },
    };
    isDrawing = true;
    lastPoint = point;
    canvas.setPointerCapture(event.pointerId);
    renderDocument();
  } else if (activeTool.type === "sticker") {
    // if sticker Commit directly to history on click
    undoStack.push(cloneDrawingItems(documentCollection.items));

    const newSticker: StickerItem = {
      kind: "sticker",
      id: crypto.randomUUID(),
      x: point.x,
      y: point.y,
      content: activeTool.content || "⭐",
      fontSize: activeTool.fontSize || 32,
    };

    documentCollection.items = [...documentCollection.items, newSticker];
    redoStack.length = 0;

    renderDocument();
    updateHistoryButtons();
  }
});

// continued capture of stroke
canvas.addEventListener("pointermove", (event) => {
  if (!isDrawing || !activeItem || activeItem.kind !== "path" || !lastPoint) {
    return;
  }

  const point = getCanvasPoint(event);
  activeItem.points.push(point);
  lastPoint = point;
  renderDocument();
});

// detections to stop capturing stroke
canvas.addEventListener("pointerup", finishStroke);
canvas.addEventListener("pointerleave", (event) => {
  if (isDrawing && !canvas.hasPointerCapture(event.pointerId)) {
    finishStroke(event);
  }
});

// cancle stroke
canvas.addEventListener("pointercancel", (event) => {
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  isDrawing = false;
  activeItem = null;
  lastPoint = null;
  renderDocument();
});

app.setAttribute(
  "aria-label",
  "Drawing application with retained document model",
);

updateHistoryButtons();
renderDocument();
renderToolPalette();
