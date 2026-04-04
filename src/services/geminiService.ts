import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateInvoiceSummary = async (invoiceData: any) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Summarize this invoice for a quick notification: ${JSON.stringify(invoiceData)}`,
    config: {
      systemInstruction: "You are an ERP assistant. Provide a very brief, professional summary of the invoice (Dealer, Total, Date).",
    },
  });
  return response.text;
};
