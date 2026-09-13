# History content

The public history is deliberately separate from the statistics database.

- `src/content/history/editions.ts` is the structured registry shared by the history landing page, edition routes and the future map comparison.
- `src/content/history/editions/edition-*.mdx` contains editorial article bodies.
- `src/components/history/` contains reusable presentation components that MDX articles can embed.
- `src/app/(public)/wiki/` owns routing and page composition.
- `public/history/editions/<number>/archive/` contains original public-facing archive media selected for publication.

## MDX boundary

History prose lives in MDX because the pages are primarily editorial text with occasional structured components. Routing, publication state, edition metadata and historical-map identifiers stay in TypeScript so they can be reused by the timeline and other site features without parsing article prose.

The project uses the official `@next/mdx` integration. `src/mdx-components.tsx` is the required App Router MDX component hook; article-specific components are imported explicitly in each MDX file so their dependencies remain easy to see during review.

## Editorial rule

The archaeology dossiers remain the exhaustive source material. Public pages should only retain information that helps a player understand:

1. what made an edition distinct;
2. what changed from the previous edition;
3. what happened during the evening;
4. what is still worth remembering.

Detailed log reconstruction, uncertain inferred statistics, unplayed branches and development-only lore stay out of the public narrative.

Original invitations, teasers, presentations and similar public material may be preserved as archive objects. Development-only captures should not be published merely because they survived in the source archive.

### Writing style

Write the public article as the story itself, not as commentary about the archaeology. Prefer concrete events, player actions and details over phrases such as “the archives show”, “traces remain”, “this already establishes…” or explanations of what the material means for SGP as a concept. Use that editorial reasoning to choose facts, then remove the reasoning from the final prose.

History pages are reading pages rather than dense UI: body copy and narrative cards should remain comfortably larger than labels/metadata. Archive images get at most one visible caption each; gallery labels are accessibility metadata rather than a second caption layer.

Avoid recap paragraphs that merely repeat material already explained in the preceding section. A mechanic or event should normally be introduced once, where it matters to the story; repeat it later only when the later passage adds a genuinely new consequence or perspective.

## Historical map contract

Each edition owns a stable `map.snapshotKey` in the edition registry. `map.previewSrc` is nullable until historical map media exists.

The intended experience is:

- the `/wiki` timeline shows a fixed-frame preview for each edition;
- each edition article links to its historical state;
- a future `/wiki/carte` comparison owns the full interactive view.

The world footprint is constant across these editions. Historical previews/comparison should therefore preserve the same bounds/camera wherever possible so changes inside the world are directly comparable.

Do not couple this feature to the live `/map` route. The live route remains the current BlueMap experience; historical map generation can be designed independently from retained edition world snapshots.
