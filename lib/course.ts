/**
 * Courses: a product whose delivery is a set of lessons, grouped in modules.
 *
 * The outline — modules, lessons, which video and files each lesson has — is
 * kept in a record of its own rather than on the store, because a store page
 * is read on every visit and a course with two hundred lessons would make
 * every one of those reads heavier for nothing. The text of each lesson is
 * kept apart again, so opening one lesson never loads all the others.
 *
 * Files live in the same private store as everything else a creator sells,
 * under a folder named after the lesson, and leave it only through a signed
 * link made for someone who may see them.
 *
 * Pure rules at the top, storage at the bottom.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { type ProductFile, parseProductFile } from "@/lib/product-file";

export const MAX_MODULES = 30;
export const MAX_LESSONS = 200;
export const MAX_LESSON_FILES = 5;
export const MAX_ITEM_TITLE = 120;
export const MAX_BODY_LENGTH = 10_000;
export const MAX_DRIP_DAYS = 365;

/** Videos a lesson can play in every current browser. */
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export const COURSE_ID_PATTERN = /^[0-9a-f]{32}$/;
export const ITEM_ID_PATTERN = /^[a-z0-9]{12}$/;

export type Lesson = {
  id: string;
  title: string;
  /** Open to anyone from the store page, as a taste of the course. */
  preview: boolean;
  video: ProductFile | null;
  /** Downloads that go with the lesson: worksheets, slides, templates. */
  files: ProductFile[];
  /** A page elsewhere the lesson points to, when it has one. */
  link: string | null;
  /** Whether the lesson has text, so the outline can say so without loading it. */
  hasBody: boolean;
};

export type CourseModule = {
  id: string;
  title: string;
  /**
   * Days after joining before this module opens. 0 opens it at once. The
   * same number for everyone, counted from the day each student paid.
   */
  dripDays: number;
  lessons: Lesson[];
};

export type Course = {
  id: string;
  modules: CourseModule[];
};

export function newCourseId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Twelve lowercase letters and digits: short enough for a URL, unique in practice. */
export function newItemId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

function cleanTitle(raw: unknown, fallback: string): string {
  const text = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  return text.slice(0, MAX_ITEM_TITLE) || fallback;
}

function parseLesson(raw: unknown): Lesson | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string" || !ITEM_ID_PATTERN.test(value.id)) return null;
  const files = Array.isArray(value.files)
    ? value.files.map(parseProductFile).filter((f): f is ProductFile => f !== null).slice(0, MAX_LESSON_FILES)
    : [];
  return {
    id: value.id,
    title: cleanTitle(value.title, "Untitled lesson"),
    preview: value.preview === true,
    video: parseProductFile(value.video),
    files,
    link: typeof value.link === "string" && value.link ? value.link.slice(0, 2000) : null,
    hasBody: value.hasBody === true,
  };
}

function parseModule(raw: unknown): CourseModule | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string" || !ITEM_ID_PATTERN.test(value.id)) return null;
  const drip = Number(value.dripDays);
  return {
    id: value.id,
    title: cleanTitle(value.title, "Untitled module"),
    dripDays: Number.isInteger(drip) && drip >= 0 && drip <= MAX_DRIP_DAYS ? drip : 0,
    lessons: Array.isArray(value.lessons)
      ? value.lessons.map(parseLesson).filter((l): l is Lesson => l !== null)
      : [],
  };
}

export function parseCourse(raw: unknown): Course | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (typeof value.id !== "string" || !COURSE_ID_PATTERN.test(value.id)) return null;
    const modules = Array.isArray(value.modules)
      ? value.modules.map(parseModule).filter((m): m is CourseModule => m !== null).slice(0, MAX_MODULES)
      : [];
    return { id: value.id, modules };
  } catch {
    return null;
  }
}

/** Every lesson, in the order a student meets them. */
export function lessonsInOrder(course: Course): { lesson: Lesson; unit: CourseModule }[] {
  return course.modules.flatMap((unit) => unit.lessons.map((lesson) => ({ lesson, unit })));
}

