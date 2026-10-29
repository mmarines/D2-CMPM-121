const app = document.querySelector<HTMLElement>("#app")!;

document.body.style.margin = "0";
document.body.style.minHeight = "100vh";
document.body.style.display = "grid";
document.body.style.placeItems = "center";
document.body.style.background = "#e5e7eb";

const canvas = document.createElement("canvas");
canvas.width = 640;
canvas.height = 480;
canvas.setAttribute("aria-label", "Drawing Canvas");
canvas.style.display = "block";
canvas.style.width = "640px";
canvas.style.height = "480px";
canvas.style.background = "#ffffff";
canvas.style.border = "2px solid #111827";
canvas.style.borderRadius = "16px";
canvas.style.boxShadow = "0 20px 50px rgba(15, 23, 42, 0.18)";
canvas.style.cursor = "crosshair";
canvas.style.touchAction = "none";

const context = canvas.getContext("2d");
if (!context) {
  throw new Error("Canvas 2D context is unavailable.");
}

context.lineCap = "round";
context.lineJoin = "round";
context.lineWidth = 4;
context.strokeStyle = "#111827";

app.style.display = "grid";
app.style.placeItems = "center";
app.append(canvas);

let isDrawing = false;
let lastPoint: { x: number; y: number } | null = null;

function getCanvasPoint(event: PointerEvent) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
  };
}

function stopDrawing() {
  isDrawing = false;
  lastPoint = null;
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const point = getCanvasPoint(event);
  isDrawing = true;
  lastPoint = point;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!isDrawing || !lastPoint) {
    return;
  }

  const point = getCanvasPoint(event);
  context.beginPath();
  context.moveTo(lastPoint.x, lastPoint.y);
  context.lineTo(point.x, point.y);
  context.stroke();
  lastPoint = point;
});

function finishGesture(event: PointerEvent) {
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  stopDrawing();
}

canvas.addEventListener("pointerup", finishGesture);
canvas.addEventListener("pointerleave", (event) => {
  if (isDrawing && !canvas.hasPointerCapture(event.pointerId)) {
    finishGesture(event);
  }
});
canvas.addEventListener("pointercancel", (event) => {
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  stopDrawing();
});

app.setAttribute("aria-label", "Editing Application");
