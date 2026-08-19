"use client";

import { useRef, useState } from "react";
import {
  Activity,
  Check,
  ChevronRight,
  Circle,
  Copy,
  Database,
  Download,
  FileArchive,
  FolderOpen,
  HardDrive,
  HeartPulse,
  HelpCircle,
  History,
  Menu,
  RefreshCw,
  Settings,
  ShieldCheck,
  Skull,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  BrandIcon,
  BrandIdentity,
} from "@/components/branding/brand-identity";
import { DeveloperCredit } from "@/components/branding/developer-credit";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BackupMetadata, Character, RecoveryMode } from "@/lib/types";
import {
  importDirectoryFiles,
  importDirectoryHandle,
  importZipFile,
  type BrowserFileSystemDirectoryHandle,
} from "@/lib/web/import-save";
import {
  downloadPackageBlob,
  generateSavePackage,
  packageFilename,
  selectPackageOutput,
} from "@/lib/web/package-save";
import type {
  BrowserSaveWorkspace,
  WebOperationProgress,
  WebRecoveryHistory,
} from "@/lib/web/types";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import { runSaveWorker } from "@/components/web/worker-client";

type WebView =
  | "overview"
  | "saves"
  | "backups"
  | "characters"
  | "recovery"
  | "settings";

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: "read" | "readwrite";
  }) => Promise<BrowserFileSystemDirectoryHandle>;
}

interface Notice {
  tone: "success" | "danger";
  message: string;
}

const EMPTY_PROGRESS: WebOperationProgress = {
  stage: "idle",
  percent: 0,
  message: "",
};

const mainNavigation = [
  { id: "overview" as const, label: "Dashboard", icon: Activity },
  { id: "saves" as const, label: "Save atual", icon: HardDrive },
  { id: "backups" as const, label: "Backups", icon: History },
  { id: "settings" as const, label: "Ajustes", icon: Settings },
];

const recoveryNavigation = [
  { id: "characters" as const, label: "Personagens", icon: Skull },
  { id: "recovery" as const, label: "Recovery", icon: Database },
];

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function WebSidebar({
  view,
  open,
  onClose,
  onNavigate,
}: {
  view: WebView;
  open: boolean;
  onClose: () => void;
  onNavigate: (view: WebView) => void;
}) {
  const navGroup = (items: typeof mainNavigation | typeof recoveryNavigation) =>
    items.map((item) => {
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
    });

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
          <p className="mb-3 px-3 text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">Sistema · Web</p>
          <div className="space-y-1">{navGroup(mainNavigation)}</div>
          <p className="mb-3 mt-8 px-3 text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">Recovery · Private</p>
          <div className="space-y-1">{navGroup(recoveryNavigation)}</div>
        </nav>
        <div className="border-t border-border p-5">
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <ShieldCheck className="size-4 text-success" />
            <span>
              Processamento privado
              <span className="mt-1 block text-success">● 0 bytes enviados</span>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}

