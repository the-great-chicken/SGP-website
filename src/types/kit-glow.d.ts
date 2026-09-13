import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "sgp-kit-glow": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { color: string };
    }
  }
}
