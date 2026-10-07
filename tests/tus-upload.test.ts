/**
 * A lesson's video goes to the video service in pieces, and an upload cut
 * off goes on from where it stopped (lib/tus-upload.ts).
 *
 * What matters is at the end of every part here: the service holds exactly
 * the bytes of the file, once each, in order — whether the line dropped on
 * the way there, on the way back, or the service stumbled — and an upload
 * that cannot go on says why instead of pretending.
 *
 * The service is stood in for by something that speaks the same protocol
 * (tus 1.0.0) and can be told to break.
 */
import { PIECE_BYTES, RETRY_PAUSES_MS, TusError, metadataHeader, tusUpload } from "@/lib/tus-upload";
import { done, is, part } from "./check";

const ENDPOINT = "https://video.example/tusupload";
const AUTH = { AuthorizationSignature: "sig", AuthorizationExpire: "1790000000", LibraryId: "4242", VideoId: "00000000-0000-4000-8000-000000000001" };

type Upload = { length: number; bytes: number[] };
type Seen = { method: string; url: string; headers: Record<string, string> };

/** A service that takes uploads by the protocol, and breaks when `trouble` says to. */
function service(trouble: (seen: Seen, nth: number) => "lost-going" | "lost-coming" | number | null = () => null, location = "/files/abc") {
  const uploads = new Map<string, Upload>();
  const seen: Seen[] = [];
  const waits: number[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const now: Seen = { method, url, headers };
    const nth = seen.filter((s) => s.method === method).length;
    seen.push(now);
    const what = trouble(now, nth);
    if (what === "lost-going") throw new TypeError("fetch failed");
    if (typeof what === "number") return new Response(null, { status: what });
    if (method === "POST" && url === ENDPOINT) {
      const where = new URL(location, ENDPOINT).toString();
      uploads.set(where, { length: Number(headers["Upload-Length"]), bytes: [] });
      return new Response(null, { status: 201, headers: { Location: location } });
    }
    const upload = uploads.get(url);
    if (!upload) return new Response(null, { status: 404 });
    if (method === "HEAD") return new Response(null, { status: 200, headers: { "Upload-Offset": String(upload.bytes.length) } });
    if (method === "PATCH") {
      if (Number(headers["Upload-Offset"]) !== upload.bytes.length) return new Response(null, { status: 409 });
      upload.bytes.push(...new Uint8Array(await (init?.body as Blob).arrayBuffer()));
      if (what === "lost-coming") throw new TypeError("fetch failed");
      return new Response(null, { status: 204, headers: { "Upload-Offset": String(upload.bytes.length) } });
    }
    return new Response(null, { status: 405 });
  }) as typeof fetch;
  return { fetcher, uploads, seen, waits, wait: async (ms: number) => void waits.push(ms) };
}

const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 3) % 251);
const file = (n: number) => new Blob([bytes(n)]);
const door = { endpoint: ENDPOINT, headers: AUTH, metadata: { filetype: "video/mp4", title: "Lesson one.mp4" } };
const whole = (s: ReturnType<typeof service>) => [...s.uploads.values()][0]?.bytes ?? [];

async function refusal(work: Promise<void>): Promise<string> {
  try {
    await work;
    return "finished";
  } catch (error) {
    return error instanceof TusError ? `${error.reason} ${error.status}` : "another error";
  }
}

