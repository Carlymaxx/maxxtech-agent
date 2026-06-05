import { GoogleGenAI } from "@google/genai";

if (!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
  throw new Error(
    "AI_INTEGRATIONS_GEMINI_BASE_URL must be set. Did you forget to provision the Gemini AI integration?",
  );
}

if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_GEMINI_API_KEY must be set. Did you forget to provision the Gemini AI integration?",
  );
}

const httpOpts = {
  apiVersion: "",
  baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
};

export const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: httpOpts,
});

// Secondary key for fallback (e.g. image generation quota)
export const ai2 = process.env.AI_INTEGRATIONS_GEMINI_API_KEY_2
  ? new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY_2,
      httpOptions: httpOpts,
    })
  : null;
