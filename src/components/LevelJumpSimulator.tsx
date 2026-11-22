import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Rocket,
  Sparkles,
} from "lucide-react";
import {
  type CourseOaItem,
  type SubjectGroup,
  type TrajectoriesDataset,
} from "../types";

interface LevelJumpSimulatorProps {
  dataset: TrajectoriesDataset;
  subject: SubjectGroup;
  onSelectSubject: (s: SubjectGroup) => void;
  milestoneId: string;
  onSelectMilestone: (docId: string) => void;
  onCopyText: (text: string, label: string) => void;
}

type JumpKind = "insuf_to_elem" | "elem_to_adec" | "adec_to_adv";

export default function LevelJumpSimulator({
  dataset,
  subject,
  onSelectSubject,
  milestoneId,
  onSelectMilestone,
  onCopyText,
}: LevelJumpSimulatorProps) {
  const [jump, setJump] = useState<JumpKind>("elem_to_adec");
  const [ejeFilter, setEjeFilter] = useState<string>("");

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

  const ejesAvailable = useMemo(() => {
    if (!activeMilestone) return [];
    const list: string[] = [];
    for (const ind of activeMilestone.indicadores) {
      if (!list.includes(ind.eje)) list.push(ind.eje);
    }
    return list;
  }, [activeMilestone]);

  // Precompute involved OAs across the milestone's full coverage courses for each indicator
  const oasByIndicator = useMemo(() => {
    const map = new Map<string, CourseOaItem[]>();
    if (!activeMilestone) return map;
    for (const ind of activeMilestone.indicadores) {
      const list: CourseOaItem[] = [];
      for (const curso of activeMilestone.fullCoverageCourses) {
        const courseList = dataset.courseOas[`${curso}|${activeMilestone.subjectGroup}`] || [];
        for (const o of courseList) {
          const directHit = o.directDocId === activeMilestone.docId && o.directIndicators.includes(ind.code);
          const threadHit = o.directDocId !== activeMilestone.docId && ind.threads.some((t) => o.threads.includes(t));
          if (directHit || threadHit) list.push(o);
        }
      }
      map.set(ind.code, list);
    }
    return map;
  }, [activeMilestone, dataset.courseOas]);

  const jumpCards = useMemo(() => {
    if (!activeMilestone) return [];
    return activeMilestone.indicadores
      .filter((ind) => {
        if (ejeFilter && ind.eje !== ejeFilter) return false;
        if (jump === "insuf_to_elem") return Boolean(ind.elemental);
        if (jump === "elem_to_adec") return Boolean(ind.adecuado);
        return Boolean(ind.avanzado);
      })
      .map((ind) => {
        let fromLabel = "";
        let fromText = "";
        let toLabel = "";
        let toText = "";
        let fromClass = "tier-insuf";
        let toClass = "tier-elem";

        if (jump === "insuf_to_elem") {
          fromLabel = `Punto de partida · Insuficiente (${activeMilestone.puntajes.insuficiente})`;
          fromText = activeMilestone.resumenNiveles.insuficiente;
          toLabel = `Meta del salto · Elemental (${activeMilestone.puntajes.elemental})`;
          toText = ind.elemental || "";
          fromClass = "tier-insuf";
          toClass = "tier-elem";
        } else if (jump === "elem_to_adec") {
          fromLabel = `Punto de partida · Elemental (${activeMilestone.puntajes.elemental})`;
          fromText =
            ind.elemental ||
            "No exigido aún como mínimo en Elemental: requiere instalar el aprendizaje base desde cero antes de consolidar Adecuado.";
          toLabel = `Meta del salto · Adecuado (${activeMilestone.puntajes.adecuado})`;
          toText = ind.adecuado || "";
          fromClass = "tier-elem";
          toClass = "tier-adec";
        } else {
          fromLabel = `Punto de partida · Adecuado (${activeMilestone.puntajes.adecuado})`;
          fromText =
            ind.adecuado ||
            "Contenido avanzado de las Bases Curriculares evaluado exclusivamente en Expectativa Curricular (sobre el puntaje de corte Adecuado).";
          toLabel = "Meta del salto · Sobre Adecuado / Expectativa Curricular";
          toText = ind.avanzado || "";
          fromClass = "tier-adec";
          toClass = "tier-adv";
        }

        const oas = oasByIndicator.get(ind.code) || [];
        return { ind, fromLabel, fromText, toLabel, toText, fromClass, toClass, oas };
      });
  }, [activeMilestone, jump, ejeFilter, oasByIndicator]);

  const handleCopyJumpPlan = () => {
    if (!activeMilestone) return;
    const jumpTitle =
      jump === "insuf_to_elem"
        ? "PLAN DE NIVELACIÓN: INSUFICIENTE → ELEMENTAL"
        : jump === "elem_to_adec"
        ? "PLAN DE CONSOLIDACIÓN: ELEMENTAL → ADECUADO"
        : "PLAN DE DESAFÍO: ADECUADO → EXPECTATIVA CURRICULAR";

    const lines: string[] = [
      `${jumpTitle} — ${activeMilestone.titulo}`,
      ejeFilter ? `Eje filtrado: ${ejeFilter}` : "Todos los ejes",
      "",
    ];
    for (const c of jumpCards) {
      lines.push(`• [${c.ind.code}] ${c.ind.eje} — ${c.ind.tema}`);
      lines.push(`  Desde: ${c.fromText}`);
      lines.push(`  Hacia: ${c.toText}`);
      lines.push(
        `  OA clave del ciclo: ${c.oas.map((o) => `${o.curso} ${o.oa}`).join(" · ")}`,
      );
      lines.push("");
    }
    onCopyText(lines.join("\n"), `Plan "${jumpTitle}" copiado`);
  };

  if (!activeMilestone) return null;

  return (
    <section aria-label="Simulador de salto entre niveles de desempeño SIMCE">
      <div className="hero-head">
        <div>
          <h1>Ruta para Subir de Nivel SIMCE</h1>
          <p>
            Identifica exactamente qué salto cognitivo separa a los estudiantes entre <strong>Insuficiente → Elemental → Adecuado → Expectativa Curricular</strong> y qué OA del ciclo debes reforzar en guías y nivelación.
          </p>
        </div>
        <button type="button" className="btn btn-primary no-print" onClick={handleCopyJumpPlan}>
          <Copy size={14} /> Copiar Plan de Salto ({jumpCards.length} indicadores)
        </button>
      </div>

      {/* Controles de Asignatura y SIMCE */}
      <div className="control-strip no-print">
        <div className="control-row">
          <div>
            <div className="control-label">1. Asignatura</div>
            <div className="segmented">
              {(["Lectura", "Matemática", "Historia"] as SubjectGroup[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`seg-btn ${subject === s ? "active" : ""}`}
                  onClick={() => {
                    onSelectSubject(s);
                    setEjeFilter("");
                  }}
                >
                  {s === "Historia" ? "Historia, Geografía y Cs. Sociales" : s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-500)" }}>Eje:</span>
            <button
              type="button"
              className={`chip ${ejeFilter === "" ? "active" : ""}`}
              onClick={() => setEjeFilter("")}
            >
              Todos
            </button>
            {ejesAvailable.map((e) => (
              <button
                key={e}
                type="button"
                className={`chip ${ejeFilter === e ? "active" : ""}`}
                onClick={() => setEjeFilter(ejeFilter === e ? "" : e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="control-label">2. Hito SIMCE</div>
          <div className="milestone-rail">
            {milestonesForSubject.map((m) => (
              <button
                key={m.docId}
                type="button"
                className={`milestone-pill ${m.docId === activeMilestone.docId ? "active" : ""}`}
                onClick={() => {
                  onSelectMilestone(m.docId);
                  setEjeFilter("");
                }}
              >
                <span className="milestone-pill-title">{m.shortLabel}</span>
                <span className="milestone-pill-sub tabular">
                  Elem. {m.cutElemental} · Adec. {m.cutAdecuado}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selector visual de los 3 Saltos */}
      <div className="jump-selector-grid no-print">
        <button
          type="button"
          className={`jump-card-btn ${jump === "insuf_to_elem" ? "active" : ""}`}
          style={{
            borderColor: jump === "insuf_to_elem" ? "var(--elem-fg)" : undefined,
            background: jump === "insuf_to_elem" ? "var(--elem-bg)" : undefined,
          }}
          onClick={() => setJump("insuf_to_elem")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span className="badge badge-err">Insuficiente</span>
            <ArrowRight size={13} />
            <span className="badge badge-warn">Elemental</span>
          </div>
          <strong style={{ fontSize: 14, color: "var(--ink-950)", display: "block" }}>
            Salto 1 · Nivelación y piso mínimo
          </strong>
          <span style={{ fontSize: 12, color: "var(--ink-700)" }}>
            Qué habilidades básicas instalar con andamiaje para superar {activeMilestone.cutElemental} puntos.
          </span>
        </button>

        <button
          type="button"
          className={`jump-card-btn ${jump === "elem_to_adec" ? "active" : ""}`}
          style={{
            borderColor: jump === "elem_to_adec" ? "var(--adec-fg)" : undefined,
            background: jump === "elem_to_adec" ? "var(--adec-bg)" : undefined,
          }}
          onClick={() => setJump("elem_to_adec")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span className="badge badge-warn">Elemental</span>
            <ArrowRight size={13} />
            <span className="badge badge-ok">Adecuado</span>
          </div>
          <strong style={{ fontSize: 14, color: "var(--ink-950)", display: "block" }}>
            Salto 2 · Consolidación de meta SIMCE
          </strong>
          <span style={{ fontSize: 12, color: "var(--ink-700)" }}>
            El salto de autonomía, inferencia y selección de datos para alcanzar ≥ {activeMilestone.cutAdecuado} puntos.
          </span>
        </button>

        <button
          type="button"
          className={`jump-card-btn ${jump === "adec_to_adv" ? "active" : ""}`}
          style={{
            borderColor: jump === "adec_to_adv" ? "var(--adv-fg)" : undefined,
            background: jump === "adec_to_adv" ? "var(--adv-bg)" : undefined,
          }}
          onClick={() => setJump("adec_to_adv")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span className="badge badge-ok">Adecuado</span>
            <ArrowRight size={13} />
            <span className="badge badge-adv">Expectativa Curricular</span>
          </div>
          <strong style={{ fontSize: 14, color: "var(--ink-950)", display: "block" }}>
            Salto 3 · Desafío y problemas no rutinarios
          </strong>
          <span style={{ fontSize: 12, color: "var(--ink-700)" }}>
            Contenidos complejos y transferencia para superar significativamente el corte Adecuado.
          </span>
        </button>
      </div>

      {/* Tarjetas Antes -> Después */}
      {jumpCards.length === 0 ? (
        <div className="panel panel-pad" style={{ textAlign: "center", padding: 36, color: "var(--ink-500)" }}>
          <Rocket size={26} style={{ opacity: 0.45, marginBottom: 6 }} />
          <div>
            Este documento SIMCE no define descriptores adicionales separados para este salto en el eje seleccionado. Prueba con otro salto o «Todos los ejes».
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {jumpCards.map((card) => {
            const gaps = card.oas.filter((o) => !o.covered).length;
            return (
              <article key={card.ind.code} className="panel panel-pad">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="mono badge badge-navy">{card.ind.code}</span>
                    <strong style={{ fontSize: 14.5, color: "var(--ink-950)" }}>{card.ind.tema}</strong>
                    <span className="badge badge-neutral">{card.ind.eje}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="badge badge-ok tabular">
                      <CheckCircle2 size={11} /> {card.oas.length - gaps}/{card.oas.length} OA con material
                    </span>
                    {gaps > 0 && (
                      <span className="badge badge-warn tabular">
                        <AlertCircle size={11} /> {gaps} brecha{gaps > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div className="jump-compare-grid">
                  <div className={`tier-box ${card.fromClass}`}>
                    <div className="tier-box-label">{card.fromLabel}</div>
                    <div>{card.fromText}</div>
                  </div>
                  <div className="jump-arrow-col">
                    <ArrowRight size={20} />
                  </div>
                  <div className={`tier-box ${card.toClass}`}>
                    <div className="tier-box-label">{card.toLabel}</div>
                    <div style={{ fontWeight: 500 }}>{card.toText}</div>
                  </div>
                </div>

                {/* OA puente a lo largo del ciclo */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Sparkles size={13} style={{ color: "var(--navy-700)", flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-500)" }}>
                    OA clave para trabajar este salto:
                  </span>
                  {card.oas.map((o) => (
                    <span
                      key={o.id}
                      className={`badge ${o.covered ? "badge-navy" : "badge-warn"}`}
                      title={`${o.curso} · ${o.oa}: ${o.desc}`}
                    >
                      {o.curso} · <span className="mono">{o.oa}</span>
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
