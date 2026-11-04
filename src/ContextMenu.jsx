import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Small drop-down opened by right-clicking a task.
 * Rendered inside the app frame (not the page) so it can never leave the 16:9 canvas.
 * menu = { id, x, y } – x/y are relative to the frame's top-left corner.
 */
export default function ContextMenu({
  menu,
  frameRef,
  onMove,
  onEdit,
  onDelete,
  onClose,
}) {
  const ref = useRef(null);

  // Keep the menu fully inside the frame (right-clicking near an edge would otherwise clip it).
  useLayoutEffect(() => {
    const f = frameRef.current.getBoundingClientRect();
    const m = ref.current.getBoundingClientRect();
    const pad = 6;
    const x = Math.max(pad, Math.min(menu.x, f.width - m.width - pad));
    const y = Math.max(pad, Math.min(menu.y, f.height - m.height - pad));
    if (x !== menu.x || y !== menu.y) onMove(x, y);
  }, [menu.x, menu.y, frameRef, onMove]);

  // Close on: click elsewhere, Esc, scroll, resize, window losing focus.
  useEffect(() => {
    const away = (e) => {
      if (!ref.current.contains(e.target)) onClose();
    };
    const key = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    document.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
      document.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  // Focus the first item for keyboard users (preventScroll: the menu may not be clamped yet).
  useEffect(() => {
    ref.current
      .querySelector('[role="menuitem"]')
      .focus({ preventScroll: true });
  }, []);

  const onKeyDown = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...ref.current.querySelectorAll('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    const step = e.key === "ArrowDown" ? 1 : -1;
    items[(i + step + items.length) % items.length].focus();
  };

  return (
    <div
      ref={ref}
      className="menu"
      role="menu"
      style={{ left: menu.x, top: menu.y }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" role="menuitem" onClick={onEdit}>
        Edit task
      </button>
      <button
        type="button"
        role="menuitem"
        className="menu__danger"
        onClick={onDelete}
      >
        Delete task
      </button>
    </div>
  );
}
