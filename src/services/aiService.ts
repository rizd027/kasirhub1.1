import { toast } from "sonner";

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY || "";

// AI Themed Toasts
export const aiToast = {
  success: (msg: string) => toast.success(`✨ AI Power: ${msg}`, {
    className: "bg-indigo-600 text-white border-indigo-400",
    descriptionClassName: "text-indigo-100",
  }),
  info: (msg: string) => toast.info(`✨ AI Suggestion: ${msg}`, {
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
  }),
  error: (msg: string) => toast.error(`⚠️ AI Issue: ${msg}`, {
    className: "bg-rose-50 text-rose-700 border-rose-200",
  })
};

export type AIAnalysisMode = 'product' | 'ingredient' | 'expense' | 'verification' | 'business_advice';

/**
 * Optimized AI Analysis Service for various retail data types.
 */
export async function analyzeImage(imageUrl: string, mode: AIAnalysisMode): Promise<any> {
  console.log(`[AI] Analyzing ${mode} for:`, imageUrl);

  // Optimization: Downscale image for AI
  let aiImageUrl = imageUrl;
  if (imageUrl.includes('cloudinary.com')) {
    // Force format to JPG (f_jpg) because q_auto might return AVIF which Gemini API rejects (400 Bad Request)
    aiImageUrl = imageUrl.replace('/upload/', '/upload/w_800,c_limit,f_jpg,q_auto:eco/');
  }

  // Helper to fetch and convert to base64
  const getBase64 = async (url: string) => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise<{ base64: string, mimeType: string }>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        // Enforce valid image MIME type for Gemini
        let type = blob.type;
        if (!type || type === 'application/octet-stream') {
           type = url.toLowerCase().includes('.png') ? 'image/png' : 
                  url.toLowerCase().includes('.webp') ? 'image/webp' : 'image/jpeg';
        }
        resolve({ base64, mimeType: type });
      };
      reader.readAsDataURL(blob);
    });
  };

  const { base64, mimeType } = await getBase64(aiImageUrl);

  // Define prompts based on mode
  let prompt = "";
  if (mode === 'product') {
    prompt = `Identifikasi produk dalam gambar. Jika ini adalah rak toko, pilih satu produk paling jelas. 
    Berikan HANYA JSON: {"name": "Nama Produk", "category": "Kategori", "suggested_price": 25000, "description": "Deskripsi singkat"}. 
    Gunakan Bahasa Indonesia. Pastikan field "name" tidak kosong.`;
  } else if (mode === 'ingredient') {
    prompt = `Identifikasi bahan baku atau kemasan atau struk belanja. 
    Berikan HANYA JSON: {"name": "Nama Bahan", "category": "Kategori", "unit": "Gram/ML/Pcs", "cost_per_unit": 5000, "type": "ingredient", "description": "Info tambahan"}. 
    PENTING: Gunakan "packaging" pada field "type" jika itu adalah kemasan (cup, plastik, dus, sedotan, lakban, dll). Gunakan "ingredient" jika itu adalah bahan konsumsi (kopi, gula, susu, bumbu, dll).
    Gunakan Bahasa Indonesia. Pastikan field "name" tidak kosong.`;
  } else if (mode === 'expense') {
    prompt = `Identifikasi struk pengeluaran, nota, atau tagihan. 
    Cari total nominal yang harus dibayar. 
    Berikan HANYA JSON: {"total_amount": 50000, "category": "Operasional/Sewa/Listrik/Gaji/Lainnya", "date": "YYYY-MM-DD", "note": "Nama Toko/Keterangan"}. 
    Gunakan Bahasa Indonesia.`;
  } else if (mode === 'verification') {
    prompt = `Verifikasi bukti transfer bank atau struk pembayaran e-wallet ini. 
    Cari status (Berhasil/Pending) dan nominalnya. 
    Berikan HANYA JSON: {"is_valid": true, "amount_detected": 50000, "bank_name": "Nama Bank/E-Wallet", "note": "Keterangan validasi"}. 
    Gunakan Bahasa Indonesia.`;
  }

  // 1. Try Gemini
  const geminiModels = [
    { name: "gemini-2.0-flash", version: "v1beta" },
    { name: "gemini-2.0-flash-lite-preview-02-05", version: "v1beta" },
    { name: "gemini-1.5-flash", version: "v1" },
    { name: "gemini-1.5-flash-8b", version: "v1" },
    { name: "gemini-1.5-pro", version: "v1" }
  ];
  for (const model of geminiModels) {
    try {
      console.log(`[AI] Trying Gemini: ${model.name}...`);
      const response = await fetch(`https://generativelanguage.googleapis.com/${model.version}/models/${model.name}:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64 } }
            ]
          }]
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        console.warn(`[AI] Gemini ${model.name} error:`, response.status, errJson);
        continue;
      }

      const data = await response.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(`[AI] Gemini ${model.name} success!`);
        return JSON.parse(data.candidates[0].content.parts[0].text);
      }
    } catch (err: any) {
      // Silently fail Gemini to try next model or fallback
    }
  }

  // 2. Try Groq (Fallback)
  const groqModels = ["meta-llama/llama-4-scout-17b-16e-instruct", "llama-3.2-90b-vision-preview"];
  for (const model of groqModels) {
    try {
      console.log(`[AI] Trying Groq: ${model}...`);
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
            ]
          }],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        console.log(`[AI] Groq ${model} success!`);
        return JSON.parse(data.choices[0].message.content);
      }
    } catch (err: any) {
      console.warn(`[AI] Groq ${model} error:`, err.message);
    }
  }

  throw new Error("Gagal mengidentifikasi gambar. Pastikan gambar sudah terunggah sempurna atau coba lagi beberapa saat lagi.");
}

/**
 * Text-based AI Analysis for Business Intelligence
 */
export async function analyzeText(prompt: string): Promise<string> {
  // 1. Try Gemini Models
  const geminiModels = [
    { name: "gemini-2.0-flash", version: "v1beta" },
    { name: "gemini-1.5-flash", version: "v1" },
    { name: "gemini-1.5-pro", version: "v1" }
  ];
  
  for (const model of geminiModels) {
    if (!GEMINI_API_KEY) break;
    
    try {
      console.log(`[AI Text] Trying Gemini: ${model.name}...`);
      const response = await fetch(`https://generativelanguage.googleapis.com/${model.version}/models/${model.name}:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 1024 },
          tools: [{ google_search_retrieval: {} }],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
          ]
        })
      });

      if (!response.ok) {
        if (response.status === 429) continue; // Rate limit - try next model
        throw new Error(`API Error (${response.status})`);
      }

      const data = await response.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const candidate = data.candidates[0];
        if (candidate.finishReason === "SAFETY") {
           console.warn(`[AI Text] Gemini ${model.name} blocked by safety.`);
           continue;
        }
        return candidate.content.parts[0].text;
      }
    } catch (err: any) {
      if (err.message.includes("429")) continue;
    }
  }

  // 2. Try Groq (Fallback)
  const groqModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  for (const model of groqModels) {
    if (!GROQ_API_KEY) break;

    try {
      console.log(`[AI Text] Trying Groq: ${model}...`);
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn(`[AI Text] Groq ${model} HTTP Error:`, response.status, errorData);
        if (response.status === 429) continue;
        throw new Error(`Groq Error (${response.status}): ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
    } catch (err: any) {
      console.warn(`[AI Text] Groq ${model} error:`, err.message);
    }
  }

  throw new Error("Maaf, semua layanan AI sedang sibuk atau mencapai batas kuota. Silakan coba lagi beberapa saat lagi.");
}

/**
 * Legacy support for backward compatibility
 */
export async function identifyProductFromImage(imageUrl: string) {
  return analyzeImage(imageUrl, 'product');
}
