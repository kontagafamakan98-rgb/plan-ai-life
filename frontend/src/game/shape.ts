/**
 * Shape: the curve toolkit.
 *
 * Every drawing in the world used to be a rectangle with rounded corners, which
 * is why it read as clip art. A limb is not a rectangle: it is a spine with a
 * width that tapers, bends at a joint and thickens again. So the tools here take
 * a spine (a list of points with a width) and return a real outline, and take a
 * list of points and return a smooth closed curve through all of them.
 *
 * Nothing in this file knows about colour or about React: it turns numbers into
 * path strings, so the figure, the props and the room all draw the same way.
 */

export interface Point {
  x: number;
  y: number;
}

/** A point on a spine, with the full width of the form at that point. */
export interface Node extends Point {
  w: number;
}

/** Two decimals is plenty at this scale and keeps the paths readable. */
const r2 = (value: number) => Math.round(value * 100) / 100;

/**
 * A smooth closed curve through every point (Catmull-Rom, expressed as cubic
 * beziers). Used for blobs: foliage, rocks, cushions, hair masses.
 */
export function smoothClosed(points: Point[], tension = 1): string {
  if (points.length < 2) return '';
  const count = points.length;
  let path = `M ${r2(points[0].x)} ${r2(points[0].y)}`;
  for (let index = 0; index < count; index += 1) {
    const p0 = points[(index - 1 + count) % count];
    const p1 = points[index];
    const p2 = points[(index + 1) % count];
    const p3 = points[(index + 2) % count];
    const c1x = p1.x + (p2.x - p0.x) / (6 * tension);
    const c1y = p1.y + (p2.y - p0.y) / (6 * tension);
    const c2x = p2.x - (p3.x - p1.x) / (6 * tension);
    const c2y = p2.y - (p3.y - p1.y) / (6 * tension);
    path += ` C ${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2.x)} ${r2(p2.y)}`;
  }
  return `${path} Z`;
}

/** The same curve, left open, for strands, veins, folds and folds of cloth. */
export function smoothOpen(points: Point[], tension = 1): string {
  if (points.length < 2) return '';
  let path = `M ${r2(points[0].x)} ${r2(points[0].y)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const c1x = p1.x + (p2.x - p0.x) / (6 * tension);
    const c1y = p1.y + (p2.y - p0.y) / (6 * tension);
    const c2x = p2.x - (p3.x - p1.x) / (6 * tension);
    const c2y = p2.y - (p3.y - p1.y) / (6 * tension);
    path += ` C ${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2.x)} ${r2(p2.y)}`;
  }
  return path;
}

/** Offsets a spine by half its width on both sides, following the bends. */
function offsetSides(nodes: Node[]): { left: Point[]; right: Point[] } {
  const left: Point[] = [];
  const right: Point[] = [];
  nodes.forEach((node, index) => {
    const before = nodes[Math.max(0, index - 1)];
    const after = nodes[Math.min(nodes.length - 1, index + 1)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const half = node.w / 2;
    left.push({ x: node.x + nx * half, y: node.y + ny * half });
    right.push({ x: node.x - nx * half, y: node.y - ny * half });
  });
  return { left, right };
}

/**
 * A limb, a trunk, a lock of hair, a scarf: a spine with a width at each node.
 *
 * The outline is the two offset sides joined around both ends, so a tapered
 * forearm and a branch are the same function with different numbers.
 */
export function limbOutline(nodes: Node[]): string {
  if (nodes.length < 2) return '';
  const { left, right } = offsetSides(nodes);
  return smoothClosed([...left, ...right.reverse()]);
}

/**
 * An organic blob: a ring of points whose radius wobbles, so a bush, a rock, a
 * cushion and a cloud all come out of one stable function of a seed.
 */
export function blob(cx: number, cy: number, rx: number, ry: number, seed: number, lobes = 7): string {
  const points: Point[] = [];
  for (let index = 0; index < lobes; index += 1) {
    const angle = (index / lobes) * Math.PI * 2;
    const wobble = 0.86 + (((seed >> (index % 12)) & 7) / 7) * 0.24;
    points.push({ x: cx + Math.cos(angle) * rx * wobble, y: cy + Math.sin(angle) * ry * wobble });
  }
  return smoothClosed(points);
}

/** A four point face, for slabs, panels and the planes of a room. */
export function quad(points: Point[]): string {
  if (points.length < 3) return '';
  let path = `M ${r2(points[0].x)} ${r2(points[0].y)}`;
  for (let index = 1; index < points.length; index += 1) {
    path += ` L ${r2(points[index].x)} ${r2(points[index].y)}`;
  }
  return `${path} Z`;
}

/** A taper: one edge of a fold, thin at one end and thick at the other. */
export function taper(from: Point, to: Point, startWidth: number, bend = 0): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const midX = (from.x + to.x) / 2 + nx * bend;
  const midY = (from.y + to.y) / 2 + ny * bend;
  return smoothClosed(
    [
      { x: from.x + (nx * startWidth) / 2, y: from.y + (ny * startWidth) / 2 },
      { x: midX, y: midY },
      { x: to.x, y: to.y },
      { x: midX - nx * 0.6, y: midY - ny * 0.6 },
      { x: from.x - (nx * startWidth) / 2, y: from.y - (ny * startWidth) / 2 },
    ],
    1.1,
  );
}
