import { useEffect, useRef } from "react";

// Use the stage SVG's coordinate system, including responsive scaling and its
// centered origin. The nested sprite SVG has a different viewBox.
function stagePoint(element, event) {
  const stage = element.closest(".stage");
  const matrix = stage?.getScreenCTM();
  if (!matrix) return null;
  const point = stage.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(matrix.inverse());
}

export default function useSpriteDrag(sprite, onSelect, onMove, disabled) {
  const drag = useRef(null);
  const end = () => {
    const current = drag.current;
    drag.current = null;
    if (current?.element.hasPointerCapture(current.pointerId)) {
      current.element.releasePointerCapture(current.pointerId);
    }
  };
  useEffect(() => {
    if (disabled) end();
    return end;
  }, [disabled]);

  const move = (event) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId || disabled) return;
    const point = stagePoint(current.element, event);
    if (!point) return;
    onMove(sprite.id, point.x + current.offsetX, -point.y + current.offsetY);
  };
  return {
    onPointerDown(event) {
      if (!event.isPrimary || event.button !== 0) return;
      onSelect(sprite.id);
      if (disabled) return;
      const element = event.currentTarget;
      const point = stagePoint(element, event);
      if (!point) return;
      event.preventDefault();
      drag.current = {
        element,
        pointerId: event.pointerId,
        offsetX: sprite.x - point.x,
        offsetY: sprite.y + point.y,
      };
      element.setPointerCapture(event.pointerId);
    },
    onPointerMove: move,
    onPointerUp(event) {
      if (drag.current?.pointerId !== event.pointerId) return;
      move(event);
      end();
    },
    onPointerCancel: end,
    onLostPointerCapture: end,
  };
}
