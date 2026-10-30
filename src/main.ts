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

type Tool = {
  id: string;
  name: string;
  type: "pen" | "sticker";
  appearance?: StrokeAppearance;
  content?: string;
  fontSize?: number;
};

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

const DEFAULT_PEN_APPEARANCE: StrokeAppearance = {
  color: "#111827",
  width: 4,
  cap: "round",
  join: "round",
};

const DEFAULT_STICKER_CONTENT = "⭐";
const DEFAULT_STICKER_SIZE = 48;

const toolAppearance: StrokeAppearance = { ...DEFAULT_PEN_APPEARANCE };

class ToolCatalog {
  readonly presetTools: Tool[] = [
    {
      id: "thin-marker",
      name: "Thin Marker",
      type: "pen",
      appearance: { ...DEFAULT_PEN_APPEARANCE },
    },
    {
      id: "bold-marker",
      name: "Bold Marker",
      type: "pen",
      appearance: {
        ...DEFAULT_PEN_APPEARANCE,
        width: 12,
      },
    },
    {
      id: "sticker-star",
      name: "Star Sticker",
      type: "sticker",
      content: "⭐",
      fontSize: 48,
    },
    {
      id: "sticker-heart",
      name: "Heart Sticker",
      type: "sticker",
      content: "💗",
      fontSize: 32,
    },
    {
      id: "sticker-fire",
      name: "Fire Sticker",
      type: "sticker",
      content: "🔥",
      fontSize: 32,
    },
  ];

  readonly customTools: Tool[] = [];
  activeTool: Tool;

  constructor() {
    this.activeTool = this.presetTools[0];
  }

  get tools(): Tool[] {
    return [...this.presetTools, ...this.customTools];
  }

  getDisplayLabel(tool: Tool): string {
    if (tool.type === "pen") {
      return `${tool.name} · ${tool.appearance?.width ?? 4}px`;
    }

    return `${tool.content ?? DEFAULT_STICKER_CONTENT} · ${
      tool.fontSize ?? DEFAULT_STICKER_SIZE
    }px`;
  }

  select(tool: Tool): void {
    this.activeTool = tool;

    if (tool.type === "pen" && tool.appearance) {
      toolAppearance.color = tool.appearance.color;
      toolAppearance.width = tool.appearance.width;
      toolAppearance.cap = tool.appearance.cap;
      toolAppearance.join = tool.appearance.join;
    }
  }

  addCustomSticker(
    content = DEFAULT_STICKER_CONTENT,
    size = DEFAULT_STICKER_SIZE,
  ): Tool {
    const customTool: Tool = {
      id: `custom-sticker-${crypto.randomUUID()}`,
      name: content,
      type: "sticker",
      content,
      fontSize: size,
    };

    this.customTools.push(customTool);
    this.select(customTool);
    return customTool;
  }
}

const toolCatalog = new ToolCatalog();

