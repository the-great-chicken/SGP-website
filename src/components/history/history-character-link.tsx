import Link from "next/link";
import type { ReactNode } from "react";
import type { HistoryCharacterSlug } from "@/content/history/characters";

type HistoryCharacterLinkProps = {
  slug: HistoryCharacterSlug;
  children?: ReactNode;
};

export function HistoryCharacterLink({ slug, children }: HistoryCharacterLinkProps) {
  return (
    <Link className="history-reference-link" href={`/wiki/personnages/${slug}`}>
      {children}
    </Link>
  );
}
