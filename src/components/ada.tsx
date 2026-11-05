"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Plus,
  ArrowRight,
  ChevronRight,
  Menu,
  X,
  BookOpen,
  Compass,
  Lightbulb,
  MoreHorizontal,
  Check,
  ArrowLeft,
  LogOut,
  Settings,
  Pause,
  Sparkles,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { PublicState, PublicCourse } from "@/lib/schema";
import type { Command } from "@/lib/service";
import { status, readiness } from "@/lib/learning";
type ApiResult = { state: PublicState; resource?: string; notice?: string };
function clearCachedAnswers() {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("ada-answer-")) localStorage.removeItem(key);
  } catch {}
}
function cachedAnswer(
  id: string | undefined,
  fallback: string,
  version: number,
) {
  if (!id || typeof window === "undefined") return fallback;
  try {
    const cached = JSON.parse(
      localStorage.getItem("ada-answer-" + id) || "null",
    );
    return cached?.version === version ? String(cached.text) : fallback;
  } catch {
    return fallback;
  }
}
const empty: PublicState = {
  drafts: [],
  courses: [],
  preferences: { timezone: "UTC", displayName: "" },
};
async function api(url: string, body?: unknown) {
  const r = await fetch("/api/v1/" + url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(
      data.error?.message || "Something went wrong. Please try again.",
    );
  return data;
}
export default function Ada() {
  const router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  const [state, setState] = useState<PublicState>(empty),
    [loading, setLoading] = useState(true),
    [loggedIn, setLoggedIn] = useState(false),
    [email, setEmail] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [mode, setMode] = useState({ mock: false, devAuth: false }),
    [drawer, setDrawer] = useState(false);
  const [observedActivityId, setObservedActivityId] = useState<
    string | undefined
  >(undefined);
  const [input, setInput] = useState(""),
    [answer, setAnswer] = useState(""),
    [menu, setMenu] = useState(false),
    [goalEdit, setGoalEdit] = useState(false),
    [goal, setGoal] = useState(""),
    [intent, setIntent] = useState<"curiosity" | "goal">("curiosity"),
    [deleting, setDeleting] = useState(false),
    [displayName, setDisplayName] = useState(""),
    [timezone, setTimezone] = useState("UTC");
  const pending = useRef(false),
    answerDirty = useRef(false),
    saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    retryKey = useRef<{ signature: string; key: string } | null>(null);
  const courseId = pathname.split("/")[3],
    course = state.courses.find((c) => c.id === courseId),
    draft = state.drafts.find((d) => d.id === params.get("draft"));
  const activity = course?.activities[course.current],
    tab = pathname.endsWith("/outline")
      ? "outline"
      : pathname.endsWith("/progress")
        ? "progress"
        : "learn";
  const isSettings = pathname === "/app/settings",
    isReview = pathname === "/app/review",
    isSetup = pathname === "/app/new";
  useEffect(() => {
    api("state")
      .then((data) => {
        setState(data.state);
        setMode(data.mode);
        setLoggedIn(true);
        setDisplayName(data.state.preferences.displayName);
        setTimezone(data.state.preferences.timezone);
      })
      .catch(() => setLoggedIn(false))
      .finally(() => setLoading(false));
  }, []);
  if (activity?.id !== observedActivityId) {
    setObservedActivityId(activity?.id);
    setAnswer(
      cachedAnswer(
        activity?.id,
        activity?.answer || "",
        activity?.answerVersion || 0,
      ),
    );
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawer(false);
        setMenu(false);
        setGoalEdit(false);
        setDeleting(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    const heading = document.querySelector<HTMLElement>(".lesson h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [activity?.id]);
  useEffect(() => {
    if (!goalEdit && !deleting) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(
      '[role="dialog"],[role="alertdialog"]',
    );
    const controls = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,textarea,select,a[href]",
        ) || [],
      );
    controls()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = controls(),
        first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [goalEdit, deleting]);
  async function run(cmd: Command): Promise<ApiResult | undefined> {
    if (
      [
        "saveAnswer",
        "attempt",
        "hint",
        "explain",
        "next",
        "skip",
        "pause",
      ].includes(cmd.action)
    )
      cmd = { ...cmd, activityId: activity?.id };
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const signature = JSON.stringify(cmd);
    if (!retryKey.current || retryKey.current.signature !== signature)
      retryKey.current = { signature, key: crypto.randomUUID() };
    try {
      const data = await api("command", {
        ...cmd,
        key: cmd.key || retryKey.current.key,
      });
      setState(data.state);
      if (cmd.action === "delete") {
        const removed = state.courses.find((c) => c.id === cmd.resource);
        try {
          removed?.activities.forEach((a) =>
            localStorage.removeItem("ada-answer-" + a.id),
          );
        } catch {}
      }
      if (data.notice) setError(data.notice);
      retryKey.current = null;
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
      try {
        const saved = await api("state");
        setState(saved.state);
      } catch {}
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function navigate(url: string) {
    if (answerDirty.current && course && activity && !activity.feedback) {
      if (!(await save())) return;
    }

    setMenu(false);
    setDrawer(false);
    setInput("");
    setError("");
    setGoalEdit(false);
    setDeleting(false);
    answerDirty.current = false;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    router.push(url);
  }
  async function save() {
    if (!course || !activity || activity.feedback || !answerDirty.current)
      return true;
    const result = await run({
      action: "saveAnswer",
      resource: course.id,
      text: answer,
      version: activity.answerVersion,
    });
    if (result) {
      answerDirty.current = false;
      return true;
    }
    return false;
  }
  function updateAnswer(text: string) {
    setAnswer(text);
    try {
      if (activity)
        localStorage.setItem(
          "ada-answer-" + activity.id,
          JSON.stringify({ text, version: activity.answerVersion }),
        );
    } catch {}
    answerDirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (pending.current) return;
      const data = await run({
        action: "saveAnswer",
        resource: course?.id,
        text,
        version: activity?.answerVersion,
      });
      if (data) answerDirty.current = false;
    }, 700);
  }
  async function activityAction(action: Command["action"]) {
    if (!course) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (["hint", "explain", "pause"].includes(action) && !(await save()))
      return;
    const data = await run({
      action,
      resource: course.id,
      ...(action === "attempt" ? { text: answer } : {}),
    });
    if (data) {
      if (action === "attempt" && activity) {
        try {
          localStorage.removeItem("ada-answer-" + activity.id);
        } catch {}
      }
      answerDirty.current = false;
      if (action === "pause") navigate("/app");
    }
  }
  async function startTopic(e: React.FormEvent) {
    e.preventDefault();
    const data = await run({ action: "createDraft", text: input });
    if (data) navigate("/app/new?draft=" + data.resource);
  }
  async function answerDraft(text: string) {
    if (!draft) return;
    const data = await run({
      action: "answerDraft",
      resource: draft.id,
      text,
      version: draft.revision,
    });
    if (data) setInput("");
  }
  function due(c: PublicCourse) {
    return c.reviews.filter((r) => Date.parse(r.dueAt) <= Date.now());
  }
  const icon = (c: PublicCourse) =>
    c.intent === "curiosity" ? <Compass size={17} /> : <BookOpen size={17} />;
  if (loading)
    return (
      <div className="boot">
        <span className="brand-mark">a</span>
        <p>Making room for curiosity…</p>
      </div>
    );
  if (!loggedIn)
    return (
      <main className="login">
        <Link className="brand" href="/app">
          <span className="brand-mark">a</span>Ada
          <span className="beta">EARLY ACCESS</span>
        </Link>
        <div className="login-inner">
          <span className="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</span>
          <h1>
            Your next
            <br />
            “oh, I get it.”
          </h1>
          <p>
            A course for whatever’s on your mind.
            <br />A coach to help it make sense.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("login", { email });
                setSent(true);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="email">Your email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="primary" disabled={busy}>
              {busy ? "Sending…" : "Continue with email"}
              <ArrowRight size={17} />
            </button>
          </form>
          {sent && (
            <p role="status">Check your email for a secure sign-in link.</p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <small>
            Lessons are generated and assessed using third-party AI. Please
            avoid sharing sensitive information.
          </small>
        </div>
        <footer>Ada teaches what no one bothered to make a course for.</footer>
      </main>
    );
  return (
    <div className="shell">
      <Link className="skip-link" href="#main">
        Skip to content
      </Link>
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
      <aside
        className={"sidebar " + (drawer ? "open" : "")}
        aria-label="Courses"
      >
        <Link
          href="/app"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("/app");
          }}
        >
          <span className="brand-mark">a</span>Ada
          <span className="beta">BETA</span>
        </Link>
        <button className="new-course" onClick={() => navigate("/app")}>
          <Plus size={18} />
          New course
        </button>
        <div className="nav-label">
          YOUR COURSES <span>{state.courses.length || ""}</span>
        </div>
        <nav className="courses">
          {state.courses.length ? (
            state.courses.map((c) => (
              <Link
                key={c.id}
                href={"/app/courses/" + c.id}
                title={c.title}
                className={
                  "course-link " + (course?.id === c.id ? "active" : "")
                }
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/app/courses/" + c.id);
                }}
              >
                {icon(c)}
                <span>{c.title}</span>
                {due(c).length > 0 && (
                  <i className="due-dot" aria-label="Review due" />
                )}
              </Link>
            ))
          ) : (
            <p className="empty-sidebar">
              A place for your interests.
              <br />
              Your courses will appear here.
            </p>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="quiet-note">
            <Sparkles size={16} />
            <p>
              A little every day.
              <br />
              <span>See where it takes you.</span>
            </p>
          </div>
          <button
            className={"profile " + (isSettings ? "active" : "")}
            onClick={() => navigate("/app/settings")}
          >
            <span className="avatar">
              {state.preferences.displayName?.[0]?.toUpperCase() || "Y"}
            </span>
            <span>
              {state.preferences.displayName || "Your learning space"}
              <small>Personal account</small>
            </span>
            <Settings size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open course menu"
            onClick={() => setDrawer(true)}
          >
            <Menu size={21} />
          </button>
          <span>
            {course ? (
              <>
                Your courses <ChevronRight size={13} />
                <span>{course.title}</span>
              </>
            ) : isSettings ? (
              "Your preferences"
            ) : isSetup ? (
              "A new beginning"
            ) : isReview ? (
              "A little recall"
            ) : (
              "Your learning space"
            )}
          </span>
          <div className="top-right">
            {mode.mock ? (
              <span className="dev-label">Local fake model</span>
            ) : (
              <span className="ai-label">
                <i />
                Your curiosity, a little further
              </span>
            )}
          </div>
        </header>
        {mode.devAuth && (
          <div className="demo-banner">
            Development preview · single local learner ·{" "}
            {mode.mock
              ? "lessons and grading are deterministic test fixtures"
              : "AI requires configured credentials"}
          </div>
        )}
        <main
          id="main"
          className={course ? "course-main" : "main"}
          tabIndex={-1}
        >
          {error && (
            <div className="error global-error" role="alert">
              {error}
              <button
                className="text-button"
                onClick={() => {
                  api("state")
                    .then((d) => {
                      setState(d.state);
                      setError("");
                    })
                    .catch(() =>
                      setError(
                        "Offline. Your last saved work is safe. Reconnect and retry.",
                      ),
                    );
                }}
              >
                Refresh saved state <RotateCcw size={13} />
              </button>
            </div>
          )}
          {!course && !isSetup && !isSettings && !isReview && (
            <div className="home">
              <div className="home-symbol">
                <Sparkles size={25} strokeWidth={1.3} />
              </div>
              <span className="eyebrow">FOLLOW THAT LITTLE SPARK</span>
              <h1>
                What would you like
                <br className="desktop-break" /> to learn?
              </h1>
              <p className="home-subtitle">
                A passing thought. A big ambition. A question that won’t leave.
              </p>
              <form className="topic-form" onSubmit={startTopic}>
                <input
                  aria-label="What would you like to learn?"
                  value={input}
                  maxLength={500}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="I’ve always wondered about…"
                  required
                />
                <button
                  className="send"
                  aria-label="Start a new course"
                  disabled={busy || !input.trim()}
                >
                  <ArrowUp size={21} />
                </button>
              </form>
              <p className="form-note">
                We’ll find a starting point, together.
                <span>
                  {input.length ? `${input.length}/500` : "No syllabus needed."}
                </span>
              </p>
              <div className="suggestions">
                <span>NOT SURE? FOLLOW A THREAD</span>
                <div>
                  {[
                    "Why do we dream?",
                    "The art of negotiation",
                    "How black holes work",
                  ].map((t) => (
                    <button key={t} onClick={() => setInput(t)}>
                      {t}
                      <ArrowUp size={13} />
                    </button>
                  ))}
                </div>
              </div>
              {state.drafts.some((d) => !d.courseId) && (
                <button
                  className="resume-row"
                  onClick={() =>
                    navigate(
                      "/app/new?draft=" +
                        state.drafts.filter((d) => !d.courseId).at(-1)!.id,
                    )
                  }
                >
                  <span>
                    Continue setting up{" "}
                    <strong>
                      {state.drafts.filter((d) => !d.courseId).at(-1)!.topic}
                    </strong>
                  </span>
                  <ArrowRight size={17} />
                </button>
              )}
              {state.courses.length > 0 && (
                <button
                  className="resume-row"
                  onClick={() =>
                    navigate(
                      "/app/courses/" +
                        [...state.courses].sort((a, b) =>
                          b.updatedAt.localeCompare(a.updatedAt),
                        )[0].id,
                    )
                  }
                >
                  <span>
                    Pick up where you left off{" "}
                    <strong>
                      {
                        [...state.courses].sort((a, b) =>
                          b.updatedAt.localeCompare(a.updatedAt),
                        )[0].title
                      }
                    </strong>
                  </span>
                  <ArrowRight size={17} />
                </button>
              )}
              <div className="home-footer">
                <span className="tiny-spark">✧</span> Built around you. Open to
                wherever you go.
              </div>
            </div>
          )}
          {isSetup && (
            <section className="setup reading">
              <button className="back" onClick={() => navigate("/app")}>
                <ArrowLeft size={15} />
                Your learning space
              </button>
              {!draft ? (
                <p>Choose a topic to start a course.</p>
              ) : (
                <>
                  <span className="eyebrow">
                    LET’S FIND YOUR STARTING POINT
                  </span>
                  <h1>{draft.topic}</h1>
                  <div className="conversation">
                    {draft.answers.map((a, i) => (
                      <div className="learner-turn" key={i}>
                        {a}
                      </div>
                    ))}
                  </div>
                  {draft.proposal ? (
                    <>
                      <div className="ada-message">
                        <span className="ada-avatar">a</span>
                        <div>
                          <h2>A path to begin with.</h2>
                          <p>{draft.proposal.direction}</p>
                        </div>
                      </div>
                      <div className="starting-path">
                        <div className="path-heading">
                          <span>YOUR STARTING PATH</span>
                          <span>Adaptable, always</span>
                        </div>
                        {draft.proposal.concepts.map((c, i) => (
                          <div className="path-row" key={c.slug}>
                            <span className="path-number">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <div>
                              <h3>{c.title}</h3>
                              <p>{c.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="cadence">
                        <Lightbulb size={16} />
                        {draft.proposal.cadence}
                      </p>
                      {draft.proposal.assumptions.map((a) => (
                        <p className="muted" key={a}>
                          {a}
                        </p>
                      ))}
                      <div className="actions">
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={async () => {
                            const data = await run({
                              action: "convert",
                              resource: draft.id,
                            });
                            if (data) navigate("/app/courses/" + data.resource);
                          }}
                        >
                          Start course
                          <ArrowRight size={17} />
                        </button>
                        <button
                          disabled={busy}
                          className="text-button"
                          onClick={() =>
                            run({ action: "adjust", resource: draft.id })
                          }
                        >
                          Adjust
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="ada-message">
                        <span className="ada-avatar">a</span>
                        <div>
                          <h2>
                            {draft.question?.question ||
                              "Let’s turn your curiosity into a starting path."}
                          </h2>
                          <p>
                            There’s no right answer. We’ll build from where you
                            are.
                          </p>
                        </div>
                      </div>
                      {draft.question && (
                        <div className="quick-replies">
                          {draft.question.options.map((option) => (
                            <button
                              disabled={busy}
                              key={option}
                              onClick={() => answerDraft(option)}
                            >
                              {option}
                              <ArrowRight size={14} />
                            </button>
                          ))}
                        </div>
                      )}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          answerDraft(input);
                        }}
                      >
                        <div className="reply-input">
                          <input
                            aria-label="Your answer"
                            placeholder="Or tell Ada in your own words…"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            maxLength={1500}
                          />
                          <button
                            className="send"
                            aria-label="Send answer"
                            disabled={busy || !input.trim()}
                          >
                            <ArrowUp size={18} />
                          </button>
                        </div>
                      </form>
                      <div className="actions">
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => answerDraft("Start now")}
                        >
                          Let Ada decide · Start now
                          <ArrowRight size={15} />
                        </button>
                        {draft.answers.length > 0 && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              run({ action: "propose", resource: draft.id })
                            }
                          >
                            Generate / retry starting path
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  {busy && (
                    <p className="thinking" role="status">
                      Ada is thinking through your next step…
                    </p>
                  )}
                </>
              )}
            </section>
          )}
          {course && (
            <>
              <div className="course-header">
                <div className="course-eyebrow">
                  <span className="eyebrow">
                    {course.intent === "curiosity"
                      ? "A CURIOSITY WORTH FOLLOWING"
                      : "SOMETHING TO WORK TOWARD"}
                  </span>
                  <div className="course-menu">
                    <button
                      className="icon-button"
                      aria-label="Course options"
                      aria-expanded={menu}
                      onClick={() => setMenu(!menu)}
                    >
                      <MoreHorizontal size={21} />
                    </button>
                    {menu && (
                      <div className="dropdown">
                        <button
                          onClick={() => {
                            setGoal(course.goals.at(-1)?.text || "");
                            setIntent(course.intent);
                            setGoalEdit(true);
                            setMenu(false);
                          }}
                        >
                          Change direction
                        </button>
                        <button
                          onClick={() => {
                            const title = window.prompt(
                              "Course name",
                              course.title,
                            );
                            if (title?.trim())
                              run({
                                action: "rename",
                                resource: course.id,
                                text: title,
                              });
                            setMenu(false);
                          }}
                        >
                          Rename course
                        </button>
                        <button
                          onClick={() => {
                            setDeleting(true);
                            setMenu(false);
                          }}
                        >
                          Delete course
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <h1>{course.title}</h1>
                <p>{course.goals.at(-1)?.text}</p>
                <nav className="tabs" aria-label="Course views">
                  {["Learn", "Outline", "Progress"].map((t) => (
                    <Link
                      key={t}
                      className={tab === t.toLowerCase() ? "selected" : ""}
                      href={
                        "/app/courses/" +
                        course.id +
                        (t === "Learn" ? "" : "/" + t.toLowerCase())
                      }
                      onClick={async (e) => {
                        e.preventDefault();
                        if (await save())
                          navigate(
                            "/app/courses/" +
                              course.id +
                              (t === "Learn" ? "" : "/" + t.toLowerCase()),
                          );
                      }}
                    >
                      {t}
                    </Link>
                  ))}
                </nav>
              </div>
              {goalEdit && (
                <div className="dialog-backdrop">
                  <section
                    className="dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="goal-title"
                  >
                    <button
                      className="close icon-button"
                      aria-label="Close"
                      onClick={() => setGoalEdit(false)}
                    >
                      <X size={19} />
                    </button>
                    <h2 id="goal-title">A new direction</h2>
                    <p>
                      Your learning evidence stays with this course. Ada will
                      adapt the starting path.
                    </p>
                    <label htmlFor="intent">I’m learning to</label>
                    <select
                      id="intent"
                      value={intent}
                      onChange={(e) =>
                        setIntent(e.target.value as "curiosity" | "goal")
                      }
                    >
                      <option value="curiosity">Explore a curiosity</option>
                      <option value="goal">Reach a concrete goal</option>
                    </select>
                    <label htmlFor="goal">
                      What would you like to explore or do?
                    </label>
                    <textarea
                      id="goal"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      maxLength={800}
                    />
                    <button
                      className="primary"
                      disabled={busy || !goal.trim()}
                      onClick={async () => {
                        if (
                          await run({
                            action: "goal",
                            resource: course.id,
                            text: goal,
                            intent,
                          })
                        )
                          setGoalEdit(false);
                      }}
                    >
                      Update direction
                      <ArrowRight size={16} />
                    </button>
                  </section>
                </div>
              )}
              {deleting && (
                <div className="dialog-backdrop">
                  <section
                    className="dialog"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="delete-title"
                  >
                    <h2 id="delete-title">Delete this course?</h2>
                    <p>
                      This permanently removes “{course.title}”, its lessons,
                      answers, evidence and reviews.
                    </p>
                    <div className="actions">
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={async () => {
                          if (
                            await run({ action: "delete", resource: course.id })
                          )
                            navigate("/app");
                        }}
                      >
                        Delete course
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setDeleting(false)}
                      >
                        Keep learning
                      </button>
                    </div>
                  </section>
                </div>
              )}
              <div className="workspace">
                {tab === "learn" && (
                  <>
                    {!activity ? (
                      <div className="lesson-intro">
                        <span className="lesson-icon">
                          <Compass size={27} strokeWidth={1.3} />
                        </span>
                        <span className="eyebrow">ONE IDEA AT A TIME</span>
                        <h2>Let’s see where you are.</h2>
                        <p>
                          We’ll begin with a small question, then build on what
                          you know. This path will change as you learn.
                        </p>
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() =>
                            run({ action: "session", resource: course.id })
                          }
                        >
                          {busy
                            ? "Preparing your first activity…"
                            : "Begin learning"}
                          <ArrowRight size={17} />
                        </button>
                        {due(course).length > 0 && (
                          <p className="muted">
                            A review is ready when you are.
                          </p>
                        )}
                      </div>
                    ) : (
                      <article className="lesson" key={activity.id}>
                        <div className="lesson-meta">
                          <span>
                            {activity.isReview
                              ? "A LITTLE RECALL"
                              : activity.spec.kind === "explanation"
                                ? "LET’S LOOK CLOSER"
                                : "THINK IT THROUGH"}
                            <i />{" "}
                            {
                              course.plan.concepts.find(
                                (c) => c.slug === activity.concept,
                              )?.title
                            }
                          </span>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => activityAction("pause")}
                          >
                            <Pause size={13} />
                            Pause
                          </button>
                        </div>
                        <h2>{activity.spec.title}</h2>
                        <div className="prose">{activity.spec.body}</div>
                        {activity.alternative && (
                          <div className="aside-explanation">
                            <span className="eyebrow">
                              ANOTHER WAY TO SEE IT
                            </span>
                            <p>{activity.alternative}</p>
                          </div>
                        )}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            activityAction("attempt");
                          }}
                        >
                          {activity.spec.kind !== "explanation" && (
                            <>
                              <h3 className="question">
                                {activity.spec.prompt}
                              </h3>
                              {activity.spec.kind === "multiple_choice" ? (
                                <fieldset
                                  className="choices"
                                  disabled={!!activity.feedback || busy}
                                >
                                  <legend className="sr-only">
                                    Choose your answer
                                  </legend>
                                  {activity.spec.choices.map((choice, i) => (
                                    <label
                                      className={
                                        "choice " +
                                        (answer === choice.id ? "chosen" : "")
                                      }
                                      key={choice.id}
                                    >
                                      <input
                                        type="radio"
                                        name="answer"
                                        value={choice.id}
                                        checked={answer === choice.id}
                                        onChange={() => updateAnswer(choice.id)}
                                      />
                                      <span className="choice-letter">
                                        {String.fromCharCode(65 + i)}
                                      </span>
                                      <span>{choice.text}</span>
                                      {answer === choice.id && (
                                        <Check size={17} />
                                      )}
                                    </label>
                                  ))}
                                </fieldset>
                              ) : (
                                <>
                                  <label className="sr-only" htmlFor="response">
                                    Your explanation
                                  </label>
                                  <textarea
                                    id="response"
                                    className="response"
                                    placeholder="Think it through in your own words…"
                                    value={answer}
                                    onChange={(e) =>
                                      updateAnswer(e.target.value)
                                    }
                                    disabled={!!activity.feedback}
                                    maxLength={10000}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        if (answer.trim() && !busy)
                                          activityAction("attempt");
                                      }
                                    }}
                                  />
                                  <p className="input-note">
                                    Saved as you go · Shift + Enter for a new
                                    line
                                  </p>
                                </>
                              )}
                            </>
                          )}
                          {activity.hint && !activity.feedback && (
                            <div className="hint">
                              <Lightbulb size={17} />
                              <p>
                                {activity.hint}
                                <small>
                                  This attempt will be recorded as assisted.
                                </small>
                              </p>
                            </div>
                          )}
                          {activity.feedback ? (
                            <div
                              className={"feedback " + activity.feedback.result}
                              role="status"
                            >
                              <span className="eyebrow">
                                {activity.feedback.result === "correct"
                                  ? "THAT CONNECTS"
                                  : activity.feedback.result === "uncertain"
                                    ? "A MOMENT TO REFLECT"
                                    : "LET’S BUILD ON THAT"}
                                {activity.assisted ? " · WITH SUPPORT" : ""}
                              </span>
                              <p>{activity.feedback.feedback}</p>
                              <button
                                type="button"
                                className="primary"
                                disabled={busy}
                                onClick={() => activityAction("next")}
                              >
                                Continue
                                <ArrowRight size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="lesson-actions">
                              <button
                                className="primary"
                                disabled={
                                  busy ||
                                  (activity.spec.kind !== "explanation" &&
                                    !answer.trim())
                                }
                                type={
                                  activity.spec.kind === "explanation"
                                    ? "button"
                                    : "submit"
                                }
                                onClick={
                                  activity.spec.kind === "explanation"
                                    ? () => activityAction("next")
                                    : undefined
                                }
                              >
                                {busy
                                  ? "Working…"
                                  : activity.spec.kind === "explanation"
                                    ? "Continue"
                                    : "Check answer"}
                                <ArrowRight size={16} />
                              </button>
                              <div className="secondary-actions">
                                <button
                                  type="button"
                                  className="text-button"
                                  disabled={busy}
                                  onClick={() => activityAction("hint")}
                                >
                                  <Lightbulb size={15} />
                                  Hint
                                </button>
                                <button
                                  type="button"
                                  className="text-button"
                                  disabled={busy}
                                  onClick={() => activityAction("explain")}
                                >
                                  Explain differently
                                </button>
                                <button
                                  type="button"
                                  className="text-button"
                                  disabled={busy}
                                  onClick={() => activityAction("skip")}
                                >
                                  Skip
                                </button>
                              </div>
                            </div>
                          )}
                        </form>
                        <p className="ai-disclosure">
                          AI-generated learning content · May make mistakes. Ask
                          questions and check important claims.
                        </p>
                      </article>
                    )}
                  </>
                )}
                {tab === "outline" && (
                  <section className="outline">
                    <span className="eyebrow">A MAP, NOT A CHECKLIST</span>
                    <h2>Your path, so far.</h2>
                    <p className="muted">
                      A provisional outline. We’ll adapt it as your
                      understanding grows.
                    </p>
                    {course.plan.concepts.map((n, i) => (
                      <details key={n.slug} className="concept">
                        <summary>
                          <span className="path-number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span>
                            {n.title}
                            <small>
                              {n.prerequisites.length
                                ? `Builds on ${n.prerequisites.map((p) => course.plan.concepts.find((c) => c.slug === p)?.title).join(", ")}`
                                : "Your starting point"}
                            </small>
                          </span>
                          <span className="status">
                            {status(
                              course.evidence.filter(
                                (e) => e.concept === n.slug,
                              ),
                              course.reviews.find((r) => r.concept === n.slug)
                                ?.dueAt,
                            )}
                          </span>
                          <ChevronRight size={16} />
                        </summary>
                        <div className="concept-detail">
                          <p>{n.description}</p>
                          <p>
                            <strong>What you’ll practice:</strong>{" "}
                            {n.criteria.join(" ")}
                          </p>
                          {course.evidence
                            .filter((e) => e.concept === n.slug)
                            .map((e) => (
                              <p className="evidence" key={e.id}>
                                {e.result.feedback}
                                <small>
                                  {e.assisted ? "With support" : "Independent"}{" "}
                                  · {new Date(e.at).toLocaleDateString()}
                                </small>
                              </p>
                            ))}
                        </div>
                      </details>
                    ))}
                    <p className="muted small">
                      {course.curriculumVersions.length} curriculum version
                      {course.curriculumVersions.length === 1 ? "" : "s"} · Your
                      evidence stays with you when the path changes.
                    </p>
                  </section>
                )}
                {tab === "progress" && (
                  <section className="progress">
                    <span className="eyebrow">
                      UNDERSTANDING, WITH EVIDENCE
                    </span>
                    <h2>
                      {course.intent === "goal"
                        ? readiness(course)
                        : "See what’s taking shape."}
                    </h2>
                    <p className="muted">
                      {course.intent === "goal"
                        ? `Estimated readiness for: ${course.goals.at(-1)?.text}. This is a provisional estimate, not a qualification.`
                        : "Curiosity has no finish line. Here’s what you’ve explored and what could come next."}
                    </p>
                    {[
                      "What you can explain",
                      "Needs more practice",
                      "Due to revisit",
                    ].map((heading, i) => {
                      const nodes = course.plan.concepts.filter((n) => {
                        const label = status(
                          course.evidence.filter((e) => e.concept === n.slug),
                          course.reviews.find((r) => r.concept === n.slug)
                            ?.dueAt,
                        );
                        return i === 0
                          ? label === "Demonstrated"
                          : i === 1
                            ? label === "Developing"
                            : label === "Review due";
                      });
                      return (
                        <div className="progress-section" key={heading}>
                          <h3>{heading}</h3>
                          {nodes.length ? (
                            nodes.map((n) => <p key={n.slug}>{n.title}</p>)
                          ) : (
                            <p className="muted">
                              {i === 0
                                ? "Not enough evidence yet. Two different independent successes, including a more challenging question, are needed."
                                : i === 1
                                  ? "Your next answers will help us find a useful starting point."
                                  : "Nothing due right now."}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <div className="progress-section">
                      <h3>Learning evidence</h3>
                      {course.evidence.length ? (
                        course.evidence
                          .slice()
                          .reverse()
                          .map((e) => (
                            <div className="evidence" key={e.id}>
                              <span>
                                {course.plan.concepts.find(
                                  (c) => c.slug === e.concept,
                                )?.title || e.concept}
                              </span>
                              <p>{e.result.feedback}</p>
                              <small>
                                {e.assisted ? "Assisted" : "Independent"} ·{" "}
                                {e.result.result} ·{" "}
                                {new Date(e.at).toLocaleString(undefined, {
                                  timeZone: state.preferences.timezone,
                                })}
                              </small>
                            </div>
                          ))
                      ) : (
                        <p className="muted">
                          No assessments yet. Reading and lesson counts don’t
                          establish proficiency.
                        </p>
                      )}
                    </div>
                    <div className="progress-section">
                      <h3>Scheduled recall</h3>
                      {course.reviews.length ? (
                        course.reviews.map((r) => (
                          <p key={r.concept}>
                            {
                              course.plan.concepts.find(
                                (n) => n.slug === r.concept,
                              )?.title
                            }{" "}
                            <span className="muted">
                              ·{" "}
                              {new Date(r.dueAt).toLocaleDateString(undefined, {
                                timeZone: state.preferences.timezone,
                              })}
                            </span>
                          </p>
                        ))
                      ) : (
                        <p className="muted">
                          Your first assessment will schedule a gentle recall
                          check.
                        </p>
                      )}
                    </div>
                    <div className="progress-section">
                      <h3>Direction history</h3>
                      {course.goals.map((g, i) => (
                        <p key={i}>
                          {g.text}
                          <small>
                            Version {i + 1} ·{" "}
                            {new Date(g.at).toLocaleDateString()}
                          </small>
                        </p>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </>
          )}
          {isSettings && (
            <section className="reading settings">
              <span className="eyebrow">MAKE YOURSELF AT HOME</span>
              <h1>Your preferences</h1>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await run({
                    action: "preferences",
                    text: displayName,
                    timezone,
                  });
                }}
              >
                <label htmlFor="displayName">Your name</label>
                <input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={100}
                />
                <label htmlFor="timezone">Time zone</label>
                <input
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="America/Chicago"
                />
                <button className="primary" disabled={busy}>
                  Save preferences
                  <Check size={16} />
                </button>
              </form>
              <div className="progress-section">
                <h3>Reminders</h3>
                <p>
                  All reminders are off. Ada does not send learning
                  notifications. Reminder delivery is planned for a later
                  version.
                </p>
                <button
                  className="text-button"
                  onClick={() => navigate("/app/review")}
                >
                  See your due reviews
                  <ArrowRight size={14} />
                </button>
              </div>
              <div className="progress-section">
                <h3>Your data, your call</h3>
                <p>
                  Topics, answers and relevant course history are sent to the
                  configured AI provider for teaching and assessment. Avoid
                  sharing secrets or sensitive personal details. AI can make
                  mistakes, especially on niche or high-stakes subjects.
                </p>
                <Link
                  prefetch={false}
                  download
                  href="/api/v1/export"
                  className="text-button"
                >
                  Export your learning data
                  <ArrowRight size={14} />
                </Link>
                <button
                  className="text-button"
                  onClick={async () => {
                    await api("logout", {});
                    clearCachedAnswers();
                    setLoggedIn(false);
                    navigate("/login");
                  }}
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
              <div className="progress-section">
                <h3>Delete account</h3>
                <p>
                  Permanently removes your account and all associated learner
                  data.
                </p>
                <button
                  className="text-button danger-text"
                  onClick={async () => {
                    if (
                      window.confirm(
                        "Permanently delete your account and all courses? This cannot be undone.",
                      )
                    ) {
                      try {
                        await api("delete-account", {});
                        clearCachedAnswers();
                        setLoggedIn(false);
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }
                  }}
                >
                  <Trash2 size={14} />
                  Delete my account
                </button>
              </div>
            </section>
          )}
          {isReview && (
            <section className="reading reviews">
              <span className="eyebrow">MAKE IT STICK</span>
              <h1>A little recall.</h1>
              {state.courses.some((c) => due(c).length) ? (
                state.courses
                  .filter((c) => due(c).length)
                  .map((c) => (
                    <button
                      className="resume-row"
                      key={c.id}
                      onClick={() => navigate("/app/courses/" + c.id)}
                    >
                      <span>
                        {c.title}
                        <small>
                          {due(c).length} concept{due(c).length > 1 ? "s" : ""}{" "}
                          to revisit
                        </small>
                      </span>
                      <ArrowRight size={17} />
                    </button>
                  ))
              ) : (
                <>
                  <p>
                    Nothing due right now. Your next recall checks will appear
                    here after you’ve practiced.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => navigate("/app")}
                  >
                    Follow another curiosity
                    <ArrowRight size={16} />
                  </button>
                </>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