async function main() {
  part("A file goes over in pieces");
  let s = service();
  const progress: number[] = [];
  await tusUpload(file(20), door, { fetcher: s.fetcher, wait: s.wait, pieceBytes: 8, onProgress: (p) => progress.push(Math.round(p)) });
  is("the service has every byte, once, in order", whole(s), [...bytes(20)]);
  is("in three pieces of eight at most", s.seen.filter((x) => x.method === "PATCH").map((x) => x.headers["Upload-Offset"]), ["0", "8", "16"]);
  is("it was told how long the file is before a byte went", s.seen[0].headers["Upload-Length"], "20");
  is("and what it is, each value in base64", s.seen[0].headers["Upload-Metadata"], `filetype ${btoa("video/mp4")},title ${btoa("Lesson one.mp4")}`);
  is("every request says which version of the protocol it speaks", s.seen.every((x) => x.headers["Tus-Resumable"] === "1.0.0"), true);
  is("and carries what the service wants to believe it: the first, and every piece", s.seen.every((x) => x.headers.AuthorizationSignature === "sig" && x.headers.VideoId === AUTH.VideoId), true);
  is("the creator sees it advance, and end at 100", progress, [0, 40, 80, 100, 100]);
  is("nothing was waited for", s.waits, []);
  is("a piece is 8 MB when nobody says otherwise", PIECE_BYTES, 8 * 1024 * 1024);

  part("A name that is not plain letters");
  is("is written as UTF-8", metadataHeader({ title: "Aula 1 — introdução.mp4" }), `title ${Buffer.from("Aula 1 — introdução.mp4", "utf8").toString("base64")}`);
  is("a key the protocol would not read is left out", metadataHeader({ "bad key": "x", ok: "y" }), `ok ${btoa("y")}`);

  part("The address of the upload may be given whole");
  s = service(() => null, "https://storage.example/u/9");
  await tusUpload(file(10), door, { fetcher: s.fetcher, wait: s.wait, pieceBytes: 8 });
  is("the pieces go where the service said", s.seen[1].url, "https://storage.example/u/9");
  is("and all arrive", whole(s), [...bytes(10)]);

  part("The line drops on the way there");
  s = service((seen, nth) => (seen.method === "PATCH" && nth === 1 ? "lost-going" : null));
  await tusUpload(file(20), door, { fetcher: s.fetcher, wait: s.wait, pieceBytes: 8 });
  is("the piece that was lost is sent again, after a pause", s.waits, [RETRY_PAUSES_MS[0]]);
  is("the service is asked where it has got to before anything is sent again", s.seen.filter((x) => x.method === "HEAD").length, 1);
  is("and it holds the file exactly: nothing missing, nothing twice", whole(s), [...bytes(20)]);

  part("The line drops on the way back");
  s = service((seen, nth) => (seen.method === "PATCH" && nth === 1 ? "lost-coming" : null));
  await tusUpload(file(20), door, { fetcher: s.fetcher, wait: s.wait, pieceBytes: 8 });
  is("the piece arrived though no answer did, and it is not sent a second time", s.seen.filter((x) => x.method === "PATCH").map((x) => x.headers["Upload-Offset"]), ["0", "8", "16"]);
  is("the file is whole, once", whole(s), [...bytes(20)]);

  part("The service stumbles");
  s = service((seen, nth) => (seen.method === "PATCH" && (nth === 0 || nth === 1) ? 503 : null));
  await tusUpload(file(20), door, { fetcher: s.fetcher, wait: s.wait, pieceBytes: 8 });
  is("twice busy: tried again after a longer pause each time", s.waits, [RETRY_PAUSES_MS[0], RETRY_PAUSES_MS[1]]);
  is("and the file is whole", whole(s), [...bytes(20)]);
  s = service((seen, nth) => (seen.method === "POST" && nth === 0 ? "lost-going" : null));
  await tusUpload(file(20), door, { fetcher: s.fetcher, wait: s.wait, pieceBytes: 8 });
  is("the very first request lost: asked again, and one upload is made, not two", [s.uploads.size, whole(s).length], [1, 20]);

  part("An upload that cannot go on says why");
  s = service((seen) => (seen.method === "POST" ? 403 : null));
  is("the service will not open one: refused, at once", [await refusal(tusUpload(file(20), door, { fetcher: s.fetcher, wait: s.wait, pieceBytes: 8 })), s.waits.length], ["refused 403", 0]);
  s = service((seen, nth) => (seen.method === "PATCH" && nth === 1 ? 404 : null));
  is("the service no longer has it: gone", await refusal(tusUpload(file(20), door, { fetcher: s.fetcher, wait: s.wait, pieceBytes: 8 })), "gone 404");
  s = service((seen, nth) => (seen.method === "PATCH" && nth >= 1 ? "lost-going" : seen.method === "HEAD" ? "lost-going" : null));
  is("the service is not there, pause after pause: unreachable", await refusal(tusUpload(file(20), door, { fetcher: s.fetcher, wait: s.wait, pieceBytes: 8 })), "unreachable 0");
  is("only after every pause was tried, a few minutes in all", s.waits, RETRY_PAUSES_MS);
  is("what did arrive is still there for an upload that tries again", whole(s).length, 8);
  s = service((seen) => (seen.method === "PATCH" ? 401 : null));
  is("a signature the service stopped believing: refused, without trying again", [await refusal(tusUpload(file(20), door, { fetcher: s.fetcher, wait: s.wait, pieceBytes: 8 })), s.waits.length], ["refused 401", 0]);

  done();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
