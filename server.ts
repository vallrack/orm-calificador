import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

// Body parser with support for base64 image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Server-side Gemini Client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Universal OpenAI-compatible Caller
async function callOpenAICompatible(
  client: OpenAI | null,
  modelName: string,
  base64Image: string,
  mimeType: string,
  systemPrompt: string,
  questionCount: number,
  optionsLetters: string
) {
  if (!client) throw new Error("Client not configured");
  const response = await client.chat.completions.create({
    model: modelName,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: `Analyze this exam sheet. Total expected questions: ${questionCount}. Possible choices: ${optionsLetters}. Return ONLY valid JSON matching the exact requested structure.` },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
        ]
      }
    ]
  });
  let content = response.choices[0].message.content || "{}";
  if (content.startsWith("```")) {
    content = content.replace(/^```(json)?\n/, "").replace(/\n```$/, "");
  }
  return JSON.parse(content);
}

function calculateConsensus(results: any[]) {
  if (results.length === 0) throw new Error("No results to calculate consensus.");
  
  // Consensus for Student Name and Grade
  const nameCounts: Record<string, number> = {};
  const gradeCounts: Record<string, number> = {};
  
  results.forEach(res => {
    if (res.studentName) nameCounts[res.studentName] = (nameCounts[res.studentName] || 0) + 1;
    if (res.grade) gradeCounts[res.grade] = (gradeCounts[res.grade] || 0) + 1;
  });
  
  const bestName = Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const bestGrade = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  // Consensus for Answers
  const finalAnswers: any[] = [];
  const totalQuestions = results[0].answers?.length || 30;
  
  for (let q = 1; q <= totalQuestions; q++) {
    const votes: Record<string, number> = {};
    results.forEach(res => {
      const ans = res.answers?.find((a: any) => a.questionNumber === q);
      if (ans && ans.selectedOption) {
        votes[ans.selectedOption] = (votes[ans.selectedOption] || 0) + 1;
      }
    });
    const winnerOption = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] || "BLANK";
    
    finalAnswers.push({
      questionNumber: q,
      selectedOption: winnerOption,
      isDoubleMark: winnerOption === "MULTIPLE",
      isBlank: winnerOption === "BLANK"
    });
  }

  return {
    studentName: bestName,
    grade: bestGrade,
    answers: finalAnswers,
    confidence: results.reduce((acc, r) => acc + (r.confidence || 0.9), 0) / results.length,
    anomalies: [`Consensus reached successfully using ${results.length} AI models.`]
  };
}

// Login Endpoint
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPass = process.env.ADMIN_PASSWORD || "admin123";

  if (username === adminUser && password === adminPass) {
    return res.json({ success: true, token: "admin_token_xyz" });
  }
  return res.status(401).json({ success: false, error: "Credenciales inválidas" });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Sheet OCR & HTR Analysis Endpoint
