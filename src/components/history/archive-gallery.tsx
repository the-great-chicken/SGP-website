import Image from "next/image";

type ArchiveItem = {
  src: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
};

type ArchiveGalleryProps = {
  items: readonly ArchiveItem[];
  label?: string;
};

export function ArchiveGallery({ items, label = "Documents d’archive" }: ArchiveGalleryProps) {
  return (
    <figure className="history-archive-gallery" aria-label={label}>
      <div className="history-archive-grid">
        {items.map((item) => (
          <a
            className="history-archive-item"
            href={item.src}
            key={item.src}
            target="_blank"
            rel="noreferrer"
          >
            <span className="history-archive-image-wrap">
              <Image
                src={item.src}
                alt={item.alt}
                width={item.width}
                height={item.height}
                sizes="(max-width: 700px) 100vw, 46vw"
              />
            </span>
            {item.caption ? <span className="history-archive-caption">{item.caption}</span> : null}
          </a>
        ))}
      </div>
    </figure>
  );
}
