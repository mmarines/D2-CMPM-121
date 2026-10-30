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
    name: "⭐",
    type: "sticker",
    content: "⭐",
    fontSize: 256,
  },
  {
    id: "sticker-heart",
    name: "❤️",
    type: "sticker",
    content: "❤️",
    fontSize: 32,
  },
  {
    id: "sticker-fire",
    name: "🔥",
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

// setup PNG export button and logic
const exportButton = document.createElement("button");
exportButton.type = "button";
exportButton.textContent = "Export as PNG";
exportButton.addEventListener("click", () => {
  const scale = 2;
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = documentCollection.width * scale;
  exportCanvas.height = documentCollection.height * scale;
  const exportCtx = exportCanvas.getContext("2d")!;
  // map document coordinates to the larger export canvas dimensions
  exportCtx.scale(scale, scale);

  // replay committed command objects against the export context
  for (const item of documentCollection.items) {
    drawItem(item, exportCtx);
  }

  exportCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "drawing-export.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, "image/png");
});

// actually add history controlls to the page (and also the export button)
historyControls.append(
  clearDocumentButton,
  undoButton,
  redoButton,
  exportButton,
);
app.append(historyControls);

// setup tool pallet
const toolPalette = document.createElement("div");
toolPalette.style.display = "flex";
toolPalette.style.gap = "0.5rem";
toolPalette.style.justifyContent = "center";
toolPalette.style.flexWrap = "wrap";
app.append(toolPalette);

function renderToolPalette() {
  toolPalette.innerHTML = "";

  for (const tool of tools) {
    const toolButton = document.createElement("button");
    toolButton.type = "button";

    // label buttons
    if (tool.type === "sticker") {
      toolButton.textContent = tool.content || "⭐";
    } else {
      toolButton.textContent = `🖊️ ${tool.appearance?.width}`;
    }

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

      // if the user clicks a pen tool, sync setting appearance
      if (tool.type === "pen" && tool.appearance) {
        toolAppearance.width = tool.appearance.width;
        toolAppearance.color = tool.appearance.color;
      }

      renderToolPalette(); // force new render for highlights
      renderContextualUI();
    });

    toolPalette.append(toolButton);
  }
}

// setup dynamic container for customizing tools based on what kind of tool is selected
const contextualControlsContainer = document.createElement("div");
contextualControlsContainer.style.display = "flex";
contextualControlsContainer.style.justifyContent = "center";
contextualControlsContainer.style.alignItems = "center";
contextualControlsContainer.style.gap = "0.75rem";
contextualControlsContainer.style.marginTop = "0.5rem";
app.append(contextualControlsContainer);

// function that renders the correct UI panel based on whether activeTool is a pen or a sticker (should prob rename)
function renderContextualUI() {
  contextualControlsContainer.innerHTML = "";

  if (activeTool.type === "pen") {
    // pen setttings UI
    const penControlsDiv = document.createElement("div");
    penControlsDiv.style.display = "flex";
    penControlsDiv.style.alignItems = "center";
    penControlsDiv.style.gap = "8px";

    const strokeWidthText = document.createElement("span");
    strokeWidthText.textContent = `Stroke Thickness: ${
      activeTool.appearance?.width || 4
    }`;

    const strokeWidthSlider = document.createElement("input");
    strokeWidthSlider.type = "range";
    strokeWidthSlider.min = "1";
    strokeWidthSlider.max = "20";
    strokeWidthSlider.value = String(activeTool.appearance?.width || 4);
    strokeWidthSlider.step = "1";
    strokeWidthSlider.addEventListener("input", () => {
      strokeWidthText.textContent = "Stroke Thickness: " +
        strokeWidthSlider.value;
      const width = parseInt(strokeWidthSlider.value, 10);
      toolAppearance.width = width;
      if (activeTool.appearance) {
        activeTool.appearance.width = width;
      }
      renderToolPalette();
    });

    const colorLabel = document.createElement("span");
    colorLabel.textContent = "Pen Color:";

    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.value = activeTool.appearance?.color || "#000000";
    toolAppearance.color = colorPicker.value;
    colorPicker.addEventListener("input", (e) => {
      const selectedColor = (e.target as HTMLInputElement).value;
      toolAppearance.color = selectedColor;
      if (activeTool.appearance) {
        activeTool.appearance.color = selectedColor;
      }
    });

    penControlsDiv.append(
      strokeWidthText,
      strokeWidthSlider,
      colorLabel,
      colorPicker,
    );
    contextualControlsContainer.append(penControlsDiv);
  } else if (activeTool.type === "sticker") {
    const stickerControlsDiv = document.createElement("div");
    stickerControlsDiv.style.display = "flex";
    stickerControlsDiv.style.alignItems = "center";
    stickerControlsDiv.style.gap = "8px";

    const editLabel = document.createElement("span");
    editLabel.textContent = "Edit Sticker:";

    const stickerEditInput = document.createElement("input");
    stickerEditInput.type = "text";
    stickerEditInput.value = activeTool.content || "";
    stickerEditInput.maxLength = 10;
    stickerEditInput.style.padding = "4px 8px";

    // Modify current sticker button live as the user types
    stickerEditInput.addEventListener("input", () => {
      activeTool.content = stickerEditInput.value;
      activeTool.name = stickerEditInput.value;
      renderToolPalette();
    });

    const currentSize = activeTool.fontSize || 32;

    const sizeText = document.createElement("span");
    sizeText.textContent = `Size: ${currentSize}px`;

    const sizeSlider = document.createElement("input");
    sizeSlider.type = "range";
    sizeSlider.min = "4";
    sizeSlider.max = "256";
    sizeSlider.value = String(currentSize);
    sizeSlider.step = "1";

    sizeSlider.addEventListener("input", () => {
      const selectedSize = parseInt(sizeSlider.value, 10);
      activeTool.fontSize = selectedSize;
      sizeText.textContent = `Size: ${selectedSize}px`;
    });

    const addNewButton = document.createElement("button");
    addNewButton.type = "button";
    addNewButton.textContent = "Add New Sticker";
    addNewButton.addEventListener("click", () => {
      const newCustomTool: Tool = {
        id: `custom-sticker-${crypto.randomUUID()}`,
        name: "✅",
        type: "sticker",
        content: "✅",
        fontSize: 32,
      };
      tools.push(newCustomTool);
      activeTool = newCustomTool;
      renderToolPalette();
      renderContextualUI();
    });

    stickerControlsDiv.append(
      editLabel,
      stickerEditInput,
      sizeText,
      sizeSlider,
      addNewButton,
    );
    contextualControlsContainer.append(stickerControlsDiv);
  }
}

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

function drawItem(item: DrawingItem, ctx: CanvasRenderingContext2D) {
  ctx.save();
  if (item.kind === "path") {
    if (item.points.length === 0) {
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(item.points[0].x, item.points[0].y);

    for (let index = 1; index < item.points.length; index += 1) {
      ctx.lineTo(item.points[index].x, item.points[index].y);
    }

    ctx.lineCap = item.appearance.cap;
    ctx.lineJoin = item.appearance.join;
    ctx.lineWidth = item.appearance.width;
    ctx.strokeStyle = item.appearance.color;
    ctx.stroke();
  } else if (item.kind === "sticker") {
    // render them sicker
    ctx.font = `${item.fontSize || 32}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.content, item.x, item.y);
  }
  ctx.restore();
}

function renderDocument() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (const item of documentCollection.items) {
    drawItem(item, context);
  }

  if (
    activeItem && activeItem.kind === "path" && activeItem.points.length > 0
  ) {
    drawItem(activeItem, context);
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
renderContextualUI();
