"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Archive,
  ChevronRight,
  Database,
  FolderCog,
  HardDrive,
  History,
  Menu,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Skull,
  Terminal,
  X,
} from "lucide-react";

import { CharacterProfileCard } from "@/components/character/character-profile-card";
import { apiRequest } from "@/components/dashboard/api-client";
import {
  BrandIcon,
  BrandIdentity,
} from "@/components/branding/brand-identity";
import { DeveloperCredit } from "@/components/branding/developer-credit";
import { RecoveryPanel } from "@/components/recovery/recovery-panel";
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
  BackupMetadata,
  CharacterScan,
  ZomboidSave,
} from "@/lib/types";
import { cn, formatBytes, formatDate, formatRelativeDate } from "@/lib/utils";

type View =
  | "overview"
  | "saves"
  | "backups"
  | "characters"
  | "recovery"
  | "settings";

interface Notice {
  tone: "success" | "danger";
  message: string;
}

const navigation = [
  { id: "overview" as const, label: "Dashboard", icon: Activity },
  { id: "saves" as const, label: "Saves", icon: HardDrive },
  { id: "backups" as const, label: "Backups", icon: History },
  { id: "settings" as const, label: "Ajustes", icon: Settings },
];

const recoveryNavigation = [
  { id: "characters" as const, label: "Personagens", icon: Skull },
  { id: "recovery" as const, label: "Recovery", icon: Database },
];

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="truncate text-[13px] text-foreground">{value}</div>
    </div>
  );
}

