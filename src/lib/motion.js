// Shared coordinate rules for both single-block previews and program playback.
const { number } = require("./program");
const STAGE = Object.freeze({
  width: 480,
  height: 360,
  spriteSize: 64,
});
const LIMIT_X = (STAGE.width - STAGE.spriteSize) / 2;
const LIMIT_Y = (STAGE.height - STAGE.spriteSize) / 2;
const STEP_MS = 160;
const clamp = (value, limit) =>
  Math.max(-limit, Math.min(limit, number(value)));
const direction = (value) => ((number(value) % 360) + 360) % 360;
const durationMs = (seconds) =>
  Math.max(0, Math.min(60, number(seconds))) * 1000;
function destination(sprite, steps) {
  const radians = (sprite.direction * Math.PI) / 180;
  return {
    x: clamp(sprite.x + number(steps) * Math.cos(radians), LIMIT_X),
    y: clamp(sprite.y - number(steps) * Math.sin(radians), LIMIT_Y),
  };
}
function applyImmediate(sprite, block) {
  const result = {
    ...sprite,
    bubble: null,
    activeBlock: null,
  };
  switch (block.type) {
    case "move":
      return {
        ...result,
        ...destination(sprite, block.steps),
      };
    case "turn":
      return {
        ...result,
        direction: direction(
          sprite.direction +
            number(block.degrees) *
              (block.rotation === "anticlockwise" ? -1 : 1),
        ),
      };
    case "goto":
      return {
        ...result,
        x: clamp(block.x, LIMIT_X),
        y: clamp(block.y, LIMIT_Y),
      };
    case "say":
    case "think":
      return {
        ...result,
        bubble: {
          type: block.type,
          text: String(block.text || ""),
        },
      };
    default:
      return result;
  }
}

// Returns first contact along the relative movement segment, or null.
// This catches sprites that cross between two rendered frames.
function contactTime(beforeA, afterA, beforeB, afterB, radius = 60) {
  const x = beforeA.x - beforeB.x;
  const y = beforeA.y - beforeB.y;
  const dx = afterA.x - afterB.x - x;
  const dy = afterA.y - afterB.y - y;
  const c = x * x + y * y - radius * radius;
  if (c <= 1e-8) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return null;
  const b = 2 * (x * dx + y * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const time = (-b - Math.sqrt(discriminant)) / (2 * a);
  return time >= 0 && time <= 1 ? time : null;
}
module.exports = {
  STAGE,
  LIMIT_X,
  LIMIT_Y,
  STEP_MS,
  clamp,
  direction,
  durationMs,
  destination,
  applyImmediate,
  contactTime,
};
