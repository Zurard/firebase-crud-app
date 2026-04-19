"use client";

import { useEffect, useMemo, useState } from "react";
import type { Analytics } from "firebase/analytics";
import { logEvent } from "firebase/analytics";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  auth,
  db,
  getFirebaseAnalytics,
  googleProvider,
  storage,
} from "@/lib/firebase";
import type { Task, TaskFormState } from "@/lib/types";

const emptyForm: TaskFormState = {
  title: "",
  detail: "",
  status: "todo",
  priority: "medium",
  dueDate: "",
};

const statusStyles = {
  todo: "bg-[color:var(--accent-soft)] text-[color:var(--accent)]",
  doing: "bg-[rgba(71,209,140,0.16)] text-[color:var(--success)]",
  done: "bg-[rgba(231,236,245,0.16)] text-[color:var(--foreground)]",
} as const;

const priorityStyles = {
  low: "bg-[rgba(71,209,140,0.18)] text-[color:var(--success)]",
  medium: "bg-[color:var(--accent-soft)] text-[color:var(--accent)]",
  high: "bg-[rgba(255,111,111,0.16)] text-[color:var(--danger)]",
} as const;

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState<TaskFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    getFirebaseAnalytics().then((instance) => {
      setAnalytics(instance);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }

    const tasksRef = collection(db, "tasks");
    const tasksQuery = query(tasksRef, where("ownerId", "==", user.uid));
    const unsubscribe = onSnapshot(
      tasksQuery,
      (snapshot) => {
        const nextTasks = snapshot.docs.map((item) => {
          const data = item.data() as Omit<Task, "id">;
          return { id: item.id, ...data };
        });
        nextTasks.sort((a, b) => b.createdAt - a.createdAt);
        setTasks(nextTasks);
      },
      (snapshotError) => {
        setError(snapshotError.message);
      },
    );

    return () => unsubscribe();
  }, [user]);

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
    setSelectedFile(null);
  };

  const safeLogEvent = (eventName: string, params?: Record<string, unknown>) => {
    if (!analytics || !eventName || eventName.length > 40) {
      return;
    }

    logEvent(analytics, eventName, params);
  };

  const uploadAttachment = async (taskId: string) => {
    if (!user || !selectedFile) {
      return null;
    }

    const attachmentPath = `attachments/${user.uid}/${taskId}/${Date.now()}-${selectedFile.name}`;
    const storageRef = ref(storage, attachmentPath);

    await uploadBytes(storageRef, selectedFile);
    const attachmentUrl = await getDownloadURL(storageRef);

    safeLogEvent("file_uploaded", {
      task_id: taskId,
      file_size: selectedFile.size,
    });

    return {
      attachmentName: selectedFile.name,
      attachmentPath,
      attachmentUrl,
    };
  };

  const handleEmailAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (isRegisterMode) {
        await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
      } else {
        await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
      }

      safeLogEvent("login", { method: isRegisterMode ? "email_register" : "email" });
      setAuthEmail("");
      setAuthPassword("");
    } catch (loginError) {
      const message =
        loginError instanceof Error ? loginError.message : "Authentication failed.";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);

    try {
      await signInWithPopup(auth, googleProvider);
      safeLogEvent("login", { method: "google" });
    } catch (googleError) {
      const message =
        googleError instanceof Error ? googleError.message : "Google sign in failed.";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    if (!user) {
      setError("Please sign in first.");
      return;
    }

    event.preventDefault();
    setSaving(true);
    setError(null);
    setUploading(false);

    try {
      const payload = {
        ownerId: user.uid,
        ownerName: user.displayName ?? "Student",
        ownerEmail: user.email ?? "",
        title: form.title.trim(),
        detail: form.detail.trim(),
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate,
        updatedAt: Date.now(),
      };

      if (!payload.title) {
        setError("Title is required.");
        setSaving(false);
        return;
      }

      if (editingId) {
        const taskToEdit = tasks.find((item) => item.id === editingId);
        const updatePayload: Partial<Task> = {
          ...payload,
        };

        if (selectedFile) {
          setUploading(true);
          const upload = await uploadAttachment(editingId);
          if (upload) {
            if (taskToEdit?.attachmentPath) {
              await deleteObject(ref(storage, taskToEdit.attachmentPath)).catch(() => {
                return null;
              });
            }
            updatePayload.attachmentName = upload.attachmentName;
            updatePayload.attachmentPath = upload.attachmentPath;
            updatePayload.attachmentUrl = upload.attachmentUrl;
          }
        }

        await updateDoc(doc(db, "tasks", editingId), updatePayload);
        safeLogEvent("task_updated", { task_id: editingId });
      } else {
        const createdRef = await addDoc(collection(db, "tasks"), {
          ...payload,
          attachmentName: "",
          attachmentPath: "",
          attachmentUrl: "",
          createdAt: Date.now(),
        });

        if (selectedFile) {
          setUploading(true);
          const upload = await uploadAttachment(createdRef.id);

          if (upload) {
            await updateDoc(doc(db, "tasks", createdRef.id), {
              attachmentName: upload.attachmentName,
              attachmentPath: upload.attachmentPath,
              attachmentUrl: upload.attachmentUrl,
            });
          }
        }

        safeLogEvent("task_created", { task_id: createdRef.id });
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
      setUploading(false);
    }
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setForm({
      title: task.title,
      detail: task.detail,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
    });
  };

  const handleDelete = async (taskId: string) => {
    setError(null);
    try {
      const targetTask = tasks.find((task) => task.id === taskId);

      if (targetTask?.attachmentPath) {
        await deleteObject(ref(storage, targetTask.attachmentPath)).catch(() => {
          return null;
        });
      }

      await deleteDoc(doc(db, "tasks", taskId));
      safeLogEvent("task_deleted", { task_id: taskId });

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

  const handleSignOut = async () => {
    await signOut(auth);
    setAuthError(null);
    resetForm();
  };

  if (!user) {
    return (
      <div className="flex-1 bg-[color:var(--background)] text-[color:var(--foreground)]">
        <div className="hero-gradient gridlines">
          <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 sm:px-10 lg:px-16">
            <section className="fade-up grid gap-8 lg:grid-cols-2">
              <div className="flex flex-col gap-5">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--border)] bg-[rgba(15,17,21,0.6)] px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-[color:var(--foreground-muted)]">
                  ProManage
                </span>
                <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                  Student Project Tracker
                </h1>
                <p className="max-w-xl text-base leading-7 text-[color:var(--foreground-muted)] sm:text-lg">
                  Plan coursework, track progress, and attach project evidence.
                  Sign in to unlock your personal task workspace powered by
                  Firestore, Storage, Functions, and Analytics.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="glass rounded-2xl p-4 text-sm">Auth + Roles</div>
                  <div className="glass rounded-2xl p-4 text-sm">File Storage</div>
                  <div className="glass rounded-2xl p-4 text-sm">Usage Analytics</div>
                </div>
              </div>
              <div className="glass fade-up delay-1 rounded-3xl p-6 sm:p-8">
                <div className="flex flex-col gap-5">
                  <h2 className="text-2xl font-semibold text-white">
                    {isRegisterMode ? "Create account" : "Sign in"}
                  </h2>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={authLoading}
                    className="rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-semibold text-white transition hover:border-[color:var(--accent)] disabled:opacity-70"
                  >
                    Continue with Google
                  </button>
                  <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
                    <label className="text-sm font-medium text-[color:var(--foreground-muted)]">
                      Email
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(event) => setAuthEmail(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-white outline-none focus:border-[color:var(--accent)]"
                        placeholder="student@college.edu"
                        required
                      />
                    </label>
                    <label className="text-sm font-medium text-[color:var(--foreground-muted)]">
                      Password
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(event) => setAuthPassword(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-white outline-none focus:border-[color:var(--accent)]"
                        placeholder="Minimum 6 characters"
                        required
                        minLength={6}
                      />
                    </label>
                    {authError ? (
                      <div className="rounded-2xl border border-[color:var(--danger)]/60 bg-[rgba(255,111,111,0.12)] px-4 py-3 text-sm text-[color:var(--danger)]">
                        {authError}
                      </div>
                    ) : null}
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="rounded-full bg-[color:var(--accent-strong)] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-70"
                    >
                      {isRegisterMode ? "Register with email" : "Sign in with email"}
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => setIsRegisterMode((prev) => !prev)}
                    className="text-left text-sm text-[color:var(--foreground-muted)] underline underline-offset-4"
                  >
                    {isRegisterMode
                      ? "Already have an account? Switch to sign in"
                      : "No account yet? Switch to registration"}
                  </button>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="hero-gradient gridlines">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 sm:px-10 lg:px-16">
          <section className="fade-up flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--border)] bg-[rgba(15,17,21,0.6)] px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-[color:var(--foreground-muted)]">
                ProManage
              </span>
              <div className="flex items-center gap-3">
                <div className="rounded-full border border-[color:var(--border)] bg-[rgba(15,17,21,0.5)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--foreground-muted)]">
                  {user.email}
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-full border border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-[color:var(--accent)]"
                >
                  Sign out
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Student Project Tracker
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[color:var(--foreground-muted)] sm:text-lg">
                Manage course milestones with private authentication, file
                evidence, cloud activity logging, and analytics-backed usage
                insights.
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
                  <label className="text-sm font-medium text-[color:var(--foreground-muted)]">
                    Priority
                    <select
                      className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-base text-white outline-none transition focus:border-[color:var(--accent)]"
                      value={form.priority}
                      onChange={(event) =>
                        handleChange(
                          "priority",
                          event.target.value as TaskFormState["priority"],
                        )
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-[color:var(--foreground-muted)]">
                    Due date
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(event) => handleChange("dueDate", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-base text-white outline-none transition focus:border-[color:var(--accent)]"
                    />
                  </label>
                  <label className="text-sm font-medium text-[color:var(--foreground-muted)]">
                    Attachment
                    <input
                      type="file"
                      onChange={(event) =>
                        setSelectedFile(event.target.files?.[0] ?? null)
                      }
                      className="mt-2 w-full cursor-pointer rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm text-[color:var(--foreground-muted)] outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-[color:var(--accent)] file:px-4 file:py-2 file:font-semibold file:text-black hover:border-[color:var(--accent)]"
                    />
                  </label>
                  {uploading ? (
                    <div className="rounded-2xl border border-[color:var(--accent)]/60 bg-[rgba(245,182,91,0.12)] px-4 py-3 text-sm text-[color:var(--accent)]">
                      Uploading file, please wait...
                    </div>
                  ) : null}
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
                      No projects yet. Add your first milestone.
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
                          <div className="flex flex-wrap items-center gap-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${priorityStyles[task.priority]}`}
                            >
                              {task.priority} priority
                            </span>
                            <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-mono text-[color:var(--foreground-muted)]">
                              Due {task.dueDate || "not set"}
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
                          {task.attachmentUrl ? (
                            <a
                              href={task.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-fit rounded-full border border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)] transition hover:border-[color:var(--accent)]"
                            >
                              View {task.attachmentName || "attachment"}
                            </a>
                          ) : (
                            <span className="text-xs text-[color:var(--foreground-muted)]">
                              No attachment uploaded
                            </span>
                          )}
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
                Capture real project milestones and personal deadlines.
              </p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--foreground-muted)]">
                Update
              </p>
              <p className="mt-2 text-sm text-white">
                Update scope, status, and due date with live sync.
              </p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--foreground-muted)]">
                Upload
              </p>
              <p className="mt-2 text-sm text-white">
                Attach PDFs or screenshots as project evidence.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
