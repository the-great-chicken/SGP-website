import Edition2Changelog from "@/content/history/changelogs/edition-2.mdx";
import Edition3Changelog from "@/content/history/changelogs/edition-3.mdx";
import Edition4Changelog from "@/content/history/changelogs/edition-4.mdx";

const changelogArticles = {
  2: Edition2Changelog,
  3: Edition3Changelog,
  4: Edition4Changelog,
} as const;

export function getChangelogArticle(edition: number) {
  return changelogArticles[edition as keyof typeof changelogArticles] ?? null;
}
