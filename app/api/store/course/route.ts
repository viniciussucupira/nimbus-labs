import type { NextRequest } from "next/server";
import { del, head } from "@vercel/blob";
import { setCourseLessons, setProductCourse, storeForEmail, storeFolder } from "@/lib/store";
import { guardStoreWrite, text } from "@/lib/store-request";
import { readLink } from "@/lib/product-link";
import { ownsPath, safeFileName, type ProductFile } from "@/lib/product-file";
import {
  type CourseEdit,
  MAX_BODY_LENGTH,
  cleanBody,
  dropBody,
  dropCourse,
  editCourse,
  emptyCourse,
  filesInCourse,
  findLesson,
  lessonCount,
  readBody,
  readCourse,
  saveBody,
  saveCourse,
} from "@/lib/course";
import { registerDrip, setBlocked } from "@/lib/learn";
import { EMAIL_PATTERN, SESSION_COOKIE, emailForSession } from "@/lib/auth";

const OPS = new Set([
  "module-add",
  "module-edit",
  "module-move",
  "module-remove",
  "lesson-add",
  "lesson-edit",
  "lesson-move",
  "lesson-remove",
  "media-remove",
]);

/** A lesson's text, for the studio to edit. The creator's own courses only. */
export async function GET(request: NextRequest) {
  const email = await emailForSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!email) return Response.json({ ok: false, error: "signed_out" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const lessonId = request.nextUrl.searchParams.get("lessonId") ?? "";
  const store = await storeForEmail(email);
  const product = store?.products.find((p) => p.id === id);
  const course = product?.course ? await readCourse(product.course.id) : null;
  if (!course || !findLesson(course, lessonId)) return Response.json({ ok: false, error: "unknown" }, { status: 404 });
  return Response.json({ ok: true, text: await readBody(course.id, lessonId) }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Everything the studio changes about a course.
 *
 * `{ action: "enable", id }` makes a product a course; `{ action: "disable",
 * id }` turns an empty one back; `{ action: "edit", id, op, ... }` changes
 * the outline; `{ action: "body", id, lessonId, text }` saves a lesson's
 * text; `{ action: "media", id, lessonId, kind, pathname, name }` puts an
 * uploaded video or file on a lesson; `{ action: "block", id, email, blocked
 * }` takes a student off the course or lets them back.
 *
 * `id` is always the product's, and the course is found through the
 * creator's own store, so nothing here can reach anyone else's course.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, MAX_BODY_LENGTH * 4 + 4_000);
  if (!guarded.ok) return guarded.response;
  const { email, body } = guarded;
  const action = text(body.action, 10);
  const id = text(body.id, 40);
  if (!id) return Response.json({ ok: false, error: "unknown" }, { status: 400 });

  try {
    const store = await storeForEmail(email);
    if (!store) return Response.json({ ok: false, error: "none" }, { status: 400 });
    const product = store.products.find((p) => p.id === id);
    if (!product) return Response.json({ ok: false, error: "unknown" }, { status: 404 });

    if (action === "enable") {
      if (product.course) return Response.json({ ok: true, courseId: product.course.id });
      const course = emptyCourse();
      const result = await setProductCourse(email, id, { id: course.id, lessons: 0 });
      if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: 400 });
      await saveCourse(course);
      return Response.json({ ok: true, courseId: course.id });
    }

    if (!product.course) return Response.json({ ok: false, error: "not_course" }, { status: 400 });
    const course = await readCourse(product.course.id);
    if (!course) return Response.json({ ok: false, error: "unknown" }, { status: 404 });

    if (action === "disable") {
      if (lessonCount(course) > 0) return Response.json({ ok: false, error: "not_empty" }, { status: 400 });
      const result = await setProductCourse(email, id, null);
      if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: 400 });
      await dropCourse(course);
      await registerDrip(store, product, { ...course, modules: [] });
      return Response.json({ ok: true });
    }

    if (action === "block") {
      const who = text(body.email, 254).trim();
      if (!EMAIL_PATTERN.test(who)) return Response.json({ ok: false, error: "email" }, { status: 400 });
      await setBlocked(store, course.id, who, body.blocked === true);
      return Response.json({ ok: true });
    }

    if (action === "body") {
      const lessonId = text(body.lessonId, 20);
      if (!findLesson(course, lessonId)) return Response.json({ ok: false, error: "unknown" }, { status: 404 });
      const cleaned = cleanBody(body.text);
      await saveBody(course.id, lessonId, cleaned);
      const found = findLesson(course, lessonId)!;
      const result = editCourse(course, {
        op: "lesson-edit",
        lessonId,
        title: found.lesson.title,
        preview: found.lesson.preview,
        link: found.lesson.link,
        hasBody: cleaned.length > 0,
      });
      if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: 400 });
      await saveCourse(result.course);
      return Response.json({ ok: true, course: result.course });
    }

    let edit: CourseEdit;
    if (action === "media") {
      const lessonId = text(body.lessonId, 20);
      const pathname = text(body.pathname, 400);
      const kind = body.kind === "video" ? "video" : "file";
      if (!findLesson(course, lessonId)) return Response.json({ ok: false, error: "unknown" }, { status: 404 });
      // The file has to sit in this account's folder for this very lesson,
      // and what it is is read from storage, not from the browser.
      const folder = await storeFolder(email);
      if (!ownsPath(pathname, folder, lessonId)) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
      const found = await head(pathname);
      const file: ProductFile = {
        pathname,
        name: safeFileName(text(body.name, 200) || found.pathname),
        bytes: found.size,
        contentType: found.contentType,
        addedAt: new Date().toISOString(),
      };
      edit = { op: "media", lessonId, kind, file };
    } else if (action === "edit") {
      const op = text(body.op, 20);
      if (!OPS.has(op)) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
      const direction = body.direction === "up" ? "up" : "down";
      if (op === "lesson-edit") {
        const rawLink = text(body.link, 2000).trim();
        let link: string | null = null;
        if (rawLink) {
          const read = readLink(rawLink);
          if (!read.ok) return Response.json({ ok: false, error: "link", reason: read.reason }, { status: 400 });
          link = read.url;
        }
        edit = { op, lessonId: text(body.lessonId, 20), title: body.title, preview: body.preview, link };
      } else if (op === "module-add") edit = { op, title: body.title };
      else if (op === "module-edit") edit = { op, moduleId: text(body.moduleId, 20), title: body.title, dripDays: body.dripDays };
      else if (op === "module-move") edit = { op, moduleId: text(body.moduleId, 20), direction };
      else if (op === "module-remove") edit = { op, moduleId: text(body.moduleId, 20) };
      else if (op === "lesson-add") edit = { op, moduleId: text(body.moduleId, 20), title: body.title };
      else if (op === "lesson-move") edit = { op, lessonId: text(body.lessonId, 20), direction };
      else if (op === "lesson-remove") edit = { op, lessonId: text(body.lessonId, 20) };
      else edit = { op: "media-remove", lessonId: text(body.lessonId, 20), pathname: text(body.pathname, 400) };
    } else {
      return Response.json({ ok: false, error: "invalid" }, { status: 400 });
    }

    const result = editCourse(course, edit);
    if (!result.ok) {
      return Response.json({ ok: false, error: result.reason }, { status: result.reason === "unknown" ? 404 : 400 });
    }
    await saveCourse(result.course);
    const lessons = lessonCount(result.course);
    if (lessons !== product.course.lessons) await setCourseLessons(email, id, lessons);
    if (edit.op === "lesson-remove") await dropBody(course.id, edit.lessonId);
    if (edit.op === "module-edit" || edit.op === "module-remove" || edit.op === "lesson-add") {
      await registerDrip(store, product, result.course);
    }

    // Storage is released only after the record that no longer points at it
    // is written, the same order every other file here is handled in.
    for (const file of result.removed) {
      if (filesInCourse(result.course).some((f) => f.pathname === file.pathname)) continue;
      await del(file.pathname).catch((error: unknown) => console.error("could not delete a lesson file", error));
    }
    return Response.json({ ok: true, course: result.course, addedId: result.addedId });
  } catch (error) {
    console.error("changing a course failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
