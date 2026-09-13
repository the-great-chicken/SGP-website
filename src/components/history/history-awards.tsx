import { HistoryPlayerLink } from "@/components/history/history-player-link";

type HistoryAward = {
  title: string;
  player: string;
};

type HistoryAwardsProps = {
  awards: readonly HistoryAward[];
};

export function HistoryAwards({ awards }: HistoryAwardsProps) {
  return (
    <div className="history-awards" role="list" aria-label="Distinctions de l’édition">
      {awards.map((award) => (
        <div role="listitem" key={`${award.title}-${award.player}`}>
          <span>{award.title}</span>
          <HistoryPlayerLink name={award.player} />
        </div>
      ))}
    </div>
  );
}
