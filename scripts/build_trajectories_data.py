#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera public/data/trayectorias-simce.json a partir del catálogo oficial de
Estándares SIMCE y del Banco de Material Docente (banco-material-docente),
enriquecido con las 23 Líneas de Progresión Longitudinal (1° Básico a 2° Medio)
y las trayectorias multi-curso hacia cada hito SIMCE.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

SRC_BANCO = Path("/home/antigravity/for-mi-da-ble/banco-material-docente/public/data/banco-docente.json")
SRC_STD = Path("/home/antigravity/for-mi-da-ble/banco-material-docente/public/data/estandares-oa.json")
OUT_JSON = Path(__file__).resolve().parent.parent / "public" / "data" / "trayectorias-simce.json"

# Definición de los 10 hitos SIMCE con sus cursos de cobertura oficial y tramo inmediato
MILESTONE_META = {
    "2_Lectura": {
        "subjectGroup": "Lectura",
        "shortLabel": "SIMCE 2° Básico",
        "gradeOrder": 2,
        "cutElemental": 215,
        "cutAdecuado": 265,
        "immediateCourses": ["1° Básico", "2° Básico"],
        "fullCoverageCourses": ["1° Básico", "2° Básico"],
    },
    "4_Lectura": {
        "subjectGroup": "Lectura",
        "shortLabel": "SIMCE 4° Básico",
        "gradeOrder": 4,
        "cutElemental": 241,
        "cutAdecuado": 284,
        "immediateCourses": ["3° Básico", "4° Básico"],
        "fullCoverageCourses": ["1° Básico", "2° Básico", "3° Básico", "4° Básico"],
    },
    "6_Lectura": {
        "subjectGroup": "Lectura",
        "shortLabel": "SIMCE 6° Básico",
        "gradeOrder": 6,
        "cutElemental": 233,
        "cutAdecuado": 279,
        "immediateCourses": ["5° Básico", "6° Básico"],
        "fullCoverageCourses": ["3° Básico", "4° Básico", "5° Básico", "6° Básico"],
    },
    "8_Lectura": {
        "subjectGroup": "Lectura",
        "shortLabel": "SIMCE 8° Básico",
        "gradeOrder": 8,
        "cutElemental": 244,
        "cutAdecuado": 292,
        "immediateCourses": ["7° Básico", "8° Básico"],
        "fullCoverageCourses": ["5° Básico", "6° Básico", "7° Básico", "8° Básico"],
    },
    "II_Lectura": {
        "subjectGroup": "Lectura",
        "shortLabel": "SIMCE 2° Medio",
        "gradeOrder": 10,
        "cutElemental": 250,
        "cutAdecuado": 295,
        "immediateCourses": ["1° Medio", "2° Medio"],
        "fullCoverageCourses": ["7° Básico", "8° Básico", "1° Medio", "2° Medio"],
    },
    "4_Matematica": {
        "subjectGroup": "Matemática",
        "shortLabel": "SIMCE 4° Básico",
        "gradeOrder": 4,
        "cutElemental": 245,
        "cutAdecuado": 295,
        "immediateCourses": ["3° Básico", "4° Básico"],
        "fullCoverageCourses": ["1° Básico", "2° Básico", "3° Básico", "4° Básico"],
    },
    "6_Matematica": {
        "subjectGroup": "Matemática",
        "shortLabel": "SIMCE 6° Básico",
        "gradeOrder": 6,
        "cutElemental": 226,
        "cutAdecuado": 286,
        "immediateCourses": ["5° Básico", "6° Básico"],
        "fullCoverageCourses": ["3° Básico", "4° Básico", "5° Básico", "6° Básico"],
    },
    "8_Matematica": {
        "subjectGroup": "Matemática",
        "shortLabel": "SIMCE 8° Básico",
        "gradeOrder": 8,
        "cutElemental": 247,
        "cutAdecuado": 297,
        "immediateCourses": ["7° Básico", "8° Básico"],
        "fullCoverageCourses": ["5° Básico", "6° Básico", "7° Básico", "8° Básico"],
    },
    "II_Matematica": {
        "subjectGroup": "Matemática",
        "shortLabel": "SIMCE 2° Medio",
        "gradeOrder": 10,
        "cutElemental": 252,
        "cutAdecuado": 319,
        "immediateCourses": ["1° Medio", "2° Medio"],
        "fullCoverageCourses": ["7° Básico", "8° Básico", "1° Medio", "2° Medio"],
    },
    "8_Historia": {
        "subjectGroup": "Historia",
        "shortLabel": "SIMCE 8° Básico",
        "gradeOrder": 8,
        "cutElemental": 243,
        "cutAdecuado": 296,
        "immediateCourses": ["7° Básico", "8° Básico"],
        "fullCoverageCourses": ["5° Básico", "6° Básico", "7° Básico", "8° Básico"],
    },
}

