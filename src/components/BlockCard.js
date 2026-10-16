import React from "react";
import { suppressesClick } from "../lib/drag";
import { number } from "../lib/program";
export default function BlockCard({
  block,
  onChange,
  children,
  active,
  draggable = true,
  onDragStart,
  onRun,
}) {
  const input = (field, label, type = "number") => (
    <input
      aria-label={label}
      type={type}
      value={block[field]}
      draggable={false}
      min={field === "times" || field === "seconds" ? 0 : undefined}
      max={field === "times" ? 1000 : field === "seconds" ? 60 : undefined}
      step={field === "times" ? 1 : "any"}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange({ [field]: e.target.value })}
      onBlur={(e) => {
        if (type !== "number") return;
        let value = number(e.target.value);
        if (field === "times")
          value = Math.max(0, Math.min(1000, Math.floor(value)));
        if (field === "seconds") value = Math.max(0, Math.min(60, value));
        onChange({ [field]: value });
      }}
      title={
        field === "times"
          ? "0 to 1000 repetitions"
          : field === "seconds"
            ? "0 to 60 seconds"
            : label
      }
      className={type === "text" ? "block-input text-input" : "block-input"}
    />
  );
  return (
    <div
      className={`code-block ${block.type === "repeat" ? "control-block" : ["say", "think"].includes(block.type) ? "looks-block" : "motion-block"} ${active ? "active-block" : ""}`}
      draggable={false}
      onPointerDown={draggable ? onDragStart : undefined}
      role={onRun ? "button" : undefined}
      tabIndex={onRun ? 0 : undefined}
      aria-label={onRun ? `Run from ${block.type} block` : undefined}
      title={onRun ? "Click to run from this block; drag to move" : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (
          !onRun ||
          event.target.closest("input, button") ||
          event.target.closest(".code-block") !== event.currentTarget
        )
          return;
        if (suppressesClick(event.currentTarget)) return;
        onRun();
      }}
      onKeyDown={(event) => {
        if (
          onRun &&
          event.target === event.currentTarget &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          event.stopPropagation();
          onRun();
        }
      }}
    >
      <div className="block-fields">
        {block.type === "move" && (
          <>move {input("steps", "Move steps")} steps</>
        )}
        {block.type === "turn" && (
          <>
            turn {block.rotation === "anticlockwise" ? "↺" : "↻"}{" "}
            {input(
              "degrees",
              block.rotation === "anticlockwise"
                ? "Anticlockwise turn degrees"
                : "Turn degrees",
            )}{" "}
            degrees
          </>
        )}
        {block.type === "goto" && (
          <>
            go to x: {input("x", "Go to x")} y: {input("y", "Go to y")}
          </>
        )}
        {block.type === "say" && (
          <>
            say {input("text", "Say text", "text")} for{" "}
            {input("seconds", "Say seconds")} seconds
          </>
        )}
        {block.type === "think" && (
          <>
            think {input("text", "Think text", "text")} for{" "}
            {input("seconds", "Think seconds")} seconds
          </>
        )}
        {block.type === "repeat" && (
          <>repeat {input("times", "Repeat times")} times</>
        )}
      </div>
      {children}
    </div>
  );
}
