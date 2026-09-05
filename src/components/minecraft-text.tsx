import type { CSSProperties, ReactNode } from "react";
import {
  formatActivationKeybind,
  getMinecraftColor,
  type JsonValue,
} from "@/lib/kit-manifest";

type MinecraftTextProps = {
  value: JsonValue;
  className?: string;
};

export function MinecraftText({ value, className }: MinecraftTextProps) {
  return <span className={className}>{renderText(value, "root")}</span>;
}

function renderText(value: JsonValue | undefined, key: string): ReactNode {
  if (value === undefined || typeof value === "boolean") {
    return null;
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((child, index) => (
      <span key={`${key}-${index}`}>{renderText(child, `${key}-${index}`)}</span>
    ));
  }

  const style: CSSProperties = {
    color: typeof value.color === "string" ? getMinecraftColor(value.color) : undefined,
    fontStyle: value.italic === true ? "italic" : value.italic === false ? "normal" : undefined,
    fontWeight: value.bold === true ? 700 : undefined,
    textDecoration: getTextDecoration(value),
  };
  const content =
    typeof value.text === "string"
      ? value.text
      : typeof value.keybind === "string"
        ? formatActivationKeybind(value.keybind)
        : typeof value.translate === "string"
          ? value.translate
          : "";

  return (
    <span style={style}>
      {content}
      {renderText(value.extra, `${key}-extra`)}
    </span>
  );
}

function getTextDecoration(value: Record<string, JsonValue>): CSSProperties["textDecoration"] {
  const decorations = [];
  if (value.underlined === true) {
    decorations.push("underline");
  }
  if (value.strikethrough === true) {
    decorations.push("line-through");
  }
  return decorations.length ? decorations.join(" ") : undefined;
}