# 23 Líneas de Progresión Longitudinal (conectan indicadores equivalentes entre hitos SIMCE)
PROGRESSION_THREADS = [
    # ---- LECTURA (8 líneas de 2°B a 2°M) ----
    {
        "id": "LEC-LOC",
        "subjectGroup": "Lectura",
        "ejeMacro": "Localizar información",
        "title": "Localización de información explícita y claves textuales",
        "summary": "Evoluciona desde ubicar datos destacados en textos breves (2°B) hasta discriminar información similar en textos complejos sin ayudas gráficas ni títulos (2°M).",
        "color": "#1d5b96",
        "steps": {
            "2_Lectura": ["L2-LOC-01"],
            "4_Lectura": ["L4-LOC-01", "L4-LOC-02", "L4-LOC-03"],
            "6_Lectura": ["L6-LOC-01"],
            "8_Lectura": ["L8-LOC-01", "L8-LOC-02"],
            "II_Lectura": ["L2M-LOC-01"],
        },
    },
    {
        "id": "LEC-TEM",
        "subjectGroup": "Lectura",
        "ejeMacro": "Interpretar y relacionar",
        "title": "Comprensión global: tema, conflicto, propósito y postura",
        "summary": "Progresa desde reconocer de qué trata un texto familiar (2°B) hasta determinar tesis, conflictos y posturas implícitas cuando compiten múltiples ideas (2°M).",
        "color": "#0f766e",
        "steps": {
            "2_Lectura": ["L2-INT-01"],
            "4_Lectura": ["L4-INT-01"],
            "6_Lectura": ["L6-INT-01"],
            "8_Lectura": ["L8-INT-01"],
            "II_Lectura": ["L2M-INT-01"],
        },
    },
    {
        "id": "LEC-INF",
        "subjectGroup": "Lectura",
        "ejeMacro": "Interpretar y relacionar",
        "title": "Inferencias globales, conclusiones y comparación de información",
        "summary": "Avanza de inferencias directas con pistas evidentes (2°B) a conclusiones integrando partes distantes, textos no literarios técnicos y dos o más fuentes (2°M).",
        "color": "#0d9488",
        "steps": {
            "2_Lectura": ["L2-INT-03"],
            "4_Lectura": ["L4-INT-02"],
            "6_Lectura": ["L6-INT-02", "L6-INT-03"],
            "8_Lectura": ["L8-INT-02", "L8-INT-03"],
            "II_Lectura": ["L2M-INT-02"],
        },
    },
    {
        "id": "LEC-SEC",
        "subjectGroup": "Lectura",
        "ejeMacro": "Interpretar y relacionar",
        "title": "Secuencia cronológica y relaciones causa–consecuencia",
        "summary": "Pasa de secuenciar acciones explícitas y reconocer causas directas (2°B) a inferir encadenamientos causales implícitos en sintaxis compleja con distractores (2°M).",
        "color": "#15803d",
        "steps": {
            "2_Lectura": ["L2-INT-02", "L2-INT-04"],
            "4_Lectura": ["L4-INT-03", "L4-INT-04"],
            "6_Lectura": ["L6-INT-04", "L6-INT-05"],
            "8_Lectura": ["L8-INT-04", "L8-INT-05"],
            "II_Lectura": ["L2M-INT-02"],
        },
    },
    {
        "id": "LEC-PER",
        "subjectGroup": "Lectura",
        "ejeMacro": "Interpretar y relacionar",
        "title": "Personajes, motivaciones, estereotipos y problemas humanos",
        "summary": "Transita desde identificar sentimientos comunes en situaciones familiares (2°B) hasta inferir motivaciones, estereotipos y dilemas humanos integrando pistas dispersas (2°M).",
        "color": "#b45309",
        "steps": {
            "2_Lectura": ["L2-INT-05"],
            "4_Lectura": ["L4-INT-05"],
            "6_Lectura": ["L6-INT-06"],
            "8_Lectura": ["L8-INT-06"],
            "II_Lectura": ["L2M-INT-03", "L2M-INT-04"],
        },
    },
    {
        "id": "LEC-VOC",
        "subjectGroup": "Lectura",
        "ejeMacro": "Interpretar y relacionar",
        "title": "Vocabulario contextual, correferencia y lenguaje figurado",
        "summary": "Crece desde deducir palabras por sinónimos y expresiones figuradas frecuentes (4°B) hasta interpretar metáforas poco familiares desde el sentido global del texto (2°M).",
        "color": "#c2410c",
        "steps": {
            "4_Lectura": ["L4-INT-06", "L4-INT-07"],
            "6_Lectura": ["L6-INT-07", "L6-INT-08"],
            "8_Lectura": ["L8-INT-07", "L8-INT-08"],
            "II_Lectura": ["L2M-INT-05"],
        },
    },
    {
        "id": "LEC-REC",
        "subjectGroup": "Lectura",
        "ejeMacro": "Reflexionar",
        "title": "Función y efecto de ilustraciones, recursos gráficos y retóricos",
        "summary": "Evoluciona desde interpretar ilustraciones e íconos familiares (2°B) hasta analizar el propósito de preguntas retóricas, citas, analogías y recursos multimodales (2°M).",
        "color": "#4338ca",
        "steps": {
            "2_Lectura": ["L2-INT-06"],
            "4_Lectura": ["L4-INT-08"],
            "6_Lectura": ["L6-INT-09", "L6-REF-03"],
            "8_Lectura": ["L8-INT-08", "L8-REF-02"],
            "II_Lectura": ["L2M-REF-02"],
        },
    },
    {
        "id": "LEC-REF",
        "subjectGroup": "Lectura",
        "ejeMacro": "Reflexionar",
        "title": "Opinión fundamentada, aplicación y evaluación crítica de argumentos",
        "summary": "Sube desde opinar sobre aspectos relevantes del texto (2°B) hasta contrastar puntos de vista, distinguir hecho/opinión y detectar fallas de argumentación (2°M).",
        "color": "#9f1239",
        "steps": {
            "2_Lectura": ["L2-REF-01"],
            "4_Lectura": ["L4-REF-01", "L4-REF-02"],
            "6_Lectura": ["L6-REF-01", "L6-REF-02", "L6-REF-03"],
            "8_Lectura": ["L8-REF-01", "L8-REF-02", "L8-REF-03"],
            "II_Lectura": ["L2M-REF-01", "L2M-REF-03"],
        },
    },
    # ---- MATEMÁTICA (9 líneas de 4°B a 2°M) ----
    {
        "id": "MAT-NUM",
        "subjectGroup": "Matemática",
        "ejeMacro": "Números",
        "title": "Sistemas numéricos, valor posicional, orden y recta numérica",
        "summary": "Amplía el dominio numérico desde naturales y descomposición aditiva (4°B) hasta decimales/mixtos/factores (6°B), enteros (8°B) y números reales en la recta numérica (2°M).",
        "color": "#1d5b96",
        "steps": {
            "4_Matematica": ["M4-NUM-01", "M4-NUM-02"],
            "6_Matematica": ["M6-NUM-01", "M6-NUM-08"],
            "8_Matematica": ["M8-NUM-01"],
            "II_Matematica": ["M2M-NUM-01"],
        },
    },
    {
        "id": "MAT-OPE",
        "subjectGroup": "Matemática",
        "ejeMacro": "Números",
        "title": "Operatoria aritmética, potencias, raíces y logaritmos",
        "summary": "Progresa desde las cuatro operaciones en naturales (4°B) y combinada con paréntesis (6°B) hacia enteros y potencias/raíces (8°B) hasta raíces enésimas y logaritmos (2°M).",
        "color": "#0369a1",
        "steps": {
            "4_Matematica": ["M4-NUM-03"],
            "6_Matematica": ["M6-NUM-02"],
            "8_Matematica": ["M8-NUM-02", "M8-NUM-05"],
            "II_Matematica": ["M2M-NUM-02", "M2M-NUM-03", "M2M-NUM-04"],
        },
    },
    {
        "id": "MAT-FRA",
        "subjectGroup": "Matemática",
        "ejeMacro": "Números",
        "title": "Fracciones, decimales, razones, porcentajes y cambio porcentual",
        "summary": "Avanza de representar fracciones/decimales (4°B) a operar fracciones/decimales y razones/porcentajes (6°B–8°B) hasta racionales y cambio porcentual compuesto (2°M).",
        "color": "#0f766e",
        "steps": {
            "4_Matematica": ["M4-NUM-04", "M4-NUM-05"],
            "6_Matematica": ["M6-NUM-03", "M6-NUM-04", "M6-NUM-05", "M6-NUM-06", "M6-NUM-07"],
            "8_Matematica": ["M8-NUM-03", "M8-NUM-04"],
            "II_Matematica": ["M2M-NUM-01", "M2M-ALG-07"],
        },
    },
    {
        "id": "MAT-ALG",
        "subjectGroup": "Matemática",
        "ejeMacro": "Álgebra y funciones",
        "title": "Patrones, lenguaje algebraico, productos notables y factorización",
        "summary": "Pasa de extender patrones numéricos (4°B) a traducir lenguaje natural a algebraico (6°B), reducir términos semejantes (8°B) y factorizar / desarrollar productos notables (2°M).",
        "color": "#15803d",
        "steps": {
            "4_Matematica": ["M4-PAT-01"],
            "6_Matematica": ["M6-PAT-03", "M6-PAT-04"],
            "8_Matematica": ["M8-ALG-01"],
            "II_Matematica": ["M2M-ALG-02"],
        },
    },
    {
        "id": "MAT-ECU",
        "subjectGroup": "Matemática",
        "ejeMacro": "Álgebra y funciones",
        "title": "Ecuaciones, inecuaciones, sistemas 2×2 y modelamiento funcional",
        "summary": "Escala desde ecuaciones/inecuaciones de un paso (4°B) y ax+b=c (6°B) a funciones lineales/afines (8°B) hasta sistemas 2×2, función cuadrática e inversa (2°M).",
        "color": "#b45309",
        "steps": {
            "4_Matematica": ["M4-PAT-02"],
            "6_Matematica": ["M6-PAT-01", "M6-PAT-02"],
            "8_Matematica": ["M8-ALG-02", "M8-ALG-03"],
            "II_Matematica": ["M2M-ALG-01", "M2M-ALG-03", "M2M-ALG-04", "M2M-ALG-05", "M2M-ALG-06"],
        },
    },
    {
        "id": "MAT-FIG",
        "subjectGroup": "Matemática",
        "ejeMacro": "Geometría",
        "title": "Figuras 2D/3D, ángulos, Pitágoras, semejanza, Tales y trigonometría",
        "summary": "Evoluciona desde clasificar figuras y ángulos (4°B) y propiedades angulares (6°B) hacia elementos del triángulo y Pitágoras (8°B) hasta semejanza, Tales y trigonometría (2°M).",
        "color": "#c2410c",
        "steps": {
            "4_Matematica": ["M4-GEO-02", "M4-GEO-03", "M4-GEO-06"],
            "6_Matematica": ["M6-GEO-02", "M6-GEO-03", "M6-GEO-04", "M6-GEO-05"],
            "8_Matematica": ["M8-GEO-02", "M8-GEO-04"],
            "II_Matematica": ["M2M-GEO-01", "M2M-GEO-03", "M2M-GEO-05"],
        },
    },
    {
        "id": "MAT-ISO",
        "subjectGroup": "Matemática",
        "ejeMacro": "Geometría",
        "title": "Ubicación espacial, plano cartesiano, isometrías, homotecia y vectores",
        "summary": "Transita desde coordenadas letra-número y simetrías (4°B) a plano cartesiano y teselados (6°B), composición isométrica con vectores (8°B) y homotecia vectorial (2°M).",
        "color": "#4338ca",
        "steps": {
            "4_Matematica": ["M4-GEO-01", "M4-GEO-04", "M4-GEO-05"],
            "6_Matematica": ["M6-GEO-01", "M6-GEO-06"],
            "8_Matematica": ["M8-GEO-01"],
            "II_Matematica": ["M2M-GEO-02"],
        },
    },
    {
        "id": "MAT-MED",
        "subjectGroup": "Matemática",
        "ejeMacro": "Medición y Geometría",
        "title": "Medición, perímetro, área de superficie y volumen de cuerpos",
        "summary": "Crece desde medir longitudes/tiempo y perímetro de rectángulos (4°B) a áreas/volumen de paralelepípedos (6°B), círculo/prismas/cilindros (8°B) y cono/esfera/sectores (2°M).",
        "color": "#7c3aed",
        "steps": {
            "4_Matematica": ["M4-MED-01", "M4-MED-02", "M4-MED-03", "M4-MED-04"],
            "6_Matematica": ["M6-MED-01", "M6-MED-02", "M6-MED-03", "M6-MED-04"],
            "8_Matematica": ["M8-GEO-03", "M8-GEO-05"],
            "II_Matematica": ["M2M-GEO-04"],
        },
    },
    {
        "id": "MAT-DAT",
        "subjectGroup": "Matemática",
        "ejeMacro": "Datos y Probabilidades",
        "title": "Tablas, gráficos, estadística, probabilidad y combinatoria",
        "summary": "Progresa desde tablas/pictogramas/barras (4°B) a gráficos dobles/circulares y ocurrencia (6°B), tendencia central y frecuencias (8°B) hasta nubes de puntos, variables aleatorias y combinatoria (2°M).",
        "color": "#9f1239",
        "steps": {
            "4_Matematica": ["M4-DAT-01"],
            "6_Matematica": ["M6-DAT-01", "M6-DAT-02"],
            "8_Matematica": ["M8-DAT-01", "M8-DAT-02", "M8-DAT-03"],
            "II_Matematica": ["M2M-PRO-01", "M2M-PRO-02", "M2M-PRO-03", "M2M-PRO-04"],
        },
    },
    # ---- HISTORIA (6 líneas de 5°B a 8°B → SIMCE 8°) ----
    {
        "id": "HIS-UTE",
        "subjectGroup": "Historia",
        "ejeMacro": "Ubicación temporal y espacial",
        "title": "Pensamiento temporal, continuidad/cambio y lectura de mapas",
        "summary": "Articula transversalmente de 5° a 8° Básico la secuenciación cronológica (años, décadas, siglos), continuidad/cambio y el uso de mapas temáticos e históricos.",
        "color": "#1d5b96",
        "steps": {"8_Historia": ["H8-UTE-01", "H8-UTE-02", "H8-UTE-03"]},
    },
    {
        "id": "HIS-FUE",
        "subjectGroup": "Historia",
        "ejeMacro": "Análisis de fuentes",
        "title": "Análisis de fuentes escritas, iconográficas y estadísticas",
        "summary": "Desarrolla desde 5° a 8° Básico la extracción, comparación y evaluación crítica de fuentes históricas, tablas de doble entrada y gráficos.",
        "color": "#0f766e",
        "steps": {"8_Historia": ["H8-FUE-01", "H8-FUE-02"]},
    },
    {
        "id": "HIS-CHI",
        "subjectGroup": "Historia",
        "ejeMacro": "Historia de Chile y América",
        "title": "Historia de América y Chile (Precolombino, Colonia, República)",
        "summary": "Integra la trayectoria 5°B (Conquista y Colonia) → 6°B (Independencia y Chile Republicano s. XIX–XX) → 7°B (Civilizaciones americanas) → 8°B (Choque de dos mundos y Colonia).",
        "color": "#b45309",
        "steps": {"8_Historia": ["H8-HCH-01", "H8-HCH-02", "H8-HCH-03"]},
    },
    {
        "id": "HIS-UNI",
        "subjectGroup": "Historia",
        "ejeMacro": "Historia Universal",
        "title": "Historia Universal (Neolítico, Antigüedad, Medievo, Modernidad y Revoluciones)",
        "summary": "Progresa de 7°B (Hominización, Neolítico, Grecia, Roma y Edad Media) a 8°B (Humanismo, Renacimiento, Reforma, Absolutismo, Ilustración y Revolución Francesa).",
        "color": "#c2410c",
        "steps": {"8_Historia": ["H8-HUN-01", "H8-HUN-02", "H8-HUN-03", "H8-HUN-04", "H8-HUN-05"]},
    },
    {
        "id": "HIS-GEO",
        "subjectGroup": "Historia",
        "ejeMacro": "Geografía",
        "title": "Geografía de Chile, América, Europa y dinámicas del geosistema",
        "summary": "Conecta 5°B (grandes zonas y riesgos) → 6°B (regiones y ambientes) → 7°B (Mediterráneo y relación ser humano–medio) → 8°B (regiones, conectividad y desarrollo).",
        "color": "#15803d",
        "steps": {"8_Historia": ["H8-GEO-01", "H8-GEO-02", "H8-GEO-03", "H8-GEO-04"]},
    },
    {
        "id": "HIS-FCI",
        "subjectGroup": "Historia",
        "ejeMacro": "Formación Ciudadana",
        "title": "Democracia, poderes del Estado, Derechos Humanos y economía",
        "summary": "Construye ciudadanía desde 5°B (sujetos de derecho y deberes) → 6°B (Constitución, poderes y DD.HH.) → 7°B (legado clásico) → 8°B (Ilustración, soberanía y mercado).",
        "color": "#9f1239",
        "steps": {"8_Historia": ["H8-FCI-01", "H8-FCI-02", "H8-FCI-03", "H8-FCI-04"]},
    },
]