export function lessonCount(course: Course): number {
  return course.modules.reduce((sum, unit) => sum + unit.lessons.length, 0);
}

export function findLesson(course: Course, lessonId: string): { lesson: Lesson; unit: CourseModule } | null {
  for (const unit of course.modules) {
    const lesson = unit.lessons.find((l) => l.id === lessonId);
    if (lesson) return { lesson, unit };
  }
  return null;
}

/** When a module opens for someone who joined at `startSeconds`. */
export function opensAt(unit: CourseModule, startSeconds: number): number {
  return startSeconds + unit.dripDays * 86_400;
}

export function isOpen(unit: CourseModule, startSeconds: number, nowSeconds = Date.now() / 1000): boolean {
  return unit.dripDays === 0 || opensAt(unit, startSeconds) <= nowSeconds;
}

/** Every stored file a course holds, so nothing is left behind when it goes. */
export function filesInCourse(course: Course): ProductFile[] {
  return lessonsInOrder(course).flatMap(({ lesson }) => [
    ...(lesson.video ? [lesson.video] : []),
    ...lesson.files,
  ]);
}

export type CourseEdit =
  | { op: "module-add"; title: unknown }
  | { op: "module-edit"; moduleId: string; title: unknown; dripDays: unknown }
  | { op: "module-move"; moduleId: string; direction: "up" | "down" }
  | { op: "module-remove"; moduleId: string }
  | { op: "lesson-add"; moduleId: string; title: unknown }
  | { op: "lesson-edit"; lessonId: string; title: unknown; preview: unknown; link: string | null; hasBody?: boolean }
  | { op: "lesson-move"; lessonId: string; direction: "up" | "down" }
  | { op: "lesson-remove"; lessonId: string }
  | { op: "media"; lessonId: string; kind: "video" | "file"; file: ProductFile }
  | { op: "media-remove"; lessonId: string; pathname: string };

export type EditResult =
  | { ok: true; course: Course; removed: ProductFile[]; addedId?: string }
  | { ok: false; reason: "unknown" | "too_many" | "not_empty" | "drip" | "files" | "video_type" };

function mapLesson(course: Course, lessonId: string, change: (lesson: Lesson) => Lesson): Course | null {
  let found = false;
  const modules = course.modules.map((unit) => ({
    ...unit,
    lessons: unit.lessons.map((lesson) => {
      if (lesson.id !== lessonId) return lesson;
      found = true;
      return change(lesson);
    }),
  }));
  return found ? { ...course, modules } : null;
}

/**
 * Applies one change from the studio. Pure: what to store and which files
 * are no longer used come back, and the caller writes and deletes.
 */
