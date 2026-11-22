# Trayectorias SIMCE — Atlas Visual de Progresión Curricular

Segunda aplicación web interactiva del Colegio Marina de Chile diseñada para visualizar la **progresión de los Estándares de Aprendizaje SIMCE** (10 documentos oficiales: Lectura 2°B–2°M, Matemática 4°B–2°M e Historia 8°B) y las **trayectorias de Objetivos de Aprendizaje (OA)** desde 1° Básico hasta 2° Medio que conducen a cada evaluación SIMCE.

## Vistas interactivas
1. **Mapa de Trayectorias al SIMCE (Grafo SVG interactivo)**: muestra de izquierda a derecha los cursos que construyen el camino hacia cada hito SIMCE (en modo *Cobertura completa de 4 años* o *Tramo inmediato de 2 años*). Al pasar el cursor o hacer clic en cualquier **Estándar** u **OA**, se ilumina toda su ruta de aprendizaje y se abre el inspector lateral con los 3 niveles de logro, la línea de tiempo paso a paso de OA, las brechas de material del Banco Docente y copia en 1 clic.
2. **Escalera Longitudinal 2°B → 2°M**: organiza los 155 indicadores en **23 Líneas de Progresión** para comparar lado a lado cómo escala la demanda cognitiva desde 2° Básico hasta 2° Medio (con lente por nivel Elemental / Adecuado / Sobre Adecuado y gráfico comparativo de puntajes de corte SIMCE).
3. **Ruta para Subir de Nivel**: compara indicador por indicador el salto entre **Insuficiente → Elemental**, **Elemental → Adecuado** y **Adecuado → Expectativa Curricular**, señalando los OA puente del ciclo y las brechas sin material.

## Desarrollo local
```bash
npm install
npm run dev
npm run build
```
