/**
 * aiVision.ts
 * 
 * Client-side AI Vision cascade. Calls AI APIs directly from the browser,
 * bypassing Vercel serverless function timeout limits entirely.
 * 
 * Fallback order: Gemini → Qwen → Groq (Llama Vision) → OpenAI → null (local scanner)
 */

export interface AIVisionResult {
  studentName: string;
  grade: string;
  answers: Array<{
    questionNumber: number;
    selectedOption: string;
    isDoubleMark: boolean;
    isBlank: boolean;
  }>;
  confidence: number;
  anomalies: string[];
  modelUsed: string;
}

function buildSystemPrompt(totalQuestions: number, optionsPerQuestion: number): string {
  const optionsLetters =
    optionsPerQuestion === 5 ? 'a,b,c,d,e' :
    optionsPerQuestion === 3 ? 'a,b,c' : 'a,b,c,d';

  return `You are an expert OMR (Optical Mark Recognition) and HTR (Handwritten Text Recognition) system for Colombian school exams.
Analyze the provided exam sheet image carefully and:
1. Extract the handwritten student name (campo "Nombre del Estudiante") exactly as written.
2. Extract the student's Grade/Group (campo "Grado"/"Grupo"/"Curso") exactly as written (e.g. "10-1", "11A").
3. Read the filled bubbles for each question from 1 up to ${totalQuestions}.
   For each question (${optionsLetters}):
   - If one bubble is darkened/filled: return its lowercase letter.
   - If multiple are filled: return "MULTIPLE".
   - If none are filled: return "BLANK".
4. Return confidence (0 to 1) and any anomaly notes.
Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
{"studentName":"string","grade":"string","answers":[{"questionNumber":1,"selectedOption":"string","isDoubleMark":false,"isBlank":false}],"confidence":0.95,"anomalies":[]}`;
}

function parseAIResponse(raw: string): AIVisionResult | null {
  try {
    let text = raw.trim();
    // Strip markdown code fences if present
    if (text.startsWith('```')) {
      text = text.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.answers) && parsed.answers.length > 0) {
      return parsed as AIVisionResult;
    }
    return null;
  } catch {
    return null;
  }
}

/** 1. GEMINI (Google) - Primary, fastest */
async function callGemini(base64: string, mimeType: string, prompt: string, totalQuestions: number, optionsPerQuestion: number): Promise<AIVisionResult | null> {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) return null;
  try {
    const optionsLetters = optionsPerQuestion === 5 ? 'a,b,c,d,e' : optionsPerQuestion === 3 ? 'a,b,c' : 'a,b,c,d';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: `${prompt}\n\nTotal questions: ${totalQuestions}. Choices: ${optionsLetters}. Return ONLY valid JSON.` }
          ]}],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );
    const json = await res.json();
    if (json.error) { console.warn('[Gemini] API error:', json.error.message); return null; }
    const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const result = parseAIResponse(raw);
    if (result) { result.modelUsed = 'Gemini 2.0 Flash'; console.log('[Gemini] ✓ Success'); }
    return result;
  } catch (e: any) {
    console.warn('[Gemini] Failed:', e.message);
    return null;
  }
}

/** 2. QWEN (Alibaba) - First fallback */
async function callQwen(base64: string, mimeType: string, prompt: string, totalQuestions: number, optionsPerQuestion: number): Promise<AIVisionResult | null> {
  const key = import.meta.env.VITE_QWEN_API_KEY;
  if (!key) return null;
  try {
    const optionsLetters = optionsPerQuestion === 5 ? 'a,b,c,d,e' : optionsPerQuestion === 3 ? 'a,b,c' : 'a,b,c,d';
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen-vl-plus',
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: `${prompt}\n\nTotal questions: ${totalQuestions}. Choices: ${optionsLetters}. Return ONLY valid JSON.` }
        ]}]
      })
    });
    const json = await res.json();
    if (json.error) { console.warn('[Qwen] API error:', json.error); return null; }
    const raw = json?.choices?.[0]?.message?.content || '';
    const result = parseAIResponse(raw);
    if (result) { result.modelUsed = 'Qwen VL Plus'; console.log('[Qwen] ✓ Success'); }
    return result;
  } catch (e: any) {
    console.warn('[Qwen] Failed:', e.message);
    return null;
  }
}

