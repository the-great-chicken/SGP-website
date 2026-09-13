import Image from "next/image";
import { ImageIcon } from "lucide-react";
import Link from "next/link";
import type { HistoryCharacter } from "@/content/history/characters";

type CharacterHeroProps = {
  character: HistoryCharacter;
};

export function CharacterHero({ character }: CharacterHeroProps) {
  return (
    <header className="history-character-hero">
      <div className="history-character-topline">
        <Link href="/wiki/personnages">Personnages</Link>
        <span aria-hidden="true">/</span>
        <span>{character.name}</span>
      </div>

      <div className={`history-character-portrait${character.portrait.src ? " has-image" : ""}`}>
        {character.portrait.src ? (
          <Image
            src={character.portrait.src}
            alt={character.portrait.alt}
            fill
            sizes="(max-width: 1200px) 100vw, 1120px"
            priority
          />
        ) : (
          <div className="history-character-portrait-placeholder" aria-label="Emplacement réservé au portrait 16 par 9">
            <ImageIcon size={28} aria-hidden="true" />
            <span>Portrait 16:9</span>
            <small>visuel à fournir</small>
          </div>
        )}
      </div>

      <div className="history-character-heading">
        <div>
          <p className="eyebrow">Personnage</p>
          <p className="history-character-kicker">{character.kicker}</p>
          <h1>{character.name}</h1>
          <p className="history-character-summary">{character.summary}</p>
        </div>
        {character.editorialStatus === "draft" ? (
          <span className="history-status-chip">Fiche à compléter</span>
        ) : null}
      </div>
    </header>
  );
}