app.post("/api/analyze-sheet", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", questionCount = 30, optionsPerQuestion = 4 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 in request body" });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, "");
    const optionsLetters = ["a", "b", "c", "d", "e", "f"].slice(0, optionsPerQuestion).join(", ");

    const systemPrompt = `You are a high-precision Optical Mark Recognition (OMR) and Handwritten Text Recognition (HTR) examination scanner for optical bubble answer sheets.
Analyze the provided exam sheet image with maximum accuracy:
1. Extract the handwritten student name ("Nombre del Estudiante" / "Estudiante") exactly as written.
2. Extract the student's Grade/Group ("Grado" / "Grupo" / "Curso") exactly as written (e.g. "10-1", "11A").
3. Read the filled bubbles for each question from 1 up to ${questionCount}.
For each question (numbered 1, 2, 3...):
- Identify which bubble (${optionsLetters}) has been shaded/darkened/marked by pencil or pen.
- If multiple bubbles are filled for the same question, mark it as "MULTIPLE".
- If no bubble is filled, mark it as "BLANK".
- If exactly one is shaded, return the lowercase letter ('a', 'b', 'c', 'd', etc.).
4. Return a confidence rating (0 to 1) and any anomaly notes.

You must return ONLY a valid JSON object strictly following this structure:
{
  "studentName": "string",
  "grade": "string",
  "answers": [
    {
      "questionNumber": 1,
      "selectedOption": "string",
      "isDoubleMark": boolean,
      "isBlank": boolean
    }
  ],
  "confidence": 0.95,
  "anomalies": ["string"]
}`;

    // Init API Clients
    const geminiClient = getGeminiClient();
    const openAIClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
    const groqClient = process.env.GROQ_API_KEY ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" }) : null;
    const xAIClient = process.env.XAI_API_KEY ? new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: "https://api.x.ai/v1" }) : null;
    const qwenClient = process.env.QWEN_API_KEY ? new OpenAI({ apiKey: process.env.QWEN_API_KEY, baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" }) : null;

    if (!geminiClient && !openAIClient && !groqClient && !xAIClient && !qwenClient) {
      return res.json({
        success: true,
        isFallback: true,
        studentName: "",
        grade: "",
        answers: {},
        warnings: ["No AI API keys configured. Please add them to .env"],
      });
    }

    const promises: Promise<any>[] = [];

    // 1. Gemini Flash
    if (geminiClient) {
      promises.push(
        geminiClient.models.generateContent({
          model: "gemini-flash-latest",
          contents: [
            { inlineData: { mimeType: mimeType || "image/jpeg", data: cleanBase64 } },
            { text: `Analyze this exam sheet. Total expected questions: ${questionCount}. Possible choices: ${optionsLetters}. Return ONLY valid JSON matching the exact requested structure.` }
          ],
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
          }
        }).then(response => {
          console.log("[Gemini] Responded. Raw Text:", response.text);
          const parsed = JSON.parse(response.text || "{}");
          console.log("[Gemini] Parsed:", JSON.stringify(parsed, null, 2));
          return parsed;
        }).catch(e => { console.error("[Gemini] Error:", e); return null; })
      );
    }

    // 2. OpenAI GPT-4o
    if (openAIClient) {
      promises.push(callOpenAICompatible(openAIClient, "gpt-4o-mini", cleanBase64, mimeType, systemPrompt, questionCount, optionsLetters)
        .catch(() => callOpenAICompatible(openAIClient, "gpt-4o", cleanBase64, mimeType, systemPrompt, questionCount, optionsLetters))
        .then(res => { console.log("[OpenAI] Responded."); return res; })
        .catch(e => { console.error("[OpenAI] Error:", e.message); return null; }));
    }

    // 3. Groq (Llama Vision)
    if (groqClient) {
      promises.push(callOpenAICompatible(groqClient, "llama-3.2-90b-vision-preview", cleanBase64, mimeType, systemPrompt, questionCount, optionsLetters)
        .catch(() => callOpenAICompatible(groqClient, "llama-3.2-90b-vision", cleanBase64, mimeType, systemPrompt, questionCount, optionsLetters))
        .catch(() => callOpenAICompatible(groqClient, "llama-3.2-11b-vision", cleanBase64, mimeType, systemPrompt, questionCount, optionsLetters))
        .then(res => { console.log("[Groq] Responded."); return res; })
        .catch(e => { console.error("[Groq] Error:", e.message); return null; }));
    }

    // 4. xAI (Grok Vision)
    if (xAIClient) {
      promises.push(callOpenAICompatible(xAIClient, "grok-vision-beta", cleanBase64, mimeType, systemPrompt, questionCount, optionsLetters)
        .then(res => { console.log("[xAI] Responded."); return res; })
        .catch(e => { console.error("[xAI] Error:", e.message); return null; }));
    }

    // 5. Qwen (DashScope)
    if (qwenClient) {
      promises.push(callOpenAICompatible(qwenClient, "qwen-vl-plus", cleanBase64, mimeType, systemPrompt, questionCount, optionsLetters)
        .then(res => { console.log("[Qwen] Responded."); return res; })
        .catch(e => { console.error("[Qwen] Error:", e.message); return null; }));
    }

    console.log(`[AI Army] Dispatching ${promises.length} concurrent requests (first-to-respond wins)...`);

    // Use Promise.any: returns the FIRST AI that responds successfully.
    // This is critical for Vercel: Gemini responds in ~4s, so we don't need to wait for slow models.
    // Filter out null results (failed AI calls) by wrapping each in a rejection if null.
    const firstValidResult = await Promise.any(
      promises.map(p => p.then(res => {
        if (res && Array.isArray(res.answers) && res.answers.length > 0) {
          return res;
        }
        throw new Error("Invalid or empty AI response");
      }))
    ).catch(() => null);

    const validResults = firstValidResult ? [firstValidResult] : [];

    if (validResults.length === 0) {
      throw new Error("All AI models failed to process the image.");
    }

    console.log(`[AI Army] Calculating consensus from ${validResults.length} successful responses...`);
    const consensusData = calculateConsensus(validResults);

    // Transform consensus answers into the frontend expected format
    // Frontend expects: `Record<number, OptionLetter | 'MULTIPLE' | 'BLANK'>`
    const formattedAnswers: Record<number, string> = {};
    consensusData.answers.forEach((ans: any) => {
      formattedAnswers[ans.questionNumber] = ans.selectedOption;
    });

    const responseData = {
      ...consensusData,
      answers: formattedAnswers
    };

    return res.json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    console.error("Error analyzing exam sheet:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Error al procesar la hoja de examen.",
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Calificador OMR Server running on http://0.0.0.0:${PORT}`);
  });
}

// In Vercel, we export the app for serverless execution.
// Locally, we start the server immediately.
if (!process.env.VERCEL) {
  startServer();
}

export default app;
