"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Check,
  Circle,
  Database,
  HeartPulse,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { CharacterProfileCard } from "@/components/character/character-profile-card";
import { apiRequest } from "@/components/dashboard/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  AppConfig,
  Character,
  CharacterScan,
  RecoveryMode,
  RecoveryRecord,
  RecoveryStatus,
  ZomboidSave,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

interface Notice {
  tone: "success" | "danger";
  message: string;
}

const PENDING_STATUSES: RecoveryStatus[] = [
  "backup-created",
  "database-updated",
  "waiting-game-launch",
  "waiting-player-load",
];

const STATUS_LABELS: Record<RecoveryStatus, string> = {
  "backup-created": "BACKUP CRIADO",
  "database-updated": "DATABASE UPDATED",
  "waiting-game-launch": "AGUARDANDO JOGO",
  "waiting-player-load": "AGUARDANDO PERSONAGEM",
  completed: "RECOVERY COMPLETE",
  failed: "RECOVERY FAILED",
  "rolled-back": "ROLLBACK COMPLETE",
};

function isPending(status: RecoveryStatus): boolean {
  return PENDING_STATUSES.includes(status);
}

function ProcessStep({
  index,
  label,
  state,
}: {
  index: number;
  label: string;
  state: "done" | "waiting" | "skipped" | "failed";
}) {
  const stateLabel = {
    done: "OK",
    waiting: "WAIT",
    skipped: "--",
    failed: "FAIL",
  }[state];
  return (
    <div className="flex min-w-0 items-center gap-2 text-[11px]">
      <span className="text-muted-foreground">[{String(index).padStart(2, "0")}]</span>
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="min-w-2 flex-1 overflow-hidden whitespace-nowrap text-border">
        ................................
      </span>
      <span
        className={cn(
          state === "done" && "text-success",
          state === "waiting" && "text-warning",
          state === "skipped" && "text-muted-foreground",
          state === "failed" && "text-danger",
        )}
      >
        {stateLabel}
      </span>
    </div>
  );
}

