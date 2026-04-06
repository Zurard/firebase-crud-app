"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Task, TaskFormState } from "@/lib/types";

const emptyForm: TaskFormState = {
  title: "",
  detail: "",
  status: "todo",
};

const statusStyles = {
  todo: "bg-[color:var(--accent-soft)] text-[color:var(--accent)]",
  doing: "bg-[rgba(71,209,140,0.16)] text-[color:var(--success)]",
  done: "bg-[rgba(231,236,245,0.16)] text-[color:var(--foreground)]",
} as const;

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState<TaskFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const tasksRef = collection(db, "tasks");
    const tasksQuery = query(tasksRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      tasksQuery,
      (snapshot) => {
        const nextTasks = snapshot.docs.map((item) => {
          const data = item.data() as Omit<Task, "id">;
          return { id: item.id, ...data };
        });
        setTasks(nextTasks);
      },
      (snapshotError) => {
        setError(snapshotError.message);
      },
    );

    return () => unsubscribe();
  }, []);

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const normalized = search.toLowerCase();
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(normalized) ||
        task.detail.toLowerCase().includes(normalized),
    );
  }, [search, tasks]);

  const totals = useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        acc.all += 1;
        acc[task.status] += 1;
        return acc;
      },
      { all: 0, todo: 0, doing: 0, done: 0 },
    );
  }, [tasks]);

  const handleChange = (
    field: keyof TaskFormState,
    value: TaskFormState[keyof TaskFormState],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        title: form.title.trim(),
        detail: form.detail.trim(),
        status: form.status,
        updatedAt: Date.now(),
      };

      if (!payload.title) {
        setError("Title is required.");
        setSaving(false);
        return;
      }

      if (editingId) {
        await updateDoc(doc(db, "tasks", editingId), payload);
      } else {
        await addDoc(collection(db, "tasks"), {
          ...payload,
          createdAt: Date.now(),
        });
      }

      resetForm();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setForm({ title: task.title, detail: task.detail, status: task.status });
  };

  const handleDelete = async (taskId: string) => {
    setError(null);
    try {
      await deleteDoc(doc(db, "tasks", taskId));
      if (editingId === taskId) {
        resetForm();
      }
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete task.";
      setError(message);
    }
  };

  return (
    <div className="flex-1 bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="hero-gradient gridlines">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 sm:px-10 lg:px-16">
          <section className="fade-up flex flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--border)] bg-[rgba(15,17,21,0.6)] px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-[color:var(--foreground-muted)]">
              Firebase + Next.js
            </span>
            <div className="flex flex-col gap-4">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Firebase CRUD Studio
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[color:var(--foreground-muted)] sm:text-lg">
                Create, edit, and manage tasks in Firestore with a fast Next.js
                UI. Live updates, inline editing, and focused workflows make it
                easy to track work in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-xl border border-[color:var(--border)] bg-[rgba(15,17,21,0.5)] px-4 py-3 text-sm">
                <p className="font-semibold text-white">{totals.all}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--foreground-muted)]">
                  Total
                </p>
              </div>
              <div className="rounded-xl border border-[color:var(--border)] bg-[rgba(15,17,21,0.5)] px-4 py-3 text-sm">
                <p className="font-semibold text-white">{totals.todo}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--foreground-muted)]">
                  Todo
                </p>
              </div>
              <div className="rounded-xl border border-[color:var(--border)] bg-[rgba(15,17,21,0.5)] px-4 py-3 text-sm">
                <p className="font-semibold text-white">{totals.doing}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--foreground-muted)]">
                  Doing
                </p>
              </div>
              <div className="rounded-xl border border-[color:var(--border)] bg-[rgba(15,17,21,0.5)] px-4 py-3 text-sm">
                <p className="font-semibold text-white">{totals.done}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--foreground-muted)]">
                  Done
                </p>
              </div>
            </div>
          </section>

          <section className="fade-up delay-1 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="glass rounded-3xl p-6 sm:p-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-semibold text-white">
                    Focus panel
                  </h2>
                  <p className="text-sm text-[color:var(--foreground-muted)]">
                    {editingId
                      ? "Update the selected task or discard changes."
                      : "Add a new task to Firestore in seconds."}
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <label className="text-sm font-medium text-[color:var(--foreground-muted)]">
                    Title
                    <input
                      className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-base text-white outline-none transition focus:border-[color:var(--accent)]"
                      placeholder="Ship new onboarding flow"
                      value={form.title}
                      onChange={(event) =>
                        handleChange("title", event.target.value)
                      }
                    />
                  </label>
                  <label className="text-sm font-medium text-[color:var(--foreground-muted)]">
                    Detail
                    <textarea
                      className="mt-2 min-h-[120px] w-full resize-none rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-base text-white outline-none transition focus:border-[color:var(--accent)]"
                      placeholder="Outline the tasks, owners, and checkpoints."
                      value={form.detail}
                      onChange={(event) =>
                        handleChange("detail", event.target.value)
                      }
                    />
                  </label>
                  <label className="text-sm font-medium text-[color:var(--foreground-muted)]">
                    Status
                    <select
                      className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-base text-white outline-none transition focus:border-[color:var(--accent)]"
                      value={form.status}
                      onChange={(event) =>
                        handleChange(
                          "status",
                          event.target.value as TaskFormState["status"],
                        )
                      }
                    >
                      <option value="todo">Todo</option>
                      <option value="doing">Doing</option>
                      <option value="done">Done</option>
                    </select>
                  </label>
                  {error ? (
                    <div className="rounded-2xl border border-[color:var(--danger)]/60 bg-[rgba(255,111,111,0.12)] px-4 py-3 text-sm text-[color:var(--danger)]">
                      {error}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-full bg-[color:var(--accent-strong)] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {editingId ? "Update task" : "Create task"}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-full border border-[color:var(--border)] px-6 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
                    >
                      Clear
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="glass rounded-3xl p-6 sm:p-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-semibold text-white">
                    Live board
                  </h2>
                  <p className="text-sm text-[color:var(--foreground-muted)]">
                    Track and update work across your team.
                  </p>
                </div>
                <label className="text-sm font-medium text-[color:var(--foreground-muted)]">
                  Search tasks
                  <input
                    className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-base text-white outline-none transition focus:border-[color:var(--accent)]"
                    placeholder="Filter by keyword"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <div className="flex flex-col gap-4">
                  {filteredTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-6 py-12 text-center text-sm text-[color:var(--foreground-muted)]">
                      No tasks yet. Add the first one to get started.
                    </div>
                  ) : (
                    filteredTasks.map((task, index) => (
                      <div
                        key={task.id}
                        className="fade-up rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-strong)] p-5"
                        style={{ animationDelay: `${0.08 + index * 0.05}s` }}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-semibold text-white">
                                {task.title}
                              </h3>
                              <p className="text-sm text-[color:var(--foreground-muted)]">
                                {task.detail || "No details yet."}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusStyles[task.status]}`}
                            >
                              {task.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--foreground-muted)]">
                            <span className="rounded-full border border-[color:var(--border)] px-3 py-1 font-mono">
                              Updated{" "}
                              {new Date(task.updatedAt).toLocaleDateString()}
                            </span>
                            <span className="rounded-full border border-[color:var(--border)] px-3 py-1 font-mono">
                              ID {task.id.slice(0, 6)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => startEdit(task)}
                              className="rounded-full border border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(task.id)}
                              className="rounded-full border border-[rgba(255,111,111,0.5)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--danger)] transition hover:border-[color:var(--danger)]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="fade-up delay-2 grid gap-4 sm:grid-cols-3">
            <div className="glass rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--foreground-muted)]">
                Create
              </p>
              <p className="mt-2 text-sm text-white">
                Add new tasks to the Firestore collection instantly.
              </p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--foreground-muted)]">
                Update
              </p>
              <p className="mt-2 text-sm text-white">
                Edit titles, details, and status with live sync.
              </p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--foreground-muted)]">
                Delete
              </p>
              <p className="mt-2 text-sm text-white">
                Remove tasks in a single click, instantly.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
