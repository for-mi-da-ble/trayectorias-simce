import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Compass,
  Copy,
  TrendingUp,
} from "lucide-react";
import {
  type CourseOaItem,
  type SimceMilestone,
  type StandardIndicator,
  type SubjectGroup,
  type TrajectoriesDataset,
} from "../types";

interface ProgressionLadderProps {
  dataset: TrajectoriesDataset;
  subject: SubjectGroup;
  onSelectSubject: (s: SubjectGroup) => void;
  selectedThreadId: string;
  onSelectThread: (id: string) => void;
  onCopyText: (text: string, label: string) => void;
  onOpenMilestoneMap: (docId: string) => void;
}

type LevelLens = "all" | "elemental" | "adecuado" | "avanzado";

export default function ProgressionLadder({
  dataset,
  subject,
  onSelectSubject,
  selectedThreadId,
  onSelectThread,
  onCopyText,
  onOpenMilestoneMap,
}: ProgressionLadderProps) {
  const [lens, setLens] = useState<LevelLens>("adecuado");
  const [expandedOaId, setExpandedOaId] = useState<string | null>(null);

  const threadsForSubject = useMemo(
    () => dataset.threads.filter((t) => t.subjectGroup === subject),
    [dataset.threads, subject],
  );

  const activeThread = useMemo(
    () => threadsForSubject.find((t) => t.id === selectedThreadId) || threadsForSubject[0],
    [threadsForSubject, selectedThreadId],
  );

  useEffect(() => {
    if (activeThread && activeThread.id !== selectedThreadId) {
      onSelectThread(activeThread.id);
    }
    setExpandedOaId(null);
  }, [activeThread, selectedThreadId, onSelectThread]);

  const milestonesForSubject = useMemo(
    () =>
      dataset.milestones
        .filter((m) => m.subjectGroup === subject)
        .sort((a, b) => a.gradeOrder - b.gradeOrder),
    [dataset.milestones, subject],
  );

  const milestoneById = useMemo(
    () => new Map(dataset.milestones.map((m) => [m.docId, m])),
    [dataset.milestones],
  );

  // Build ordered progression steps for activeThread
  const stepsData = useMemo(() => {
    if (!activeThread) return [];
    const docIds = milestonesForSubject
      .map((m) => m.docId)
      .filter((id) => Boolean(activeThread.steps[id]?.length));

    return docIds.map((docId) => {
      const m = milestoneById.get(docId)!;
      const codes = activeThread.steps[docId] || [];
      const inds = codes
        .map((c) => m.indicadores.find((i) => i.code === c))
        .filter((x): x is StandardIndicator => Boolean(x));

      // Gather OAs from the courses directly linked to this milestone doc that map to any of these codes
      const coursesToCheck =
        m.subjectGroup === "Historia" || docId === "4_Matematica"
          ? m.fullCoverageCourses
          : m.immediateCourses;
      const oasByCourse: Array<{ curso: string; oas: CourseOaItem[] }> = [];
      for (const curso of coursesToCheck) {
        const list = (dataset.courseOas[`${curso}|${m.subjectGroup}`] || []).filter((o) =>
          o.directDocId === docId && o.directIndicators.some((c) => codes.includes(c)),
        );
        if (list.length > 0) oasByCourse.push({ curso, oas: list });
      }
      return { milestone: m, indicators: inds, oasByCourse };
    });
  }, [activeThread, milestonesForSubject, milestoneById, dataset.courseOas]);

  const handleCopyLadder = () => {
    if (!activeThread) return;
    const lines: string[] = [
      `ESCALERA LONGITUDINAL DE ESTÁNDARES SIMCE — ${subject.toUpperCase()}`,
      `Línea de progresión: ${activeThread.title} (${activeThread.ejeMacro})`,
      activeThread.summary,
      "",
    ];
    for (const st of stepsData) {
      lines.push(`=== ${st.milestone.shortLabel} (${st.milestone.cobertura}) · Adecuado ${st.milestone.puntajes.adecuado} ===`);
      for (const ind of st.indicators) {
        lines.push(`• [${ind.code}] ${ind.tema}`);
        if (ind.elemental) lines.push(`  - Elemental: ${ind.elemental}`);
        if (ind.adecuado) lines.push(`  - Adecuado: ${ind.adecuado}`);
        if (ind.avanzado) lines.push(`  - Sobre Adecuado: ${ind.avanzado}`);
      }
      for (const grp of st.oasByCourse) {
        lines.push(`  OA en ${grp.curso}: ${grp.oas.map((o) => o.oa).join(", ")}`);
      }
      lines.push("");
    }
    onCopyText(lines.join("\n"), `Escalera longitudinal "${activeThread.title}" copiada`);
  };

  return (
    <section aria-label="Escalera longitudinal de progresión de estándares SIMCE">
      <div className="hero-head">
        <div>
          <h1>Escalera Longitudinal de Estándares</h1>
          <p>
            Observa cómo escala la exigencia cognitiva de una misma habilidad o eje desde <strong>2° Básico hasta 2° Medio</strong>, comparando niveles de logro y los OA que sostienen cada peldaño.
          </p>
        </div>
        {activeThread && (
          <button type="button" className="btn btn-primary no-print" onClick={handleCopyLadder}>
            <Copy size={14} /> Copiar Escalera Completa
          </button>
        )}
      </div>

      {/* Selector de asignatura + Gráfico SVG de Puntajes de Corte */}
      <div className="control-strip">
        <div className="control-row">
          <div>
            <div className="control-label">Asignatura</div>
            <div className="segmented">
              {(["Lectura", "Matemática", "Historia"] as SubjectGroup[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`seg-btn ${subject === s ? "active" : ""}`}
                  onClick={() => onSelectSubject(s)}
                >
                  {s === "Historia" ? "Historia, Geografía y Cs. Sociales" : s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="control-label">Lente de nivel a comparar</div>
            <div className="segmented">
              {(
                [
                  { id: "adecuado", label: "Nivel Adecuado" },
                  { id: "elemental", label: "Nivel Elemental" },
                  { id: "avanzado", label: "Sobre Adecuado" },
                  { id: "all", label: "Los 3 niveles" },
                ] as Array<{ id: LevelLens; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`seg-btn ${lens === opt.id ? "active" : ""}`}
                  onClick={() => setLens(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mini Gráfico SVG de Puntajes de Corte SIMCE */}
        <CutScoreStrip milestones={milestonesForSubject} onOpenMap={onOpenMilestoneMap} />
      </div>

      {/* Layout: Lista de Líneas de Progresión + Escalera de Peldaños */}
      <div className="ladder-layout">
        <aside>
          <div className="control-label" style={{ paddingLeft: 4 }}>
            Líneas de progresión ({threadsForSubject.length})
          </div>
          <div className="thread-list">
            {threadsForSubject.map((th) => (
              <button
                key={th.id}
                type="button"
                className={`thread-item ${activeThread?.id === th.id ? "active" : ""}`}
                style={{
                  borderLeft: `4px solid ${th.color}`,
                }}
                onClick={() => onSelectThread(th.id)}
              >
                <span className="thread-item-eje">{th.ejeMacro}</span>
                <span className="thread-item-title">{th.title}</span>
              </button>
            ))}
          </div>
        </aside>

        {activeThread && (
          <div>
            <div
              className="panel panel-pad"
              style={{
                marginBottom: 14,
                borderLeft: `5px solid ${activeThread.color}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <TrendingUp size={16} style={{ color: activeThread.color }} />
                <span className="badge badge-neutral">{activeThread.ejeMacro}</span>
                <span className="badge badge-navy tabular">{stepsData.length} hitos SIMCE</span>
              </div>
              <h2 className="serif" style={{ margin: "2px 0 4px", fontSize: 20, color: "var(--ink-950)" }}>
                {activeThread.title}
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-700)" }}>
                {activeThread.summary}
              </p>
            </div>

            <div className="ladder-steps-grid">
              {stepsData.map((step, idx) => (
                <article key={step.milestone.docId} className="ladder-step-col">
                  <div className="ladder-step-header">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <span
                        className="mono badge"
                        style={{
                          background: activeThread.color,
                          color: "#ffffff",
                        }}
                      >
                        Peldaño {idx + 1}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm no-print"
                        onClick={() => onOpenMilestoneMap(step.milestone.docId)}
                        title="Abrir el grafo de trayectorias de este SIMCE"
                      >
                        <Compass size={11} /> Mapa <ArrowRight size={10} />
                      </button>
                    </div>
                    <div className="ladder-step-grade" style={{ marginTop: 6 }}>
                      {step.milestone.shortLabel}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: 2 }}>
                      {step.milestone.cobertura} · Adecuado ≥{" "}
                      <strong className="mono">{step.milestone.cutAdecuado}</strong>
                    </div>
                  </div>

                  {/* Indicadores de este peldaño */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    {step.indicators.map((ind) => (
                      <div
                        key={ind.code}
                        style={{
                          padding: "10px",
                          borderRadius: 10,
                          background: "var(--surface-warm)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                          <span className="mono badge badge-navy" style={{ fontSize: 10.5 }}>
                            {ind.code}
                          </span>
                          <strong style={{ fontSize: 12.2, color: "var(--ink-950)", lineHeight: 1.3 }}>
                            {ind.tema}
                          </strong>
                        </div>

                        <div className="tier-stack">
                          {(lens === "all" || lens === "elemental") && (
                            <div className="tier-box tier-elem">
                              <div className="tier-box-label">Elemental</div>
                              <div>{ind.elemental || "No exigido como mínimo en Elemental."}</div>
                            </div>
                          )}
                          {(lens === "all" || lens === "adecuado") && (
                            <div className="tier-box tier-adec">
                              <div className="tier-box-label">Adecuado</div>
                              <div>{ind.adecuado || "Evaluado sobre corte Adecuado (ver Expectativa Curricular)."}</div>
                            </div>
                          )}
                          {(lens === "all" || lens === "avanzado") && (
                            <div className="tier-box tier-adv">
                              <div className="tier-box-label">Sobre Adecuado</div>
                              <div>{ind.avanzado || "Consolidación autónoma en situaciones complejas o no rutinarias."}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* OA que sostienen este peldaño */}
                  {step.oasByCourse.length > 0 && (
                    <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                      <div
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "var(--ink-500)",
                          marginBottom: 6,
                        }}
                      >
                        OA que construyen este peldaño (clic para leer):
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {step.oasByCourse.map((grp) => (
                          <div key={grp.curso}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-700)", marginBottom: 4 }}>
                              {grp.curso}:
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {grp.oas.map((o) => {
                                const isOpen = expandedOaId === o.id;
                                return (
                                  <button
                                    key={o.id}
                                    type="button"
                                    className={`badge mono ${isOpen ? "badge-navy" : o.covered ? "badge-ok" : "badge-warn"}`}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => setExpandedOaId(isOpen ? null : o.id)}
                                  >
                                    {o.oa}
                                  </button>
                                );
                              })}
                            </div>
                            {grp.oas.map((o) =>
                              expandedOaId === o.id ? (
                                <div
                                  key={`${o.id}-detail`}
                                  style={{
                                    marginTop: 6,
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    background: "var(--navy-50)",
                                    border: "1px solid #c8daf4",
                                    fontSize: 11.5,
                                    lineHeight: 1.45,
                                  }}
                                >
                                  <div style={{ fontWeight: 700, color: "var(--navy-900)", marginBottom: 2 }}>
                                    {o.curso} · {o.oa} ({o.covered ? `${o.mats} recursos` : "Brecha en banco"})
                                  </div>
                                  <div>{o.desc}</div>
                                </div>
                              ) : null,
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CutScoreStrip({
  milestones,
  onOpenMap,
}: {
  milestones: SimceMilestone[];
  onOpenMap: (docId: string) => void;
}) {
  const minScore = 160;
  const maxScore = 360;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - minScore) / (maxScore - minScore)) * 100));

  return (
    <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <span className="control-label" style={{ margin: 0 }}>
          Umbrales oficiales de puntaje SIMCE por hito (escala 160–360 pts)
        </span>
        <div style={{ display: "flex", gap: 10, fontSize: 11, color: "var(--ink-500)" }}>
          <span><strong style={{ color: "var(--insuf-fg)" }}>■</strong> Insuficiente</span>
          <span><strong style={{ color: "var(--elem-fg)" }}>■</strong> Elemental</span>
          <span><strong style={{ color: "var(--adec-fg)" }}>■</strong> Adecuado</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {milestones.map((m) => {
          const wInsuf = pct(m.cutElemental);
          const wElem = pct(m.cutAdecuado) - wInsuf;
          const wAdec = 100 - pct(m.cutAdecuado);
          return (
            <button
              key={m.docId}
              type="button"
              onClick={() => onOpenMap(m.docId)}
              style={{
                textAlign: "left",
                padding: "9px 11px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-warm)",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              title="Clic para abrir el mapa de trayectorias de este SIMCE"
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                <span>{m.shortLabel}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--adec-fg)" }}>
                  ≥ {m.cutAdecuado}
                </span>
              </div>
              <div style={{ display: "flex", height: 9, borderRadius: 999, overflow: "hidden", background: "#e5e7eb" }}>
                <div style={{ width: `${wInsuf}%`, background: "#e57373" }} />
                <div style={{ width: `${wElem}%`, background: "#eab308" }} />
                <div style={{ width: `${wAdec}%`, background: "#0f766e" }} />
              </div>
              <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-500)", marginTop: 4 }}>
                <span>&lt;{m.cutElemental}</span>
                <span>{m.cutElemental}–{m.cutAdecuado - 1}</span>
                <span>≥{m.cutAdecuado}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