const documentCollection: DocumentCollection = {
  width: 640,
  height: 480,
  coordinateSystem: "canvas pixels",
  items: [],
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
app.append(canvas);

const historyControls = document.createElement("div");
historyControls.style.display = "flex";
historyControls.style.gap = "0.75rem";
historyControls.style.justifyContent = "center";
historyControls.style.flexWrap = "wrap";

const clearDocumentButton = document.createElement("button");
clearDocumentButton.type = "button";
clearDocumentButton.textContent = "Clear Document";
clearDocumentButton.addEventListener("click", () => {
  if (documentCollection.items.length === 0) {
    return;
  }

  historyManager.commit(documentCollection.items);
  documentCollection.items = [];
  activeItem = null;
  isDrawing = false;
  lastPoint = null;
  renderDocument();
  updateHistoryButtons();
});

const undoButton = document.createElement("button");
undoButton.type = "button";
undoButton.textContent = "Undo";
undoButton.title = "Undo the last completed action";
undoButton.addEventListener("click", () => {
  if (!historyManager.canUndo) {
    return;
  }

  documentCollection.items = historyManager.undo(documentCollection.items);
  activeItem = null;
  isDrawing = false;
  lastPoint = null;
  renderDocument();
  updateHistoryButtons();
});

const redoButton = document.createElement("button");
redoButton.type = "button";
redoButton.textContent = "Redo";
redoButton.title = "Restore the last undone action";
redoButton.addEventListener("click", () => {
  if (!historyManager.canRedo) {
    return;
  }

  documentCollection.items = historyManager.redo(documentCollection.items);
  activeItem = null;
  isDrawing = false;
  lastPoint = null;
  renderDocument();
  updateHistoryButtons();
});

const exportButton = document.createElement("button");
exportButton.type = "button";
exportButton.textContent = "Export as PNG";
exportButton.addEventListener("click", () => {
  renderer.exportAsPng(documentCollection.items, "drawing-export.png");
});

historyControls.append(
  clearDocumentButton,
  undoButton,
  redoButton,
  exportButton,
);
app.append(historyControls);

const toolPalette = document.createElement("div");
toolPalette.style.display = "flex";
toolPalette.style.gap = "0.5rem";
toolPalette.style.justifyContent = "center";
toolPalette.style.flexWrap = "wrap";
app.append(toolPalette);

function renderToolPalette() {
  toolPalette.innerHTML = "";

  for (const tool of toolCatalog.tools) {
    const toolButton = document.createElement("button");
    toolButton.type = "button";
    toolButton.textContent = toolCatalog.getDisplayLabel(tool);
    toolButton.title = tool.name;

    if (tool === toolCatalog.activeTool) {
      toolButton.style.border = "2px solid #2563eb";
      toolButton.style.backgroundColor = "#eff6ff";
      toolButton.style.fontWeight = "bold";
    } else {
      toolButton.style.border = "1px solid #d1d5db";
      toolButton.style.backgroundColor = "#f9fafb";
    }

    toolButton.addEventListener("click", () => {
      toolCatalog.select(tool);
      renderToolPalette();
      renderContextualUI();
    });

    toolPalette.append(toolButton);
  }
}

const contextualControlsContainer = document.createElement("div");
contextualControlsContainer.style.display = "flex";
contextualControlsContainer.style.justifyContent = "center";
contextualControlsContainer.style.alignItems = "center";
contextualControlsContainer.style.gap = "0.75rem";
contextualControlsContainer.style.marginTop = "0.5rem";
app.append(contextualControlsContainer);

function renderContextualUI() {
  contextualControlsContainer.innerHTML = "";

  if (toolCatalog.activeTool.type === "pen") {
    const penControlsDiv = document.createElement("div");
    penControlsDiv.style.display = "flex";
    penControlsDiv.style.alignItems = "center";
    penControlsDiv.style.gap = "8px";

    const strokeWidthText = document.createElement("span");
    strokeWidthText.textContent = `Stroke Thickness: ${
      toolCatalog.activeTool.appearance?.width ?? 4
    }`;

    const strokeWidthSlider = document.createElement("input");
    strokeWidthSlider.type = "range";
    strokeWidthSlider.min = "1";
    strokeWidthSlider.max = "20";
    strokeWidthSlider.step = "1";
    strokeWidthSlider.value = String(
      toolCatalog.activeTool.appearance?.width ?? DEFAULT_PEN_APPEARANCE.width,
    );
    strokeWidthSlider.addEventListener("input", () => {
      const width = Number.parseInt(strokeWidthSlider.value, 10);
      strokeWidthText.textContent = `Stroke Thickness: ${width}`;
      toolAppearance.width = width;
      if (toolCatalog.activeTool.appearance) {
        toolCatalog.activeTool.appearance.width = width;
      }
      renderToolPalette();
    });

    const colorLabel = document.createElement("span");
    colorLabel.textContent = "Pen Color:";

    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.value = toolCatalog.activeTool.appearance?.color ?? "#111827";
    colorPicker.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      const selectedColor = target.value;
      toolAppearance.color = selectedColor;
      if (toolCatalog.activeTool.appearance) {
        toolCatalog.activeTool.appearance.color = selectedColor;
      }
    });

    penControlsDiv.append(
      strokeWidthText,
      strokeWidthSlider,
      colorLabel,
      colorPicker,
    );
    contextualControlsContainer.append(penControlsDiv);
    return;
  }

  const stickerControlsDiv = document.createElement("div");
  stickerControlsDiv.style.display = "flex";
  stickerControlsDiv.style.alignItems = "center";
  stickerControlsDiv.style.gap = "8px";

  const editLabel = document.createElement("span");
  editLabel.textContent = "Edit Sticker:";

  const stickerEditInput = document.createElement("input");
  stickerEditInput.type = "text";
  stickerEditInput.value = toolCatalog.activeTool.content ||
    DEFAULT_STICKER_CONTENT;
  stickerEditInput.maxLength = 10;
  stickerEditInput.style.padding = "4px 8px";
  stickerEditInput.addEventListener("input", () => {
    toolCatalog.activeTool.content = stickerEditInput.value ||
      DEFAULT_STICKER_CONTENT;
    toolCatalog.activeTool.name = stickerEditInput.value ||
      DEFAULT_STICKER_CONTENT;
    renderToolPalette();
  });

  const currentSize = toolCatalog.activeTool.fontSize ?? DEFAULT_STICKER_SIZE;

  const sizeText = document.createElement("span");
  sizeText.textContent = `Size: ${currentSize}px`;

  const sizeSlider = document.createElement("input");
  sizeSlider.type = "range";
  sizeSlider.min = "12";
  sizeSlider.max = "128";
  sizeSlider.step = "1";
  sizeSlider.value = String(currentSize);
  sizeSlider.addEventListener("input", () => {
    const selectedSize = Number.parseInt(sizeSlider.value, 10);
    toolCatalog.activeTool.fontSize = selectedSize;
    sizeText.textContent = `Size: ${selectedSize}px`;
  });

  const addNewButton = document.createElement("button");
  addNewButton.type = "button";
  addNewButton.textContent = "Add New Sticker";
  addNewButton.addEventListener("click", () => {
    const customSticker = toolCatalog.addCustomSticker(
      DEFAULT_STICKER_CONTENT,
      DEFAULT_STICKER_SIZE,
    );
    toolCatalog.select(customSticker);
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

class HistoryManager {
  private readonly undoStack: DrawingItem[][] = [];
  private readonly redoStack: DrawingItem[][] = [];

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  commit(items: DrawingItem[]): void {
    this.undoStack.push(cloneDrawingItems(items));
    this.redoStack.length = 0;
  }

  undo(items: DrawingItem[]): DrawingItem[] {
    if (!this.canUndo) {
      return items;
    }

    this.redoStack.push(cloneDrawingItems(items));
    return this.undoStack.pop() ?? items;
  }

  redo(items: DrawingItem[]): DrawingItem[] {
    if (!this.canRedo) {
      return items;
    }

    this.undoStack.push(cloneDrawingItems(items));
    return this.redoStack.pop() ?? items;
  }
}

const historyManager = new HistoryManager();

class CanvasRenderer {
  constructor(
    private readonly canvasElement: HTMLCanvasElement,
    private readonly canvasContext: CanvasRenderingContext2D,
  ) {}

  drawItem(item: DrawingItem, ctx = this.canvasContext): void {
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
      ctx.font = `${item.fontSize ?? DEFAULT_STICKER_SIZE}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.content, item.x, item.y);
    }

    ctx.restore();
  }

  renderDocument(items: DrawingItem[], activeItem: DrawingItem | null): void {
    this.canvasContext.clearRect(
      0,
      0,
      this.canvasElement.width,
      this.canvasElement.height,
    );

    for (const item of items) {
      this.drawItem(item, this.canvasContext);
    }

    if (
      activeItem && activeItem.kind === "path" && activeItem.points.length > 0
    ) {
      this.drawItem(activeItem, this.canvasContext);
    }
  }

  exportAsPng(items: DrawingItem[], fileName: string): void {
    const scale = 2;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = this.canvasElement.width * scale;
    exportCanvas.height = this.canvasElement.height * scale;

    const exportContext = exportCanvas.getContext("2d")!;
    exportContext.scale(scale, scale);

    for (const item of items) {
      this.drawItem(item, exportContext);
    }

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, "image/png");
  }
}

const renderer = new CanvasRenderer(canvas, context);

let isDrawing = false;
let activeItem: DrawingItem | null = null;
let lastPoint: Point | null = null;

function cloneDrawingItem(item: DrawingItem): DrawingItem {
  if (item.kind === "path") {
    return {
      kind: "path",
      id: item.id,
      points: item.points.map((point) => ({ ...point })),
      appearance: { ...item.appearance },
    };
  }

  return {
    kind: "sticker",
    id: item.id,
    x: item.x,
    y: item.y,
    content: item.content,
    fontSize: item.fontSize,
  };
}

function cloneDrawingItems(items: DrawingItem[]): DrawingItem[] {
  return items.map((item) => cloneDrawingItem(item));
}

function updateHistoryButtons() {
  const canUndo = historyManager.canUndo;
  const canRedo = historyManager.canRedo;

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

function renderDocument() {
  renderer.renderDocument(documentCollection.items, activeItem);
}

function finishStroke(event: PointerEvent) {
  if (!isDrawing || !activeItem) {
    return;
  }

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  if (activeItem.kind === "path" && activeItem.points.length > 0) {
    historyManager.commit(documentCollection.items);
    documentCollection.items = [
      ...documentCollection.items,
      cloneDrawingItem(activeItem),
    ];
  }

  isDrawing = false;
  activeItem = null;
  lastPoint = null;
  renderDocument();
  updateHistoryButtons();
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();

  const point = getCanvasPoint(event);

  if (toolCatalog.activeTool.type === "pen") {
    activeItem = {
      kind: "path",
      id: crypto.randomUUID(),
      points: [point],
      appearance: toolCatalog.activeTool.appearance
        ? { ...toolCatalog.activeTool.appearance }
        : { ...DEFAULT_PEN_APPEARANCE },
    };
    isDrawing = true;
    lastPoint = point;
    canvas.setPointerCapture(event.pointerId);
    renderDocument();
    return;
  }

  historyManager.commit(documentCollection.items);

  const newSticker: StickerItem = {
    kind: "sticker",
    id: crypto.randomUUID(),
    x: point.x,
    y: point.y,
    content: toolCatalog.activeTool.content || DEFAULT_STICKER_CONTENT,
    fontSize: toolCatalog.activeTool.fontSize || DEFAULT_STICKER_SIZE,
  };

  documentCollection.items = [...documentCollection.items, newSticker];
  renderDocument();
  updateHistoryButtons();
});

canvas.addEventListener("pointermove", (event) => {
  if (!isDrawing || !activeItem || activeItem.kind !== "path" || !lastPoint) {
    return;
  }

  const point = getCanvasPoint(event);
  activeItem.points.push(point);
  lastPoint = point;
  renderDocument();
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