function RecoveryProcess({
  recovery,
  onRollback,
  rollbackPending,
}: {
  recovery: RecoveryRecord;
  onRollback: () => void;
  rollbackPending: boolean;
}) {
  const failed = recovery.status === "failed";
  const databaseDone = !["backup-created", "failed"].includes(recovery.status);
  const complete = recovery.status === "completed";
  const fullHealth = recovery.mode === "full-health";
  const waitingGame = ["waiting-game-launch", "waiting-player-load"].includes(
    recovery.status,
  );

  return (
    <Card className={cn("min-w-0 overflow-hidden", failed && "border-danger/40")}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            Recovery process
          </p>
          <h3 className="mt-2 text-[13px] uppercase tracking-[0.1em]">
            {recovery.characterName}
          </h3>
        </div>
        <span
          className={cn(
            "border px-2 py-1 text-[9px] uppercase tracking-[0.12em]",
            complete && "border-success/35 text-success",
            waitingGame && "border-warning/35 text-warning",
            failed && "border-danger/35 text-danger",
            recovery.status === "rolled-back" &&
              "border-muted-foreground/35 text-muted-foreground",
          )}
        >
          {STATUS_LABELS[recovery.status]}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProcessStep index={1} label="BACKUP SAVE" state="done" />
        <ProcessStep
          index={2}
          label="VALIDATE DATABASE"
          state={failed && !databaseDone ? "failed" : databaseDone ? "done" : "waiting"}
        />
        <ProcessStep
          index={3}
          label="REVIVE CHARACTER"
          state={failed ? "failed" : databaseDone ? "done" : "waiting"}
        />
        <ProcessStep
          index={4}
          label="PREPARE HEALTH SCRIPT"
          state={fullHealth ? (failed ? "failed" : "done") : "skipped"}
        />
        <ProcessStep
          index={5}
          label="WAIT FOR PLAYER LOAD"
          state={!fullHealth ? "skipped" : complete ? "done" : failed ? "failed" : "waiting"}
        />
        <ProcessStep
          index={6}
          label="RESTORE FULL HEALTH"
          state={!fullHealth ? "skipped" : complete ? "done" : failed ? "failed" : "waiting"}
        />

        {waitingGame && fullHealth && (
          <div className="border border-warning/30 bg-warning/5 p-4 text-[11px] leading-6 text-warning">
            <p className="uppercase tracking-[0.12em]">Próxima ação obrigatória</p>
            <p className="mt-2 text-muted-foreground">
              Abra o menu Mods do Project Zomboid, habilite “Zomboid Save Manager
              Recovery” e carregue o save correto. Esta tela detectará a conclusão pelo
              log local do jogo.
            </p>
          </div>
        )}

        {recovery.errorMessage && (
          <p className="border-l-2 border-danger pl-3 text-[11px] leading-5 text-danger">
            {recovery.errorMessage}
          </p>
        )}

        {recovery.status !== "rolled-back" && (
          <div className="flex justify-end border-t border-border pt-4">
            <Button
              variant="danger"
              size="sm"
              onClick={onRollback}
              disabled={rollbackPending}
            >
              {rollbackPending ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
              Desfazer recuperação
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecoveryPanel({
  save,
  config,
  historyOnly,
  onNotice,
}: {
  save: ZomboidSave;
  config: AppConfig;
  historyOnly: boolean;
  onNotice: (notice: Notice) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedCharacter, setSelectedCharacter] = useState<Character>();
  const [mode, setMode] = useState<RecoveryMode>("full-health");
  const [confirmed, setConfirmed] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<RecoveryRecord>();

  const charactersQuery = useQuery({
    queryKey: ["characters", save.id],
    queryFn: () =>
      apiRequest<CharacterScan>(
        `/api/characters?saveId=${encodeURIComponent(save.id)}`,
      ),
    retry: false,
  });
  const recoveriesQuery = useQuery({
    queryKey: ["recoveries", save.id],
    queryFn: () =>
      apiRequest<RecoveryRecord[]>(
        `/api/character-recovery?saveId=${encodeURIComponent(save.id)}`,
      ),
    refetchInterval: (query) =>
      query.state.data?.some((recovery) => isPending(recovery.status))
        ? 2_500
        : false,
  });
  const gameStatusQuery = useQuery({
    queryKey: ["game-status"],
    queryFn: () => apiRequest<{ running: boolean }>("/api/game-status"),
    refetchInterval: 5_000,
    retry: false,
  });

  const history = recoveriesQuery.data ?? [];
  const pendingRecovery = history.find((recovery) => isPending(recovery.status));
  const statusQuery = useQuery({
    queryKey: ["recovery-status", pendingRecovery?.id],
    queryFn: () =>
      apiRequest<RecoveryRecord>(
        `/api/character-recovery/${encodeURIComponent(pendingRecovery!.id)}`,
      ),
    enabled: Boolean(pendingRecovery),
    refetchInterval: (query) => {
      const current = query.state.data;
      return current && !isPending(current.status) ? false : 2_000;
    },
  });

  const recoverMutation = useMutation({
    mutationFn: (input: {
      saveId: string;
      characterId: string;
      mode: RecoveryMode;
    }) =>
      apiRequest<RecoveryRecord>("/api/character-recovery", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
  const rollbackMutation = useMutation({
    mutationFn: (recoveryId: string) =>
      apiRequest<RecoveryRecord>(
        `/api/character-recovery/${encodeURIComponent(recoveryId)}/rollback`,
        { method: "POST" },
      ),
  });

  const latestRecovery =
    statusQuery.data ?? recoverMutation.data ?? rollbackMutation.data ?? history[0];
  const gameRunning = gameStatusQuery.data?.running ?? false;
  const recoveryStillPending = statusQuery.data
    ? isPending(statusQuery.data.status)
    : Boolean(pendingRecovery);
  const recoveryBlocked =
    !config.enableCharacterRecovery || gameRunning || recoveryStillPending;

  function openRecovery(character: Character) {
    setSelectedCharacter(character);
    setMode("full-health");
    setConfirmed(false);
  }

  async function submitRecovery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCharacter || !confirmed) return;
    try {
      const recovery = await recoverMutation.mutateAsync({
        saveId: save.id,
        characterId: selectedCharacter.id,
        mode,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["characters", save.id] }),
        queryClient.invalidateQueries({ queryKey: ["recoveries", save.id] }),
        queryClient.invalidateQueries({ queryKey: ["backups", save.id] }),
      ]);
      setSelectedCharacter(undefined);
      onNotice({
        tone: "success",
        message:
          recovery.mode === "full-health"
            ? "Personagem revivido. Conclua a restauração de saúde dentro do jogo."
            : "Personagem revivido e validado no banco de dados.",
      });
    } catch (error) {
      setSelectedCharacter(undefined);
      onNotice({
        tone: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível recuperar o personagem.",
      });
    }
  }

  async function submitRollback() {
    if (!rollbackTarget) return;
    try {
      await rollbackMutation.mutateAsync(rollbackTarget.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["characters", save.id] }),
        queryClient.invalidateQueries({ queryKey: ["recoveries", save.id] }),
        queryClient.invalidateQueries({ queryKey: ["recovery-status"] }),
      ]);
      setRollbackTarget(undefined);
      onNotice({
        tone: "success",
        message: "players.db foi restaurado ao estado anterior à recuperação.",
      });
    } catch (error) {
      setRollbackTarget(undefined);
      onNotice({
        tone: "danger",
        message:
          error instanceof Error ? error.message : "Não foi possível desfazer a recuperação.",
      });
    }
  }

  return (
    <div className="space-y-7">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-primary">
            Character recovery · {save.gameMode}
          </p>
          <h2 className="mt-3 text-xl uppercase tracking-[0.12em]">{save.name}</h2>
          <p className="mt-3 max-w-2xl text-[11px] leading-6 text-muted-foreground">
            A recuperação modifica apenas o estado necessário em players.db. Um backup
            completo e um backup separado do banco são obrigatórios antes da transação.
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-3 border px-4 py-3 text-[10px] uppercase tracking-[0.12em]",
            gameRunning
              ? "border-danger/35 bg-danger/5 text-danger"
              : "border-success/35 bg-success/5 text-success",
          )}
        >
          <Activity className="size-4" />
          {gameRunning ? "× JOGO ABERTO · OPERAÇÕES BLOQUEADAS" : "● JOGO FECHADO · READY"}
        </div>
      </div>

      {!config.enableCharacterRecovery && (
        <div className="flex items-center gap-3 border border-warning/35 bg-warning/5 p-4 text-[11px] text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          Character Recovery está desabilitado. Ative o recurso em Ajustes para continuar.
        </div>
      )}

      {latestRecovery && (
        <RecoveryProcess
          recovery={latestRecovery}
          onRollback={() => setRollbackTarget(latestRecovery)}
          rollbackPending={rollbackMutation.isPending}
        />
      )}

      {!historyOnly && (
        <section>
          <div className="mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="text-primary">[SUBJECTS]</span>
            <span>Personagens detectados</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {charactersQuery.isLoading ? (
            <Card>
              <CardContent className="flex min-h-48 items-center justify-center gap-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <RefreshCw className="size-4 animate-spin text-primary" /> Validando players.db...
              </CardContent>
            </Card>
          ) : charactersQuery.error ? (
            <Card className="border-warning/35">
              <CardContent className="flex min-h-48 flex-col items-center justify-center text-center">
                <Database className="mb-4 size-6 text-warning" />
                <p className="text-[12px] uppercase tracking-[0.12em] text-warning">
                  Scanner indisponível
                </p>
                <p className="mt-3 max-w-lg text-[11px] leading-6 text-muted-foreground">
                  {charactersQuery.error instanceof Error
                    ? charactersQuery.error.message
                    : "players.db não pôde ser validado."}
                </p>
              </CardContent>
            </Card>
          ) : (charactersQuery.data?.characters.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="flex min-h-48 flex-col items-center justify-center text-center">
                <UserRound className="mb-4 size-6 text-muted-foreground" />
                <p className="text-[11px] uppercase tracking-[0.12em]">Nenhum personagem encontrado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
              {charactersQuery.data?.characters.map((character) => (
                <CharacterProfileCard
                  key={character.id}
                  character={character}
                  action={
                    character.dead ? (
                      <Button
                        variant="danger"
                        onClick={() => openRecovery(character)}
                        disabled={recoveryBlocked}
                      >
                        <HeartPulse className="size-4" /> Reviver personagem
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {historyOnly && (
        <section>
          <div className="mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="text-primary">[HISTORY]</span>
            <span>Operações registradas</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          {history.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-48 items-center justify-center text-[11px] text-muted-foreground">
                Nenhuma recuperação foi iniciada para este save.
              </CardContent>
            </Card>
          ) : (
            <div className="border border-border bg-panel">
              {history.map((recovery, index) => (
                <div
                  key={recovery.id}
                  className={cn(
                    "grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center",
                    index > 0 && "border-t border-border",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] uppercase tracking-[0.1em]">{recovery.characterName}</p>
                    <p className="mt-2 truncate text-[9px] text-muted-foreground">{recovery.id}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formatDate(recovery.createdAt)}</span>
                  <span className="text-[9px] uppercase tracking-[0.1em] text-primary">{STATUS_LABELS[recovery.status]}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="border border-border bg-panel p-5 text-[10px] leading-6 text-muted-foreground">
        <p className="flex items-center gap-2 uppercase tracking-[0.12em] text-foreground">
          <ShieldCheck className="size-4 text-primary" /> Limites da recuperação
        </p>
        <p className="mt-2">
          Skills, XP, profissão, traços, posição e mundo não são alterados. Itens já
          transferidos ao cadáver, zumbi ou chão precisam ser recuperados dentro do jogo.
        </p>
      </div>

      <Dialog
        open={Boolean(selectedCharacter)}
        onOpenChange={(open) => !open && setSelectedCharacter(undefined)}
      >
        <DialogContent className="max-w-2xl">
          <DialogTitle>Reviver {selectedCharacter?.name}</DialogTitle>
          <DialogDescription>
            Esta operação modifica dados internos do personagem somente depois de criar e
            validar os backups obrigatórios.
          </DialogDescription>
          <form onSubmit={submitRecovery} className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  value: "full-health" as const,
                  title: "Totalmente saudável",
                  description: "Revive agora e restaura a saúde quando o personagem carregar.",
                },
                {
                  value: "revive" as const,
                  title: "Reviver como estava",
                  description: "Altera apenas o estado de morte no banco de dados.",
                },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={cn(
                    "border p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    mode === option.value
                      ? "border-primary/60 bg-primary/5"
                      : "border-border bg-background",
                  )}
                >
                  <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em]">
                    {mode === option.value ? (
                      <Check className="size-4 text-primary" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" />
                    )}
                    {option.title}
                  </span>
                  <span className="mt-3 block text-[10px] leading-5 text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>

            {mode === "full-health" && (
              <div className="grid grid-cols-2 gap-3 border border-border bg-background p-4 text-[10px] text-muted-foreground sm:grid-cols-4">
                {["HP máximo", "Sem ferimentos", "Sem infecção", "Sem fraturas"].map((item) => (
                  <span key={item} className="flex items-center gap-2">
                    <Check className="size-3 text-success" /> {item}
                  </span>
                ))}
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 border border-danger/30 bg-danger/5 p-4 text-[11px] leading-5">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              Confirmo que o Project Zomboid está fechado e quero iniciar a recuperação de
              {selectedCharacter ? ` ${selectedCharacter.name}` : " este personagem"}.
            </label>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setSelectedCharacter(undefined)}>
                Cancelar
              </Button>
              <Button type="submit" variant="danger" disabled={!confirmed || recoverMutation.isPending}>
                {recoverMutation.isPending ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <HeartPulse className="size-4" />
                )}
                {recoverMutation.isPending ? "Criando backup..." : "Confirmar recuperação"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(rollbackTarget)}
        onOpenChange={(open) => !open && setRollbackTarget(undefined)}
      >
        <DialogContent>
          <DialogTitle>Desfazer recuperação?</DialogTitle>
          <DialogDescription>
            O players.db anterior à recuperação será restaurado. O estado atual também será
            preservado separadamente antes da troca.
          </DialogDescription>
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setRollbackTarget(undefined)}>Cancelar</Button>
            <Button variant="danger" onClick={submitRollback} disabled={rollbackMutation.isPending}>
              <RotateCcw className="size-4" /> Restaurar estado anterior
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
