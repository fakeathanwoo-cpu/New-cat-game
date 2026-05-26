import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

export const getAI = () => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export const generateDreamWisdom = async (): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: "Generate a punny, dreamy, and slightly cryptic one-sentence message from a wise cat to a player about to start a dream adventure. Keep it under 15 words.",
      config: {
        systemInstruction: "You are a mystical cat who speaks in dreams. Your tone is cozy, slightly mischievous, and wise.",
      },
    });
    
    if (!response || !response.text) {
      throw new Error("Empty response from Gemini");
    }
    
    return response.text.replace(/"/g, '').trim();
  } catch (error) {
    // Log minimal error to console to avoid cluttering but still track issues
    console.warn("Dream wisdom generation failed, using fallback.");
    return "The moon watches your paws, little dreamer.";
  }
};
