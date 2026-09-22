import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { findLesson, isOpen, readCourse } from "@/lib/course";
import { courseAccess } from "@/lib/learn";
import { plain, serveFile } from "@/lib/serve-file";

/**
 * A lesson's download: a worksheet, the slides. Handed over only to someone
 * the lesson is open for, the same check the lesson page makes.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const store = await storeForHandle(normaliseHandle(q.get("h") ?? ""));
  const product = store?.products.find((p) => p.id === q.get("p") && p.course);
  if (!store || !product?.course) return plain(404, "Not found.");
  const course = await readCourse(product.course.id);
  const found = course ? findLesson(course, q.get("l") ?? "") : null;
  const index = Number(q.get("i"));
  const file = found && Number.isInteger(index) ? found.lesson.files[index] : undefined;
  if (!found || !file) return plain(404, "Not found.");

  if (!found.lesson.preview) {
    const access = await courseAccess(store, product, await cookies());
    if (access.state !== "open" || !isOpen(found.unit, access.start)) {
      return plain(403, "This lesson is not open for you. Open the course page to get in.");
    }
  }
  return serveFile(file);
}