function ConnectSave({
  busy,
  onDirectory,
  onDirectoryFallback,
  onZip,
  onHelp,
}: {
  busy: boolean;
  onDirectory: () => void;
  onDirectoryFallback: () => void;
  onZip: () => void;
  onHelp: () => void;
}) {
  return (
    <Card className="technical-grid min-h-[540px] overflow-hidden">
      <CardContent className="grid min-h-[540px] p-0 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col justify-center border-b border-border p-7 sm:p-10 lg:border-b-0 lg:border-r">
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary">Private browser workspace</p>
          <h2 className="mt-5 max-w-xl text-3xl uppercase leading-[1.25] tracking-[0.12em] sm:text-4xl">
            Conecte seu save
          </h2>
          <p className="mt-6 max-w-xl text-[12px] leading-7 text-muted-foreground">
            Escolha a pasta individual da partida ou importe um ZIP. A leitura, o SQLite e a compactação acontecem neste navegador. Nenhum arquivo é enviado para a Vercel.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <span className="border border-success/30 bg-success/5 px-3 py-2 text-success">● Sem upload</span>
            <span className="border border-border bg-background px-3 py-2">Original intacto</span>
            <span className="border border-border bg-background px-3 py-2">Sessão temporária</span>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-3 bg-panel/80 p-7 sm:p-10">
          <Button size="lg" onClick={onDirectory} disabled={busy}>
            {busy ? <RefreshCw className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}
            Selecionar pasta do save
          </Button>
          <Button size="lg" variant="outline" onClick={onDirectoryFallback} disabled={busy}>
            <HardDrive className="size-4" /> Selecionar pasta — compatibilidade
          </Button>
          <Button size="lg" variant="outline" onClick={onZip} disabled={busy}>
            <FileArchive className="size-4" /> Importar save ZIP
          </Button>
          <button
            className="mt-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-primary"
            onClick={onHelp}
          >
            <HelpCircle className="size-3.5" /> Onde encontro meu save?
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressPanel({ progress }: { progress: WebOperationProgress }) {
  if (progress.stage === "idle") return null;
  return (
    <div className="mb-5 border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.12em]">
        <span className="flex items-center gap-2 text-primary">
          {progress.stage === "complete" ? <Check className="size-4" /> : <RefreshCw className="size-4 animate-spin" />}
          {progress.message}
        </span>
        <span>{progress.percent}%</span>
      </div>
      <div className="mt-3 h-1 bg-border">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  );
}

export function WebDashboard() {
  const [view, setView] = useState<WebView>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [workspace, setWorkspace] = useState<BrowserSaveWorkspace>();
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [recoveries, setRecoveries] = useState<WebRecoveryHistory[]>([]);
  const [progress, setProgress] = useState<WebOperationProgress>(EMPTY_PROGRESS);
  const [notice, setNotice] = useState<Notice>();
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character>();
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode>("full-health");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const titles: Record<WebView, [string, string]> = {
    overview: ["Dashboard", "Workspace privado no navegador"],
    saves: ["Save atual", "Origem conectada nesta sessão"],
    backups: ["Backups", "Pacotes exportados nesta sessão"],
    characters: ["Personagens", "Scanner SQLite local ao navegador"],
    recovery: ["Recovery", "Pacotes de recuperação gerados"],
    settings: ["Ajustes", "Origem e privacidade da sessão"],
  };

  function navigate(nextView: WebView) {
    setView(nextView);
    setMenuOpen(false);
  }

  async function connectWorkspace(candidate: BrowserSaveWorkspace) {
    setBusy(true);
    setNotice(undefined);
    setProgress({ stage: "validating", percent: 25, message: "Validando players.db..." });
    try {
      const scan = await runSaveWorker({
        action: "scan",
        database: toArrayBuffer(candidate.originalPlayersDb.slice()),
        saveId: candidate.id,
      });
      setWorkspace({ ...candidate, characters: scan.characters });
      setBackups([]);
      setRecoveries([]);
      setView("overview");
      setProgress({ stage: "complete", percent: 100, message: "Save conectado com segurança" });
      setNotice({ tone: "success", message: `${candidate.name} está pronto para uso privado.` });
    } catch (error) {
      await candidate.cleanup();
      setProgress(EMPTY_PROGRESS);
      setNotice({
        tone: "danger",
        message: error instanceof Error ? error.message : "Não foi possível importar o save.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function selectDirectory() {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) return directoryInputRef.current?.click();
    try {
      setProgress({ stage: "reading", percent: 10, message: "Lendo pasta selecionada..." });
      const handle = await picker({ id: "zomboid-save", mode: "read" });
      await connectWorkspace(await importDirectoryHandle(handle));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setProgress(EMPTY_PROGRESS);
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "A pasta não pôde ser lida." });
    }
  }

  async function handleDirectoryFiles(files: FileList | null) {
    if (!files?.length) return;
    setProgress({ stage: "reading", percent: 10, message: "Lendo arquivos da pasta..." });
    try {
      await connectWorkspace(await importDirectoryFiles(files));
    } catch (error) {
      setProgress(EMPTY_PROGRESS);
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "A pasta não pôde ser importada." });
    } finally {
      if (directoryInputRef.current) directoryInputRef.current.value = "";
    }
  }

  async function handleZip(file: File | undefined) {
    if (!file) return;
    setProgress({ stage: "reading", percent: 10, message: "Abrindo ZIP local..." });
    try {
      await connectWorkspace(await importZipFile(file));
    } catch (error) {
      setProgress(EMPTY_PROGRESS);
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "O ZIP não pôde ser importado." });
    } finally {
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  }

  async function exportBackup() {
    if (!workspace) return;
    try {
      const filename = packageFilename(workspace.name, "BACKUP");
      const target = await selectPackageOutput(filename);
      setBusy(true);
      const result = await generateSavePackage({
        workspace,
        target,
        mode: "backup",
        onProgress: setProgress,
      });
      if (result.blob) downloadPackageBlob(result.blob, filename);
      setBackups((current) => [
        {
          id: `web-backup-${crypto.randomUUID()}`,
          saveId: workspace.id,
          saveName: workspace.name,
          gameMode: "Imported",
          createdAt: result.manifest.createdAt,
          size: workspace.size,
          fileCount: workspace.entries.length,
          favorite: true,
          type: "manual",
          label: filename,
        },
        ...current,
      ]);
      setProgress({ stage: "complete", percent: 100, message: "Backup exportado" });
      setNotice({ tone: "success", message: "Backup criado sem alterar o save original." });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setProgress(EMPTY_PROGRESS);
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "O backup não pôde ser exportado." });
    } finally {
      setBusy(false);
    }
  }

  async function submitRecovery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !selectedCharacter || !confirmed) return;
    try {
      const filename = packageFilename(workspace.name, "RECOVERED");
      const target = await selectPackageOutput(filename);
      setBusy(true);
      setProgress({ stage: "sqlite", percent: 15, message: "Reviving personagem em memória..." });
      const recovered = await runSaveWorker({
        action: "recover",
        database: toArrayBuffer(workspace.originalPlayersDb.slice()),
        saveId: workspace.id,
        characterId: selectedCharacter.id,
      });
      if (!recovered.database) throw new Error("O banco recuperado não foi retornado.");
      const recoveredBytes = new Uint8Array(recovered.database);
      const result = await generateSavePackage({
        workspace,
        target,
        mode: recoveryMode,
        characterName: selectedCharacter.name,
        recoveredPlayersDb: recoveredBytes,
        onProgress: setProgress,
      });
      if (result.blob) downloadPackageBlob(result.blob, filename);
      setRecoveries((current) => [
        {
          id: `web-recovery-${crypto.randomUUID()}`,
          characterName: selectedCharacter.name,
          mode: recoveryMode,
          createdAt: result.manifest.createdAt,
          packageName: filename,
          originalHash: result.manifest.originalPlayersDbSha256,
          recoveredHash: result.manifest.outputPlayersDbSha256,
        },
        ...current,
      ]);
      setSelectedCharacter(undefined);
      setProgress({ stage: "complete", percent: 100, message: "Pacote recuperado pronto" });
      setNotice({ tone: "success", message: "Pacote gerado. O save original continua intacto." });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setSelectedCharacter(undefined);
      setProgress(EMPTY_PROGRESS);
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "A recuperação falhou." });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await workspace?.cleanup();
    setWorkspace(undefined);
    setBackups([]);
    setRecoveries([]);
    setProgress(EMPTY_PROGRESS);
    setNotice(undefined);
    setView("overview");
  }

  function characterCards() {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workspace?.characters.map((character) => (
          <Card key={character.id} className={cn(character.dead && "border-danger/35")}>
            <CardContent className="p-0">
              <div className="technical-grid flex min-h-40 items-start justify-between p-6">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Subject · {character.source}</p>
                  <h3 className="mt-5 text-lg uppercase tracking-[0.1em]">{character.name}</h3>
                </div>
                {character.dead ? <Skull className="size-5 text-danger" /> : <HeartPulse className="size-5 text-success" />}
              </div>
              <div className="border-t border-border p-5">
                <p className={cn("text-[11px] uppercase", character.dead ? "text-danger" : "text-success")}>
                  {character.dead ? "☠ DECEASED" : "● ALIVE"}
                </p>
                {character.dead && (
                  <Button
                    className="mt-5 w-full"
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      setSelectedCharacter(character);
                      setRecoveryMode("full-health");
                      setConfirmed(false);
                    }}
                  >
                    <HeartPulse className="size-4" /> Criar pacote de recuperação
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  function connectedContent() {
    if (!workspace) return null;
    if (view === "characters") return characterCards();
    if (view === "saves") {
      return (
        <Card>
          <CardContent className="technical-grid p-7">
            <p className="text-[10px] uppercase tracking-[0.18em] text-primary">Save conectado</p>
            <h2 className="mt-4 text-2xl uppercase tracking-[0.12em]">{workspace.name}</h2>
            <div className="mt-7 grid grid-cols-2 gap-px bg-border md:grid-cols-4">
              {[["Origem", workspace.sourceType], ["Tamanho", formatBytes(workspace.size)], ["Arquivos", workspace.entries.length], ["Personagens", workspace.characters.length]].map(([label, value]) => (
                <div key={String(label)} className="bg-panel p-4">
                  <p className="text-[9px] uppercase text-muted-foreground">{label}</p>
                  <p className="mt-2 text-[12px]">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }
    if (view === "backups") {
      return backups.length ? (
        <div className="border border-border bg-panel">
          {backups.map((backup) => (
            <div key={backup.id} className="grid gap-3 border-b border-border p-5 last:border-0 md:grid-cols-[1fr_auto_auto]">
              <span className="truncate text-[11px] uppercase">{backup.label}</span>
              <span className="text-[10px] text-muted-foreground">{formatDate(backup.createdAt)}</span>
              <span className="text-[10px] text-success">ORIGINAL INTACTO</span>
            </div>
          ))}
        </div>
      ) : <Card><CardContent className="py-16 text-center text-[11px] text-muted-foreground">Nenhum backup exportado nesta sessão.</CardContent></Card>;
    }
    if (view === "recovery") {
      return recoveries.length ? (
        <div className="border border-border bg-panel">
          {recoveries.map((recovery) => (
            <div key={recovery.id} className="grid gap-3 border-b border-border p-5 last:border-0 md:grid-cols-[1fr_auto_auto]">
              <span className="text-[11px] uppercase">{recovery.characterName}</span>
              <span className="text-[10px] text-muted-foreground">{recovery.mode.toUpperCase()}</span>
              <span className="text-[10px] text-success">PACOTE PRONTO</span>
            </div>
          ))}
        </div>
      ) : <Card><CardContent className="py-16 text-center text-[11px] text-muted-foreground">Nenhum pacote de recuperação foi gerado.</CardContent></Card>;
    }
    if (view === "settings") {
      return (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader><span className="text-[11px] uppercase tracking-[0.14em]">Origem da sessão</span></CardHeader>
            <CardContent>
              <p className="text-sm uppercase">{workspace.name}</p>
              <p className="mt-3 text-[10px] leading-5 text-muted-foreground">A permissão e os arquivos existem somente nesta aba.</p>
              <Button className="mt-6" variant="danger" onClick={disconnect}><X className="size-4" /> Desconectar save</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><span className="text-[11px] uppercase tracking-[0.14em]">Privacidade</span></CardHeader>
            <CardContent className="space-y-3 text-[10px] leading-5 text-muted-foreground">
              <p>✓ Nenhum upload para servidores</p><p>✓ Nenhum nome salvo no navegador</p><p>✓ Nenhuma conta ou cookie de identificação</p><p>✓ Original aberto somente para leitura</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="technical-grid flex flex-col gap-7 p-7 md:flex-row md:items-end md:justify-between">
              <div><p className="text-[10px] uppercase tracking-[0.18em] text-primary">Private save workspace</p><h2 className="mt-4 text-3xl uppercase tracking-[0.12em]">{workspace.name}</h2><p className="mt-3 text-[11px] text-muted-foreground">{formatBytes(workspace.size)} · {workspace.entries.length} arquivos · {workspace.characters.length} personagens</p></div>
              <div className="flex flex-wrap gap-3"><Button onClick={exportBackup} disabled={busy}><Download className="size-4" /> Criar backup ZIP</Button><Button variant="outline" onClick={selectDirectory} disabled={busy}><FolderOpen className="size-4" /> Selecionar outro</Button></div>
            </div>
          </CardContent>
        </Card>
        <div><div className="mb-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><span className="text-primary">[SUBJECTS]</span><span>Personagens</span><span className="h-px flex-1 bg-border" /></div>{characterCards()}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WebSidebar view={view} open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={navigate} />
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-7 lg:px-9">
          <div className="flex items-center gap-4"><button aria-label="Abrir menu" className="text-muted-foreground lg:hidden" onClick={() => setMenuOpen(true)}><Menu className="size-5" /></button><BrandIcon className="lg:hidden" size={30} /><div><h1 className="text-[13px] uppercase tracking-[0.16em]">{titles[view][0]}</h1><p className="mt-1 hidden text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:block">{titles[view][1]}</p></div></div>
          <div className="flex items-center gap-3"><Button size="sm" variant="ghost" onClick={selectDirectory} disabled={busy}><FolderOpen className="size-3.5" /><span className="hidden sm:inline">{workspace ? "Selecionar outro save" : "Selecionar save"}</span></Button><div className="hidden border-l border-border pl-4 text-right sm:block"><p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Processamento privado</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-success">● Nenhum arquivo enviado</p></div></div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 sm:p-7 lg:p-9">
          {notice && <div role="status" className={cn("mb-5 flex items-center justify-between border px-4 py-3 text-[11px]", notice.tone === "success" ? "border-success/35 bg-success/5 text-success" : "border-danger/35 bg-danger/5 text-danger")}><span>{notice.tone === "success" ? "●" : "×"} {notice.message}</span><button aria-label="Fechar aviso" onClick={() => setNotice(undefined)}><X className="size-3.5" /></button></div>}
          <ProgressPanel progress={progress} />
          {workspace ? connectedContent() : <ConnectSave busy={busy} onDirectory={selectDirectory} onDirectoryFallback={() => directoryInputRef.current?.click()} onZip={() => zipInputRef.current?.click()} onHelp={() => setHelpOpen(true)} />}
        </main>
        <footer className="mx-4 flex flex-col gap-2 border-t border-border py-5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:mx-7 sm:flex-row sm:justify-between lg:mx-9"><span>ZSM · Browser private runtime</span><DeveloperCredit /></footer>
      </div>

      <input ref={directoryInputRef} type="file" multiple className="hidden" onChange={(event) => handleDirectoryFiles(event.target.files)} {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)} />
      <input ref={zipInputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => handleZip(event.target.files?.[0])} />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-2xl"><DialogTitle>Onde encontro meu save?</DialogTitle><DialogDescription>Abra o Explorador de Arquivos e navegue até a pasta de saves do Project Zomboid.</DialogDescription><div className="mt-6 space-y-4"><div className="border border-border bg-background p-4"><p className="text-[9px] uppercase text-muted-foreground">Caminho base no Windows</p><code className="mt-3 block break-all text-[11px] text-primary">C:\Users\SEU_USUÁRIO\Zomboid\Saves</code><Button className="mt-4" size="sm" variant="outline" onClick={() => navigator.clipboard.writeText("C:\\Users\\SEU_USUÁRIO\\Zomboid\\Saves")}><Copy className="size-3.5" /> Copiar caminho</Button></div><div className="text-[11px] leading-6 text-muted-foreground"><p>1. Entre na pasta do modo: Sandbox, Apocalypse, Survivor, Builder ou Multiplayer.</p><p>2. Selecione a pasta individual da partida.</p><p>3. Ela deve conter players.db e map_ver.bin.</p></div><Button className="w-full" onClick={() => { setHelpOpen(false); void selectDirectory(); }}><FolderOpen className="size-4" /> Abrir seletor de pasta</Button></div></DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedCharacter)} onOpenChange={(open) => !open && setSelectedCharacter(undefined)}>
        <DialogContent className="max-w-2xl"><DialogTitle>Gerar recuperação para {selectedCharacter?.name}</DialogTitle><DialogDescription>O banco será copiado para memória e o resultado será salvo em um ZIP novo. O original não será modificado.</DialogDescription><form className="mt-6 space-y-5" onSubmit={submitRecovery}><div className="grid gap-3 sm:grid-cols-2">{([{ value: "full-health", label: "Totalmente saudável", text: "Inclui o Recovery Mod de execução única." }, { value: "revive", label: "Reviver como estava", text: "Altera somente isDead no banco exportado." }] as const).map((option) => <button type="button" key={option.value} onClick={() => setRecoveryMode(option.value)} className={cn("border p-4 text-left", recoveryMode === option.value ? "border-primary/60 bg-primary/5" : "border-border bg-background")}><span className="flex items-center gap-2 text-[11px] uppercase">{recoveryMode === option.value ? <Check className="size-4 text-primary" /> : <Circle className="size-4" />}{option.label}</span><span className="mt-3 block text-[10px] leading-5 text-muted-foreground">{option.text}</span></button>)}</div><label className="flex items-start gap-3 border border-danger/30 bg-danger/5 p-4 text-[11px] leading-5"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 size-4 accent-primary" />Confirmo que desejo gerar uma cópia recuperada. Meu save original permanecerá intacto.</label><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={() => setSelectedCharacter(undefined)}>Cancelar</Button><Button type="submit" variant="danger" disabled={!confirmed || busy}>{busy ? <RefreshCw className="size-4 animate-spin" /> : <Upload className="size-4" />} Gerar pacote ZIP</Button></div></form></DialogContent>
      </Dialog>
    </div>
  );
}
