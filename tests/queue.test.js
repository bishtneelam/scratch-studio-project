const test = require("node:test");
const assert = require("node:assert/strict");
const { makeBlock } = require("../src/lib/program");
const { startRuntime, tick, enqueueProgram } = require("../src/lib/runtime");
const makeSprite = (id, blocks) => ({
  id,
  name: id,
  x: 0,
  y: 0,
  direction: 0,
  blocks,
});
test("rapid clicks run every Move/Turn pair from the current position", () => {
  const blocks = [makeBlock("move"), makeBlock("turn")];
  const runtime = startRuntime([makeSprite("a", blocks)], {
    collisions: false,
  });
  tick(runtime, 0);
  tick(runtime, 80);
  assert.equal(enqueueProgram(runtime, "a", blocks), true);
  assert.equal(enqueueProgram(runtime, "a", blocks), true);
  let result;
  for (let now = 96; now < 3000; now += 16) {
    result = tick(runtime, now);
    if (result.done) break;
  }
  assert.equal(result.done, true);
  assert.equal(result.sprites[0].direction, 45);
  const expectedX = 10 * (1 + Math.cos(Math.PI / 12) + Math.cos(Math.PI / 6));
  const expectedY = -10 * (Math.sin(Math.PI / 12) + Math.sin(Math.PI / 6));
  assert(Math.abs(result.sprites[0].x - expectedX) < 1e-7);
  assert(Math.abs(result.sprites[0].y - expectedY) < 1e-7);
  assert.equal(result.sprites[0].blocks, blocks);
  assert.equal(result.swaps, 0);
});
test("queued clicks can start an idle second sprite without changing its script", () => {
  const a = [makeBlock("think")],
    b = [makeBlock("move")];
  const runtime = startRuntime([makeSprite("a", a), makeSprite("b", b)], {
    programs: { a },
    collisions: false,
  });
  tick(runtime, 0);
  assert.equal(runtime.runners.b.done, true);
  enqueueProgram(runtime, "b", b);
  tick(runtime, 16);
  const result = tick(runtime, 176);
  assert.equal(result.sprites[1].x, 10);
  assert.equal(result.sprites[1].blocks, b);
});
test("empty, unknown, and green-flag requests cannot enqueue scripts", () => {
  const blocks = [makeBlock("move")];
  const runtime = startRuntime([makeSprite("a", blocks)], {
    collisions: false,
  });
  assert.equal(enqueueProgram(runtime, "a", []), false);
  assert.equal(enqueueProgram(runtime, "missing", blocks), false);
  assert.equal(
    enqueueProgram(startRuntime([makeSprite("a", blocks)]), "a", blocks),
    false,
  );
});
