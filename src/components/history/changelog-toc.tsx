"use client";

import { useEffect, useState } from "react";
import type { HistoryChangelogSection } from "@/content/history/changelogs";

type ChangelogTocProps = {
  sections: readonly HistoryChangelogSection[];
};

export function ChangelogToc({ sections }: ChangelogTocProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const updateActiveSection = () => {
      const anchorLine = 150;
      let nextActive = sections[0]?.id ?? "";

      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (!element) continue;

        if (element.getBoundingClientRect().top <= anchorLine) {
          nextActive = section.id;
        } else {
          break;
        }
      }

      setActiveId((current) => (current === nextActive ? current : nextActive));
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    window.addEventListener("hashchange", updateActiveSection);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
      window.removeEventListener("hashchange", updateActiveSection);
    };
  }, [sections]);

  return (
    <aside className="history-changelog-toc" aria-label="Sommaire du changelog">
      <p className="eyebrow">Sommaire</p>
      <nav>
        {sections.map((section) => {
          const active = activeId === section.id;
          return (
            <a
              className={active ? "is-active" : undefined}
              href={`#${section.id}`}
              key={section.id}
              aria-current={active ? "location" : undefined}
              onClick={() => setActiveId(section.id)}
            >
              {section.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
