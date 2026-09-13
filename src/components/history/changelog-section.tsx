import type { ReactNode } from "react";

type ChangelogSectionProps = {
  id: string;
  title: string;
  children: ReactNode;
};

export function ChangelogSection({ id, title, children }: ChangelogSectionProps) {
  return (
    <section className="history-changelog-section" id={id} aria-labelledby={`${id}-title`}>
      <div className="history-changelog-section-heading">
        <h2 id={`${id}-title`}>{title}</h2>
      </div>
      <div className="history-changelog-section-body">{children}</div>
    </section>
  );
}
