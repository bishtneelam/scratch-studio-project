import React from "react";
import CatSprite from "./CatSprite";
import useSpriteDrag from "../hooks/useSpriteDrag";

const StageSprite = React.memo(function StageSprite({
  sprite,
  onSelect,
  onMove,
  disabled,
}) {
  const drag = useSpriteDrag(sprite, onSelect, onMove, disabled);
  const select = () => onSelect(sprite.id);
  return (
    <g>
      <g
        role="button"
        tabIndex={0}
        aria-label={`Select ${sprite.name}`}
        {...drag}
        onClick={select}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            select();
          }
        }}
        transform={`translate(${sprite.x},${-sprite.y})`}
        className={`stage-sprite ${disabled ? "playback-locked" : ""}`}
      >
        <g transform={`rotate(${sprite.direction})`}>
          <g
            transform="translate(-32,-32)"
            className="sprite-art"
            style={{ filter: `hue-rotate(${sprite.hue || 0}deg)` }}
          >
            <CatSprite size={64} />
          </g>
        </g>
      </g>
      {sprite.bubble && (
        <foreignObject
          x={Math.max(-235, Math.min(55, sprite.x - 80))}
          y={Math.max(-175, sprite.y > 75 ? -sprite.y + 45 : -sprite.y - 95)}
          width="180"
          height="80"
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            className={`bubble ${sprite.bubble.type === "think" ? "thought-bubble" : ""}`}
          >
            {sprite.bubble.type === "think" ? "◌ " : ""}
            {sprite.bubble.text}
          </div>
        </foreignObject>
      )}
    </g>
  );
});

export default function Stage({ sprites, onSelect, onMove, disabled }) {
  return (
    <div className="stage-panel">
      <svg
        className="stage"
        viewBox="-240 -180 480 360"
        role="group"
        aria-label="Animation stage, 480 by 360. Origin at center."
      >
        <rect x="-240" y="-180" width="480" height="360" fill="white" />
        {sprites.map((sprite) => (
          <StageSprite
            key={sprite.id}
            sprite={sprite}
            onSelect={onSelect}
            onMove={onMove}
            disabled={disabled}
          />
        ))}
      </svg>
    </div>
  );
}
