// Pointer interactions are isolated from block rendering and program state.
let cancelDrag = null;
const suppressClickUntil = new WeakMap();
export function cancelActiveDrag() {
  if (cancelDrag) cancelDrag();
}
export function suppressesClick(element) {
  return (suppressClickUntil.get(element) || 0) > Date.now();
}
export function beginDrag(event, inputPayload) {
  if (event.button !== 0 || event.target.closest("input, button")) return;
  event.stopPropagation();
  if (cancelDrag) cancelDrag();
  const source = event.currentTarget;
  const sourceRect = source.getBoundingClientRect();
  const startX = event.clientX,
    startY = event.clientY;
  const offsetX = startX - sourceRect.left,
    offsetY = startY - sourceRect.top;
  const payload = {
    ...inputPayload,
    tail: true,
  };
  const wrappers = [];
  if (payload.source === "workspace") {
    let sibling = source.closest(".workspace-block");
    while (sibling) {
      if (sibling.classList.contains("workspace-block")) wrappers.push(sibling);
      sibling = sibling.nextElementSibling;
    }
  }
  const draggedIds = new Set(
    wrappers.flatMap((wrapper) => [
      wrapper.dataset.blockId,
      ...Array.from(
        wrapper.querySelectorAll("[data-block-id]"),
        (node) => node.dataset.blockId,
      ),
    ]),
  );
  let ghost = null,
    target = null,
    canvas = null;
  function clear() {
    ghost?.remove();
    target?.classList.remove("drop-over");
    wrappers.forEach((wrapper) => wrapper.classList.remove("dragging-block"));
    source.classList.remove("dragging-block");
    canvas?.classList.remove("canvas-drag-over");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", clear);
    window.removeEventListener("blur", clear);
    cancelDrag = null;
  }
  function hitTest(e) {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const surface = under?.closest(
      '[data-workspace-canvas][data-enabled="true"]',
    );
    if (!surface)
      return {
        surface: null,
        slot: null,
      };
    const slots = Array.from(
      surface.querySelectorAll('[data-drop-index][data-enabled="true"]'),
    ).filter(
      (slot) =>
        !draggedIds.has(slot.dataset.dropOwner) &&
        !draggedIds.has(slot.dataset.dropParent),
    );
    const direct = under?.closest("[data-drop-index]");
    if (direct && slots.includes(direct))
      return {
        surface,
        slot: direct,
      };
    const left = e.clientX - offsetX,
      top = e.clientY - offsetY;
    let nearest = null,
      distance = Infinity;
    for (const slot of slots) {
      if (slot.classList.contains("empty-slot")) {
        const rect = slot.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        )
          return {
            surface,
            slot,
          };
        continue;
      }
      const rect = slot.getBoundingClientRect();
      const dx = Math.abs(left - rect.left),
        dy = Math.abs(top - (rect.top + 3));
      if (dx < 28 && dy < 18 && dx + dy < distance) {
        nearest = slot;
        distance = dx + dy;
      }
    }
    return {
      surface,
      slot: nearest,
    };
  }
  function move(e) {
    if (!ghost && Math.hypot(e.clientX - startX, e.clientY - startY) < 5)
      return;
    e.preventDefault();
    if (!ghost) {
      ghost = document.createElement("div");
      ghost.className = "drag-ghost";
      const cards = wrappers.length
        ? wrappers.map((wrapper) => wrapper.firstElementChild)
        : [source];
      cards.forEach((card) => {
        const copy = card.cloneNode(true);
        copy.style.width = `${card.getBoundingClientRect().width}px`;
        ghost.appendChild(copy);
      });
      document.body.appendChild(ghost);
      if (wrappers.length)
        wrappers.forEach((wrapper) => wrapper.classList.add("dragging-block"));
      else source.classList.add("dragging-block");
    }
    ghost.style.left = `${e.clientX - offsetX}px`;
    ghost.style.top = `${e.clientY - offsetY}px`;
    target?.classList.remove("drop-over");
    canvas?.classList.remove("canvas-drag-over");
    const hit = hitTest(e);
    canvas = hit.surface;
    target = hit.slot;
    target?.classList.add("drop-over");
    if (canvas && !target) canvas.classList.add("canvas-drag-over");
  }
  function end(e) {
    if (ghost) {
      suppressClickUntil.set(source, Date.now() + 400);
      const { surface, slot } = hitTest(e);
      if (surface) {
        const rect = surface.getBoundingClientRect();
        window.dispatchEvent(
          new CustomEvent("scratch-drop", {
            detail: {
              payload: {
                ...payload,
                beforeHead: slot?.dataset.dropHead === "true",
              },
              parentId: slot?.dataset.dropParent || null,
              index: slot ? Number(slot.dataset.dropIndex) : 0,
              position: slot
                ? undefined
                : {
                    x: e.clientX - offsetX - rect.left,
                    y: e.clientY - offsetY - rect.top,
                  },
            },
          }),
        );
      }
    }
    clear();
  }
  window.addEventListener("pointermove", move, {
    passive: false,
  });
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", clear);
  window.addEventListener("blur", clear);
  cancelDrag = clear;
}
