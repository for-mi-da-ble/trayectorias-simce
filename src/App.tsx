import React, { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Compass,
  ExternalLink,
  GitBranch,
  Rocket,
  Table2,
  TrendingUp,
} from "lucide-react";
import { type SubjectGroup, type TrajectoriesDataset } from "./types";
import TrajectoryMap from "./components/TrajectoryMap";
import ProgressionLadder from "./components/ProgressionLadder";
import LevelJumpSimulator from "./components/LevelJumpSimulator";

type ActiveView = "map" | "ladder" | "jumps";

const DEFAULT_MILESTONE: Record<SubjectGroup, string> = {
  Lectura: "4_Lectura",
  Matemática: "4_Matematica",
  Historia: "8_Historia",
};

export default function App() {
  const [dataset, setDataset] = useState<TrajectoriesDataset | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<ActiveView>("map");
  const [subject, setSubject] = useState<SubjectGroup>("Matemática");
  const [milestoneId, setMilestoneId] = useState<string>("4_Matematica");
  const [threadId, setThreadId] = useState<string>("MAT-NUM");
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch("./data/trayectorias-simce.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: TrajectoriesDataset) => setDataset(data))
      .catch((err) => setError(String(err)));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((cur) => (cur === msg ? "" : cur));
    }, 3000);
  }, []);

  const handleCopyText = useCallback(
    (text: string, label: string) => {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(text).then(() => showToast(label));
      } else {
        showToast(label);
      }
    },
    [showToast],
  );

  const handleSelectSubject = useCallback(
    (next: SubjectGroup) => {
      setSubject(next);
      setMilestoneId(DEFAULT_MILESTONE[next]);
      if (dataset) {
        const firstThread = dataset.threads.find((t) => t.subjectGroup === next);
        if (firstThread) setThreadId(firstThread.id);
      }
    },
    [dataset],
  );

  const handleJumpToThread = useCallback((tid: string) => {
    setThreadId(tid);
    setView("ladder");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleOpenMilestoneMap = useCallback((docId: string) => {
    setMilestoneId(docId);
    setView("map");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (error) {
    return (
      <main className="shell">
        <div className="panel panel-pad">
          <h2>No se pudo cargar el atlas de trayectorias SIMCE</h2>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!dataset) {
    return (
      <main className="shell" style={{ textAlign: "center", paddingTop: 90 }}>
        <div className="serif" style={{ fontSize: 20, fontWeight: 700, color: "var(--ink-950)" }}>
          Cargando Trayectorias SIMCE — Colegio Marina de Chile…
        </div>
        <p style={{ color: "var(--ink-500)", fontSize: 13 }}>
          Preparando 10 hitos SIMCE, 155 estándares y 421 OA en progresión curricular
        </p>
      </main>
    );
  }

  return (
    <div>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">
              <GitBranch size={20} />
            </div>
            <div>
              <div className="brand-title">Trayectorias SIMCE</div>
              <div className="brand-sub">
                Atlas Visual de Estándares y OA · 1° Básico a 2° Medio · Colegio Marina de Chile
              </div>
            </div>
          </div>

          <nav className="nav-tabs" aria-label="Vistas principales">
            <button
              type="button"
              className={`nav-tab ${view === "map" ? "active" : ""}`}
              onClick={() => setView("map")}
            >
              <Compass size={15} /> Mapa de Trayectorias
            </button>
            <button
              type="button"
              className={`nav-tab ${view === "ladder" ? "active" : ""}`}
              onClick={() => setView("ladder")}
            >
              <TrendingUp size={15} /> Escalera 2°B → 2°M
            </button>
            <button
              type="button"
              className={`nav-tab ${view === "jumps" ? "active" : ""}`}
              onClick={() => setView("jumps")}
            >
              <Rocket size={15} /> Subir de Nivel
            </button>
          </nav>

          <div className="topbar-links">
            <a
              href={dataset.meta.banco_app_url}
              target="_blank"
              rel="noopener noreferrer"
              className="topbar-link"
            >
              <BookOpen size={13} /> Banco Docente <ExternalLink size={11} />
            </a>
            <a
              href={dataset.meta.sheet_matrix_url}
              target="_blank"
              rel="noopener noreferrer"
              className="topbar-link"
            >
              <Table2 size={13} /> Matriz Sheets <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </header>

      <main className="shell">
        {view === "map" && (
          <TrajectoryMap
            dataset={dataset}
            subject={subject}
            onSelectSubject={handleSelectSubject}
            milestoneId={milestoneId}
            onSelectMilestone={setMilestoneId}
            onCopyText={handleCopyText}
            onJumpToThread={handleJumpToThread}
          />
        )}

        {view === "ladder" && (
          <ProgressionLadder
            dataset={dataset}
            subject={subject}
            onSelectSubject={handleSelectSubject}
            selectedThreadId={threadId}
            onSelectThread={setThreadId}
            onCopyText={handleCopyText}
            onOpenMilestoneMap={handleOpenMilestoneMap}
          />
        )}

        {view === "jumps" && (
          <LevelJumpSimulator
            dataset={dataset}
            subject={subject}
            onSelectSubject={handleSelectSubject}
            milestoneId={milestoneId}
            onSelectMilestone={setMilestoneId}
            onCopyText={handleCopyText}
          />
        )}
      </main>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
