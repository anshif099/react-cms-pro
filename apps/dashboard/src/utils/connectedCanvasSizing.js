const DEFAULT_VIEWPORT_PADDING = 32;
const DEFAULT_FIT_GAP = 4;
const DEFAULT_MIN_FRAME_HEIGHT = 700;

function finiteNonNegative(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

export function calculateConnectedCanvasSizing({
  viewportWidth,
  viewportHeight,
  canvasWidth,
  viewportPadding = DEFAULT_VIEWPORT_PADDING,
  fitGap = DEFAULT_FIT_GAP,
  minFrameHeight = DEFAULT_MIN_FRAME_HEIGHT
}) {
  const safeCanvasWidth = Math.max(1, finiteNonNegative(canvasWidth, 1440));
  const reservedSpace = finiteNonNegative(viewportPadding)
    + finiteNonNegative(fitGap);
  const availableWidth = Math.max(
    0,
    finiteNonNegative(viewportWidth) - reservedSpace
  );
  const availableHeight = Math.max(
    0,
    finiteNonNegative(viewportHeight) - reservedSpace
  );
  const scale = availableWidth > 0
    ? Math.min(1, availableWidth / safeCanvasWidth)
    : 1;
  const frameHeight = Math.max(
    finiteNonNegative(minFrameHeight, DEFAULT_MIN_FRAME_HEIGHT),
    scale > 0 ? availableHeight / scale : DEFAULT_MIN_FRAME_HEIGHT
  );

  return {
    scale,
    frameHeight,
    layoutWidth: safeCanvasWidth * scale,
    layoutHeight: frameHeight * scale
  };
}

