import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type ChangelogKitInlineProps = {
  kitKey: string;
  children: ReactNode;
};

export function ChangelogKitInline({ kitKey, children }: ChangelogKitInlineProps) {
  return (
    <Link className="history-changelog-kit-inline" href={`/kits/${kitKey}`}>
      <Image
        className="history-changelog-kit-inline-icon"
        src={`/generated/kit-models/${kitKey}/icon.png`}
        width={22}
        height={22}
        alt=""
        unoptimized
      />
      <span>{children}</span>
    </Link>
  );
}
