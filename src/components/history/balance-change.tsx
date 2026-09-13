import type { ReactNode } from "react";

type BalanceChangeProps = {
  kind: "buff" | "nerf";
  children: ReactNode;
};

export function BalanceChange({ kind, children }: BalanceChangeProps) {
  return (
    <span className={`history-balance-change is-${kind}`}>
      <span className="sr-only">{kind === "buff" ? "Amélioration : " : "Réduction : "}</span>
      {children}
    </span>
  );
}