export function editCourse(course: Course, edit: CourseEdit): EditResult {
  const modules = course.modules;
  switch (edit.op) {
    case "module-add": {
      if (modules.length >= MAX_MODULES) return { ok: false, reason: "too_many" };
      const id = newItemId();
      const unit: CourseModule = {
        id,
        title: cleanTitle(edit.title, `Module ${modules.length + 1}`),
        dripDays: 0,
        lessons: [],
      };
      return { ok: true, course: { ...course, modules: [...modules, unit] }, removed: [], addedId: id };
    }
    case "module-edit": {
      const at = modules.findIndex((m) => m.id === edit.moduleId);
      if (at < 0) return { ok: false, reason: "unknown" };
      const drip = typeof edit.dripDays === "string" && edit.dripDays.trim() === "" ? 0 : Number(edit.dripDays);
      if (!Number.isInteger(drip) || drip < 0 || drip > MAX_DRIP_DAYS) return { ok: false, reason: "drip" };
      const next = [...modules];
      next[at] = { ...next[at], title: cleanTitle(edit.title, next[at].title), dripDays: drip };
      return { ok: true, course: { ...course, modules: next }, removed: [] };
    }
    case "module-move": {
      const at = modules.findIndex((m) => m.id === edit.moduleId);
      if (at < 0) return { ok: false, reason: "unknown" };
      const to = edit.direction === "up" ? at - 1 : at + 1;
      if (to < 0 || to >= modules.length) return { ok: true, course, removed: [] };
      const next = [...modules];
      [next[at], next[to]] = [next[to], next[at]];
      return { ok: true, course: { ...course, modules: next }, removed: [] };
    }
    case "module-remove": {
      const unit = modules.find((m) => m.id === edit.moduleId);
      if (!unit) return { ok: false, reason: "unknown" };
      // Lessons are removed one by one, on purpose: a module full of work
      // should never vanish in one press.
      if (unit.lessons.length > 0) return { ok: false, reason: "not_empty" };
      return { ok: true, course: { ...course, modules: modules.filter((m) => m.id !== edit.moduleId) }, removed: [] };
    }
    case "lesson-add": {
      if (lessonCount(course) >= MAX_LESSONS) return { ok: false, reason: "too_many" };
      const at = modules.findIndex((m) => m.id === edit.moduleId);
      if (at < 0) return { ok: false, reason: "unknown" };
      const id = newItemId();
      const lesson: Lesson = {
        id,
        title: cleanTitle(edit.title, `Lesson ${modules[at].lessons.length + 1}`),
        preview: false,
        video: null,
        files: [],
        link: null,
        hasBody: false,
      };
      const next = [...modules];
      next[at] = { ...next[at], lessons: [...next[at].lessons, lesson] };
      return { ok: true, course: { ...course, modules: next }, removed: [], addedId: id };
    }
    case "lesson-edit": {
      const next = mapLesson(course, edit.lessonId, (lesson) => ({
        ...lesson,
        title: cleanTitle(edit.title, lesson.title),
        preview: edit.preview === true,
        link: edit.link,
        hasBody: edit.hasBody ?? lesson.hasBody,
      }));
      return next ? { ok: true, course: next, removed: [] } : { ok: false, reason: "unknown" };
    }
    case "lesson-move": {
      const mi = modules.findIndex((m) => m.lessons.some((l) => l.id === edit.lessonId));
      if (mi < 0) return { ok: false, reason: "unknown" };
      const li = modules[mi].lessons.findIndex((l) => l.id === edit.lessonId);
      const next = modules.map((m) => ({ ...m, lessons: [...m.lessons] }));
      const lesson = next[mi].lessons[li];
      if (edit.direction === "up") {
        if (li > 0) {
          [next[mi].lessons[li - 1], next[mi].lessons[li]] = [lesson, next[mi].lessons[li - 1]];
        } else if (mi > 0) {
          // The first lesson of a module moves to the end of the one before.
          next[mi].lessons.splice(li, 1);
          next[mi - 1].lessons.push(lesson);
        }
      } else if (li < next[mi].lessons.length - 1) {
        [next[mi].lessons[li + 1], next[mi].lessons[li]] = [lesson, next[mi].lessons[li + 1]];
      } else if (mi < next.length - 1) {
        // The last lesson of a module moves to the start of the next.
        next[mi].lessons.splice(li, 1);
        next[mi + 1].lessons.unshift(lesson);
      }
      return { ok: true, course: { ...course, modules: next }, removed: [] };
    }
    case "lesson-remove": {
      const found = findLesson(course, edit.lessonId);
      if (!found) return { ok: false, reason: "unknown" };
      const removed = [...(found.lesson.video ? [found.lesson.video] : []), ...found.lesson.files];
      return {
        ok: true,
        course: {
          ...course,
          modules: modules.map((m) => ({ ...m, lessons: m.lessons.filter((l) => l.id !== edit.lessonId) })),
        },
        removed,
      };
    }
    case "media": {
      const found = findLesson(course, edit.lessonId);
      if (!found) return { ok: false, reason: "unknown" };
      if (edit.kind === "video") {
        if (!VIDEO_TYPES.includes(edit.file.contentType)) return { ok: false, reason: "video_type" };
        const previous = found.lesson.video;
        const next = mapLesson(course, edit.lessonId, (lesson) => ({ ...lesson, video: edit.file }));
        return next
          ? { ok: true, course: next, removed: previous && previous.pathname !== edit.file.pathname ? [previous] : [] }
          : { ok: false, reason: "unknown" };
      }
      if (found.lesson.files.length >= MAX_LESSON_FILES) return { ok: false, reason: "files" };
      const next = mapLesson(course, edit.lessonId, (lesson) => ({ ...lesson, files: [...lesson.files, edit.file] }));
      return next ? { ok: true, course: next, removed: [] } : { ok: false, reason: "unknown" };
    }
    case "media-remove": {
      const found = findLesson(course, edit.lessonId);
      if (!found) return { ok: false, reason: "unknown" };
      const { lesson } = found;
      if (lesson.video?.pathname === edit.pathname) {
        const next = mapLesson(course, edit.lessonId, (l) => ({ ...l, video: null }));
        return { ok: true, course: next as Course, removed: [lesson.video] };
      }
      const file = lesson.files.find((f) => f.pathname === edit.pathname);
      if (!file) return { ok: false, reason: "unknown" };
      const next = mapLesson(course, edit.lessonId, (l) => ({ ...l, files: l.files.filter((f) => f.pathname !== edit.pathname) }));
      return { ok: true, course: next as Course, removed: [file] };
    }
  }
}

