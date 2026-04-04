import { GoogleGenAI } from "@google/genai";

const apiKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined;

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateInvoiceSummary = async (invoiceData: any) => {
  if (!ai) {
    console.warn('Gemini AI: Missing API Key. Summary generation disabled.');
    return 'Summary not available (API Key missing)';
  }
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Summarize this invoice for a quick notification: ${JSON.stringify(invoiceData)}`,
    config: {
      systemInstruction: "You are an ERP assistant. Provide a very brief, professional summary of the invoice (Dealer, Total, Date).",
    },
  });
  return response.text;
};
