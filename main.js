/**
 * Line Intersection Visualization
 * Interactive diagram: line through two points meeting a target x, with constraints.
 * @module IntersectsApp
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Configuration & Constants
  // ---------------------------------------------------------------------------

  /** @type {Object} Color palette for the diagram (hex or named colors). */
  const COLOR_PALETTE = {
    background: "#003049",
    point: "#eae2b7",
    /** Saturated red for Y constraint borders. */
    constraintLine: "#ff1744",
    constraintBox: "#ff1744",
    intersection: "#fcbf49",
    /** Path when intersection is within band (on the line). */
    arrow: "#f77f00",
    /** Path when saturated/clamped — different color to show "off". */
    pathWhenClamped: "#b0a090",
    grid: "rgba(255, 255, 255, 0.06)",
    label: "#ffffff",
  };

  /** @type {Object} Configuration for diagram and UI. */
  const CONFIG = {
    pointRadius: 12,
    pointDragRadius: 44,
    constraintBoxDimensions: [48, 2],
    constraintBoxRadius: 4,
    uiStripHeight: 60,
    canvasTopMargin: 4,
    gridStep: 16,
    /** Epsilon for treating line as vertical (delta x). */
    verticalLineEpsilon: 1e-6,
    /** Equal margin from all canvas edges (fraction of min dimension), min pixels */
    canvasMarginFraction: 0.06,
    canvasMarginMin: 20,
    /** Constraint slider: 1 = full band, 4 = narrowest band (within margin). */
    constraintsSliderMin: 1,
    constraintsSliderMax: 4,
    defaultConstraintsValue: 3,
    /** Dash segment length and gap for path line (pixels). */
    dashLength: 12,
    dashGap: 8,
    labelOffsetX: 20,
    labelOffsetY: 10,
    labelSize: 11,
  };

  /** @type {Object} Single app state. */
  let appState = {
    startPoint: null,
    endPoint: null,
    targetX: 0.5,
    constraintSliderValue: CONFIG.defaultConstraintsValue,
    canvasWidth: 0,
    canvasHeight: 0,
  };

  // ---------------------------------------------------------------------------
  // Calculation
  // ---------------------------------------------------------------------------

  /**
   * Compute y where the line through P1 and P2 intersects the vertical line at x.
   * @param {p5.Vector} startPoint - First point on the line.
   * @param {p5.Vector} endPoint - Second point on the line.
   * @param {number} targetX - X coordinate of the vertical line.
   * @returns {{ y: number|null, isVertical: boolean, m: number|null, b: number|null }}
   */
  function calculateLineIntersectionAtX(startPoint, endPoint, targetX) {
    // Match original: alpha = (P1.y - P2.y) / (P1.x - P2.x), b = P2.y - alpha*P2.x, y = alpha*x + b
    const dx = startPoint.x - endPoint.x;
    const isVertical = Math.abs(dx) < CONFIG.verticalLineEpsilon;
    if (isVertical) {
      return { y: null, isVertical: true, m: null, b: null };
    }
    const m = (startPoint.y - endPoint.y) / dx;
    const b = endPoint.y - m * endPoint.x;
    const y = m * targetX + b;
    return { y, isVertical: false, m, b };
  }

  /**
   * Margin from canvas edges (equal on all sides).
   * @param {number} width - Canvas width.
   * @param {number} height - Canvas height.
   * @returns {number} Margin in pixels.
   */
  function getCanvasMargin(width, height) {
    const minDim = Math.min(width, height);
    return Math.max(CONFIG.canvasMarginMin, minDim * CONFIG.canvasMarginFraction);
  }

  /**
   * Map constraint slider value (1–4) to top Y and bottom Y of the allowed band,
   * within the canvas margin so there is equal distance from top and bottom.
   * @param {number} value - Slider value in [1, 4].
   * @param {number} height - Canvas height.
   * @param {number} margin - Margin from top/bottom.
   * @returns {[number, number]} [topY, bottomY]
   */
  function getConstraintBounds(value, height, margin) {
    const innerH = height - 2 * margin;
    const topY = margin + (value * innerH) / 10;
    const bottomY = height - margin - (value * innerH) / 10;
    return [topY, bottomY];
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  /**
   * Draw a draggable point (circle) with subtle glow and outline for visibility.
   * @param {p5.Vector} position - Center of the point.
   * @param {string} fillColor - Fill color (hex or named).
   */
  function drawPoint(position, fillColor) {
    push();
    const r = CONFIG.pointRadius;
    noStroke();
    fill(fillColor);
    ellipse(position.x, position.y, r * 2, r * 2);
    // Thin outline for contrast
    noFill();
    stroke(255, 255, 255, 120);
    strokeWeight(1);
    ellipse(position.x, position.y, r * 2, r * 2);
    pop();
  }

  /**
   * Draw the vertical constraint line at x between topY and bottomY (saturated red).
   * Yellow point must not go beyond this band. Outer stroke for visibility.
   */
  function drawConstraintLine(x, topY, bottomY) {
    noFill();
    stroke(COLOR_PALETTE.constraintLine);
    strokeWeight(2);
    line(x, topY, x, bottomY);
  }

  /**
   * Draw one constraint cap (Y min or Y max) — saturated red; yellow point cannot pass.
   * White outline for clarity on dark background.
   */
  function drawConstraintBox(x, y) {
    const [w, h] = CONFIG.constraintBoxDimensions;
    rectMode(CENTER);
    noStroke();
    fill(COLOR_PALETTE.constraintBox);
    rect(x, y, w, h, CONFIG.constraintBoxRadius);
  }

  /**
   * Draw a dashed line segment (path) between two points.
   * @param {p5.Vector} startPoint - First point.
   * @param {p5.Vector} endPoint - Second point.
   * @param {string} color - Stroke color.
   */
  function drawDashedLineSegment(startPoint, endPoint, color) {
    stroke(color);
    strokeWeight(2);
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return;
    const ux = dx / len;
    const uy = dy / len;
    const dash = CONFIG.dashLength;
    const gap = CONFIG.dashGap;
    let t = 0;
    while (t < len) {
      const t1 = Math.min(t + dash, len);
      line(
        startPoint.x + ux * t,
        startPoint.y + uy * t,
        startPoint.x + ux * t1,
        startPoint.y + uy * t1
      );
      t = t1 + gap;
    }
  }

  /**
   * Draw a label next to a point.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {string} text - Label text.
   * @param {string} [horizontalAlign='left'] - 'left', 'center', or 'right'.
   * @param {number} [verticalOffset=0] - Offset from point (positive = down).
   */
  function drawLabel(x, y, labelText, horizontalAlign, verticalOffset) {
    const vo = verticalOffset != null ? verticalOffset : -CONFIG.labelOffsetY;
    noStroke();
    fill(COLOR_PALETTE.label);
    textSize(CONFIG.labelSize);
    const align = horizontalAlign === "center" ? 1 : horizontalAlign === "right" ? 2 : 0;
    textAlign(align);
    text(labelText, x, y + vo);
  }

  /**
   * Draw a subtle grid in the canvas area.
   * @param {number} width - Canvas width.
   * @param {number} height - Canvas height.
   */
  function drawGrid(width, height) {
    const step = CONFIG.gridStep;
    stroke(COLOR_PALETTE.grid);
    strokeWeight(1);
    for (let x = 0; x <= width; x += step) {
      line(Math.round(x), 0, Math.round(x), Math.round(height));
    }
    for (let y = 0; y <= height; y += step) {
      line(0, Math.round(y), Math.round(width), Math.round(y));
    }
  }

  // ---------------------------------------------------------------------------
  // UI helpers (DOM)
  // ---------------------------------------------------------------------------

  /**
   * Sync app state from DOM sliders.
   */
  function syncStateFromSliders() {
    const cSlider = document.getElementById("constraints-slider");
    const xSlider = document.getElementById("desired-x-slider");
    if (cSlider) {
      appState.constraintSliderValue = parseFloat(cSlider.value);
    }
    if (xSlider) {
      const x = parseFloat(xSlider.value);
      if (!isNaN(x)) appState.targetX = x;
    }
  }

  /**
   * Update Target X slider min/max from canvas content area and clamp targetX.
   * Call from draw() so slider range matches current canvas with equal margins.
   */
  function updateTargetXSliderBounds() {
    const w = appState.canvasWidth;
    const h = appState.canvasHeight;
    if (w < 1 || h < 1) return;
    const margin = getCanvasMargin(w, h);
    const contentLeft = margin;
    const contentRight = w - margin;
    const xSlider = document.getElementById("desired-x-slider");
    if (xSlider) {
      const minStr = String(Math.round(contentLeft));
      const maxStr = String(Math.round(contentRight));
      if (xSlider.min !== minStr) xSlider.min = minStr;
      if (xSlider.max !== maxStr) xSlider.max = maxStr;
      appState.targetX = constrain(appState.targetX, contentLeft, contentRight);
      xSlider.value = appState.targetX;
    }
  }

  /**
   * Update DOM output elements for slider values.
   */
  function updateSliderOutputs() {
    const cVal = document.getElementById("constraints-value");
    const xVal = document.getElementById("desired-x-value");
    if (cVal) {
      const mapped = (10 - appState.constraintSliderValue).toFixed(2);
      cVal.textContent = `Range: ${mapped}`;
    }
    if (xVal) {
      xVal.textContent = appState.targetX;
    }
  }

  /**
   * Serialize current state to URL query params and replace state.
   */
  function pushStateToUrl() {
    if (typeof history === "undefined" || !history.replaceState) return;
    const p1 = appState.startPoint;
    const p2 = appState.endPoint;
    const params = new URLSearchParams();
    params.set("x", String(Math.round(appState.targetX)));
    params.set("c", String(appState.constraintSliderValue));
    params.set("p1", `${Math.round(p1.x)},${Math.round(p1.y)}`);
    params.set("p2", `${Math.round(p2.x)},${Math.round(p2.y)}`);
    const url = `${window.location.pathname}?${params.toString()}`;
    history.replaceState(null, "", url);
  }

  /**
   * Parse URL query params and apply to state (and sliders) if valid.
   */
  function readStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const x = params.get("x");
    const c = params.get("c");
    const p1 = params.get("p1");
    const p2 = params.get("p2");
    const w = appState.canvasWidth;
    const h = appState.canvasHeight;
    if (x != null && w > 0 && h > 0) {
      const v = parseFloat(x);
      if (!isNaN(v)) {
        const margin = getCanvasMargin(w, h);
        appState.targetX = constrain(v, margin, w - margin);
      }
    } else if (x != null) {
      const v = parseFloat(x);
      if (!isNaN(v)) appState.targetX = v;
    }
    if (c != null) {
      const v = parseFloat(c);
      if (!isNaN(v)) appState.constraintSliderValue = constrain(v, CONFIG.constraintsSliderMin, CONFIG.constraintsSliderMax);
    }
    if (p1 != null && appState.startPoint) {
      const [px, py] = p1.split(",").map(Number);
      if (px != null && py != null && !isNaN(px) && !isNaN(py)) {
        appState.startPoint.set(constrain(px, 0, w), constrain(py, 0, h));
      }
    }
    if (p2 != null && appState.endPoint) {
      const [px, py] = p2.split(",").map(Number);
      if (px != null && py != null && !isNaN(px) && !isNaN(py)) {
        appState.endPoint.set(constrain(px, 0, w), constrain(py, 0, h));
      }
    }
    const cSlider = document.getElementById("constraints-slider");
    const xSlider = document.getElementById("desired-x-slider");
    if (cSlider) cSlider.value = appState.constraintSliderValue;
    if (xSlider) xSlider.value = appState.targetX;
  }

  // ---------------------------------------------------------------------------
  // P5 lifecycle
  // ---------------------------------------------------------------------------

  function setup() {
    const container = document.getElementById("sketch-container");
    const chromeHeight = 140;
    function getCanvasSize() {
      if (container && container.clientWidth > 0 && container.clientHeight > 0) {
        return { w: container.clientWidth, h: container.clientHeight };
      }
      return {
        w: windowWidth,
        h: Math.max(280, windowHeight - chromeHeight)
      };
    }
    let { w: canvasWidth, h: canvasHeight } = getCanvasSize();
    appState.canvasWidth = canvasWidth;
    appState.canvasHeight = canvasHeight;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    if (container) {
      canvas.parent("sketch-container");
      // Keep drawable area in sync with container so it always fills the blue area
      const observer = new ResizeObserver(function () {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w < 10 || h < 10) return;
        const oldW = appState.canvasWidth;
        const oldH = appState.canvasHeight;
        if (Math.abs(w - oldW) < 2 && Math.abs(h - oldH) < 2) return;
        resizeCanvas(w, h);
        appState.canvasWidth = w;
        appState.canvasHeight = h;
        if (appState.startPoint && appState.endPoint && oldW > 0 && oldH > 0) {
          const sx = w / oldW;
          const sy = h / oldH;
          appState.startPoint.x = constrain(appState.startPoint.x * sx, 0, w);
          appState.startPoint.y = constrain(appState.startPoint.y * sy, 0, h);
          appState.endPoint.x = constrain(appState.endPoint.x * sx, 0, w);
          appState.endPoint.y = constrain(appState.endPoint.y * sy, 0, h);
        }
      });
      observer.observe(container);
    }

    const centerY = canvasHeight / 2;
    appState.startPoint = createVector((5 * canvasWidth) / 6, centerY);
    appState.endPoint = createVector((2 * canvasWidth) / 6, centerY);
    appState.constraintSliderValue = CONFIG.defaultConstraintsValue;
    appState.targetX = 125;
    readStateFromUrl();

    const cSlider = document.getElementById("constraints-slider");
    const xSlider = document.getElementById("desired-x-slider");
    if (cSlider) {
      cSlider.addEventListener("input", function () {
        syncStateFromSliders();
        pushStateToUrl();
      });
    }
    if (xSlider) {
      xSlider.addEventListener("input", function () {
        syncStateFromSliders();
        pushStateToUrl();
      });
    }

    const exportBtn = document.getElementById("export-png-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        const c = document.querySelector("#sketch-container canvas");
        if (c && c.toDataURL) {
          const link = document.createElement("a");
          link.download = "line-intersection.png";
          link.href = c.toDataURL("image/png");
          link.click();
        }
      });
    }
  }

  function draw() {
    if (!appState.startPoint || !appState.endPoint) return;
    try {
      const w = appState.canvasWidth;
      const h = appState.canvasHeight;
      updateTargetXSliderBounds();
      syncStateFromSliders();
      const margin = getCanvasMargin(w, h);
      const [constraintTop, constraintBottom] = getConstraintBounds(appState.constraintSliderValue, h, margin);
      const targetX = appState.targetX;
      const halfPoint = CONFIG.pointRadius / 2;
      const halfBox = CONFIG.constraintBoxDimensions[1] / 2;
      const lineTop = constraintTop - halfPoint - halfBox;
      const lineBottom = constraintBottom + halfPoint + halfBox;

      background(COLOR_PALETTE.background);
      drawGrid(w, h);
      updateSliderOutputs();

      const result = calculateLineIntersectionAtX(
        appState.startPoint,
        appState.endPoint,
        targetX
      );

      const rawY = result.y;
      let displayY = rawY;
      let isClamped = false;
      if (!result.isVertical && rawY != null) {
        displayY = constrain(rawY, constraintTop, constraintBottom);
        isClamped = Math.abs(displayY - rawY) > 1e-6;
      }

      const intersectionPoint = (!result.isVertical && rawY != null)
        ? createVector(targetX, displayY)
        : null;

      const pathColor = isClamped ? COLOR_PALETTE.pathWhenClamped : COLOR_PALETTE.arrow;
      if (intersectionPoint) {
        drawDashedLineSegment(appState.startPoint, intersectionPoint, pathColor);
        drawDashedLineSegment(intersectionPoint, appState.endPoint, pathColor);
      } else {
        drawDashedLineSegment(appState.startPoint, appState.endPoint, pathColor);
      }

      drawPoint(appState.startPoint, COLOR_PALETTE.point);
      drawPoint(appState.endPoint, COLOR_PALETTE.point);

      stroke(COLOR_PALETTE.constraintLine);
      fill(COLOR_PALETTE.constraintBox);
      drawConstraintLine(targetX, lineTop, lineBottom);
      drawConstraintBox(targetX, lineTop);
      drawConstraintBox(targetX, lineBottom);

      if (intersectionPoint) {
        drawPoint(intersectionPoint, COLOR_PALETTE.intersection);
      }

      const ox = CONFIG.labelOffsetX;
      const oy = CONFIG.labelOffsetY;
      drawLabel(appState.startPoint.x + ox, appState.startPoint.y, "P1", "left", -oy);
      drawLabel(appState.endPoint.x - ox, appState.endPoint.y, "P2", "right", -oy);
      if (intersectionPoint) {
        drawLabel(targetX + ox, displayY, "y", "left", 0);
      }
      drawLabel(targetX - ox, lineTop, "Y min", "center", -oy);
      drawLabel(targetX -ox, lineBottom , "Y max", "center", oy);
    } catch (_err) {
      // Prevent a single frame error from breaking the sketch
    }
  }

  function mouseDragged() {
    const stripHeight = CONFIG.uiStripHeight;
    if (mouseY >= windowHeight - stripHeight) return;

    const startPoint = appState.startPoint;
    const endPoint = appState.endPoint;
    const r = CONFIG.pointDragRadius;

    if (dist(mouseX, mouseY, startPoint.x, startPoint.y) < r) {
      startPoint.x = mouseX;
      startPoint.y = mouseY;
      pushStateToUrl();
    } else if (dist(mouseX, mouseY, endPoint.x, endPoint.y) < r) {
      endPoint.x = mouseX;
      endPoint.y = mouseY;
      pushStateToUrl();
    }
  }

  // Expose to global P5
  window.IntersectsApp = {
    setup,
    draw,
    mouseDragged,
  };
})();

// P5 global callbacks
function setup() {
  if (window.IntersectsApp) window.IntersectsApp.setup();
}
function draw() {
  if (window.IntersectsApp) window.IntersectsApp.draw();
}
function mouseDragged() {
  if (window.IntersectsApp) window.IntersectsApp.mouseDragged();
}
