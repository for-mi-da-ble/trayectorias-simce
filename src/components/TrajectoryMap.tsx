import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  Copy,
  ExternalLink,
  FileText,
  GitBranch,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  formatTrajectoryClipboard,
  shortOaExcerpt,
  type CourseOaItem,
  type SimceMilestone,
  type StandardIndicator,
  type SubjectGroup,
  type TrajectoriesDataset,
} from "../types";

interface TrajectoryMapProps {
  dataset: TrajectoriesDataset;
  subject: SubjectGroup;
  onSelectSubject: (s: SubjectGroup) => void;
  milestoneId: string;
  onSelectMilestone: (docId: string) => void;
  onCopyText: (text: string, label: string) => void;
  onJumpToThread: (threadId: string) => void;
}

type Selection =
  | { kind: "std"; code: string }
  | { kind: "oa"; id: string }
  | null;

type ScopeMode = "immediate" | "full";

function levelAccent(nivelMinimo: string): string {
  if (nivelMinimo.includes("Expectativa")) return "#4338ca";
  if (nivelMinimo === "Adecuado") return "#0e6f67";
  return "#c2610c";
}

function relationLabelForMilestone(curso: string, milestone: SimceMilestone, oaVinculo: string): string {
  if (curso === milestone.cursoEvaluado) return "Directo";
  if (milestone.immediateCourses.includes(curso)) return "Progresión a Directo";
  if (oaVinculo === "Indirecto") return "Indirecto";
  return "Base previa del ciclo";
}

function relationBadgeClass(rel: string): string {
  if (rel === "Directo") return "badge badge-ok";
  if (rel === "Progresión a Directo") return "badge badge-navy";
  return "badge badge-adv";
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  // Append ellipsis if truncated
  const joined = lines.join(" ");
  if (joined.length < text.length && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] =
      last.length > maxCharsPerLine - 1 ? last.slice(0, maxCharsPerLine - 2) + "…" : last + "…";
  }
  return lines;
}

