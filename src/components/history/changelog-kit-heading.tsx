import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChangelogSourceHeading } from "@/components/history/changelog-source-heading";

type ChangelogKitHeadingProps = {
  kitKey: string;
  color: `#${string}`;
  children: ReactNode;
};

export function ChangelogKitHeading({ kitKey, color, children }: ChangelogKitHeadingProps) {
  return (
    <ChangelogSourceHeading level={4} color={color} className="is-kit">
      <Link className="history-changelog-kit-link" href={`/kits/${kitKey}`}>
        <Image
          className="history-changelog-kit-icon"
          src={`/generated/kit-models/${kitKey}/icon.png`}
          width={30}
          height={30}
          alt=""
          unoptimized
        />
        <span>{children}</span>
      </Link>
    </ChangelogSourceHeading>
  );
}
