import type { ReactNode } from "react";

type PageIntroProps = {
  eyebrow: ReactNode;
  eyebrowClassName?: string;
  title: string;
  description: string;
  aside?: ReactNode;
};

export function PageIntro({ eyebrow, eyebrowClassName, title, description, aside }: PageIntroProps) {
  return (
    <section className="page-intro">
      <div>
        <p className={`eyebrow${eyebrowClassName ? ` ${eyebrowClassName}` : ""}`}>{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {aside ? <div className="page-intro-aside">{aside}</div> : null}
    </section>
  );
}
