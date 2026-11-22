export type SubjectGroup = "Lectura" | "Matemática" | "Historia";

export type VinculoType = "Directo" | "Progresión a Directo" | "Indirecto";

export interface StandardIndicator {
  code: string;
  eje: string;
  tema: string;
  elemental: string | null;
  adecuado: string | null;
  avanzado: string | null;
  nivelMinimo: string;
  threads: string[];
}

export interface SimceMilestone {
  docId: string;
  fileName: string;
  driveId: string;
  titulo: string;
  asignatura: string;
  cursoEvaluado: string;
  cobertura: string;
  decreto: string;
  subjectGroup: SubjectGroup;
  shortLabel: string;
  gradeOrder: number;
  cutElemental: number;
  cutAdecuado: number;
  immediateCourses: string[];
  fullCoverageCourses: string[];
  puntajes: {
    adecuado: string;
    elemental: string;
    insuficiente: string;
  };
  resumenNiveles: {
    insuficiente: string;
    elemental: string;
    adecuado: string;
    sobreAdecuado: string;
  };
  indicadores: StandardIndicator[];
}

export interface ProgressionThread {
  id: string;
  subjectGroup: SubjectGroup;
  ejeMacro: string;
  title: string;
  summary: string;
  color: string;
  steps: Record<string, string[]>; // docId -> indicator codes
}

export interface CourseMeta {
  key: string; // "Curso|SubjectGroup"
  ciclo: string;
  curso: string;
  asignatura: string;
  subjectGroup: SubjectGroup;
  docId: string;
  vinculo: VinculoType;
  notaVinculo: string;
}

export interface CourseOaItem {
  id: string; // "Curso|SubjectGroup|OA X"
  curso: string;
  asignatura: string;
  subjectGroup: SubjectGroup;
  oa: string;
  eje: string;
  desc: string;
  units: string[];
  covered: boolean;
  mats: number;
  sugerencia: string;
  directDocId: string;
  vinculo: VinculoType;
  directIndicators: string[];
  threads: string[];
}

export interface TrajectoriesDataset {
  meta: {
    generated_at: string;
    banco_app_url: string;
    sheet_matrix_url: string;
    source_folder_url: string;
    totals: {
      milestones: number;
      indicators: number;
      threads: number;
      courses: number;
      unique_oas: number;
    };
  };
  milestones: SimceMilestone[];
  threads: ProgressionThread[];
  courses: CourseMeta[];
  courseOas: Record<string, CourseOaItem[]>;
}

export function normText(s: string): string {
  return (s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function shortOaExcerpt(desc: string, maxLen = 68): string {
  const clean = desc.replace(/\s+/g, " ").split("•")[0].trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1).trimEnd() + "…";
}

export function formatTrajectoryClipboard(params: {
  milestone: SimceMilestone;
  indicator: StandardIndicator;
  routeByCourse: Array<{ curso: string; relation: string; oas: CourseOaItem[] }>;
}): string {
  const { milestone, indicator, routeByCourse } = params;
  const lines: string[] = [
    `TRAYECTORIA HACIA ESTÁNDAR SIMCE [${indicator.code}] — ${milestone.shortLabel} (${milestone.asignatura})`,
    `Eje: ${indicator.eje} · Tema: ${indicator.tema}`,
    `Cortes SIMCE: Elemental ${milestone.puntajes.elemental} | Adecuado ${milestone.puntajes.adecuado}`,
    "",
    "PROGRESIÓN DEL ESTÁNDAR (3 NIVELES):",
  ];
  if (indicator.elemental) lines.push(`• Elemental: ${indicator.elemental}`);
  if (indicator.adecuado) lines.push(`• Adecuado: ${indicator.adecuado}`);
  if (indicator.avanzado) lines.push(`• Sobre Adecuado / Expectativa Curricular: ${indicator.avanzado}`);
  lines.push("", "TRAYECTORIA DE OBJETIVOS DE APRENDIZAJE (OA) POR CURSO:");
  for (const step of routeByCourse) {
    if (step.oas.length === 0) continue;
    lines.push(`\n▸ ${step.curso} (${step.relation}) — ${step.oas.length} OA:`);
    for (const o of step.oas) {
      lines.push(`  - ${o.oa}: ${o.desc}`);
      if (o.sugerencia) lines.push(`    Foco guía: ${o.sugerencia}`);
    }
  }
  return lines.join("\n");
}