// ---------------------------------------------------------------- storage

const courseKey = (id: string) => `nl:course:${id}`;
const bodyKey = (id: string, lessonId: string) => `nl:course:${id}:body:${lessonId}`;

export function emptyCourse(id: string = newCourseId()): Course {
  return { id, modules: [{ id: newItemId(), title: "Module 1", dripDays: 0, lessons: [] }] };
}

export async function readCourse(id: string): Promise<Course | null> {
  if (!isRedisConfigured() || !COURSE_ID_PATTERN.test(id)) return null;
  const [raw] = await redisPipeline([["GET", courseKey(id)]]);
  return parseCourse(raw);
}

/** Several at once, for the pages that show every course of a store. */
export async function readCourses(ids: string[]): Promise<Map<string, Course>> {
  const found = new Map<string, Course>();
  const valid = ids.filter((id) => COURSE_ID_PATTERN.test(id));
  if (!isRedisConfigured() || valid.length === 0) return found;
  const rows = await redisPipeline(valid.map((id) => ["GET", courseKey(id)]));
  rows.forEach((raw, i) => {
    const course = parseCourse(raw);
    if (course) found.set(valid[i], course);
  });
  return found;
}

export async function saveCourse(course: Course): Promise<void> {
  await redisPipeline([["SET", courseKey(course.id), JSON.stringify(course)]]);
}

export async function readBody(courseId: string, lessonId: string): Promise<string> {
  if (!isRedisConfigured() || !COURSE_ID_PATTERN.test(courseId) || !ITEM_ID_PATTERN.test(lessonId)) return "";
  const [raw] = await redisPipeline([["GET", bodyKey(courseId, lessonId)]]);
  return typeof raw === "string" ? raw : "";
}

export async function saveBody(courseId: string, lessonId: string, text: string): Promise<void> {
  if (text) await redisPipeline([["SET", bodyKey(courseId, lessonId), text.slice(0, MAX_BODY_LENGTH)]]);
  else await redisPipeline([["DEL", bodyKey(courseId, lessonId)]]);
}

/** Takes a course's records away. Its files are the caller's to delete. */
export async function dropCourse(course: Course): Promise<void> {
  const keys = [courseKey(course.id), ...lessonsInOrder(course).map(({ lesson }) => bodyKey(course.id, lesson.id))];
  await redisPipeline(keys.map((key) => ["DEL", key]));
}

export async function dropBody(courseId: string, lessonId: string): Promise<void> {
  await redisPipeline([["DEL", bodyKey(courseId, lessonId)]]);
}

/** Lesson text, cleaned the same way wherever it is saved from. */
export function cleanBody(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, MAX_BODY_LENGTH);
}
