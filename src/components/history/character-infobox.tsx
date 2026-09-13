import Link from "next/link";
import type { HistoryCharacter } from "@/content/history/characters";
import { getHistoryEdition } from "@/content/history/editions";

type CharacterInfoboxProps = {
  character: HistoryCharacter;
};

export function CharacterInfobox({ character }: CharacterInfoboxProps) {
  const firstEdition = getHistoryEdition(character.firstAppearance);

  return (
    <aside className="history-character-infobox" aria-label={`Repères sur ${character.name}`}>
      <p className="eyebrow">Repères</p>
      <dl>
        <div>
          <dt>Rôle</dt>
          <dd>{character.roleLabel}</dd>
        </div>
        <div>
          <dt>Première apparition</dt>
          <dd>
            <Link href={`/wiki/editions/${character.firstAppearance}`}>
              Édition {character.firstAppearance}{firstEdition ? ` · ${firstEdition.dateLabel}` : ""}
            </Link>
          </dd>
        </div>
        <div>
          <dt>Éditions</dt>
          <dd className="history-character-edition-links">
            {character.appearances.map((editionNumber) => (
              <Link key={editionNumber} href={`/wiki/editions/${editionNumber}`}>
                {editionNumber}
              </Link>
            ))}
          </dd>
        </div>
      </dl>
      <p className="history-character-infobox-note">
        Cette fiche ne préremplit que les éléments déjà établis dans les éditions publiées. Le reste est laissé au scénariste.
      </p>
    </aside>
  );
}
