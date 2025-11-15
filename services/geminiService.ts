import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ProcessingResponse } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

// Initialize Gemini Client
// Note: process.env.API_KEY is injected by the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Converts a File object to a Base64 string suitable for the Gemini API.
 */
const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Define the Response Schema using the SDK's Type enum
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    apartment_card: {
      type: Type.OBJECT,
      properties: {
        house_number: { type: Type.STRING, nullable: true },
        apartment_number: { type: Type.STRING, nullable: true },
        acceptance_date: { type: Type.STRING, nullable: true, description: "ISO 8601 YYYY-MM-DD" },
        owner: {
          type: Type.OBJECT,
          properties: {
            full_name: { type: Type.STRING, nullable: true },
            phone: { type: Type.STRING, nullable: true },
          },
        },
        act_photos: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              filename: { type: Type.STRING },
              url: { type: Type.STRING, nullable: true },
              confidence: { type: Type.NUMBER },
            },
          },
        },
        defects: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text_raw: { type: Type.STRING },
              description: { type: Type.STRING },
              category: { 
                type: Type.STRING, 
                enum: [
                  'walls', 'floor', 'ceiling', 'doors', 'windows', 'plumbing', 
                  'electrical', 'heating', 'ventilation', 'finishing', 'tiles', 'paint', 'other'
                ] 
              },
              severity: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] },
              suggested_deadline_days: { type: Type.INTEGER },
              photo_refs: { type: Type.ARRAY, items: { type: Type.STRING } },
              location_in_apartment: { type: Type.STRING, nullable: true },
              confidence: { type: Type.NUMBER },
            },
            required: ["id", "text_raw", "description", "category", "severity"],
          },
        },
        metadata: {
          type: Type.OBJECT,
          properties: {
            source_ocr_text: { type: Type.STRING },
            processing_timestamp: { type: Type.STRING },
            image_gps: {
              type: Type.OBJECT,
              properties: {
                lat: { type: Type.NUMBER, nullable: true },
                lon: { type: Type.NUMBER, nullable: true },
              },
            },
          },
        },
      },
      required: ["defects", "metadata", "owner"],
    },
    errors: { type: Type.ARRAY, items: { type: Type.STRING } },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["apartment_card", "errors", "warnings"],
};

export const processActImage = async (file: File): Promise<ProcessingResponse> => {
  try {
    const base64Data = await fileToGenerativePart(file);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data,
            },
          },
          {
            text: "Проанализируй этот рукописный акт приёмки. Распознай весь текст и структурируй дефекты.",
          },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1, // Low temperature for factual extraction
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text generated");
    }

    const data = JSON.parse(text) as ProcessingResponse;
    
    // Post-processing: Ensure IDs exist if model missed them (though schema enforces it)
    data.apartment_card.defects = data.apartment_card.defects.map((d, idx) => ({
      ...d,
      id: d.id || `gen-${Date.now()}-${idx}`,
      photo_refs: d.photo_refs || []
    }));

    return data;

  } catch (error) {
    console.error("Gemini Processing Error:", error);
    throw error;
  }
};
