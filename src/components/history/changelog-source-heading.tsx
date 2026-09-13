import type { CSSProperties, ReactNode } from "react";

type ChangelogSourceHeadingProps = {
  level?: 3 | 4;
  color: `#${string}`;
  className?: string;
  children: ReactNode;
};

type Rgb = readonly [number, number, number];

const PAGE_BACKGROUND: Rgb = [24, 37, 47];
const PAGE_TEXT: Rgb = [237, 241, 238];

function hexToRgb(color: string): Rgb {
  const value = color.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function relativeLuminance([red, green, blue]: Rgb) {
  const channels = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrastRatio(a: Rgb, b: Rgb) {
  const light = Math.max(relativeLuminance(a), relativeLuminance(b));
  const dark = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (light + 0.05) / (dark + 0.05);
}

function mixRgb(source: Rgb, target: Rgb, targetWeight: number): Rgb {
  return [
    Math.round((source[0] * (1 - targetWeight)) + (target[0] * targetWeight)),
    Math.round((source[1] * (1 - targetWeight)) + (target[1] * targetWeight)),
    Math.round((source[2] * (1 - targetWeight)) + (target[2] * targetWeight)),
  ];
}

function rgbToHex([red, green, blue]: Rgb) {
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function readableSourceColor(sourceHex: string) {
  const source = hexToRgb(sourceHex);
  if (contrastRatio(source, PAGE_BACKGROUND) >= 4) return sourceHex;

  for (let paperWeight = 0.1; paperWeight <= 0.7; paperWeight += 0.05) {
    const mixed = mixRgb(source, PAGE_TEXT, paperWeight);
    if (contrastRatio(mixed, PAGE_BACKGROUND) >= 4) return rgbToHex(mixed);
  }

  return rgbToHex(mixRgb(source, PAGE_TEXT, 0.7));
}

export function ChangelogSourceHeading({
  level = 3,
  color,
  className,
  children,
}: ChangelogSourceHeadingProps) {
  const style = {
    "--changelog-source-color": color,
    "--changelog-readable-color": readableSourceColor(color),
  } as CSSProperties;

  if (level === 4) {
    return (
      <h4 className={`history-changelog-source-heading${className ? ` ${className}` : ""}`} style={style}>
        {children}
      </h4>
    );
  }

  return (
    <h3 className={`history-changelog-source-heading${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </h3>
  );
}
