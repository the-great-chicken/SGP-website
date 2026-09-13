type HistoryEvent = {
  title: string;
  description: string;
};

type HistoryEventGridProps = {
  events: readonly HistoryEvent[];
};

export function HistoryEventGrid({ events }: HistoryEventGridProps) {
  return (
    <div className="history-event-grid">
      {events.map((event, index) => (
        <article key={event.title}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3>{event.title}</h3>
            <p>{event.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
