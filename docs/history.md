# History content

History content is independent from the statistics database.

- `src/content/history/editions.ts`: edition metadata used by the wiki and map timeline.
- `src/content/history/editions/edition-*.mdx`: edition articles.
- `src/content/history/characters.ts` and `characters/*.mdx`: character metadata and articles.
- `src/content/history/story.mdx`: the cross-edition story summary.
- `src/content/history/changelogs.ts` and `changelogs/edition-*.mdx`: published changelogs.
- `public/history/editions/<number>/archive/`: selected historical images used by the articles.

Keep routing/publication metadata in TypeScript and editorial prose in MDX.

## Editorial rules

Public history should explain what made an edition distinct, what changed, what happened during the event, and what remains worth remembering. Detailed reconstruction notes, uncertain statistics, unused branches, and development-only lore stay in source material rather than the public narrative.

Write the story directly. Prefer concrete events and player actions over commentary such as “the archives show” or explanations of how evidence was interpreted. Avoid recap paragraphs that repeat the previous section.

Publish archival documents only when they have a deliberate place in the narrative. Changelogs are the normal standalone exception; surviving planning material is not automatically public content.

## Character pages

Only facts already shown to players belong in canon sections. Unused branches, notes, and future backstory stay in the scenarist placeholders until deliberately canonized.

Set `portrait.src` in `characters.ts` when a final portrait is available; the shared character views reuse it automatically.
