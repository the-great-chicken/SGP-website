import Link from "next/link";
import type { ReactNode } from "react";

type HistoryPlayerLinkProps = {
  name: string;
  children?: ReactNode;
};

export function HistoryPlayerLink({ name, children }: HistoryPlayerLinkProps) {
  return (
    <Link className="history-reference-link" href={`/players?q=${encodeURIComponent(name)}`}>
      {children ?? name}
    </Link>
  );
}