function SectionLabel({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
      <span className="text-primary">[{code}]</span>
      <span>{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function Sidebar({
  view,
  open,
  onClose,
  onNavigate,
}: {
  view: View;
  open: boolean;
  onClose: () => void;
  onNavigate: (view: View) => void;
}) {
  return (
    <>
      {open && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-black/70 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-border bg-[#0c0f0d] transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-border px-5">
          <BrandIdentity />
          <button aria-label="Fechar menu" className="text-muted-foreground lg:hidden" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6">
          <p className="mb-3 px-3 text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
            Sistema · 01
          </p>
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  className={cn(
                    "group flex h-11 w-full items-center gap-3 border px-3 text-left text-[11px] uppercase tracking-[0.12em] transition-colors",
                    active
                      ? "border-primary/35 bg-primary/8 text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-surface-raised hover:text-foreground",
                  )}
                  onClick={() => onNavigate(item.id)}
                >
                  <Icon className="size-4" strokeWidth={1.5} />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight className="size-3" />}
                </button>
              );
            })}
          </div>

          <p className="mb-3 mt-8 px-3 text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
            Recovery · 02
          </p>
          <div className="space-y-1">
            {recoveryNavigation.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  className={cn(
                    "group flex h-11 w-full items-center gap-3 border px-3 text-left text-[11px] uppercase tracking-[0.12em] transition-colors",
                    active
                      ? "border-danger/35 bg-danger/8 text-danger"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-surface-raised hover:text-foreground",
                  )}
                  onClick={() => onNavigate(item.id)}
                >
                  <Icon className="size-4" strokeWidth={1.5} />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight className="size-3" />}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-border p-5">
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <span className="status-pulse size-2 bg-success" />
            <span>
              Node local
              <span className="mt-1 block text-success">● Operacional</span>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}

function EmptySaves({ onSettings }: { onSettings: () => void }) {
  return (
    <Card className="technical-grid col-span-full min-h-[360px]">
      <CardContent className="flex min-h-[360px] flex-col items-center justify-center text-center">
        <div className="mb-6 grid size-16 place-items-center border border-border bg-background text-muted-foreground">
          <FolderCog className="size-7" strokeWidth={1.4} />
        </div>
        <h2 className="text-lg uppercase tracking-[0.15em]">Nenhum save detectado</h2>
        <p className="mt-3 max-w-md text-[13px] leading-6 text-muted-foreground">
          O diretório configurado não contém partidas. Verifique o caminho do
          Project Zomboid para iniciar a varredura.
        </p>
        <Button className="mt-7" variant="outline" onClick={onSettings}>
          <Settings className="size-4" /> Configurar diretório
        </Button>
      </CardContent>
    </Card>
  );
}

function SaveSelector({
  saves,
  selectedId,
  onSelect,
}: {
  saves: ZomboidSave[];
  selectedId?: string;
  onSelect: (saveId: string) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
      {saves.map((save) => {
        const active = save.id === selectedId;
        return (
          <button
            key={save.id}
            onClick={() => onSelect(save.id)}
            className={cn(
              "group border bg-panel p-5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary/60 bg-primary/[0.045]"
                : "border-border hover:border-muted-foreground",
            )}
          >
            <div className="mb-7 flex items-start justify-between gap-3">
              <span className={cn("text-[10px] uppercase tracking-[0.16em]", active ? "text-primary" : "text-muted-foreground")}>
                {active ? "> Save atual" : "Save detectado"}
              </span>
              <HardDrive className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
            </div>
            <h3 className="truncate text-base uppercase tracking-[0.08em]">{save.name}</h3>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
              <Metric label="Modo" value={save.gameMode} />
              <Metric label="Tamanho" value={formatBytes(save.size)} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CurrentSavePanel({
  save,
  backups,
  onCreateBackup,
}: {
  save: ZomboidSave;
  backups: BackupMetadata[];
  onCreateBackup: () => void;
}) {
  const lastBackup = backups[0];
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-4 bg-surface-raised/30">
        <div className="flex items-center gap-3">
          <span className="size-2 bg-success" />
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Save selecionado
          </span>
        </div>
        <span className="border border-success/30 bg-success/5 px-2 py-1 text-[9px] uppercase tracking-[0.16em] text-success">
          ● Disponível
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="technical-grid px-6 py-8 md:px-8">
          <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-primary">
                {save.gameMode} · {save.id.slice(-6).toUpperCase()}
              </p>
              <h2 className="break-all text-2xl uppercase tracking-[0.1em] sm:text-3xl">
                {save.name}
              </h2>
            </div>
            <Button size="lg" onClick={onCreateBackup}>
              <Save className="size-4" /> Criar backup
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border md:grid-cols-4">
          {[
            ["Última alteração", formatRelativeDate(save.lastModified)],
            ["Tamanho", formatBytes(save.size)],
            ["Arquivos", save.fileCount.toLocaleString("pt-BR")],
            ["Último backup", lastBackup ? formatRelativeDate(lastBackup.createdAt) : "nenhum"],
          ].map(([label, value]) => (
            <div key={label} className="bg-panel px-5 py-5">
              <Metric label={label} value={value} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BackupList({ backups }: { backups: BackupMetadata[] }) {
  if (backups.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-48 items-center justify-center text-center">
          <div>
            <Archive className="mx-auto mb-4 size-6 text-muted-foreground" />
            <p className="text-[12px] uppercase tracking-[0.14em]">Histórico vazio</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              O primeiro backup aparecerá aqui após a validação.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="border border-border bg-panel">
      {backups.map((backup, index) => (
        <div
          key={backup.id}
          className={cn(
            "grid gap-5 p-5 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(110px,0.6fr))] md:items-center",
            index > 0 && "border-t border-border",
          )}
        >
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="size-4 text-success" strokeWidth={1.5} />
              <span className="truncate text-[13px] uppercase tracking-[0.08em]">
                {backup.label || `BACKUP_${backup.id.slice(-8).toUpperCase()}`}
              </span>
            </div>
            <p className="truncate text-[10px] text-muted-foreground">{backup.id}</p>
          </div>
          <Metric label="Criado" value={formatDate(backup.createdAt)} />
          <Metric label="Tamanho" value={formatBytes(backup.size)} />
          <Metric label="Tipo" value={backup.type.toUpperCase()} />
        </div>
      ))}
    </div>
  );
}

function SystemReadout({ savesCount, backupsCount }: { savesCount: number; backupsCount: number }) {
  const rows = [
    ["FILESYSTEM", "OK", "success"],
    ["SAVE SCAN", `${savesCount} FOUND`, "success"],
    ["BACKUP INDEX", `${backupsCount} READY`, "success"],
    ["GAME GUARD", "READY", "success"],
  ] as const;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Terminal className="size-4 text-primary" />
          <span className="text-[11px] uppercase tracking-[0.16em]">System readout</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-[11px]">
        {rows.map(([label, value, tone], index) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-muted-foreground">[{String(index + 1).padStart(2, "0")}]</span>
            <span className="text-muted-foreground">{label}</span>
            <span className="min-w-3 flex-1 overflow-hidden whitespace-nowrap text-border">
              ................................
            </span>
            <span className={tone === "success" ? "text-success" : "text-warning"}>{value}</span>
          </div>
        ))}
        <p className="border-t border-border pt-4 text-[10px] leading-5 text-muted-foreground">
          &gt; Backups e Character Recovery protegidos pelo guard local.
        </p>
      </CardContent>
    </Card>
  );
}

function SettingsPanel({ initialConfig }: { initialConfig: AppConfig }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialConfig);
  const [notice, setNotice] = useState<Notice | null>(null);
  const mutation = useMutation({
    mutationFn: (config: AppConfig) =>
      apiRequest<AppConfig>("/api/config", {
        method: "PUT",
        body: JSON.stringify(config),
      }),
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    try {
      await mutation.mutateAsync(form);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["config"] }),
        queryClient.invalidateQueries({ queryKey: ["saves"] }),
        queryClient.invalidateQueries({ queryKey: ["backups"] }),
      ]);
      setNotice({ tone: "success", message: "Configuração salva. Nova varredura concluída." });
    } catch (error) {
      setNotice({
        tone: "danger",
        message: error instanceof Error ? error.message : "Não foi possível salvar.",
      });
    }
  }

  const textFields: ReadonlyArray<{
    key: "zomboidSavesPath" | "backupPath";
    label: string;
    hint: string;
  }> = [
    {
      key: "zomboidSavesPath" as const,
      label: "Diretório de saves",
      hint: "Pasta que contém os diretórios Sandbox, Apocalypse e outros modos.",
    },
    {
      key: "backupPath" as const,
      label: "Armazenamento de backups",
      hint: "Use um diretório fora da instalação do jogo e fora do projeto.",
    },
  ];
  const policyFields: ReadonlyArray<{
    key:
      | "backupBeforeLaunch"
      | "deleteOldBackups"
      | "enableCharacterRecovery";
    label: string;
  }> = [
    { key: "backupBeforeLaunch", label: "Backup antes de jogar" },
    { key: "deleteOldBackups", label: "Rotação automática habilitada" },
    { key: "enableCharacterRecovery", label: "Character Recovery habilitado" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FolderCog className="size-4 text-primary" />
            <div>
              <h2 className="text-[12px] uppercase tracking-[0.14em]">Rotas do filesystem</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">Configuração local armazenada em JSON.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-7">
          {textFields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {field.label}
              </span>
              <input
                value={form[field.key]}
                onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                className="h-12 w-full border border-border bg-background px-4 text-[12px] text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <span className="mt-2 block text-[10px] leading-5 text-muted-foreground">{field.hint}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Archive className="size-4 text-primary" />
            <h2 className="text-[12px] uppercase tracking-[0.14em]">Política futura de rotação</h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <label>
            <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Máximo de backups automáticos
            </span>
            <input
              type="number"
              min={1}
              max={100}
              value={form.maxAutomaticBackups}
              onChange={(event) => setForm({ ...form, maxAutomaticBackups: Number(event.target.value) })}
              className="h-12 w-full border border-border bg-background px-4 outline-none focus:border-primary"
            />
          </label>
          <div className="flex flex-col justify-end gap-3">
            {policyFields.map((field) => (
              <label key={field.key} className="flex cursor-pointer items-center gap-3 text-[11px] uppercase tracking-[0.1em]">
                <input
                  type="checkbox"
                  checked={form[field.key]}
                  onChange={(event) => setForm({ ...form, [field.key]: event.target.checked })}
                  className="size-4 accent-primary"
                />
                {field.label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div aria-live="polite" className={cn("text-[11px]", notice?.tone === "success" ? "text-success" : "text-danger")}>
          {notice?.message}
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar configuração
        </Button>
      </div>
    </form>
  );
}

function LoadingScreen() {
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <div className="text-center">
        <div className="mx-auto mb-5 size-10 border border-primary/30 p-2">
          <RefreshCw className="size-full animate-spin text-primary" />
        </div>
        <p className="text-[11px] uppercase tracking-[0.2em]">Varrendo diretórios...</p>
      </div>
    </div>
  );
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("overview");
  const [selectedSaveId, setSelectedSaveId] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [backupLabel, setBackupLabel] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const savesQuery = useQuery({
    queryKey: ["saves"],
    queryFn: () => apiRequest<ZomboidSave[]>("/api/saves"),
  });
  const configQuery = useQuery({
    queryKey: ["config"],
    queryFn: () => apiRequest<AppConfig>("/api/config"),
  });

  const saves = savesQuery.data ?? [];
  const selectedSave =
    saves.find((save) => save.id === selectedSaveId) ?? saves[0];

  const backupsQuery = useQuery({
    queryKey: ["backups", selectedSave?.id],
    queryFn: () =>
      apiRequest<BackupMetadata[]>(`/api/backups?saveId=${encodeURIComponent(selectedSave!.id)}`),
    enabled: Boolean(selectedSave),
  });
  const backups = backupsQuery.data ?? [];
  const charactersQuery = useQuery({
    queryKey: ["characters", selectedSave?.id],
    queryFn: () =>
      apiRequest<CharacterScan>(
        `/api/characters?saveId=${encodeURIComponent(selectedSave!.id)}`,
      ),
    enabled: Boolean(selectedSave),
    retry: false,
  });

  const backupMutation = useMutation({
    mutationFn: ({ saveId, label }: { saveId: string; label?: string }) =>
      apiRequest<BackupMetadata>("/api/backups", {
        method: "POST",
        body: JSON.stringify({ saveId, label }),
      }),
  });

  function navigate(nextView: View) {
    setView(nextView);
    setMenuOpen(false);
  }

  async function refresh() {
    setNotice(null);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["saves"] }),
        queryClient.invalidateQueries({ queryKey: ["backups"] }),
      ]);
      setNotice({ tone: "success", message: "Varredura local atualizada." });
    } catch {
      setNotice({ tone: "danger", message: "Não foi possível atualizar a varredura." });
    }
  }

  async function submitBackup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSave) return;
    setNotice(null);
    try {
      const backup = await backupMutation.mutateAsync({
        saveId: selectedSave.id,
        label: backupLabel.trim() || undefined,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["backups", selectedSave.id] }),
        queryClient.invalidateQueries({ queryKey: ["saves"] }),
      ]);
      setBackupLabel("");
      setDialogOpen(false);
      setNotice({
        tone: "success",
        message: `${backup.label || "Backup"} validado e armazenado com segurança.`,
      });
    } catch (error) {
      setNotice({
        tone: "danger",
        message: error instanceof Error ? error.message : "Não foi possível criar o backup.",
      });
      setDialogOpen(false);
    }
  }

  const pageTitles: Record<View, [string, string]> = {
    overview: ["Dashboard", "Visão geral da proteção local"],
    saves: ["Saves detectados", "Selecione a partida ativa"],
    backups: ["Histórico de backups", "Cópias verificadas do save atual"],
    characters: ["Personagens", "Scanner seguro de players.db"],
    recovery: ["Recovery", "Histórico e estado das recuperações"],
    settings: ["Configurações", "Diretórios e políticas locais"],
  };

  const fatalError = savesQuery.error ?? configQuery.error;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        view={view}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={navigate}
      />

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-7 lg:px-9">
          <div className="flex items-center gap-4">
            <button aria-label="Abrir menu" className="text-muted-foreground lg:hidden" onClick={() => setMenuOpen(true)}>
              <Menu className="size-5" />
            </button>
            <BrandIcon className="lg:hidden" size={30} />
            <div>
              <h1 className="text-[13px] uppercase tracking-[0.16em]">{pageTitles[view][0]}</h1>
              <p className="mt-1 hidden text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:block">
                {pageTitles[view][1]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button aria-label="Varrer saves" variant="ghost" size="sm" onClick={refresh} disabled={savesQuery.isFetching}>
              <RefreshCw className={cn("size-3.5", savesQuery.isFetching && "animate-spin")} />
              <span className="hidden sm:inline">Varrer saves</span>
            </Button>
            <div className="hidden h-8 w-px bg-border sm:block" />
            <div className="hidden text-right sm:block">
              <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Project Zomboid</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-success">● Guard disponível</div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-7 lg:p-9">
          {notice && (
            <div
              role="status"
              className={cn(
                "mb-5 flex items-center justify-between border px-4 py-3 text-[11px]",
                notice.tone === "success"
                  ? "border-success/35 bg-success/5 text-success"
                  : "border-danger/35 bg-danger/5 text-danger",
              )}
            >
              <span>{notice.tone === "success" ? "●" : "×"} {notice.message}</span>
              <button onClick={() => setNotice(null)} aria-label="Fechar aviso"><X className="size-3.5" /></button>
            </div>
          )}

          {fatalError ? (
            <Card className="border-danger/40">
              <CardContent className="py-16 text-center">
                <p className="text-danger">× FALHA NA LEITURA</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {fatalError instanceof Error ? fatalError.message : "Não foi possível carregar os dados."}
                </p>
              </CardContent>
            </Card>
          ) : savesQuery.isLoading || configQuery.isLoading ? (
            <LoadingScreen />
          ) : view === "settings" && configQuery.data ? (
            <div>
              <SectionLabel code="04">Configuração do nó local</SectionLabel>
              <div className="mt-5">
                <SettingsPanel key={JSON.stringify(configQuery.data)} initialConfig={configQuery.data} />
              </div>
            </div>
          ) : saves.length === 0 ? (
            <EmptySaves onSettings={() => navigate("settings")} />
          ) : view === "saves" ? (
            <div>
              <SectionLabel code="02">Registro de partidas</SectionLabel>
              <div className="mt-5">
                <SaveSelector saves={saves} selectedId={selectedSave?.id} onSelect={setSelectedSaveId} />
              </div>
            </div>
          ) : view === "backups" ? (
            <div>
              <div className="mb-5 flex items-center justify-between gap-4">
                <SectionLabel code="03">Backup history · {selectedSave?.name}</SectionLabel>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Save className="size-3.5" /> Novo backup
                </Button>
              </div>
              {backupsQuery.isLoading ? <LoadingScreen /> : <BackupList backups={backups} />}
            </div>
          ) : (view === "characters" || view === "recovery") && selectedSave && configQuery.data ? (
            <RecoveryPanel
              key={`${selectedSave.id}:${view}`}
              save={selectedSave}
              config={configQuery.data}
              historyOnly={view === "recovery"}
              onNotice={setNotice}
            />
          ) : selectedSave ? (
            <div className="space-y-7">
              <SectionLabel code="01">Current save control</SectionLabel>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
                <CurrentSavePanel
                  save={selectedSave}
                  backups={backups}
                  onCreateBackup={() => setDialogOpen(true)}
                />
                <SystemReadout savesCount={saves.length} backupsCount={backups.length} />
              </div>

              <div>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <SectionLabel code="02">Sobreviventes neste save</SectionLabel>
                  <button onClick={() => navigate("characters")} className="text-[10px] uppercase tracking-[0.12em] text-primary hover:underline">
                    Abrir personagens
                  </button>
                </div>
                {charactersQuery.isLoading ? (
                  <Card>
                    <CardContent className="flex min-h-40 items-center justify-center gap-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      <RefreshCw className="size-4 animate-spin text-primary" /> Lendo players.db...
                    </CardContent>
                  </Card>
                ) : charactersQuery.data?.characters.length ? (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {charactersQuery.data.characters.map((character) => (
                      <CharacterProfileCard
                        key={character.id}
                        character={character}
                        action={
                          character.dead ? (
                            <Button variant="danger" onClick={() => navigate("characters")}>
                              <Skull className="size-4" /> Abrir recovery
                            </Button>
                          ) : undefined
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-10 text-center text-[11px] text-muted-foreground">
                      {charactersQuery.error instanceof Error
                        ? charactersQuery.error.message
                        : "Nenhum personagem encontrado neste save."}
                    </CardContent>
                  </Card>
                )}
              </div>

              <div>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <SectionLabel code="03">Saves disponíveis</SectionLabel>
                  <button onClick={() => navigate("saves")} className="text-[10px] uppercase tracking-[0.12em] text-primary hover:underline">
                    Ver todos [{saves.length}]
                  </button>
                </div>
                <SaveSelector saves={saves.slice(0, 3)} selectedId={selectedSave.id} onSelect={setSelectedSaveId} />
              </div>

              <div>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <SectionLabel code="04">Backups recentes</SectionLabel>
                  <button onClick={() => navigate("backups")} className="text-[10px] uppercase tracking-[0.12em] text-primary hover:underline">
                    Abrir histórico
                  </button>
                </div>
                <BackupList backups={backups.slice(0, 3)} />
              </div>
            </div>
          ) : null}
        </main>

        <footer className="mx-4 flex flex-col gap-2 border-t border-border py-5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:mx-7 sm:flex-row sm:justify-between lg:mx-9">
          <span>ZSM · Local filesystem only</span>
          <DeveloperCredit />
        </footer>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogTitle>Criar backup manual</DialogTitle>
          <DialogDescription>
            O save será copiado para uma área temporária, validado e somente então registrado no histórico.
          </DialogDescription>
          <form onSubmit={submitBackup} className="mt-7 space-y-6">
            <div className="border border-border bg-background p-4">
              <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Origem selecionada</p>
              <p className="mt-2 text-sm uppercase tracking-[0.08em]">{selectedSave?.name}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{selectedSave?.gameMode} · {selectedSave && formatBytes(selectedSave.size)}</p>
            </div>
            <label className="block">
              <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Identificação opcional</span>
              <input
                autoFocus
                maxLength={80}
                value={backupLabel}
                onChange={(event) => setBackupLabel(event.target.value)}
                placeholder="Ex.: BASE PRONTA — DIA 27"
                className="h-12 w-full border border-border bg-background px-4 text-xs uppercase outline-none placeholder:text-muted-foreground/45 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={backupMutation.isPending || !selectedSave}>
                {backupMutation.isPending ? <RefreshCw className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {backupMutation.isPending ? "Validando cópia..." : "Criar backup"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