export default function TrajectoryMap({
  dataset,
  subject,
  onSelectSubject,
  milestoneId,
  onSelectMilestone,
  onCopyText,
  onJumpToThread,
}: TrajectoryMapProps) {
  const [scope, setScope] = useState<ScopeMode>("full");
  const [ejeFilter, setEjeFilter] = useState<string>("");
  const [nivelFilter, setNivelFilter] = useState<string>("");
  const [highlightGaps, setHighlightGaps] = useState<boolean>(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [hovered, setHovered] = useState<Selection>(null);

  const milestonesForSubject = useMemo(
    () =>
      dataset.milestones
        .filter((m) => m.subjectGroup === subject)
        .sort((a, b) => a.gradeOrder - b.gradeOrder),
    [dataset.milestones, subject],
  );

  const activeMilestone = useMemo(
    () => milestonesForSubject.find((m) => m.docId === milestoneId) || milestonesForSubject[0],
    [milestonesForSubject, milestoneId],
  );

  const threadById = useMemo(() => {
    const m = new Map(dataset.threads.map((t) => [t.id, t]));
    return m;
  }, [dataset.threads]);

  // Reset filters & auto-select first visible standard when milestone changes
  useEffect(() => {
    setEjeFilter("");
    setNivelFilter("");
    if (activeMilestone && activeMilestone.indicadores.length > 0) {
      setSelection({ kind: "std", code: activeMilestone.indicadores[0].code });
    } else {
      setSelection(null);
    }
  }, [activeMilestone?.docId]);

  const ejesAvailable = useMemo(() => {
    if (!activeMilestone) return [];
    const list: string[] = [];
    for (const ind of activeMilestone.indicadores) {
      if (!list.includes(ind.eje)) list.push(ind.eje);
    }
    return list;
  }, [activeMilestone]);

  const visibleIndicators = useMemo(() => {
    if (!activeMilestone) return [];
    return activeMilestone.indicadores.filter((ind) => {
      if (ejeFilter && ind.eje !== ejeFilter) return false;
      if (nivelFilter === "Elemental" && ind.nivelMinimo !== "Elemental") return false;
      if (nivelFilter === "Adecuado" && ind.nivelMinimo !== "Adecuado") return false;
      if (nivelFilter === "Expectativa" && !ind.nivelMinimo.includes("Expectativa")) return false;
      return true;
    });
  }, [activeMilestone, ejeFilter, nivelFilter]);

  // Ensure selection remains valid when filters change
  useEffect(() => {
    if (selection?.kind === "std") {
      const stillVisible = visibleIndicators.some((i) => i.code === selection.code);
      if (!stillVisible) {
        setSelection(visibleIndicators[0] ? { kind: "std", code: visibleIndicators[0].code } : null);
      }
    }
  }, [visibleIndicators, selection]);

  const activeCourses = useMemo(() => {
    if (!activeMilestone) return [];
    if (scope === "immediate") return activeMilestone.immediateCourses;
    return activeMilestone.fullCoverageCourses;
  }, [activeMilestone, scope]);

  // Compute exact graph: course columns + OA nodes + edges (OA -> target SIMCE standard)
  const graph = useMemo(() => {
    if (!activeMilestone) {
      return {
        columns: [] as Array<{ curso: string; relation: string; oas: CourseOaItem[] }>,
        edges: [] as Array<{ oaId: string; stdCode: string; direct: boolean; color: string }>,
        oaById: new Map<string, CourseOaItem>(),
        stdByCode: new Map<string, StandardIndicator>(),
        oaToStds: new Map<string, Set<string>>(),
        stdToOas: new Map<string, Set<string>>(),
      };
    }

    const visibleStdSet = new Set(visibleIndicators.map((i) => i.code));
    const stdByCode = new Map(visibleIndicators.map((i) => [i.code, i]));
    const oaById = new Map<string, CourseOaItem>();
    const oaToStds = new Map<string, Set<string>>();
    const stdToOas = new Map<string, Set<string>>();
    const edges: Array<{ oaId: string; stdCode: string; direct: boolean; color: string }> = [];

    const columns = activeCourses.map((curso) => {
      const allOas = dataset.courseOas[`${curso}|${activeMilestone.subjectGroup}`] || [];
      const connectedOas: CourseOaItem[] = [];

      for (const oa of allOas) {
        const matchedStds: Array<{ code: string; direct: boolean }> = [];
        if (oa.directDocId === activeMilestone.docId) {
          for (const code of oa.directIndicators) {
            if (visibleStdSet.has(code)) matchedStds.push({ code, direct: true });
          }
        } else {
          // Connect via shared longitudinal progression threads
          for (const ind of visibleIndicators) {
            if (ind.threads.some((tid) => oa.threads.includes(tid))) {
              matchedStds.push({ code: ind.code, direct: false });
            }
          }
        }

        if (matchedStds.length > 0) {
          connectedOas.push(oa);
          oaById.set(oa.id, oa);
          const sSet = oaToStds.get(oa.id) || new Set<string>();
          for (const m of matchedStds) {
            sSet.add(m.code);
            const oSet = stdToOas.get(m.code) || new Set<string>();
            oSet.add(oa.id);
            stdToOas.set(m.code, oSet);

            const ind = stdByCode.get(m.code)!;
            const thColor = threadById.get(ind.threads[0])?.color || "#1c3d6e";
            edges.push({
              oaId: oa.id,
              stdCode: m.code,
              direct: m.direct,
              color: thColor,
            });
          }
          oaToStds.set(oa.id, sSet);
        }
      }

      const sampleVinculo = connectedOas[0]?.vinculo || "Indirecto";
      return {
        curso,
        relation: relationLabelForMilestone(curso, activeMilestone, sampleVinculo),
        oas: connectedOas,
      };
    });

    return { columns, edges, oaById, stdByCode, oaToStds, stdToOas };
  }, [activeMilestone, activeCourses, dataset.courseOas, visibleIndicators, threadById]);

  // Active focus (hover overrides locked selection smoothly for instant exploration)
  const activeFocus = hovered || selection;

  const focusSets = useMemo(() => {
    const activeOas = new Set<string>();
    const activeStds = new Set<string>();
    if (!activeFocus) return { activeOas, activeStds, hasFocus: false };

    if (activeFocus.kind === "std") {
      activeStds.add(activeFocus.code);
      const oas = graph.stdToOas.get(activeFocus.code);
      if (oas) for (const id of oas) activeOas.add(id);
    } else {
      activeOas.add(activeFocus.id);
      const stds = graph.oaToStds.get(activeFocus.id);
      if (stds) for (const code of stds) activeStds.add(code);
    }
    return { activeOas, activeStds, hasFocus: true };
  }, [activeFocus, graph]);

  // SVG Layout geometry
  const layout = useMemo(() => {
    const colCount = graph.columns.length;
    const isWide = colCount <= 2;
    const oaW = isWide ? 210 : 158;
    const oaH = 44;
    const oaGap = 8;
    const stdW = 248;
    const stdH = 56;
    const stdGap = 10;
    const colGap = isWide ? 82 : 44;
    const stdGapBefore = isWide ? 115 : 88;
    const padX = 16;
    const topY = 62;

    const oaPos = new Map<string, { x: number; y: number; w: number; h: number; colIdx: number }>();
    const colHeaders: Array<{ x: number; w: number; curso: string; relation: string; count: number }> = [];

    let maxBottom = 260;

    graph.columns.forEach((col, cIdx) => {
      const x = padX + cIdx * (oaW + colGap);
      colHeaders.push({ x, w: oaW, curso: col.curso, relation: col.relation, count: col.oas.length });
      col.oas.forEach((oa, rIdx) => {
        const y = topY + rIdx * (oaH + oaGap);
        oaPos.set(oa.id, { x, y, w: oaW, h: oaH, colIdx: cIdx });
        if (y + oaH + 24 > maxBottom) maxBottom = y + oaH + 24;
      });
    });

    const stdX =
      colCount > 0
        ? padX + (colCount - 1) * (oaW + colGap) + oaW + stdGapBefore
        : padX;
    const stdPos = new Map<string, { x: number; y: number; w: number; h: number }>();

    // Vertically center standards column if shorter than tallest OA column
    const stdTotalH = visibleIndicators.length * (stdH + stdGap) - (visibleIndicators.length > 0 ? stdGap : 0);
    const oaMaxH = maxBottom - topY - 24;
    const stdStartY = stdTotalH < oaMaxH ? topY + Math.round((oaMaxH - stdTotalH) / 2) : topY;

    visibleIndicators.forEach((ind, idx) => {
      const y = stdStartY + idx * (stdH + stdGap);
      stdPos.set(ind.code, { x: stdX, y, w: stdW, h: stdH });
      if (y + stdH + 24 > maxBottom) maxBottom = y + stdH + 24;
    });

    const totalW = stdX + stdW + padX;
    const totalH = Math.max(maxBottom, 340);

    return { oaPos, stdPos, colHeaders, stdX, stdW, totalW, totalH };
  }, [graph.columns, visibleIndicators]);

  // Inspector data for locked selection (or hovered fallback)
  const inspectedStd =
    selection?.kind === "std" ? graph.stdByCode.get(selection.code) || null : null;
  const inspectedOa =
    selection?.kind === "oa" ? graph.oaById.get(selection.id) || null : null;

  const inspectedStdRoute = useMemo(() => {
    if (!inspectedStd) return [];
    const connectedSet = graph.stdToOas.get(inspectedStd.code) || new Set<string>();
    return graph.columns.map((col) => ({
      curso: col.curso,
      relation: col.relation,
      oas: col.oas.filter((o) => connectedSet.has(o.id)),
    }));
  }, [inspectedStd, graph]);

  const inspectedOaTargets = useMemo(() => {
    if (!inspectedOa) return [];
    const codes = Array.from(graph.oaToStds.get(inspectedOa.id) || []);
    return codes
      .map((c) => graph.stdByCode.get(c))
      .filter((x): x is StandardIndicator => Boolean(x));
  }, [inspectedOa, graph]);

  const totalGapsInView = useMemo(() => {
    let g = 0;
    for (const o of graph.oaById.values()) {
      if (!o.covered) g += 1;
    }
    return g;
  }, [graph.oaById]);

  if (!activeMilestone) return null;

  return (
    <section aria-label="Mapa visual de trayectorias hacia cada SIMCE">
      <div className="hero-head">
        <div>
          <h1>Mapa de Trayectorias hacia cada SIMCE</h1>
          <p>
            Explora cómo convergen los <strong>Objetivos de Aprendizaje (OA)</strong> año a año hasta alcanzar cada <strong>Estándar de Aprendizaje SIMCE</strong>. Haz clic en cualquier estándar u OA para iluminar su ruta completa.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href={`https://drive.google.com/file/d/${activeMilestone.driveId}/view`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
          >
            <FileText size={14} /> PDF {activeMilestone.fileName} <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Panel de Controles Superiores */}
      <div className="control-strip no-print">
        <div className="control-row">
          <div>
            <div className="control-label">1. Asignatura</div>
            <div className="segmented" role="tablist" aria-label="Seleccionar asignatura">
              {(["Lectura", "Matemática", "Historia"] as SubjectGroup[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={subject === s}
                  className={`seg-btn ${subject === s ? "active" : ""}`}
                  onClick={() => onSelectSubject(s)}
                >
                  {s === "Historia" ? "Historia, Geografía y Cs. Sociales" : s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="control-label">3. Alcance de la trayectoria</div>
            <div className="segmented">
              <button
                type="button"
                className={`seg-btn ${scope === "full" ? "active" : ""}`}
                onClick={() => setScope("full")}
                title="Muestra todos los cursos incluidos en la cobertura oficial del SIMCE"
              >
                <GitBranch size={13} /> Cobertura completa ({activeMilestone.fullCoverageCourses.length} cursos)
              </button>
              <button
                type="button"
                className={`seg-btn ${scope === "immediate" ? "active" : ""}`}
                onClick={() => setScope("immediate")}
                title="Muestra el tramo inmediato (Progresión a Directo → Directo)"
              >
                <Layers size={13} /> Tramo inmediato ({activeMilestone.immediateCourses.length} cursos)
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="control-label">2. Meta SIMCE objetivo</div>
          <div className="milestone-rail">
            {milestonesForSubject.map((m) => (
              <button
                key={m.docId}
                type="button"
                className={`milestone-pill ${m.docId === activeMilestone.docId ? "active" : ""}`}
                onClick={() => onSelectMilestone(m.docId)}
              >
                <span className="milestone-pill-title">{m.shortLabel}</span>
                <span className="milestone-pill-sub tabular">
                  {m.indicadores.length} est. · Adecuado ≥ {m.cutAdecuado} pts
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Filtros por Eje, Nivel y Brechas */}
        <div className="control-row" style={{ paddingTop: 4, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-500)", marginRight: 2 }}>
              Eje SIMCE:
            </span>
            <button
              type="button"
              className={`chip ${ejeFilter === "" ? "active" : ""}`}
              onClick={() => setEjeFilter("")}
            >
              Todos ({activeMilestone.indicadores.length})
            </button>
            {ejesAvailable.map((eje) => (
              <button
                key={eje}
                type="button"
                className={`chip ${ejeFilter === eje ? "active" : ""}`}
                onClick={() => setEjeFilter(ejeFilter === eje ? "" : eje)}
              >
                {eje}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={nivelFilter}
              onChange={(e) => setNivelFilter(e.target.value)}
              aria-label="Filtrar estándares por nivel mínimo"
              style={{
                padding: "5px 10px",
                borderRadius: 8,
                border: "1px solid var(--border-strong)",
                background: "#fff",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-900)",
              }}
            >
              <option value="">Nivel: Todos</option>
              <option value="Elemental">Exigidos desde Elemental</option>
              <option value="Adecuado">Exigidos desde Adecuado</option>
              <option value="Expectativa">Solo Expectativa Curricular</option>
            </select>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-700)",
                cursor: "pointer",
                padding: "4px 10px",
                borderRadius: 999,
                background: highlightGaps ? "var(--elem-bg)" : "transparent",
                border: `1px solid ${highlightGaps ? "var(--elem-bd)" : "var(--border)"}`,
              }}
            >
              <input
                type="checkbox"
                checked={highlightGaps}
                onChange={(e) => setHighlightGaps(e.target.checked)}
              />
              Resaltar brechas sin material ({totalGapsInView})
            </label>
          </div>
        </div>
      </div>

      {/* Lienzo Principal: Grafo SVG + Inspector */}
      <div className="trajectory-workspace">
        <div className="canvas-card">
          <div className="canvas-toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Compass size={16} style={{ color: "var(--navy-800)" }} />
              <strong style={{ fontSize: 13.5, color: "var(--ink-950)" }}>
                {activeMilestone.titulo}
              </strong>
              <span className="badge badge-neutral tabular">
                {graph.oaById.size} OA → {visibleIndicators.length} estándares
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11.5, color: "var(--ink-500)", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#0e6f67", display: "inline-block" }} />
                OA con material
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", border: "2px solid #c2610c", background: "#fef6e7", display: "inline-block" }} />
                OA sin material
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 16, height: 2, background: "#1c3d6e", display: "inline-block" }} />
                Vínculo directo
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 16, height: 0, borderTop: "2px dashed #64758d", display: "inline-block" }} />
                Progresión previa
              </span>
            </div>
          </div>

          <div className="canvas-scroll">
            <svg
              className="trajectory-svg"
              viewBox={`0 0 ${layout.totalW} ${layout.totalH}`}
              width={layout.totalW}
              height={layout.totalH}
              role="img"
              aria-label={`Grafo de trayectorias de OA hacia ${activeMilestone.shortLabel}`}
            >
              {/* Encabezados de Columnas de Cursos */}
              {layout.colHeaders.map((ch) => (
                <g key={ch.curso} transform={`translate(${ch.x}, 8)`}>
                  <rect
                    x={0}
                    y={0}
                    width={ch.w}
                    height={42}
                    rx={10}
                    fill={ch.relation === "Directo" ? "#e7f6f3" : ch.relation === "Progresión a Directo" ? "#e6effa" : "#eef2ff"}
                    stroke={ch.relation === "Directo" ? "#98d8ce" : ch.relation === "Progresión a Directo" ? "#c8daf4" : "#c5cdfa"}
                  />
                  <text
                    x={12}
                    y={18}
                    fontSize={12.5}
                    fontWeight={800}
                    fill="#0c1b33"
                  >
                    {ch.curso}
                  </text>
                  <text
                    x={ch.w - 10}
                    y={18}
                    textAnchor="end"
                    fontSize={10.5}
                    fontWeight={700}
                    fill="#3a4d68"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {ch.count} OA
                  </text>
                  <text
                    x={12}
                    y={34}
                    fontSize={10}
                    fontWeight={600}
                    fill={ch.relation === "Directo" ? "#0e6f67" : ch.relation === "Progresión a Directo" ? "#1c3d6e" : "#3730a3"}
                  >
                    {ch.relation}
                  </text>
                </g>
              ))}

              {/* Encabezado de la Columna Meta SIMCE */}
              <g transform={`translate(${layout.stdX}, 8)`}>
                <rect x={0} y={0} width={layout.stdW} height={42} rx={10} fill="#0d1f3a" />
                <text x={13} y={18} fontSize={12.5} fontWeight={800} fill="#ffffff">
                  META: {activeMilestone.shortLabel}
                </text>
                <text x={13} y={33} fontSize={10} fill="rgba(255,255,255,0.78)">
                  Elem. {activeMilestone.cutElemental}–{activeMilestone.cutAdecuado - 1} · Adec. ≥ {activeMilestone.cutAdecuado} pts
                </text>
              </g>

              {/* Curvas Bézier (primero las inactivas, luego las activas encima para máxima claridad) */}
              {graph.edges
                .map((edge, idx) => {
                  const p1 = layout.oaPos.get(edge.oaId);
                  const p2 = layout.stdPos.get(edge.stdCode);
                  if (!p1 || !p2) return null;
                  const isHighlighted =
                    focusSets.hasFocus &&
                    focusSets.activeOas.has(edge.oaId) &&
                    focusSets.activeStds.has(edge.stdCode);
                  return { edge, p1, p2, isHighlighted, idx };
                })
                .filter((x): x is NonNullable<typeof x> => Boolean(x))
                .sort((a, b) => Number(a.isHighlighted) - Number(b.isHighlighted))
                .map(({ edge, p1, p2, isHighlighted, idx }) => {
                  const x1 = p1.x + p1.w;
                  const y1 = p1.y + p1.h / 2;
                  const x2 = p2.x;
                  const y2 = p2.y + p2.h / 2;
                  const dx = Math.max(48, (x2 - x1) * 0.48);
                  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
                  const opacity = !focusSets.hasFocus ? 0.17 : isHighlighted ? 0.88 : 0.05;
                  return (
                    <path
                      key={`${edge.oaId}-${edge.stdCode}-${idx}`}
                      d={d}
                      className="traj-edge"
                      stroke={isHighlighted ? edge.color : "#8796ab"}
                      strokeWidth={isHighlighted ? (edge.direct ? 2.6 : 2.1) : 1.1}
                      strokeDasharray={edge.direct ? undefined : "5 4"}
                      opacity={opacity}
                    />
                  );
                })}

              {/* Nodos de OA por curso */}
              {graph.columns.map((col) =>
                col.oas.map((oa) => {
                  const pos = layout.oaPos.get(oa.id);
                  if (!pos) return null;
                  const isSelected = selection?.kind === "oa" && selection.id === oa.id;
                  const isActive = !focusSets.hasFocus || focusSets.activeOas.has(oa.id);
                  const isGapEmphasis = highlightGaps && !oa.covered;
                  const excerpt = shortOaExcerpt(oa.desc, pos.w > 180 ? 28 : 20);

                  return (
                    <g
                      key={oa.id}
                      className="traj-node"
                      transform={`translate(${pos.x}, ${pos.y})`}
                      opacity={isActive ? 1 : 0.24}
                      onMouseEnter={() => setHovered({ kind: "oa", id: oa.id })}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => setSelection({ kind: "oa", id: oa.id })}
                    >
                      <rect
                        x={0}
                        y={0}
                        width={pos.w}
                        height={pos.h}
                        rx={9}
                        fill={
                          isSelected
                            ? "#13294b"
                            : isGapEmphasis
                            ? "#fef6e7"
                            : isActive && focusSets.hasFocus
                            ? "#ffffff"
                            : "#faf9f5"
                        }
                        stroke={
                          isSelected
                            ? "#0d1f3a"
                            : isGapEmphasis
                            ? "#d97706"
                            : isActive && focusSets.hasFocus
                            ? "#1c3d6e"
                            : "#d6d3c9"
                        }
                        strokeWidth={isSelected || (isActive && focusSets.hasFocus) ? 1.8 : 1}
                      />
                      {/* Punto de estado de cobertura Banco Material */}
                      <circle
                        cx={12}
                        cy={15}
                        r={4}
                        fill={oa.covered ? (isSelected ? "#5eead4" : "#0e6f67") : "#fef6e7"}
                        stroke={oa.covered ? "none" : "#c2610c"}
                        strokeWidth={1.6}
                      />
                      <text
                        x={22}
                        y={18.5}
                        fontSize={11.5}
                        fontWeight={800}
                        fontFamily="JetBrains Mono, monospace"
                        fill={isSelected ? "#ffffff" : "#0c1b33"}
                      >
                        {oa.oa}
                      </text>
                      <text
                        x={pos.w - 8}
                        y={18}
                        textAnchor="end"
                        fontSize={9.5}
                        fontWeight={600}
                        fill={isSelected ? "rgba(255,255,255,0.75)" : oa.covered ? "#0e6f67" : "#a6520a"}
                      >
                        {oa.covered ? `${oa.mats} rec.` : "Brecha"}
                      </text>
                      <text
                        x={10}
                        y={34}
                        fontSize={10.2}
                        fill={isSelected ? "rgba(255,255,255,0.85)" : "#52637a"}
                      >
                        {excerpt}
                      </text>
                    </g>
                  );
                }),
              )}

              {/* Nodos Meta: Estándares SIMCE */}
              {visibleIndicators.map((ind) => {
                const pos = layout.stdPos.get(ind.code);
                if (!pos) return null;
                const isSelected = selection?.kind === "std" && selection.code === ind.code;
                const isActive = !focusSets.hasFocus || focusSets.activeStds.has(ind.code);
                const oaCount = graph.stdToOas.get(ind.code)?.size || 0;
                const barColor = levelAccent(ind.nivelMinimo);
                const temaLines = wrapText(ind.tema, 32, 2);

                return (
                  <g
                    key={ind.code}
                    className="traj-node"
                    transform={`translate(${pos.x}, ${pos.y})`}
                    opacity={isActive ? 1 : 0.25}
                    onMouseEnter={() => setHovered({ kind: "std", code: ind.code })}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setSelection({ kind: "std", code: ind.code })}
                  >
                    <rect
                      x={0}
                      y={0}
                      width={pos.w}
                      height={pos.h}
                      rx={10}
                      fill={isSelected ? "#13294b" : "#ffffff"}
                      stroke={isSelected ? "#0d1f3a" : isActive && focusSets.hasFocus ? barColor : "#cdc9be"}
                      strokeWidth={isSelected ? 2.2 : isActive && focusSets.hasFocus ? 1.8 : 1.1}
                    />
                    {/* Barra lateral de nivel mínimo */}
                    <rect
                      x={0}
                      y={0}
                      width={6}
                      height={pos.h}
                      rx={3}
                      fill={barColor}
                    />
                    <text
                      x={14}
                      y={18}
                      fontSize={11.5}
                      fontWeight={800}
                      fontFamily="JetBrains Mono, monospace"
                      fill={isSelected ? "#93c5fd" : "#1c3d6e"}
                    >
                      {ind.code}
                    </text>
                    <text
                      x={pos.w - 10}
                      y={18}
                      textAnchor="end"
                      fontSize={10}
                      fontWeight={700}
                      fontFamily="JetBrains Mono, monospace"
                      fill={isSelected ? "#5eead4" : "#0e6f67"}
                    >
                      {oaCount} OA
                    </text>
                    {temaLines.map((ln, lIdx) => (
                      <text
                        key={lIdx}
                        x={14}
                        y={33 + lIdx * 13}
                        fontSize={10.8}
                        fontWeight={600}
                        fill={isSelected ? "#ffffff" : "#14253f"}
                      >
                        {ln}
                      </text>
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Inspector Lateral Interactivo */}
        <aside className="inspector-card" aria-label="Detalle de trayectoria seleccionada">
          {inspectedStd ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span className="mono badge badge-navy" style={{ fontSize: 12 }}>
                    {inspectedStd.code}
                  </span>
                  <span className="badge badge-neutral">{inspectedStd.eje}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() =>
                    onCopyText(
                      formatTrajectoryClipboard({
                        milestone: activeMilestone,
                        indicator: inspectedStd,
                        routeByCourse: inspectedStdRoute,
                      }),
                      `Trayectoria hacia ${inspectedStd.code} copiada`,
                    )
                  }
                >
                  <Copy size={12} /> Copiar ruta
                </button>
              </div>

              <h2 className="serif" style={{ margin: "10px 0 4px", fontSize: 18, lineHeight: 1.25, color: "var(--ink-950)" }}>
                {inspectedStd.tema}
              </h2>
              <div style={{ fontSize: 12, color: "var(--ink-500)", marginBottom: 10 }}>
                {activeMilestone.titulo} · Nivel mínimo:{" "}
                <strong style={{ color: "var(--ink-900)" }}>{inspectedStd.nivelMinimo}</strong>
              </div>

              {/* Botón para ver la progresión longitudinal completa de esta habilidad */}
              {inspectedStd.threads.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {inspectedStd.threads.map((tid) => {
                    const th = threadById.get(tid);
                    if (!th) return null;
                    return (
                      <button
                        key={tid}
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onJumpToThread(tid)}
                        title="Ver cómo progresa esta habilidad desde 2° Básico hasta 2° Medio"
                      >
                        <Award size={12} /> Ver escalera 2°B→2°M: {th.ejeMacro} <ArrowRight size={11} />
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="inspector-section-title">Desempeño esperado en el SIMCE (3 niveles)</div>
              <div className="tier-stack">
                <div className="tier-box tier-elem">
                  <div className="tier-box-label">Elemental ({activeMilestone.puntajes.elemental})</div>
                  <div>{inspectedStd.elemental || "No exigido como mínimo en Elemental (base previa)."}</div>
                </div>
                <div className="tier-box tier-adec">
                  <div className="tier-box-label">Adecuado ({activeMilestone.puntajes.adecuado})</div>
                  <div>{inspectedStd.adecuado || "Evaluado sobre el puntaje de corte Adecuado."}</div>
                </div>
                <div className="tier-box tier-adv">
                  <div className="tier-box-label">Sobre Adecuado / Expectativa Curricular</div>
                  <div>{inspectedStd.avanzado || "Consolidación autónoma en problemas y textos complejos."}</div>
                </div>
              </div>

              <div className="inspector-section-title">
                Trayectoria de OA hacia este estándar ({graph.stdToOas.get(inspectedStd.code)?.size || 0} OA)
              </div>
              <div className="route-timeline">
                {inspectedStdRoute.map((step) => {
                  if (step.oas.length === 0) return null;
                  return (
                    <div key={step.curso} className="route-step">
                      <span className="route-step-dot" />
                      <div className="route-step-head">
                        <strong style={{ fontSize: 13, color: "var(--ink-950)" }}>{step.curso}</strong>
                        <span className={relationBadgeClass(step.relation)}>{step.relation}</span>
                        <span className="badge badge-neutral tabular">{step.oas.length} OA</span>
                      </div>
                      {step.oas.map((o) => (
                        <div
                          key={o.id}
                          className="route-oa-card"
                          onClick={() => setSelection({ kind: "oa", id: o.id })}
                          title="Clic para explorar a qué otros estándares aporta este OA"
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <strong className="mono" style={{ fontSize: 12, color: "var(--navy-900)" }}>
                              {o.oa}
                            </strong>
                            <span className={`badge ${o.covered ? "badge-ok" : "badge-warn"} tabular`} style={{ fontSize: 10 }}>
                              {o.covered ? (
                                <>
                                  <CheckCircle2 size={10} /> {o.mats} rec.
                                </>
                              ) : (
                                <>
                                  <AlertCircle size={10} /> Brecha
                                </>
                              )}
                            </span>
                          </div>
                          <div style={{ fontSize: 11.8, color: "var(--ink-700)", lineHeight: 1.42 }}>
                            {o.desc.length > 175 ? o.desc.slice(0, 172) + "…" : o.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : inspectedOa ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span className="mono badge badge-navy" style={{ fontSize: 12 }}>
                    {inspectedOa.oa}
                  </span>
                  <span className="badge badge-neutral">{inspectedOa.curso}</span>
                  <span className={`badge ${inspectedOa.covered ? "badge-ok" : "badge-warn"} tabular`}>
                    {inspectedOa.covered ? `${inspectedOa.mats} recursos` : "Sin material"}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() =>
                    onCopyText(
                      `${inspectedOa.oa} (${inspectedOa.curso} · ${inspectedOa.asignatura}): ${inspectedOa.desc}`,
                      `${inspectedOa.oa} copiado`,
                    )
                  }
                >
                  <Copy size={12} /> Copiar OA
                </button>
              </div>

              <h2 className="serif" style={{ margin: "10px 0 6px", fontSize: 17, color: "var(--ink-950)" }}>
                {inspectedOa.curso} · {inspectedOa.eje}
              </h2>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-900)", lineHeight: 1.5 }}>
                {inspectedOa.desc}
              </p>

              {inspectedOa.sugerencia && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "9px 11px",
                    borderRadius: 8,
                    background: "var(--navy-50)",
                    border: "1px solid #d5e3f6",
                    fontSize: 12,
                    color: "var(--ink-900)",
                    display: "flex",
                    gap: 6,
                    alignItems: "flex-start",
                  }}
                >
                  <Sparkles size={13} style={{ flexShrink: 0, marginTop: 2, color: "var(--navy-800)" }} />
                  <span>
                    <strong>Orientación guía:</strong> {inspectedOa.sugerencia}
                  </span>
                </div>
              )}

              <div className="inspector-section-title">
                Estándares de {activeMilestone.shortLabel} que construye ({inspectedOaTargets.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {inspectedOaTargets.map((std) => (
                  <div
                    key={std.code}
                    className="route-oa-card"
                    onClick={() => setSelection({ kind: "std", code: std.code })}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span className="mono badge badge-navy">{std.code}</span>
                      <span style={{ fontSize: 11, color: "var(--navy-700)", fontWeight: 600 }}>
                        Ver trayectoria completa →
                      </span>
                    </div>
                    <strong style={{ fontSize: 12.8, color: "var(--ink-950)", display: "block", marginBottom: 4 }}>
                      {std.tema}
                    </strong>
                    <div style={{ fontSize: 11.5, color: "var(--adec-fg)" }}>
                      <strong>Adecuado:</strong> {std.adecuado || std.avanzado}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14 }}>
                <a
                  href={dataset.meta.banco_app_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm"
                  style={{ width: "100%" }}
                >
                  <BookOpen size={13} /> Buscar guías de este OA en Banco de Material <ExternalLink size={11} />
                </a>
              </div>
            </div>
          ) : (
            <div className="inspector-empty">
              <Compass size={32} style={{ opacity: 0.45, marginBottom: 8 }} />
              <div style={{ fontWeight: 700, color: "var(--ink-900)", marginBottom: 4 }}>
                Selecciona un Estándar o un OA
              </div>
              <div style={{ fontSize: 12.5 }}>
                Haz clic en cualquier nodo del mapa para ver cómo se articulan los objetivos de aprendizaje desde los cursos previos hasta el SIMCE.
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
