# Line Intersection

[![Hits](https://hitcount.dev/p/hugoassisj/intersects.svg)](https://hitcount.dev/p/hugoassisj/intersects)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-yellow?logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![P5.js](https://img.shields.io/badge/P5.js-1.7-ED225D?logo=p5.js)](https://p5js.org/)

Interactive visualization: find where a line through two points meets a chosen **x**-coordinate, with movable **y**-constraints.

![Demo](/Tool.gif)

## What it does

- **2D space**: Two draggable points (P1, P2) define the line.
- **Target X**: A vertical line you move with a slider; the intersection is where the line meets this x.
- **Y constraints**: Y min / Y max limit where the intersection point is drawn; the yellow point is clamped to this band. When clamped, the dashed path is shown in a different color.
- **Export & share**: Download the diagram as PNG; the URL updates so you can share or bookmark a configuration.

## How to use

1. **Drag** either endpoint (P1 or P2) to change the line.
2. Use **Constraints** to set the y-range (band) for the intersection.
3. Use **Target X** to move the vertical line and see the intersection move.
4. Use **Export as PNG** to download the current diagram.
5. Copy the URL to share or bookmark a configuration.

## Math

The line through two points $(x_1, y_1)$ and $(x_2, y_2)$ has slope and intercept:

$$
m = \frac{y_1 - y_2}{x_1 - x_2}, \qquad b = y_2 - m\,x_2.
$$

So the line is $y = mx + b$. At a given **x**, the intersection **y** is:

$$
y = m \cdot x + b.
$$

| Case | Behaviour |
|------|-----------|
| **Vertical line** ($x_1 = x_2$) | No single **y** at that **x**; no intersection point is drawn. |
| **Outside band** | **y** is clamped to the constraint band; dashed path is shown in a different color. |

## Development

### Run locally

**Option A: Direct:** Open `index.html` in a browser (some features may be limited with `file://`).

**Option B: Local server:**

```bash
npx serve .
```

Then open the URL shown (e.g. `http://localhost:3000`).

### Project structure

| File         | Purpose |
|--------------|--------|
| `index.html` | Entry point: layout, controls, P5 script. |
| `main.js`    | Diagram logic: config, state, intersection math, drawing, UI sync, export, URL state. |
| `styles.css` | Design tokens, layout, control cards, responsive and reduced-motion rules. |

### Tech stack

- **P5.js** (CDN): Canvas and interaction.
- **Vanilla JS**: Single IIFE, one global (`IntersectsApp`) for the P5 lifecycle.
- **No build step**: JSDoc for types and documentation.

### URL state

State is encoded in the query string so configurations can be shared or bookmarked:

```
?x=300&c=2&p1=500,400&p2=200,300
```