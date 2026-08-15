# 📖 HISTORIAL.md — ScoreVision Pro

> Documento de referencia técnica para el equipo de desarrollo.
> Generado automáticamente al finalizar la sesión de desarrollo 2026-08-15.

Consulta el historial completo en el archivo adjunto de la sesión Antigravity.

Para ver los cambios directamente en el código:

```bash
git log --oneline
git show <commit-hash>
```

## Commits importantes (más reciente primero)

| Commit | Resumen |
|--------|---------|
| `698ff9d` | ⭐ feat: Motor IA en cascada del lado del cliente (Gemini→Qwen→Groq→OpenAI) — solución definitiva para Vercel |
| `db050cc` | feat: Borrado de registros desde Firebase |
| `661f549` | fix: Promise.any — primer respondedor gana |
| `add0190` | fix: Bug crítico pantalla en blanco (localStorage) y Firebase 1MB |
| `5338ac1` | feat: Timeout race 8.5s para Vercel |
| `867a274` | fix: Strip markdown JSON, modelo qwen-vl-plus |
| `f2e0c4e` | fix: Qwen endpoint internacional (dashscope-intl) |
| `34dae55` | feat: Toggle Modo Híbrido — desactivar IA manualmente |
| `42055ca` | feat: Modo Híbrido OMR local con grilla calibrable |

## Variables de entorno requeridas en Vercel

Ir a: **Vercel → tu proyecto → Settings → Environment Variables**

| Variable | Para qué |
|---|---|
| `VITE_GEMINI_API_KEY` | Google Gemini (IA principal) |
| `VITE_QWEN_API_KEY` | Alibaba Qwen (respaldo 1) |
| `VITE_GROQ_API_KEY` | Groq Llama Vision (respaldo 2) |
| `VITE_OPENAI_API_KEY` | OpenAI GPT-4o (respaldo 3) |

Después de agregar o cambiar cualquier variable → hacer **Redeploy**.

## Archivos clave del proyecto

| Archivo | Rol |
|---------|-----|
| `src/utils/aiVision.ts` | ⭐ Motor de IA en cascada (cliente directo) |
| `src/utils/omrEngine.ts` | Escáner OMR local heurístico (fallback final) |
| `src/utils/db.ts` | Operaciones CRUD Firebase Firestore |
| `src/components/BatchUploader.tsx` | Carga y procesamiento de exámenes |
| `src/components/ExamGrader.tsx` | Tabla de resultados y acciones |
| `src/components/VisualInspectionModal.tsx` | Inspección visual con superposición |
| `server.ts` | Servidor Express (solo para desarrollo local) |
| `api/index.ts` | Entrada Vercel serverless (legacy) |
| `vercel.json` | Configuración Vercel |
