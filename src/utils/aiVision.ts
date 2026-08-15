/**
 * aiVision.ts - Client-side AI Vision cascade with majority vote for consistency.
 * Fallback: Gemini(x3 vote) -> Qwen -> Groq -> OpenAI -> null
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

function buildOMRPrompt(totalQuestions: number, optionsPerQuestion: number, expectedKeys?: Record<number, string>): string {
  const letters = optionsPerQuestion === 5 ? 'a, b, c, d, e'
    : optionsPerQuestion === 3 ? 'a, b, c' : 'a, b, c, d';
  const count = optionsPerQuestion;
  
  let expectedKeysSection = '';
  if (expectedKeys && Object.keys(expectedKeys).length > 0) {
    expectedKeysSection = `
== EXPECTED ANSWERS (CONTEXT FOR VERIFICATION) ==
The following are the expected correct answers for this exam.
Use these ONLY as a strong hint when a mark is ambiguous or faint. 
If the student clearly marked a DIFFERENT bubble, you MUST output what the student marked, NOT the expected answer.
Expected keys: ${JSON.stringify(expectedKeys)}
`;
  }

  return `You are a precise OMR (Optical Mark Recognition) scanner analyzing a Colombian school multiple-choice answer sheet.

== SHEET STRUCTURE ==
- Top section: handwritten student name ("Nombre del Estudiante") and grade/group ("Grado"/"Curso")
- Body: rows numbered 1 to ${totalQuestions}
- Each row has exactly ${count} answer bubbles arranged LEFT-TO-RIGHT labeled: ${letters}
  (leftmost bubble = a, next = b, next = c${count >= 4 ? ', rightmost = d' : ''}${count === 5 ? ', last = e' : ''})
${expectedKeysSection}
== HOW TO READ EACH ROW ==
For question row N:
  - Scan all ${count} bubbles from left to right
  - FILLED bubble = darkened circle, solid square, heavy mark, or clear scribble inside
  - EMPTY bubble = open circle, light ring, no mark inside
  - If EXACTLY ONE is filled -> write its letter (position from left: 1st=a, 2nd=b, 3rd=c, 4th=d)
  - If TWO OR MORE are filled -> "MULTIPLE"
  - If NONE are filled -> "BLANK"

== RULES ==
- Process every row from 1 to ${totalQuestions} in order. Do NOT skip any.
- Answer letter = POSITION from left. Do not rely on labels, count positions.
- Read handwritten names as accurately as possible.

== OUTPUT ==
Return ONLY valid JSON (no markdown, no code fences):
{"studentName":"<name>","grade":"<grade>","answers":[{"questionNumber":1,"selectedOption":"<letter|BLANK|MULTIPLE>","isDoubleMark":false,"isBlank":false}],"confidence":0.9,"anomalies":[]}
The answers array MUST have exactly ${totalQuestions} entries.`;
}

function parseAIResponse(raw: string): AIVisionResult | null {
  try {
    let text = raw.trim();
    if (text.startsWith('` + '`' + '`' + `')) {
      text = text.replace(/^` + '`' + '`' + `(json)?\n?/, '').replace(/\n?` + '`' + '`' + `$/, '');
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.answers) && parsed.answers.length > 0) {
      return parsed as AIVisionResult;
    }
    return null;
  } catch { return null; }
}

function majorityVote(results: AIVisionResult[], totalQuestions: number): AIVisionResult {
  const base = results[0];
  const merged: AIVisionResult['answers'] = [];
  for (let q = 1; q <= totalQuestions; q++) {
    const votes: Record<string, number> = {};
    for (const r of results) {
      const ans = r.answers.find(a => a.questionNumber === q);
      const opt = ans?.selectedOption || 'BLANK';
      votes[opt] = (votes[opt] || 0) + 1;
    }
    const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
    merged.push({ questionNumber: q, selectedOption: winner, isDoubleMark: winner === 'MULTIPLE', isBlank: winner === 'BLANK' });
  }
  return { ...base, answers: merged, modelUsed: base.modelUsed + ' (mayoria 3 lecturas)' };
}

async function callGemini(
  base64: string, mimeType: string, prompt: string, totalQuestions: number, optionsPerQuestion: number
): Promise<AIVisionResult | null> {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) return null;
  const letters = optionsPerQuestion === 5 ? 'a,b,c,d,e' : optionsPerQuestion === 3 ? 'a,b,c' : 'a,b,c,d';
  
  console.log('[Gemini] Making 1 API call (Majority vote removed to avoid 429 limit)...');
  
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: `${prompt}\n\nThe exam has exactly ${totalQuestions} questions with options ${letters}. Return exactly ${totalQuestions} entries. Return ONLY valid JSON.` }
        ]}], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }) }
    );
    const json = await res.json();
    if (json.error) { console.warn('[Gemini] error:', json.error.message); return null; }
    
    const result = parseAIResponse(json?.candidates?.[0]?.content?.parts?.[0]?.text || '');
    if (result) {
      result.modelUsed = 'Gemini 2.0 Flash';
      return result;
    }
    return null;
  } catch (e: any) { console.warn('[Gemini] failed:', e.message); return null; }
}

async function callQwen(base64: string, mimeType: string, prompt: string, totalQuestions: number, optionsPerQuestion: number): Promise<AIVisionResult | null> {
  const key = import.meta.env.VITE_QWEN_API_KEY;
  if (!key) return null;
  const letters = optionsPerQuestion === 5 ? 'a,b,c,d,e' : optionsPerQuestion === 3 ? 'a,b,c' : 'a,b,c,d';
  try {
    const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
      { method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'qwen-vl-plus', messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: `${prompt}\n\nExactly ${totalQuestions} questions, options ${letters}. Return ONLY valid JSON.` }
        ]}] }) });
    const json = await res.json();
    if (json.error) { console.warn('[Qwen] error:', json.error); return null; }
    const result = parseAIResponse(json?.choices?.[0]?.message?.content || '');
    if (result) { result.modelUsed = 'Qwen VL Plus'; console.log('[Qwen] Success'); }
    return result;
  } catch (e: any) { console.warn('[Qwen] Failed:', e.message); return null; }
}

async function callGroq(base64: string, mimeType: string, prompt: string, totalQuestions: number, optionsPerQuestion: number): Promise<AIVisionResult | null> {
  const key = import.meta.env.VITE_GROQ_API_KEY;
  if (!key) return null;
  const models = ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview'];
  const letters = optionsPerQuestion === 5 ? 'a,b,c,d,e' : optionsPerQuestion === 3 ? 'a,b,c' : 'a,b,c,d';
  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions',
        { method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: `${prompt}\n\nExactly ${totalQuestions} questions, options ${letters}. Return ONLY valid JSON.` }
          ]}], response_format: { type: 'json_object' } }) });
      const json = await res.json();
      if (json.error) { console.warn(`[Groq/${model}] error:`, json.error.message); continue; }
      const result = parseAIResponse(json?.choices?.[0]?.message?.content || '');
      if (result) { result.modelUsed = `Groq (${model})`; console.log(`[Groq/${model}] Success`); return result; }
    } catch (e: any) { console.warn(`[Groq/${model}] Failed:`, e.message); }
  }
  return null;
}

async function callOpenAI(base64: string, mimeType: string, prompt: string, totalQuestions: number, optionsPerQuestion: number): Promise<AIVisionResult | null> {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  if (!key) return null;
  const letters = optionsPerQuestion === 5 ? 'a,b,c,d,e' : optionsPerQuestion === 3 ? 'a,b,c' : 'a,b,c,d';
  for (const model of ['gpt-4o-mini', 'gpt-4o']) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions',
        { method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: `${prompt}\n\nExactly ${totalQuestions} questions, options ${letters}. Return ONLY valid JSON.` }
          ]}], response_format: { type: 'json_object' } }) });
      const json = await res.json();
      if (json.error) { console.warn(`[OpenAI/${model}] error:`, json.error.message); continue; }
      const result = parseAIResponse(json?.choices?.[0]?.message?.content || '');
      if (result) { result.modelUsed = `OpenAI (${model})`; console.log(`[OpenAI/${model}] Success`); return result; }
    } catch (e: any) { console.warn(`[OpenAI/${model}] Failed:`, e.message); }
  }
  return null;
}

export async function analyzeExamWithAI(
  base64: string, mimeType: string, totalQuestions: number, optionsPerQuestion: number, expectedKeys?: Record<number, string>
): Promise<AIVisionResult | null> {
  const prompt = buildOMRPrompt(totalQuestions, optionsPerQuestion, expectedKeys);
  console.log('[AI Cascade] Starting... Gemini -> Qwen -> Groq -> OpenAI');
  const g = await callGemini(base64, mimeType, prompt, totalQuestions, optionsPerQuestion);
  if (g) return g;
  console.log('[AI Cascade] Gemini failed, trying Qwen...');
  const q = await callQwen(base64, mimeType, prompt, totalQuestions, optionsPerQuestion);
  if (q) return q;
  console.log('[AI Cascade] Qwen failed, trying Groq...');
  const gr = await callGroq(base64, mimeType, prompt, totalQuestions, optionsPerQuestion);
  if (gr) return gr;
  console.log('[AI Cascade] Groq failed, trying OpenAI...');
  const o = await callOpenAI(base64, mimeType, prompt, totalQuestions, optionsPerQuestion);
  if (o) return o;
  console.warn('[AI Cascade] All AI models failed. Local scanner fallback.');
  return null;
}