def oa_num(oa: str) -> int:
    m = re.search(r"\d+", oa)
    return int(m.group(0)) if m else 999


def main() -> None:
    with SRC_BANCO.open("r", encoding="utf-8") as f:
        banco = json.load(f)
    with SRC_STD.open("r", encoding="utf-8") as f:
        std = json.load(f)

    # Index indicator -> threadIds
    ind_to_threads: dict[str, list[str]] = {}
    all_ind_codes: set[str] = set()
    for d in std["docs"]:
        for ind in d["indicadores"]:
            all_ind_codes.add(ind["code"])

    for th in PROGRESSION_THREADS:
        for doc_id, codes in th["steps"].items():
            for c in codes:
                assert c in all_ind_codes, f"Thread {th['id']} references unknown code {c}"
                ind_to_threads.setdefault(c, [])
                if th["id"] not in ind_to_threads[c]:
                    ind_to_threads[c].append(th["id"])

    # Verify every single one of the 155 indicators belongs to at least one progression thread!
    unthreaded = sorted(all_ind_codes - set(ind_to_threads.keys()))
    assert not unthreaded, f"Indicators missing from PROGRESSION_THREADS: {unthreaded}"

    # Build enriched milestones
    milestones = []
    for d in std["docs"]:
        mm = MILESTONE_META[d["docId"]]
        enriched_inds = []
        for ind in d["indicadores"]:
            enriched_inds.append({**ind, "threads": ind_to_threads[ind["code"]]})
        milestones.append(
            {
                **d,
                **mm,
                "indicadores": enriched_inds,
            }
        )

    # Build unique course-level OA catalog with Banco Material coverage + direct indicators + threadIds
    cov_by_course_oa: dict[tuple[str, str, str], dict] = {}
    for row in banco["coverage"]:
        c, a = row["curso"], row["asig"]
        for oa_code, is_cov, mat_cnt in row["oas"]:
            cur = cov_by_course_oa.setdefault((c, a, oa_code), {"covered": False, "mats": 0})
            if is_cov == 1:
                cur["covered"] = True
            cur["mats"] += mat_cnt

    course_oas: dict[str, list[dict]] = {}
    course_meta: list[dict] = []

    for cl in std["courseLinks"]:
        curso = cl["curso"]
        asig = cl["asignatura"]
        doc_id = cl["docId"]
        subj_group = MILESTONE_META[doc_id]["subjectGroup"]
        key = f"{curso}|{subj_group}"

        course_meta.append(
            {
                "key": key,
                "ciclo": cl["ciclo"],
                "curso": curso,
                "asignatura": asig,
                "subjectGroup": subj_group,
                "docId": doc_id,
                "vinculo": cl["vinculo"],
                "notaVinculo": cl["notaVinculo"],
            }
        )

        oa_agg: dict[str, dict] = {}
        for u in cl["unidades"]:
            u_key = f"{curso}|{asig}|{u}"
            cat_entries = banco["oaCatalog"].get(u_key, [])
            u_link = std["unitLinks"].get(u_key, {})
            link_by_oa = {o["oa"]: o for o in u_link.get("oas", [])}

            for e in cat_entries:
                oa_c = e["oa"]
                if oa_c not in link_by_oa:
                    # skip non-SIMCE Escritura/Oral OAs from SIMCE trajectory graph
                    continue
                lnk = link_by_oa[oa_c]
                if oa_c not in oa_agg:
                    cv = cov_by_course_oa.get((curso, asig, oa_c), {"covered": False, "mats": 0})
                    oa_agg[oa_c] = {
                        "id": f"{key}|{oa_c}",
                        "curso": curso,
                        "asignatura": asig,
                        "subjectGroup": subj_group,
                        "oa": oa_c,
                        "eje": e["eje"],
                        "desc": e["desc"],
                        "units": [],
                        "covered": cv["covered"],
                        "mats": cv["mats"],
                        "sugerencia": lnk["sugerencia"],
                        "directDocId": doc_id,
                        "vinculo": cl["vinculo"],
                        "directIndicators": [],
                        "threads": [],
                    }
                if u not in oa_agg[oa_c]["units"]:
                    oa_agg[oa_c]["units"].append(u)
                for code in lnk["indicadores"]:
                    if code not in oa_agg[oa_c]["directIndicators"]:
                        oa_agg[oa_c]["directIndicators"].append(code)
                    for tid in ind_to_threads[code]:
                        if tid not in oa_agg[oa_c]["threads"]:
                            oa_agg[oa_c]["threads"].append(tid)

        course_oas[key] = sorted(oa_agg.values(), key=lambda x: oa_num(x["oa"]))

    payload = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            "banco_app_url": "https://for-mi-da-ble.github.io/banco-material-docente/",
            "sheet_matrix_url": std["meta"]["sheet_matrix_url"],
            "source_folder_url": std["meta"]["source_folder_url"],
            "totals": {
                "milestones": len(milestones),
                "indicators": len(all_ind_codes),
                "threads": len(PROGRESSION_THREADS),
                "courses": len(course_meta),
                "unique_oas": sum(len(v) for v in course_oas.values()),
            },
        },
        "milestones": milestones,
        "threads": PROGRESSION_THREADS,
        "courses": course_meta,
        "courseOas": course_oas,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with OUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    print("SUCCESS!")
    print(f"  Milestones: {len(milestones)} | Indicators: {len(all_ind_codes)} (100% threaded)")
    print(f"  Progression Threads: {len(PROGRESSION_THREADS)}")
    print(f"  Courses: {len(course_meta)} | Unique SIMCE-linked OAs: {payload['meta']['totals']['unique_oas']}")
    print(f"  Output: {OUT_JSON} ({OUT_JSON.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
