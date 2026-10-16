const assert = require("assert");
const {
  makeBlock,
  placeBlock,
  updateBlock,
  removeBlock,
} = require("../src/lib/program");
const { startRuntime, tick } = require("../src/lib/runtime");
const block = (type, fields) => ({
  ...makeBlock(type),
  ...fields,
});
const sprite = (id, blocks, props = {}) => ({
  id,
  name: id,
  x: 0,
  y: 0,
  direction: 0,
  blocks,
  ...props,
});
const close = (actual, expected) =>
  assert(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
function finish(runtime, limit = 20000) {
  for (let time = 0; time <= limit; time += 20)
    if (tick(runtime, time).done) return runtime;
  assert.fail("Runtime did not finish");
}
// Rotation affects subsequent moves; negatives go backward.
for (const [direction, steps, x, y] of [
  [0, 10, 10, 0],
  [90, 10, 0, -10],
  [180, 10, -10, 0],
  [270, 10, 0, 10],
  [45, 10, Math.sqrt(50), -Math.sqrt(50)],
  [90, -10, 0, 10],
]) {
  const runtime = finish(
    startRuntime([
      sprite(
        "a",
        [
          block("move", {
            steps,
          }),
        ],
        {
          direction,
        },
      ),
    ]),
  );
  close(runtime.sprites[0].x, x);
  close(runtime.sprites[0].y, y);
}
const square = finish(
  startRuntime([
    sprite("a", [
      block("repeat", {
        times: 4,
        children: [
          block("move", {
            steps: 50,
          }),
          block("turn", {
            degrees: 90,
          }),
        ],
      }),
    ]),
  ]),
);
close(square.sprites[0].x, 0);
close(square.sprites[0].y, 0);
const nested = finish(
  startRuntime([
    sprite("a", [
      block("repeat", {
        times: 2,
        children: [
          block("repeat", {
            times: 3,
            children: [
              block("move", {
                steps: 5,
              }),
            ],
          }),
        ],
      }),
    ]),
  ]),
);
close(nested.sprites[0].x, 30);
// Speech waits within a sprite, but never stalls another sprite.
const parallel = startRuntime([
  sprite(
    "a",
    [
      block("say", {
        text: "Hello",
        seconds: 2,
      }),
      block("move", {
        steps: 10,
      }),
    ],
    {
      x: -100,
    },
  ),
  sprite(
    "b",
    [
      block("move", {
        steps: 20,
      }),
    ],
    {
      x: 100,
    },
  ),
]);
tick(parallel, 0);
tick(parallel, 200);
assert.equal(parallel.sprites[0].bubble.text, "Hello");
close(parallel.sprites[0].x, -100);
close(parallel.sprites[1].x, 120);
tick(parallel, 2000);
tick(parallel, 2200);
close(parallel.sprites[0].x, -90);
assert.equal(parallel.sprites[0].bubble, null);
const zero = finish(
  startRuntime([
    sprite("a", [
      block("repeat", {
        times: 0,
        children: [
          block("move", {
            steps: 100,
          }),
        ],
      }),
      block("goto", {
        x: -40,
        y: 60,
      }),
    ]),
  ]),
);
close(zero.sprites[0].x, -40);
close(zero.sprites[0].y, 60);
// Collision exchanges full programs, restarts them, and latches contact.
const firstProgram = [
  block("repeat", {
    times: 25,
    children: [
      block("move", {
        steps: 8,
      }),
    ],
  }),
];
const secondProgram = [
  block("repeat", {
    times: 25,
    children: [
      block("move", {
        steps: -8,
      }),
    ],
  }),
];
const collision = finish(
  startRuntime([
    sprite("a", firstProgram, {
      x: -100,
    }),
    sprite("b", secondProgram, {
      x: 100,
    }),
  ]),
);
assert.equal(collision.swaps, 1);
assert.strictEqual(collision.sprites[0].blocks, secondProgram);
assert.strictEqual(collision.sprites[1].blocks, firstProgram);
assert(collision.sprites[0].x < -60 && collision.sprites[1].x > 60);
const overlap = startRuntime([
  sprite("a", [
    block("say", {
      seconds: 5,
    }),
  ]),
  sprite("b", [
    block("think", {
      seconds: 5,
    }),
  ]),
]);
for (let time = 0; time < 1000; time += 20) tick(overlap, time);
assert.equal(overlap.swaps, 1);
overlap.sprites[1].x = 100;
tick(overlap, 1000);
overlap.sprites[1].x = 0;
tick(overlap, 1020);
assert.equal(overlap.swaps, 2);
// Tree editing: nested drops, reorder, editing, deletion, and rejecting cycles.
const move = block("move", {
  steps: 12,
});
const repeat = block("repeat", {
  times: 2,
});
let tree = [move, repeat];
tree = placeBlock(
  tree,
  {
    source: "workspace",
    id: move.id,
  },
  repeat.id,
  0,
);
assert.equal(tree.length, 1);
assert.equal(tree[0].children[0].id, move.id);
assert.strictEqual(
  placeBlock(
    tree,
    {
      source: "workspace",
      id: repeat.id,
    },
    move.id,
    0,
  ),
  tree,
);
tree = updateBlock(tree, move.id, {
  steps: 30,
});
assert.equal(tree[0].children[0].steps, 30);
tree = placeBlock(
  tree,
  {
    source: "workspace",
    id: move.id,
  },
  null,
  1,
);
assert.equal(tree[1].id, move.id);
tree = placeBlock(
  tree,
  {
    source: "workspace",
    id: move.id,
  },
  null,
  0,
);
assert.equal(tree[0].id, move.id);
tree = removeBlock(tree, repeat.id);
assert.equal(tree.length, 1);
const copied = placeBlock(
  tree,
  {
    source: "palette",
    block: move,
  },
  null,
  1,
);
assert.notEqual(copied[0].id, copied[1].id);
console.log(
  "Passed: movement, rotation, nested repeats, timing, concurrency, collision swaps/contact reset, and program tree editing.",
);
// Free workspace placement keeps coordinates, connected suffixes, and stack boundaries.
const { workspaceGroups } = require("../src/lib/program");
const palettePayload = (type) => ({
  source: "palette",
  block: makeBlock(type),
  tail: true,
});
let canvas = placeBlock([], palettePayload("move"), null, 0, {
  x: 250,
  y: 170,
});
canvas = placeBlock(canvas, palettePayload("say"), null, 0, {
  x: 500,
  y: 300,
});
assert.deepEqual(
  workspaceGroups(canvas).map((g) => g.position),
  [
    {
      x: 250,
      y: 170,
    },
    {
      x: 500,
      y: 300,
    },
  ],
);
// Snap under the first stack, before the second stack's array entry, without stealing its position.
canvas = placeBlock(canvas, palettePayload("turn"), null, 1);
assert.equal(workspaceGroups(canvas)[0].blocks.length, 2);
assert.deepEqual(workspaceGroups(canvas)[1].position, {
  x: 500,
  y: 300,
});
const firstHead = canvas[0].id;
canvas = placeBlock(
  canvas,
  {
    source: "workspace",
    id: firstHead,
    tail: true,
  },
  null,
  0,
  {
    x: 90,
    y: 400,
  },
);
assert.equal(workspaceGroups(canvas).length, 2);
const relocated = workspaceGroups(canvas).find(
  (g) => g.blocks[0].id === firstHead,
);
assert.equal(relocated.blocks.length, 2);
assert.deepEqual(relocated.position, {
  x: 90,
  y: 400,
});
// Detach the second block without moving the block above it.
const turnId = relocated.blocks[1].id;
canvas = placeBlock(
  canvas,
  {
    source: "workspace",
    id: turnId,
    tail: true,
  },
  null,
  0,
  {
    x: 400,
    y: 500,
  },
);
assert.equal(workspaceGroups(canvas).length, 3);
const repeatBlock = makeBlock("repeat");
canvas = [
  ...canvas,
  {
    ...repeatBlock,
    workspace: {
      x: 700,
      y: 100,
    },
  },
];
canvas = placeBlock(
  canvas,
  {
    source: "workspace",
    id: turnId,
    tail: true,
  },
  repeatBlock.id,
  0,
);
assert.equal(workspaceGroups(canvas).length, 3);
assert.equal(
  canvas.find((b) => b.id === repeatBlock.id).children[0].id,
  turnId,
);
assert.equal(
  canvas.find((b) => b.id === repeatBlock.id).children[0].workspace,
  undefined,
);
assert.strictEqual(
  placeBlock(
    canvas,
    {
      source: "workspace",
      id: repeatBlock.id,
      tail: true,
    },
    turnId,
    0,
  ),
  canvas,
);
console.log(
  "Passed: free coordinates, moving connected stacks, detaching, snapping, and nested placement.",
);
// Inserting above a positioned head, arrow reordering, and deletion keep that stack anchored.
let anchored = placeBlock([], palettePayload("move"), null, 0, {
  x: 320,
  y: 240,
});
anchored = placeBlock(
  anchored,
  {
    ...palettePayload("turn"),
    beforeHead: true,
  },
  null,
  0,
);
assert.equal(workspaceGroups(anchored).length, 1);
assert.deepEqual(anchored[0].workspace, {
  x: 320,
  y: 240,
});
anchored = placeBlock(
  anchored,
  {
    source: "workspace",
    id: anchored[1].id,
  },
  null,
  0,
);
assert.equal(workspaceGroups(anchored).length, 1);
assert.deepEqual(anchored[0].workspace, {
  x: 320,
  y: 240,
});
anchored = removeBlock(anchored, anchored[0].id);
assert.deepEqual(anchored[0].workspace, {
  x: 320,
  y: 240,
});
console.log(
  "Passed: stack coordinates survive top insertion, arrow reordering, and head deletion.",
);
// Click-to-run selects only the connected suffix, including nested repeats.
const { connectedFrom } = require("../src/lib/program");
const c1 = block("move", {
  steps: 10,
});
const innerMove = block("move", {
  steps: 3,
});
const c2 = block("repeat", {
  times: 5,
  children: [innerMove],
});
const c3 = block("move", {
  steps: 20,
});
const separate = {
  ...block("move", {
    steps: 150,
  }),
  workspace: {
    x: 500,
    y: 50,
  },
};
const clickProgram = [c1, c2, c3, separate];
assert.deepEqual(
  connectedFrom(clickProgram, c1.id).map((b) => b.id),
  [c1.id, c2.id, c3.id],
);
assert.deepEqual(
  connectedFrom(clickProgram, c2.id).map((b) => b.id),
  [c2.id, c3.id],
);
assert.deepEqual(
  connectedFrom(clickProgram, innerMove.id).map((b) => b.id),
  [innerMove.id],
);
assert.deepEqual(connectedFrom(clickProgram, "missing"), []);
const clicked = finish(
  startRuntime(
    [
      sprite("clicked", clickProgram),
      sprite("other", [
        block("move", {
          steps: 100,
        }),
      ]),
    ],
    {
      programs: {
        clicked: connectedFrom(clickProgram, c1.id),
      },
      collisions: false,
    },
  ),
);
close(clicked.sprites[0].x, 45);
close(clicked.sprites[1].x, 0);
assert.equal(clicked.swaps, 0);
assert.strictEqual(clicked.sprites[0].blocks, clickProgram);
console.log(
  "Passed: clicked suffix runs with repeats; other stacks and sprites remain idle and programs stay intact.",
);
