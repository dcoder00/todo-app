import { useEffect, useRef, useState } from "react";

// Tunables
const COMPLETE_AT = 0.1; // swipe "reaches" the far edge when the finger is within 10% of it
const HOLD_MS = 500; // how long the new state (green "Completed" / restored white card) shows before the card flies out
const EXIT_MS = 420; // slide-out duration (keep in sync with .card--exiting in styles.css)
const RAMP_PX = 24; // overlay fades in over the first 24px of travel; also the minimum travel to trigger
const BORDER = 2; // card border (px) – the overlay lives inside it, so subtract it to line up with the finger

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * Two mirror-image gestures on the same card:
 *   pending  card: swipe RIGHT → LEFT  = complete  (green → white gradient grows from the right edge)
 *   done     card: swipe LEFT → RIGHT  = undo      (white → green gradient grows from the left edge)
 *
 * phase:   idle | flash (new state shown) | exiting (slides out) | entering (slides in at its new spot)
 * action:  'complete' | 'undo' | null   – which gesture is currently playing out
 */
export default function TodoCard({
  task,
  editing,
  onDone,
  onUndo,
  onMenu,
  onEditSave,
  onEditCancel,
}) {
  const [phase, setPhase] = useState("idle");
  const [action, setAction] = useState(null);
  const [drag, setDrag] = useState(null); // { fill: px covered by the overlay, ramp: 0..1 }
  const cardRef = useRef(null);
  const geo = useRef(null); // { left, width, startX, undo } while a pointer is down
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const trigger = (kind) => {
    if (phase !== "idle" || editing) return;
    geo.current = null;
    setDrag(null);
    setAction(kind);
    setPhase("flash");
    timers.current.push(
      setTimeout(() => setPhase("exiting"), HOLD_MS),
      setTimeout(() => {
        // App moves the task (below the pending ones / back into the pending ones)
        (kind === "undo" ? onUndo : onDone)(task.id);
        setPhase("entering");
      }, HOLD_MS + EXIT_MS),
    );
  };

  const onPointerDown = (e) => {
    if (phase !== "idle" || editing) return;
    if (e.pointerType === "mouse" && (e.button !== 0 || e.ctrlKey)) return; // right-click / ctrl-click = menu, not swipe
    const r = cardRef.current.getBoundingClientRect();
    geo.current = {
      left: r.left,
      width: r.width,
      startX: e.clientX,
      undo: task.done,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const g = geo.current;
    if (!g) return;
    const finger = clamp(e.clientX - g.left, 0, g.width); // finger x inside the card
    if (g.undo) {
      // left → right: overlay is anchored at the LEFT edge and ends at the finger
      const travel = e.clientX - g.startX;
      setDrag({
        fill: Math.max(finger - BORDER, 0),
        ramp: clamp(travel / RAMP_PX, 0, 1),
      });
      if (travel >= RAMP_PX && finger >= g.width * (1 - COMPLETE_AT))
        trigger("undo");
    } else {
      // right → left: overlay is anchored at the RIGHT edge and ends at the finger
      const travel = g.startX - e.clientX;
      setDrag({
        fill: Math.max(g.width - finger - BORDER, 0),
        ramp: clamp(travel / RAMP_PX, 0, 1),
      });
      if (travel >= RAMP_PX && finger <= g.width * COMPLETE_AT)
        trigger("complete");
    }
  };

  const endDrag = () => {
    geo.current = null;
    setDrag(null); // overlay retracts if the swipe didn't reach the far edge
  };

  const onKeyDown = (e) => {
    if (e.target !== e.currentTarget) return; // ignore keys typed in the edit field
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      trigger(task.done ? "undo" : "complete");
    }
  };

  const onContextMenu = (e) => {
    if (editing) return; // let the text field keep the native menu (cut / copy / paste)
    e.preventDefault();
    if (phase !== "idle") return;
    endDrag();
    let { clientX: x, clientY: y } = e;
    if (!x && !y) {
      // opened from the keyboard (Menu key / Shift+F10): anchor to the card
      const r = cardRef.current.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.bottom;
    }
    onMenu(task.id, x, y);
  };

  // ---- what the card should look like right now ----
  const flashing = phase === "flash" || phase === "exiting";
  // While an undo plays out the card looks pending again (white, blue) – the reverse of "completed".
  const looksDone = action === "undo" ? false : task.done || flashing;
  const label =
    action === "complete" && flashing
      ? "Completed"
      : looksDone
        ? `Completed · ${task.text}`
        : task.text;

  const undoDrag = Boolean(drag) && task.done && phase === "idle";
  // The text flips from blue to white at the middle of the gradient so it stays legible on both colours.
  const cut = undoDrag ? drag.fill / 2 : 0; // drag.fill is already measured inside the border

  const cardClass = [
    "card",
    looksDone && "card--done",
    editing && "card--editing",
    phase === "exiting" && "card--exiting",
    phase === "exiting" && action === "undo" && "card--to-left",
    phase === "entering" && "card--entering",
    phase === "entering" && action === "undo" && "card--from-left",
  ]
    .filter(Boolean)
    .join(" ");

  const aria = task.done
    ? `Completed: ${task.text}. Swipe right or press Enter to undo. Press the menu key for more options.`
    : `${task.text}. Swipe left or press Enter to complete. Press the menu key for more options.`;

  return (
    <div
      className="card-wrap"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onContextMenu={onContextMenu}
    >
      <div
        ref={cardRef}
        className={cardClass}
        role="button"
        tabIndex={0}
        aria-label={editing ? undefined : aria}
        onKeyDown={onKeyDown}
        onAnimationEnd={() => {
          if (phase === "entering") {
            setPhase("idle");
            setAction(null);
          }
        }}
      >
        <div
          className={task.done ? "fill fill--undo" : "fill"}
          style={{
            width: drag ? drag.fill : 0,
            opacity: drag ? drag.ramp : 0,
            display: phase === "idle" ? undefined : "none",
            transition: drag ? "none" : "width 260ms ease, opacity 260ms ease",
          }}
        />

        {editing ? (
          <EditField
            initial={task.text}
            onSave={(t) => onEditSave(task.id, t)}
            onCancel={onEditCancel}
          />
        ) : undoDrag ? (
          <>
            {/* white text on the still-green part (right of the cut) … */}
            <span
              className="layer"
              style={{ clipPath: `inset(0 0 0 ${cut}px)` }}
            >
              <span className="label">{label}</span>
            </span>
            {/* … blue text on the part the swipe has already turned white (left of the cut) */}
            <span
              className="layer layer--ink"
              aria-hidden="true"
              style={{ clipPath: `inset(0 calc(100% - ${cut}px) 0 0)` }}
            >
              <span className="label">{label}</span>
            </span>
          </>
        ) : (
          <span className="label">{label}</span>
        )}
      </div>
    </div>
  );
}

/** Inline name editor. Enter / click-away saves, Esc cancels, an empty name keeps the old one. */
function EditField({ initial, onSave, onCancel }) {
  const inputRef = useRef(null);
  const settled = useRef(false); // blur also fires after Enter/Esc unmount the field – only finish once

  useEffect(() => {
    inputRef.current.focus({ preventScroll: true });
    // inputRef.current.select();
  }, []);

  const finish = (fn) => {
    if (settled.current) return;
    settled.current = true;
    fn();
  };

  return (
    <input
      ref={inputRef}
      className="edit"
      defaultValue={initial}
      maxLength={80}
      aria-label="Task name"
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return; // don't submit while an IME is composing
        if (e.key === "Enter") {
          e.preventDefault();
          finish(() => onSave(e.currentTarget.value));
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(onCancel);
        }
      }}
      onBlur={(e) => finish(() => onSave(e.currentTarget.value))}
    />
  );
}
