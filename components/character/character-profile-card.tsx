import type { ReactNode } from "react";
import { Check, Crosshair, HeartPulse, Skull, UserRound } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { Character } from "@/lib/types";
import { cn } from "@/lib/utils";

const coordinateFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

function PositionReadout({ character }: { character: Character }) {
  if (!character.position) {
    return (
      <p className="mt-2 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        Não registrada nesta versão
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground">
      <span>X {coordinateFormatter.format(character.position.x)}</span>
      <span>Y {coordinateFormatter.format(character.position.y)}</span>
      <span>PISO {coordinateFormatter.format(character.position.z)}</span>
    </div>
  );
}

export function CharacterProfileCard({
  character,
  action,
}: {
  character: Character;
  action?: ReactNode;
}) {
  const source = character.source === "local" ? "LOCAL" : "HOSPEDADO";

  return (
    <Card
      className={cn(
        "group min-w-0 overflow-hidden",
        character.dead && "border-danger/35",
      )}
    >
      <CardContent className="flex h-full flex-col p-0">
        <div className="technical-grid grid min-h-48 grid-cols-[112px_minmax(0,1fr)] sm:grid-cols-[132px_minmax(0,1fr)]">
          <div
            className={cn(
              "relative grid place-items-center overflow-hidden border-r border-border",
              character.dead ? "bg-danger/5 text-danger" : "bg-primary/5 text-primary",
            )}
            aria-hidden="true"
          >
            <span className="absolute left-3 top-3 text-[8px] tracking-[0.18em] text-muted-foreground">
              PZ // SUBJECT
            </span>
            <UserRound className="size-16 stroke-[1.15] opacity-85 transition-transform duration-300 group-hover:scale-105 sm:size-20" />
            <span className="absolute inset-x-3 top-1/2 h-px bg-current/20" />
            <span className="absolute bottom-3 right-3 grid size-7 place-items-center border border-current/35 bg-background/90">
              {character.dead ? <Skull className="size-3.5" /> : <HeartPulse className="size-3.5" />}
            </span>
          </div>

          <div className="flex min-w-0 flex-col justify-between p-5 sm:p-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Registro {source}
                </p>
                <span
                  className={cn(
                    "border px-2 py-1 text-[9px] uppercase tracking-[0.14em]",
                    character.dead
                      ? "border-danger/35 bg-danger/5 text-danger"
                      : "border-success/35 bg-success/5 text-success",
                  )}
                >
                  {character.dead ? "Morto" : "Vivo"}
                </span>
              </div>
              <h3 className="mt-5 break-words text-lg uppercase leading-snug tracking-[0.08em]">
                {character.name}
              </h3>
            </div>

            <div className="mt-6 border-t border-border/80 pt-4">
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                <Crosshair className="size-3 text-primary" /> Última posição salva
              </div>
              <PositionReadout character={character} />
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-4 border-t border-border p-5">
          <div>
            <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Situação
            </p>
            <p
              className={cn(
                "mt-2 text-[11px] uppercase leading-5",
                character.dead ? "text-danger" : "text-success",
              )}
            >
              {character.dead
                ? "☠ Óbito registrado · recovery disponível"
                : "● Sobrevivente ativo · nenhuma ação necessária"}
            </p>
          </div>
          {action ?? (
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              <Check className="size-3.5 text-success" /> Dados validados no players.db
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