/** 3. GROQ (Llama Vision) - Second fallback */
async function callGroq(base64: string, mimeType: string, prompt: string, totalQuestions: number, optionsPerQuestion: number): Promise<AIVisionResult | null> {
  const key = import.meta.env.VITE_GROQ_API_KEY;
  if (!key) return null;
  const models = ['llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview', 'meta-llama/llama-4-scout-17b-16e-instruct'];
  const optionsLetters = optionsPerQuestion === 5 ? 'a,b,c,d,e' : optionsPerQuestion === 3 ? 'a,b,c' : 'a,b,c,d';
  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: `${prompt}\n\nTotal questions: ${totalQuestions}. Choices: ${optionsLetters}. Return ONLY valid JSON.` }
          ]}],
          response_format: { type: 'json_object' }
        })
      });
      const json = await res.json();
      if (json.error) { console.warn(`[Groq/${model}] error:`, json.error.message); continue; }
      const raw = json?.choices?.[0]?.message?.content || '';
      const result = parseAIResponse(raw);
      if (result) { result.modelUsed = `Groq (${model})`; console.log(`[Groq/${model}] ✓ Success`); return result; }
    } catch (e: any) {
      console.warn(`[Groq/${model}] Failed:`, e.message);
    }
  }
  return null;
}

/** 4. OPENAI (GPT-4o) - Third fallback */
async function callOpenAI(base64: string, mimeType: string, prompt: string, totalQuestions: number, optionsPerQuestion: number): Promise<AIVisionResult | null> {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  if (!key) return null;
  const optionsLetters = optionsPerQuestion === 5 ? 'a,b,c,d,e' : optionsPerQuestion === 3 ? 'a,b,c' : 'a,b,c,d';
  for (const model of ['gpt-4o-mini', 'gpt-4o']) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: `${prompt}\n\nTotal questions: ${totalQuestions}. Choices: ${optionsLetters}. Return ONLY valid JSON.` }
          ]}],
          response_format: { type: 'json_object' }
        })
      });
      const json = await res.json();
      if (json.error) { console.warn(`[OpenAI/${model}] error:`, json.error.message); continue; }
      const raw = json?.choices?.[0]?.message?.content || '';
      const result = parseAIResponse(raw);
      if (result) { result.modelUsed = `OpenAI (${model})`; console.log(`[OpenAI/${model}] ✓ Success`); return result; }
    } catch (e: any) {
      console.warn(`[OpenAI/${model}] Failed:`, e.message);
    }
  }
  return null;
}

/**
 * Main entry point: tries all AI providers in cascade order.
 * Returns the first successful result, or null if all fail.
 */
export async function analyzeExamWithAI(
  base64: string,
  mimeType: string,
  totalQuestions: number,
  optionsPerQuestion: number
): Promise<AIVisionResult | null> {
  const prompt = buildSystemPrompt(totalQuestions, optionsPerQuestion);
  
  console.log('[AI Cascade] Starting... Gemini → Qwen → Groq → OpenAI');

  // 1. Gemini (primary - fastest)
  const geminiResult = await callGemini(base64, mimeType, prompt, totalQuestions, optionsPerQuestion);
  if (geminiResult) return geminiResult;

  // 2. Qwen (1st fallback)
  console.log('[AI Cascade] Gemini failed, trying Qwen...');
  const qwenResult = await callQwen(base64, mimeType, prompt, totalQuestions, optionsPerQuestion);
  if (qwenResult) return qwenResult;

  // 3. Groq (2nd fallback)
  console.log('[AI Cascade] Qwen failed, trying Groq...');
  const groqResult = await callGroq(base64, mimeType, prompt, totalQuestions, optionsPerQuestion);
  if (groqResult) return groqResult;

  // 4. OpenAI (3rd fallback)
  console.log('[AI Cascade] Groq failed, trying OpenAI...');
  const openaiResult = await callOpenAI(base64, mimeType, prompt, totalQuestions, optionsPerQuestion);
  if (openaiResult) return openaiResult;

  console.warn('[AI Cascade] All AI models failed. Local scanner will be used as last resort.');
  return null;
}
