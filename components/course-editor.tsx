"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPresigned } from "@vercel/blob/client";
import {
  type Course,
  type CourseModule,
  type Lesson,
  MAX_BODY_LENGTH,
  MAX_DRIP_DAYS,
  MAX_ITEM_TITLE,
  MAX_LESSON_FILES,
  VIDEO_TYPES,
} from "@/lib/course";
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILE_BYTES,
  MULTIPART_ABOVE_BYTES,
  fileFolder,
  maxFileLabel,
  readableSize,
  safeFileName,
} from "@/lib/product-file";
import { LINK_PROBLEMS, type LinkProblem } from "@/lib/product-link";

const MESSAGES: Record<string, string> = {
  too_many: "That is as many as a course holds: 30 modules and 200 lessons.",
  not_empty: "Take its lessons out first, one by one, so no work is lost by accident.",
  drip: `Type a number of days from 0 to ${MAX_DRIP_DAYS}.`,
  files: `A lesson holds up to ${MAX_LESSON_FILES} downloads.`,
  video_type: "That video type does not play in every browser. Upload an MP4, a MOV or a WebM.",
  too_big: `That file is over ${maxFileLabel()}, which is the most one file can be.`,
  wrong_type: "That kind of file cannot be uploaded here.",
  unknown: "That is not there any more. Reload the page.",
  invalid: "That upload could not be checked. Try again.",
  signed_out: "Your session ended. Sign in again.",
  unavailable: "Stores are not switched on yet, so nothing was saved.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

type Answer = { ok?: boolean; error?: string; reason?: string; course?: Course };

async function post(payload: Record<string, unknown>): Promise<Answer> {
  try {
    const response = await fetch("/api/store/course", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await response.json().catch(() => ({ ok: false, error: "server_error" }))) as Answer;
  } catch {
    return { ok: false, error: "server_error" };
  }
}

function problem(answer: Answer): string {
  if (answer.error === "link") return LINK_PROBLEMS[answer.reason as LinkProblem] ?? LINK_PROBLEMS.shape;
  return MESSAGES[answer.error ?? ""] ?? MESSAGES.server_error;
}

const small = "text-ink-soft underline underline-offset-4 transition hover:text-violet-deep disabled:no-underline disabled:opacity-40";

/** Building a course: modules, lessons, and what each lesson holds. */
export function CourseEditor({ productId, initial, folder }: { productId: string; initial: Course; folder: string }) {
  const router = useRouter();
  const [course, setCourse] = useState<Course>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [newModule, setNewModule] = useState("");

  async function run(payload: Record<string, unknown>): Promise<Answer> {
    setBusy(true);
    setError(null);
    const answer = await post({ id: productId, ...payload });
    setBusy(false);
    if (answer.ok && answer.course) setCourse(answer.course);
    if (!answer.ok) setError(problem(answer));
    return answer;
  }

  const lessons = course.modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <div className="mt-8 space-y-6">
      {error ? (
        <p className="notice notice-error" role="alert">{error}</p>
      ) : null}

      {course.modules.map((unit, index) => (
        <ModuleCard
          key={unit.id}
          unit={unit}
          index={index}
          last={index === course.modules.length - 1}
          busy={busy}
          productId={productId}
          folder={folder}
          openLesson={openLesson}
          setOpenLesson={setOpenLesson}
          run={run}
          onCourse={setCourse}
          onError={setError}
        />
      ))}

      <form
        className="card p-6 sm:p-8"
        onSubmit={async (event) => {
          event.preventDefault();
          const answer = await run({ action: "edit", op: "module-add", title: newModule });
          if (answer.ok) setNewModule("");
        }}
      >
        <label htmlFor="new-module" className="field-label">Add a module</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="new-module"
            className="field min-w-0 flex-1"
            maxLength={MAX_ITEM_TITLE}
            placeholder={`Module ${course.modules.length + 1}`}
            value={newModule}
            onChange={(event) => setNewModule(event.target.value)}
          />
          <button type="submit" aria-busy={busy} disabled={busy} className="btn btn-secondary">Add module</button>
        </div>
      </form>

      {lessons === 0 ? (
        <div className="card-flat p-6 sm:p-8">
          <p className="text-sm text-ink-soft">
            Changed your mind? A course with no lessons can go back to being an ordinary product.
          </p>
          <button
            type="button"
            aria-busy={busy} disabled={busy}
            className="btn btn-secondary btn-sm mt-3"
            onClick={async () => {
              const answer = await run({ action: "disable" });
              if (answer.ok) router.push("/studio");
            }}
          >
            Stop selling it as a course
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ModuleCard({
  unit,
  index,
  last,
  busy,
  productId,
  folder,
  openLesson,
  setOpenLesson,
  run,
  onCourse,
  onError,
}: {
  unit: CourseModule;
  index: number;
  last: boolean;
  busy: boolean;
  productId: string;
  folder: string;
  openLesson: string | null;
  setOpenLesson: (id: string | null) => void;
  run: (payload: Record<string, unknown>) => Promise<Answer>;
  onCourse: (course: Course) => void;
  onError: (message: string | null) => void;
}) {
  const [title, setTitle] = useState(unit.title);
  const [drip, setDrip] = useState(String(unit.dripDays));
  const [newLesson, setNewLesson] = useState("");
  const changed = title !== unit.title || drip !== String(unit.dripDays);
  const titleId = `module-${unit.id}-title`;
  const dripId = `module-${unit.id}-drip`;

  return (
    <section className="card p-6 sm:p-8" aria-labelledby={`module-${unit.id}-heading`}>
      <p id={`module-${unit.id}-heading`} className="eyebrow">{`Module ${index + 1}`}</p>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          run({ action: "edit", op: "module-edit", moduleId: unit.id, title, dripDays: drip });
        }}
      >
        <label className="block min-w-0">
          <span className="field-label" id={titleId}>Name</span>
          <input aria-labelledby={titleId} className="field mt-2" maxLength={MAX_ITEM_TITLE} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label" id={dripId}>Opens after (days)</span>
          <input
            aria-labelledby={dripId}
            className="field mt-2"
            inputMode="numeric"
            pattern="[0-9]*"
            value={drip}
            onChange={(e) => setDrip(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
          />
        </label>
        <button type="submit" disabled={busy || !changed} className="btn btn-secondary">Save</button>
      </form>
      <p className="mt-2 text-sm text-ink-mute">
        {unit.dripDays === 0
          ? "Open as soon as a student joins."
          : `Opens ${unit.dripDays} ${unit.dripDays === 1 ? "day" : "days"} after each student joins, with an email to them that day.`}
      </p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold">
        <button type="button" className={small} disabled={busy || index === 0} onClick={() => run({ action: "edit", op: "module-move", moduleId: unit.id, direction: "up" })}>
          Move module up
        </button>
        <button type="button" className={small} disabled={busy || last} onClick={() => run({ action: "edit", op: "module-move", moduleId: unit.id, direction: "down" })}>
          Move module down
        </button>
        {unit.lessons.length === 0 ? (
          <button type="button" className={small} aria-busy={busy} disabled={busy} onClick={() => run({ action: "edit", op: "module-remove", moduleId: unit.id })}>
            Remove module
          </button>
        ) : null}
      </div>

      <ol className="mt-5 space-y-3">
        {unit.lessons.map((lesson, li) => (
          <li key={lesson.id} className="rounded-[var(--r-sm)] border border-line bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0 break-words font-semibold text-ink">{`${li + 1}. ${lesson.title}`}</p>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">
                {[
                  lesson.video ? "video" : null,
                  lesson.hasBody ? "text" : null,
                  lesson.files.length ? `${lesson.files.length} ${lesson.files.length === 1 ? "download" : "downloads"}` : null,
                  lesson.link ? "link" : null,
                  lesson.preview ? "free preview" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "empty"}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold">
              <button type="button" className={small} onClick={() => setOpenLesson(openLesson === lesson.id ? null : lesson.id)} aria-expanded={openLesson === lesson.id}>
                {openLesson === lesson.id ? "Close" : "Edit lesson"}
              </button>
              <button type="button" className={small} aria-busy={busy} disabled={busy} onClick={() => run({ action: "edit", op: "lesson-move", lessonId: lesson.id, direction: "up" })}>
                Up
              </button>
              <button type="button" className={small} aria-busy={busy} disabled={busy} onClick={() => run({ action: "edit", op: "lesson-move", lessonId: lesson.id, direction: "down" })}>
                Down
              </button>
            </div>
            {openLesson === lesson.id ? (
              <LessonEditor
                lesson={lesson}
                productId={productId}
                folder={folder}
                busy={busy}
                run={run}
                onCourse={onCourse}
                onError={onError}
                onRemoved={() => setOpenLesson(null)}
              />
            ) : null}
          </li>
        ))}
      </ol>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={async (event) => {
          event.preventDefault();
          const answer = await run({ action: "edit", op: "lesson-add", moduleId: unit.id, title: newLesson });
          if (answer.ok) setNewLesson("");
        }}
      >
        <label htmlFor={`new-lesson-${unit.id}`} className="sr-only">{`New lesson in module ${index + 1}`}</label>
        <input
          id={`new-lesson-${unit.id}`}
          className="field min-w-0 flex-1"
          maxLength={MAX_ITEM_TITLE}
          placeholder={`Lesson ${unit.lessons.length + 1}`}
          value={newLesson}
          onChange={(e) => setNewLesson(e.target.value)}
        />
        <button type="submit" aria-busy={busy} disabled={busy} className="btn btn-primary">Add lesson</button>
      </form>
    </section>
  );
}

function LessonEditor({
  lesson,
  productId,
  folder,
  busy,
  run,
  onCourse,
  onError,
  onRemoved,
}: {
  lesson: Lesson;
  productId: string;
  folder: string;
  busy: boolean;
  run: (payload: Record<string, unknown>) => Promise<Answer>;
  onCourse: (course: Course) => void;
  onError: (message: string | null) => void;
  onRemoved: () => void;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [preview, setPreview] = useState(lesson.preview);
  const [link, setLink] = useState(lesson.link ?? "");
  const [text, setText] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [uploading, setUploading] = useState<{ kind: "video" | "file"; percent: number } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  async function loadText() {
    setLoadingText(true);
    try {
      const response = await fetch(`/api/store/course?id=${productId}&lessonId=${lesson.id}`, { cache: "no-store" });
      const data = (await response.json()) as { ok?: boolean; text?: string };
      setText(data.ok ? data.text ?? "" : "");
    } catch {
      setText("");
    } finally {
      setLoadingText(false);
    }
  }

  async function upload(kind: "video" | "file", chosen: File) {
    onError(null);
    if (chosen.size > MAX_FILE_BYTES) return onError(MESSAGES.too_big);
    if (kind === "video" && !VIDEO_TYPES.includes(chosen.type)) return onError(MESSAGES.video_type);
    setUploading({ kind, percent: 0 });
    try {
      const pathname = fileFolder(folder, lesson.id) + safeFileName(chosen.name);
      const result = await uploadPresigned(pathname, chosen, {
        access: "private",
        handleUploadUrl: "/api/store/file",
        clientPayload: JSON.stringify({ productId: lesson.id }),
        multipart: chosen.size > MULTIPART_ABOVE_BYTES,
        onUploadProgress: (progress) => setUploading({ kind, percent: progress.percentage }),
      });
      const answer = await run({ action: "media", lessonId: lesson.id, kind, pathname: result.pathname, name: chosen.name });
      if (answer.ok && answer.course) onCourse(answer.course);
    } catch (thrown) {
      onError(thrown instanceof Error && /content type|not allowed/i.test(thrown.message) ? MESSAGES.wrong_type : MESSAGES.server_error);
    } finally {
      setUploading(null);
    }
  }

  const prefix = `lesson-${lesson.id}`;
  return (
    <div className="mt-4 space-y-5 border-t border-line pt-4">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const answer = await run({ action: "edit", op: "lesson-edit", lessonId: lesson.id, title, preview, link });
          if (answer.ok) setSaved("Saved.");
        }}
      >
        <label className="block">
          <span className="field-label">Lesson name</span>
          <input className="field mt-2" maxLength={MAX_ITEM_TITLE} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">A link for this lesson (optional)</span>
          <input className="field mt-2" type="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" className="mt-1" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
          <span>Free preview: anyone can open this lesson from your store before buying.</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" aria-busy={busy} disabled={busy} className="btn btn-secondary btn-sm">Save lesson</button>
          {saved ? <span className="text-sm text-ink-soft" role="status">{saved}</span> : null}
        </div>
      </form>

      <div>
        <p className="field-label">Video</p>
        {lesson.video ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="min-w-0 break-all text-ink">{`${lesson.video.name} · ${readableSize(lesson.video.bytes)}`}</span>
            <button type="button" className={`${small} font-bold`} disabled={busy || uploading !== null} onClick={() => run({ action: "edit", op: "media-remove", lessonId: lesson.id, pathname: lesson.video!.pathname })}>
              Remove video
            </button>
          </div>
        ) : (
          <p className="mt-1 text-sm text-ink-mute">{`MP4, MOV or WebM, up to ${maxFileLabel()}. Upright phone videos stay upright.`}</p>
        )}
        <label className="btn btn-secondary btn-sm mt-2 cursor-pointer">
          {lesson.video ? "Replace the video" : "Upload a video"}
          <input
            type="file"
            accept={VIDEO_TYPES.join(",")}
            className="sr-only"
            disabled={busy || uploading !== null}
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              e.target.value = "";
              if (chosen) upload("video", chosen);
            }}
          />
        </label>
        {uploading?.kind === "video" ? (
          <p className="mt-2 text-sm text-ink-soft" role="status">{`Uploading… ${Math.round(uploading.percent)}%`}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor={`${prefix}-text`} className="field-label">Text</label>
        {text === null ? (
          <div className="mt-2">
            <button type="button" className="btn btn-secondary btn-sm" disabled={loadingText} onClick={loadText}>
              {lesson.hasBody ? "Edit the text" : "Write text for this lesson"}
            </button>
          </div>
        ) : (
          <form
            className="mt-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const answer = await run({ action: "body", lessonId: lesson.id, text });
              if (answer.ok) setSaved("Text saved.");
            }}
          >
            <textarea
              id={`${prefix}-text`}
              rows={12}
              className="field min-h-48"
              maxLength={MAX_BODY_LENGTH}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="mt-1 text-sm text-ink-mute">
              {`Blank lines make paragraphs, lines starting with "- " make a list, and web addresses become links. ${MAX_BODY_LENGTH - text.length} characters left.`}
            </p>
            <button type="submit" aria-busy={busy} disabled={busy} className="btn btn-secondary btn-sm mt-2">Save text</button>
          </form>
        )}
      </div>

      <div>
        <p className="field-label">Downloads</p>
        {lesson.files.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {lesson.files.map((file) => (
              <li key={file.pathname} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="min-w-0 break-all text-ink">{`${file.name} · ${readableSize(file.bytes)}`}</span>
                <button type="button" className={`${small} font-bold`} aria-busy={busy} disabled={busy} onClick={() => run({ action: "edit", op: "media-remove", lessonId: lesson.id, pathname: file.pathname })}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink-mute">Worksheets, slides, templates: anything a student keeps.</p>
        )}
        {lesson.files.length < MAX_LESSON_FILES ? (
          <label className="btn btn-secondary btn-sm mt-2 cursor-pointer">
            Add a download
            <input
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              className="sr-only"
              disabled={busy || uploading !== null}
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                e.target.value = "";
                if (chosen) upload("file", chosen);
              }}
            />
          </label>
        ) : null}
        {uploading?.kind === "file" ? (
          <p className="mt-2 text-sm text-ink-soft" role="status">{`Uploading… ${Math.round(uploading.percent)}%`}</p>
        ) : null}
      </div>

      <div className="border-t border-line pt-4">
        {removing ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-ink-soft">Remove this lesson with its video, text and downloads?</span>
            <button
              type="button"
              aria-busy={busy} disabled={busy}
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                const answer = await run({ action: "edit", op: "lesson-remove", lessonId: lesson.id });
                if (answer.ok) onRemoved();
              }}
            >
              Yes, remove it
            </button>
            <button type="button" className={`${small} font-bold`} onClick={() => setRemoving(false)}>Keep it</button>
          </div>
        ) : (
          <button type="button" className="text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-danger" onClick={() => setRemoving(true)}>
            Remove lesson
          </button>
        )}
      </div>
    </div>
  );
}

/** Taking one student off the course, or letting them back on. */
export function StudentAccess({ productId, email, blocked }: { productId: string; email: string; blocked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-busy={busy} disabled={busy}
      className="whitespace-nowrap text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-violet-deep disabled:opacity-40"
      onClick={async () => {
        setBusy(true);
        await post({ id: productId, action: "block", email, blocked: !blocked });
        setBusy(false);
        router.refresh();
      }}
    >
      {blocked ? "Let back in" : "Remove access"}
    </button>
  );
}
