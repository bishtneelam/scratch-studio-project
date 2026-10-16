const { number } = require("./program");
const {
  STEP_MS,
  LIMIT_X,
  LIMIT_Y,
  applyImmediate,
  destination,
  durationMs,
  contactTime,
} = require("./motion");
function resetRunner(sprite, blocks = sprite.blocks) {
  return {
    stack: [
      {
        blocks,
        index: 0,
        remaining: 1,
      },
    ],
    active: null,
    queue: [],
    done: false,
  };
}
function nextBlock(runner) {
  // Budget prevents large or empty nested loops from blocking the browser.
  for (let budget = 0; budget < 200; budget++) {
    const frame = runner.stack[runner.stack.length - 1];
    if (!frame) {
      const pending = runner.queue.shift();
      if (pending) {
        runner.stack.push({ blocks: pending, index: 0, remaining: 1 });
        continue;
      }
      runner.done = true;
      return null;
    }
    if (frame.index >= frame.blocks.length) {
      if (frame.remaining > 1) {
        frame.remaining--;
        frame.index = 0;
      } else runner.stack.pop();
      continue;
    }
    const block = frame.blocks[frame.index++];
    if (block.type === "repeat") {
      const times = Math.max(
        0,
        Math.min(1000, Math.floor(number(block.times))),
      );
      if (times && block.children.length)
        runner.stack.push({
          blocks: block.children,
          index: 0,
          remaining: times,
        });
      continue;
    }
    return block;
  }
  return null;
}
function startRuntime(sprites, options = {}) {
  return {
    sprites: sprites.map((s) => ({
      ...s,
      bubble: null,
      activeBlock: null,
    })),
    runners: Object.fromEntries(
      sprites.map((s) => [
        s.id,
        resetRunner(
          s,
          options.programs ? options.programs[s.id] || [] : s.blocks,
        ),
      ]),
    ),
    collisions: options.collisions !== false,
    contacts: new Set(),
    swaps: 0,
    lastSwap: "",
  };
}
// Each click adds one complete suffix after the current run. Never interrupt
// a Move/Turn pair or restart from a saved position when clicks arrive quickly.
function enqueueProgram(runtime, spriteId, blocks) {
  const runner = runtime.runners[spriteId];
  if (runtime.collisions || !runner || !blocks.length) return false;
  runner.queue.push(blocks);
  runner.done = false;
  return true;
}
function tick(runtime, now) {
  const previous = runtime.sprites;
  const sprites = previous.map((s) => ({
    ...s,
  }));
  const moved = new Set();
  const teleported = new Set();
  for (const sprite of sprites) {
    const runner = runtime.runners[sprite.id];
    if (runner.active) {
      const action = runner.active;
      const progress =
        action.duration === 0
          ? 1
          : Math.min(1, Math.max(0, (now - action.start) / action.duration));
      if (action.type === "move") {
        moved.add(sprite.id);
        sprite.x = action.x + (action.toX - action.x) * progress;
        sprite.y = action.y + (action.toY - action.y) * progress;
      }
      if (progress < 1) continue;
      runner.active = null;
      sprite.bubble = null;
      // Keep the highlight until the next block is known, avoiding a blank
      // frame between consecutive iterations of the same Move block.
      // Resolve the completed movement before a following block can teleport.
      if (action.type === "move") continue;
    }
    if (runner.done) continue;
    const block = nextBlock(runner);
    if (!block) {
      if (runner.done) sprite.activeBlock = null;
      continue;
    }
    sprite.activeBlock = block.id;
    if (block.type === "move") {
      const target = destination(sprite, block.steps);
      runner.active = {
        type: "move",
        start: now,
        duration: STEP_MS,
        x: sprite.x,
        y: sprite.y,
        toX: target.x,
        toY: target.y,
      };
    } else if (block.type === "turn") {
      sprite.direction = applyImmediate(sprite, block).direction;
      runner.active = {
        type: "pause",
        start: now,
        duration: STEP_MS,
      };
    } else if (block.type === "goto") {
      teleported.add(sprite.id);
      const target = applyImmediate(sprite, block);
      sprite.x = target.x;
      sprite.y = target.y;
      runner.active = {
        type: "pause",
        start: now,
        duration: STEP_MS,
      };
    } else if (block.type === "say" || block.type === "think") {
      sprite.bubble = applyImmediate(sprite, block).bubble;
      runner.active = {
        type: block.type,
        start: now,
        duration: durationMs(block.seconds),
      };
    }
  }
  const contacts = new Set();
  const swappedThisFrame = new Set();
  const candidates = [];
  for (let a = 0; runtime.collisions && a < sprites.length; a++) {
    for (let b = a + 1; b < sprites.length; b++) {
      const first = sprites[a],
        second = sprites[b];
      const overlapping =
        Math.hypot(first.x - second.x, first.y - second.y) <= 60 + 1e-8;
      const crossing =
        moved.has(first.id) || moved.has(second.id)
          ? contactTime(
              teleported.has(first.id) ? first : previous[a],
              first,
              teleported.has(second.id) ? second : previous[b],
              second,
            )
          : null;
      if (overlapping || crossing !== null) candidates.push({ a, b, crossing });
    }
  }
  // Resolve the first physical contact, not whichever pair appears first in
  // the sprite list. A sprite can participate in one new swap per frame.
  candidates.sort((a, b) => (a.crossing ?? 1) - (b.crossing ?? 1));
  for (const { a, b, crossing } of candidates) {
    const first = sprites[a],
      second = sprites[b];
    const key = [first.id, second.id].sort().join("|");
    if (runtime.contacts.has(key)) {
      contacts.add(key);
      continue;
    }
    // Defer competing new contacts rather than recording an unhandled swap.
    if (swappedThisFrame.has(first.id) || swappedThisFrame.has(second.id))
      continue;
    contacts.add(key);
    if (
      crossing !== null &&
      !teleported.has(first.id) &&
      !teleported.has(second.id)
    ) {
      for (const [sprite, before] of [
        [first, previous[a]],
        [second, previous[b]],
      ]) {
        sprite.x = before.x + (sprite.x - before.x) * crossing;
        sprite.y = before.y + (sprite.y - before.y) * crossing;
      }
    }
    [first.blocks, second.blocks] = [second.blocks, first.blocks];
    for (const sprite of [first, second]) {
      runtime.runners[sprite.id] = resetRunner(sprite);
      sprite.bubble = null;
      sprite.activeBlock = null;
      swappedThisFrame.add(sprite.id);
    }
    runtime.swaps++;
    runtime.lastSwap = `${first.name} and ${second.name} exchanged programs`;
  }
  runtime.contacts = contacts;
  // Preserve references for unchanged sprites so memoized views can skip work.
  runtime.sprites = sprites.map((sprite, index) => {
    const before = previous[index];
    return ["x", "y", "direction", "bubble", "activeBlock", "blocks"].every(
      (key) => sprite[key] === before[key],
    )
      ? before
      : sprite;
  });
  return {
    sprites: runtime.sprites,
    done: Object.values(runtime.runners).every((r) => r.done && !r.active),
    swaps: runtime.swaps,
    lastSwap: runtime.lastSwap,
  };
}
module.exports = {
  startRuntime,
  enqueueProgram,
  tick,
  LIMIT_X,
  LIMIT_Y,
};
