import type { ReactNode } from "react";
import type { Listing } from "@/lib/store";
import { linkHost } from "@/lib/product-link";

/** One product of a bundle, as a buyer who paid for it opens it. */
export type BundleLine = {
  product: Pick<Listing, "id" | "title" | "link">;
  /** Where its file is downloaded from; null when it has none. */
  download: string | null;
  /** How its course is opened: a form's fields, or a plain address; null when it is not a course. */
  course: { action: string; fields: Record<string, string> } | { href: string } | null;
  /** Its licence key, drawn by the page, when it hands one out. */
  keyBox?: ReactNode;
};

/**
 * What a bundle hands over, one product after another, each with its own way
 * to open it — the same download, link or course a buyer of that product on
 * its own gets. Used by the thanks page and by the list of purchases.
 */
export function BundleDelivery({
  lines,
  missing,
  storeName,
  heading = "What is inside",
}: {
  lines: BundleLine[];
  /** How many products of the bundle this store no longer has. */
  missing: number;
  storeName: string;
  heading?: string;
}) {
  return (
    <section className="mt-6" aria-label={heading}>
      <p className="st-label">{heading}</p>
      <ul className="mt-3 space-y-3">
        {lines.map((line) => {
          const { product } = line;
          return (
            <li key={product.id} className="rounded-2xl px-5 py-4" style={{ border: "1px solid var(--st-line)" }}>
              <p className="font-semibold">{product.title}</p>
              {line.course ? (
                "href" in line.course ? (
                  <a href={line.course.href} className="btn st-btn mt-3">
                    Open the course
                  </a>
                ) : (
                  <form action={line.course.action} method="post" className="mt-3">
                    {Object.entries(line.course.fields).map(([name, value]) => (
                      <input key={name} type="hidden" name={name} value={value} />
                    ))}
                    <button type="submit" className="btn st-btn">
                      Start the course
                    </button>
                  </form>
                )
              ) : product.link ? (
                <>
                  <a href={product.link} rel="noopener noreferrer nofollow" target="_blank" className="btn st-btn mt-3">
                    Open it
                  </a>
                  <p className="st-muted mt-2 break-all text-xs">{`Kept on ${linkHost(product.link)}: ${product.link}`}</p>
                </>
              ) : line.download ? (
                <a href={line.download} className="btn st-btn mt-3">
                  Download it
                </a>
              ) : (
                <p className="st-muted mt-2 text-sm">
                  {`This one has nothing attached right now. Reply to your receipt and ${storeName} will send it.`}
                </p>
              )}
              {line.keyBox}
            </li>
          );
        })}
      </ul>
      {missing > 0 ? (
        <p className="st-muted mt-3 text-sm">
          {`${missing === 1 ? "One product" : `${missing} products`} of this bundle ${missing === 1 ? "is" : "are"} no longer in ${storeName}'s store, so there is nothing here to open for ${missing === 1 ? "it" : "them"}. Reply to your receipt and it reaches ${storeName}.`}
        </p>
      ) : null}
    </section>
  );
}
