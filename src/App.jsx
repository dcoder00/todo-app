import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import TodoCard from "./TodoCard.jsx";
import ContextMenu from "./ContextMenu.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";

const STORAGE_KEY = "swipe-todo:v1";
const HINT_KEY = "__undo-hint__"; // key of the "undo" hint row in the FLIP position map

const SEED = [
  { id: "s1", text: "Review pull requests", done: false },
  { id: "s2", text: "Reply to client emails", done: false },
  { id: "s3", text: "Book dentist appointment", done: false },
  { id: "s4", text: "Prepare sprint demo", done: false },
];

function loadTasks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (t) => t && typeof t.id === "string" && typeof t.text === "string",
        )
        .map((t) => ({ id: t.id, text: t.text, done: Boolean(t.done) }));
    }
  } catch {
    /* storage unavailable or corrupt – fall through to seed data */
  }
  return SEED;
}

export default function App() {
  const [tasks, setTasks] = useState(loadTasks);
  const [draft, setDraft] = useState("");
  const [freshId, setFreshId] = useState(null);
  const [menu, setMenu] = useState(null); // { id, x, y } – right-click drop-down
  const [confirmId, setConfirmId] = useState(null); // task awaiting delete confirmation
  const [editingId, setEditingId] = useState(null); // task whose name is being edited
  const frameRef = useRef(null);

  // --- FLIP: when the order changes, glide every moved row from its old spot to its new one ---
  const nodes = useRef(new Map()); // id -> <li>
  const before = useRef(new Map()); // id -> offsetTop captured just before a state change
  const skipId = useRef(null); // the card that animates itself (slide out / slide in)

  const snapshot = () => {
    const m = new Map();
    nodes.current.forEach((el, id) => m.set(id, el.offsetTop));
    before.current = m;
  };

  const orderKey = tasks.map((t) => `${t.id}:${t.done}`).join("|");
  useLayoutEffect(() => {
    nodes.current.forEach((el, id) => {
      const prev = before.current.get(id);
      if (prev === undefined || id === skipId.current) return;
      const delta = prev - el.offsetTop;
      if (delta === 0) return;
      el.animate(
        [
          { transform: `translateY(${delta}px)` },
          { transform: "translateY(0)" },
        ],
        { duration: 360, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    });
    before.current = new Map();
    skipId.current = null;
  }, [orderKey]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      /* ignore */
    }
  }, [tasks]);

  // Insert position that sits directly below the last pending task.
  const endOfPending = (list) => {
    const firstDone = list.findIndex((t) => t.done);
    return firstDone === -1 ? list.length : firstDone;
  };

  // A finished task goes directly below the last pending task (most recent completion first).
  const handleDone = useCallback((id) => {
    snapshot();
    skipId.current = id;
    setTasks((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target || target.done) return prev;
      const rest = prev.filter((t) => t.id !== id);
      const at = endOfPending(rest);
      return [
        ...rest.slice(0, at),
        { ...target, done: true },
        ...rest.slice(at),
      ];
    });
  }, []);

  // Undo: the task becomes pending again and joins the end of the pending group.
  const handleUndo = useCallback((id) => {
    snapshot();
    skipId.current = id;
    setTasks((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target || !target.done) return prev;
      const rest = prev.filter((t) => t.id !== id);
      const at = endOfPending(rest);
      return [
        ...rest.slice(0, at),
        { ...target, done: false },
        ...rest.slice(at),
      ];
    });
  }, []);

  const handleDelete = useCallback((id) => {
    snapshot(); // remaining rows glide up to close the gap
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setConfirmId(null);
  }, []);

  const saveEdit = useCallback((id, text) => {
    const name = text.trim();
    setEditingId(null);
    if (!name) return; // empty name = keep the old one
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id && t.text !== name ? { ...t, text: name } : t,
      ),
    );
  }, []);

  const cancelEdit = useCallback(() => setEditingId(null), []);

  const openMenu = useCallback((id, clientX, clientY) => {
    const f = frameRef.current.getBoundingClientRect();
    setMenu({ id, x: clientX - f.left, y: clientY - f.top });
  }, []);
  const moveMenu = useCallback(
    (x, y) => setMenu((m) => (m ? { ...m, x, y } : m)),
    [],
  );
  const closeMenu = useCallback(() => setMenu(null), []);

  const addTask = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text,
      done: false,
    };
    snapshot();
    setTasks((prev) => {
      const at = endOfPending(prev);
      return [...prev.slice(0, at), task, ...prev.slice(at)];
    });
    setFreshId(task.id);
    setDraft("");
  };

  const remaining = tasks.filter((t) => !t.done).length;
  const firstDone = tasks.findIndex((t) => t.done); // the undo hint sits right above this row
  const confirmTask = tasks.find((t) => t.id === confirmId);

  return (
    <main className="frame" ref={frameRef}>
      <header className="head">
        <h1>To-do</h1>
        <span className="meta">{remaining} left</span>
      </header>
      <p className="hint">Swipe a task from right to left to complete it.</p>

      <ul className="list">
        {tasks.map((t, i) => (
          <Fragment key={t.id}>
            {i === firstDone && (
              <li
                className="list-hint"
                ref={(el) => {
                  if (el) nodes.current.set(HINT_KEY, el);
                  else nodes.current.delete(HINT_KEY);
                }}
              >
                Swipe a task from left to right to undo complete.
              </li>
            )}
            <li
              className={t.id === freshId ? "fresh" : undefined}
              ref={(el) => {
                if (el) nodes.current.set(t.id, el);
                else nodes.current.delete(t.id);
              }}
            >
              <TodoCard
                task={t}
                editing={t.id === editingId}
                onDone={handleDone}
                onUndo={handleUndo}
                onMenu={openMenu}
                onEditSave={saveEdit}
                onEditCancel={cancelEdit}
              />
            </li>
          </Fragment>
        ))}
        {tasks.length === 0 && (
          <li className="empty">
            Nothing here yet. Add your first task below.
          </li>
        )}
      </ul>

      <form className="add" onSubmit={addTask}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task…"
          maxLength={80}
          aria-label="New task"
        />
        <button type="submit" disabled={!draft.trim()}>
          Add
        </button>
      </form>

      {menu && (
        <ContextMenu
          menu={menu}
          frameRef={frameRef}
          onMove={moveMenu}
          onClose={closeMenu}
          onEdit={() => {
            setEditingId(menu.id);
            setMenu(null);
          }}
          onDelete={() => {
            setConfirmId(menu.id);
            setMenu(null);
          }}
        />
      )}

      {confirmTask && (
        <ConfirmDialog
          name={confirmTask.text}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => handleDelete(confirmTask.id)}
        />
      )}
    </main>
  );
}
