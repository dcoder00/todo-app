import { useEffect, useRef } from "react";

/** Modal confirmation shown before a task is deleted. Cancel is focused by default (safe choice). */
export default function ConfirmDialog({ name, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current.focus({ preventScroll: true });
  }, []);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === "Tab") {
      // keep keyboard focus inside the dialog
      const buttons = dialogRef.current.querySelectorAll("button");
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div
      className="backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel(); // click outside the box = cancel
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={dialogRef}
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-msg"
        onKeyDown={onKeyDown}
      >
        <p id="confirm-msg">
          Are you sure you want to delete the task: <strong>{name}</strong>?
        </p>
        <div className="dialog__actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
