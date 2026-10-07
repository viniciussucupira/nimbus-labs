import type { NextRequest } from "next/server";
import { MAX_CAPTION_BYTES } from "@/lib/captions";
import { readKind } from "@/lib/catalog";
import { ITEM_ID_PATTERN, findLesson, readCourses } from "@/lib/course";
import { withinLimit } from "@/lib/request-guard";
import { storeFolder, storeForEmail } from "@/lib/store";
import { guardStoreWrite, text } from "@/lib/store-request";
import { addCaption, dropCaption, isStreamConfigured } from "@/lib/stream";
import { readStreamPath } from "@/lib/stream-rules";

/** Changes to captions one store may make in an hour: a long course, in several languages, in one sitting. */
const CHANGES_PER_HOUR = 600;

/** What a refusal is answered with. */
const STATUS: Record<string, number> = { off: 404, unknown: 404, unavailable: 503 };

/**
 * Captions for a lesson's video (lib/captions.ts, lib/stream.ts).
 *
 * `{ action: "add", lessonId, lang, text }` gives the lesson's video
 * captions in one language from the words of a .vtt or .srt file, read in
 * the studio's browser and sent as text. `{ action: "remove", lessonId,
 * lang }` takes them away. Either answers the languages the video has
 * captions in afterward.
 *
 * Asked for only what a signed-in creator may do: the lesson has to be one
 * of this store's own, and its video one the video service keeps for this
 * store. Which video is never taken from the request: it is read from the
 * lesson.
 */
export async function POST(request: NextRequest) {
  // The file's own ceiling, as JSON writes it at worst, and room for the rest.
  const guarded = await guardStoreWrite(request, "products", MAX_CAPTION_BYTES * 2 + 4_000);
  if (!guarded.ok) return guarded.response;
  if (!isStreamConfigured()) return Response.json({ ok: false, error: "off" }, { status: 404 });
  const { ref, body } = guarded;

  const action = text(body.action, 10);
  const lessonId = text(body.lessonId, 20);
  const lang = text(body.lang, 10);
  if (action !== "add" && action !== "remove") return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  if (!ITEM_ID_PATTERN.test(lessonId)) return Response.json({ ok: false, error: "unknown" }, { status: 400 });

  try {
    const store = await storeForEmail(ref);
    if (!store) return Response.json({ ok: false, error: "none" }, { status: 400 });
    const courseIds = (await readKind(store, "course")).flatMap((p) => (p.course ? [p.course.id] : []));
    const courses = await readCourses(courseIds);
    const found = [...courses.values()].map((course) => findLesson(course, lessonId)).find((hit) => hit !== null);
    const pathname = found?.lesson.video?.pathname ?? "";
    const folder = await storeFolder(ref);
    if (readStreamPath(pathname)?.folder !== folder) return Response.json({ ok: false, error: "unknown" }, { status: 404 });
    if (!(await withinLimit("stream-captions", folder, CHANGES_PER_HOUR, 3600))) {
      return Response.json({ ok: false, error: "slow_down" }, { status: 429 });
    }

    const answer = action === "add" ? await addCaption(pathname, lang, body.text) : await dropCaption(pathname, lang);
    if (!answer.ok) {
      const error = answer.reason === "unavailable" ? "video_unavailable" : `caption_${answer.reason}`;
      return Response.json({ ok: false, error: answer.reason === "off" ? "off" : error }, { status: STATUS[answer.reason] ?? 400 });
    }
    return Response.json({ ok: true, captions: answer.captions }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("changing a lesson video's captions failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
