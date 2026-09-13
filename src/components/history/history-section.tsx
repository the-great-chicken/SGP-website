import type { ReactNode } from "react";

type HistoryLeadProps = {
  children: ReactNode;
};

export function HistoryLead({ children }: HistoryLeadProps) {
  return <section className="history-article-lead">{children}</section>;
}

type HistorySectionProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

export function HistorySection({ eyebrow, title, children }: HistorySectionProps) {
  return (
    <section className="history-article-section">
      <div className="history-section-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
