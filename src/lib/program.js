// Programs are data. React edits them; the runtime interprets them.
let sequence = 0;
function id() {
  return `item-${Date.now()}-${++sequence}`;
}
function number(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}
function makeBlock(type) {
  const defaults = {
    move: {
      steps: 10,
    },
    turn: {
      degrees: 15,
    },
    goto: {
      x: 0,
      y: 0,
    },
    say: {
      text: "Hello!",
      seconds: 2,
    },
    think: {
      text: "Hmm...",
      seconds: 2,
    },
    repeat: {
      times: 10,
      children: [],
    },
  };
  return {
    id: id(),
    type,
    ...defaults[type],
  };
}
function cloneBlock(block) {
  const { anchor, ...data } = block;
  return {
    ...data,
    id: id(),
    ...(block.children
      ? {
          children: block.children.map(cloneBlock),
        }
      : {}),
  };
}
function findBlock(blocks, target) {
  for (const block of blocks) {
    if (block.id === target) return block;
    const nested = block.children && findBlock(block.children, target);
    if (nested) return nested;
  }
  return null;
}
function updateBlock(blocks, target, patch) {
  let changed = false;
  const result = blocks.map((block) => {
    if (block.id === target) {
      if (Object.keys(patch).every((key) => block[key] === patch[key]))
        return block;
      changed = true;
      return {
        ...block,
        ...patch,
      };
    }
    if (!block.children) return block;
    const children = updateBlock(block.children, target, patch);
    if (children === block.children) return block;
    changed = true;
    return {
      ...block,
      children,
    };
  });
  return changed ? result : blocks;
}
function removeBlock(blocks, target) {
  let changed = false;
  let inheritedPosition = null;
  const result = [];
  for (const block of blocks) {
    if (block.id === target) {
      changed = true;
      inheritedPosition = block.workspace || null;
      continue;
    }
    let next = block;
    if (inheritedPosition) {
      if (!block.workspace)
        next = {
          ...block,
          workspace: inheritedPosition,
        };
      inheritedPosition = null;
    }
    if (block.children) {
      const children = removeBlock(block.children, target);
      if (children !== block.children) {
        next = {
          ...next,
          children,
        };
        changed = true;
      }
    }
    result.push(next);
  }
  return changed ? result : blocks;
}
function insertBlock(blocks, parentId, index, block) {
  if (!parentId) {
    const copy = [...blocks];
    copy.splice(index, 0, block);
    return copy;
  }
  return blocks.map((item) =>
    item.id === parentId
      ? {
          ...item,
          children: insertBlock(item.children, null, index, block),
        }
      : item.children
        ? {
            ...item,
            children: insertBlock(item.children, parentId, index, block),
          }
        : item,
  );
}
function parentOf(blocks, target, parentId = null) {
  for (let index = 0; index < blocks.length; index++) {
    if (blocks[index].id === target)
      return {
        parentId,
        index,
      };
    const nested =
      blocks[index].children &&
      parentOf(blocks[index].children, target, blocks[index].id);
    if (nested) return nested;
  }
  return null;
}
function placeSingleBlock(blocks, payload, parentId, index) {
  if (payload.source === "palette")
    return insertBlock(blocks, parentId, index, cloneBlock(payload.block));
  const block = findBlock(blocks, payload.id);
  if (
    !block ||
    block.id === parentId ||
    (block.children && findBlock(block.children, parentId))
  )
    return blocks;
  const old = parentOf(blocks, block.id);
  const adjusted =
    old.parentId === parentId && old.index < index ? index - 1 : index;
  return insertBlock(removeBlock(blocks, block.id), parentId, adjusted, block);
}
// A workspace coordinate marks the head of a disconnected stack.
// Connected blocks following that head share the stack's position.
function workspaceGroups(blocks) {
  const groups = [];
  blocks.forEach((block, index) => {
    if (!groups.length || block.workspace)
      groups.push({
        start: index,
        position: block.workspace || {
          x: 100,
          y: 60,
        },
        blocks: [],
      });
    groups[groups.length - 1].blocks.push(block);
  });
  return groups;
}
function listAt(blocks, parentId) {
  return parentId ? findBlock(blocks, parentId)?.children || [] : blocks;
}
function withoutPosition(block) {
  const { workspace, ...rest } = block;
  return rest;
}
function placeBlock(blocks, payload, parentId, index, position) {
  // Arrow buttons move one block. Pointer dragging moves the connected suffix.
  if (!position && !payload.tail) {
    const result = placeSingleBlock(blocks, payload, parentId, index);
    const origin =
      payload.source === "workspace" && parentOf(blocks, payload.id);
    if (origin && !origin.parentId && !parentId) {
      const group = workspaceGroups(blocks).find((item) =>
        item.blocks.some((block) => block.id === payload.id),
      );
      if (index >= group.start && index <= group.start + group.blocks.length) {
        const members = new Set(group.blocks.map((block) => block.id));
        let first = true;
        return result.map((block) => {
          if (!members.has(block.id)) return block;
          const copy = withoutPosition(block);
          if (first) {
            first = false;
            return {
              ...copy,
              workspace: group.position,
            };
          }
          return copy;
        });
      }
    }
    return result;
  }
  let moving,
    origin = null;
  if (payload.source === "palette") moving = [cloneBlock(payload.block)];
  else {
    origin = parentOf(blocks, payload.id);
    if (!origin) return blocks;
    const source = listAt(blocks, origin.parentId);
    let end = source.length;
    if (!origin.parentId) {
      const nextHead = source.findIndex(
        (block, i) => i > origin.index && block.workspace,
      );
      if (nextHead !== -1) end = nextHead;
    }
    moving = source.slice(origin.index, payload.tail ? end : origin.index + 1);
    if (
      moving.some(
        (block) =>
          block.id === parentId ||
          (block.children && findBlock(block.children, parentId)),
      )
    )
      return blocks;
  }
  const movingIds = new Set(moving.map((block) => block.id));
  const destination = listAt(blocks, parentId);
  // A drop back into the same dragged suffix is a no-op.
  if (
    !position &&
    origin &&
    origin.parentId === parentId &&
    index >= origin.index &&
    index <= origin.index + moving.length
  )
    return blocks;
  const targetHead =
    !parentId && payload.beforeHead && destination[index]?.workspace;
  const adjusted =
    index -
    destination.slice(0, index).filter((block) => movingIds.has(block.id))
      .length;
  let result = blocks;
  if (origin)
    for (const block of moving) result = removeBlock(result, block.id);
  moving = moving.map(withoutPosition);
  if (position) {
    moving[0] = {
      ...moving[0],
      workspace: {
        x: Math.max(0, position.x),
        y: Math.max(0, position.y),
      },
    };
    return [...result, ...moving];
  }
  if (!parentId && targetHead && !movingIds.has(destination[index].id)) {
    moving[0] = {
      ...moving[0],
      workspace: targetHead,
    };
    const clearHead = (items) =>
      items.map((block) =>
        block.id === destination[index].id ? withoutPosition(block) : block,
      );
    result = clearHead(result);
  }
  moving.forEach((block, offset) => {
    result = insertBlock(result, parentId, adjusted + offset, block);
  });
  return result;
}
// Clicking a block runs its connected suffix, not other disconnected stacks.
function connectedFrom(blocks, target) {
  const index = blocks.findIndex((block) => block.id === target);
  if (index !== -1) {
    const nextHead = blocks.findIndex(
      (block, i) => i > index && block.workspace,
    );
    return blocks.slice(index, nextHead === -1 ? blocks.length : nextHead);
  }
  for (const block of blocks) {
    if (block.children) {
      const result = connectedFrom(block.children, target);
      if (result.length) return result;
    }
  }
  return [];
}
module.exports = {
  id,
  number,
  makeBlock,
  cloneBlock,
  updateBlock,
  removeBlock,
  placeBlock,
  workspaceGroups,
  connectedFrom,
};
