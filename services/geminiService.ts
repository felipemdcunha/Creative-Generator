import { GoogleGenAI, Type } from "@google/genai";
import { CreativeSet, Persona, GenerationConfig, CreativeIdea } from "../types";
import { urlToBase64 } from "../lib/utils";

// Helper to get client instance at runtime
const getGenAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key não configurada. Crie um arquivo .env com API_KEY=SuaChave ou configure nas Variáveis de Ambiente do seu servidor de hospedagem.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateCreativeIdea = async (
  set: CreativeSet,
  persona: Persona,
  config: GenerationConfig,
): Promise<CreativeIdea> => {
  const model = 'gemini-3-flash-preview'; // Fast text model
  const ai = getGenAI(); // Instantiate here to ensure key is ready

  const personaData = persona.advanced_data;
  const brandColors = set.brand_colors ? JSON.stringify(set.brand_colors) : JSON.stringify({ primary: "#000000", secondary: "#FFFFFF", tertiary: "#333333" });
  
  // 1. System Prompt (Director of Marketing)
  const systemInstruction = `
ROLE: Você é o DIRETOR DE CRIAÇÃO e COPYWRITER nº 1 do mundo em Real Estate.
Seu objetivo é gerar testes A/B de alta performance.

CONTEXTO:
Estamos criando anúncios para testar "Qual estilo visual e qual copy tem maior taxa de clique (CTR)?".
Portanto, NÃO crie sempre o mesmo estilo de anúncio.

VARIAÇÃO CRIATIVA (DIREÇÃO DE ARTE):
Para cada geração, escolha UMA destas direções de arte baseada na persona:
1. "Editorial Luxury": Estilo revista (Vogue/Architecture Digest). Tipografia com serifa, fina, elegante. Imagem limpa.
2. "Bold / Retail": Foco em oportunidade. Tipografia Sans-Serif grossa, alto contraste, cores sólidas da marca.
3. "Moody / Cinematic": Foco em emoção. Iluminação dramática, texto minimalista pequeno em área de respiro.
4. "Modern Interface": Estilo app/tech. Boxes translúcidos, blur no fundo, tipografia geométrica.

REGRA DE COPY (CRÍTICA):
- JAMAIS escreva o nome da persona.
- Foque em LIFESTYLE, DOR ou DESEJO.

Sua tarefa:
1) Definir um ângulo estratégico.
2) Escolher a área comum (Amenity) ideal.
3) Criar COPY (Headline + Texto). Headline deve ser curta (Max 40 chars).
4) Criar um prompt visual ("nano_banana_final_prompt") que descreva o DESIGN GRÁFICO ESPECÍFICO da direção de arte escolhida.

Regras obrigatórias:
- Retorne SOMENTE JSON válido.
`;

  // 2. User Prompt (The specific request)
  const prompt = `
BASE DE CONHECIMENTO:
${set.knowledge_base_text || "Nenhuma informação extra fornecida."}

DADOS DO EMPREENDIMENTO:
${set.market_vocation}

PERSONA:
Arquétipo: ${personaData.archetype}
Dores: ${personaData.pain_points}
Interesses: ${JSON.stringify(personaData.meta_ads.interests)}

ESTÁGIO DO FUNIL: ${config.funnelStage}
FORMATOS: ${JSON.stringify(config.formats)}
CORES DA MARCA: ${brandColors}

LOGOS: Dev: ${config.includeDevLogo}, Org: ${config.includeOrgLogo}, Extra: ${config.includeAdditionalLogo}

AMENITIES DISPONÍVEIS:
${JSON.stringify(config.availableAmenities)}

Template FINAL — Prompt do Nano Banana Pro (campo 'nano_banana_final_prompt'):
GERAR DESIGN GRÁFICO CRIATIVO.
Estilo Visual Escolhido: [Defina qual direção de arte você escolheu aqui]
Referência Visual 1 (Background): "Base intocável da arquitetura."
Texto Overlay: "Inserir '{{copy.headline}}' seguindo a tipografia do estilo escolhido."
Composição: Descreva como o texto interage com a imagem (ex: "Texto centralizado com sombra suave", ou "Texto alinhado à esquerda com barra lateral de cor da marca").
Atenção: NÃO DESCREVA UMA NOVA SALA. Descreva o LAYOUT GRÁFICO sobre a sala existente.
`;

  // Define Schema for structured output
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      selected_amenity_id: { type: Type.STRING, description: "The ID of the amenity chosen from the available list, or null if none specific." },
      creative_concept: {
        type: Type.OBJECT,
        properties: {
          angle: { type: Type.STRING },
          funnel_stage: { type: Type.STRING, enum: ["top", "middle", "bottom"] },
          target_emotion: { type: Type.STRING },
          communication_goal: { type: Type.STRING }
        },
        required: ["angle", "funnel_stage", "target_emotion", "communication_goal"]
      },
      copy: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING },
          subheadline_optional: { type: Type.STRING },
          body_optional: { type: Type.STRING },
          cta: { type: Type.STRING }
        },
        required: ["headline", "cta"]
      },
      visual_prompt: {
        type: Type.OBJECT,
        properties: {
          global_style: {
             type: Type.OBJECT,
             properties: {
                 brand_colors: {
                     type: Type.OBJECT,
                     properties: {
                         primary: { type: Type.STRING },
                         secondary: { type: Type.STRING },
                         text: { type: Type.STRING }
                     }
                 },
                 visual_style_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                 lighting: { type: Type.STRING },
                 mood: { type: Type.STRING },
                 contrast_level: { type: Type.STRING }
             }
          },
          scene_description: {
             type: Type.OBJECT,
             properties: {
                 main_subject: { type: Type.STRING },
                 secondary_elements: { type: Type.ARRAY, items: { type: Type.STRING } },
                 environment: { type: Type.STRING },
                 emotion_expression: { type: Type.STRING }
             }
          },
          composition_rules: {
              type: Type.OBJECT,
              properties: {
                  layout_type: { type: Type.STRING },
                  negative_space_for_text: { type: Type.STRING },
                  focus_priority: { type: Type.ARRAY, items: { type: Type.STRING } },
                  visual_hierarchy_notes: { type: Type.STRING }
              }
          },
          brand_assets_rules: {
              type: Type.OBJECT,
              properties: {
                  use_development_logo: { type: Type.BOOLEAN },
                  use_organization_logo: { type: Type.BOOLEAN },
                  logo_placement_preference: { type: Type.STRING },
                  logo_constraints: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
          },
          format_variations: {
              type: Type.ARRAY,
              items: {
                  type: Type.OBJECT,
                  properties: {
                      format: { type: Type.STRING, enum: ["1:1", "9:16", "16:9", "4:5"] },
                      canvas_ratio: { type: Type.STRING },
                      layout_adjustments: { type: Type.ARRAY, items: { type: Type.STRING } },
                      text_positioning: { type: Type.STRING },
                      logo_positioning: { type: Type.STRING }
                  }
              }
          },
          nano_banana_final_prompt: { type: Type.STRING }
        },
        required: ["nano_banana_final_prompt", "scene_description"]
      },
      quality_rules: { type: Type.ARRAY, items: { type: Type.STRING } },
      metadata: {
          type: Type.OBJECT,
          properties: {
              used_assets_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
      }
    },
    required: ["creative_concept", "copy", "visual_prompt"]
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text) as CreativeIdea;
      
      // FIX: Truncate to avoid DB constraints (Meta Ads Limits)
      if (data.copy.headline && data.copy.headline.length > 40) {
          data.copy.headline = data.copy.headline.substring(0, 40);
      }
      if (data.copy.body_optional && data.copy.body_optional.length > 125) {
          data.copy.body_optional = data.copy.body_optional.substring(0, 125);
      }
      if (data.copy.subheadline_optional && data.copy.subheadline_optional.length > 30) {
          data.copy.subheadline_optional = data.copy.subheadline_optional.substring(0, 30);
      }

      return data;
    }
    throw new Error("No text response from Gemini Idea Generator");
  } catch (error) {
    console.error("Gemini Idea Error:", error);
    throw error;
  }
};

export const generateCreativeImage = async (
  visualPrompt: string,
  referenceImages: string[], // Can be URLs or Base64 Data URIs
  aspectRatio: '1:1' | '9:16' | '16:9' | '4:5',
  textOverlay: string | null = null, // Explicit text to write on image
  isEditing: boolean = false
): Promise<string> => {
  // Using gemini-3-pro-image-preview
  const model = 'gemini-3-pro-image-preview';
  const ai = getGenAI(); // Instantiate here

  const parts: any[] = [];
  
  // Map 4:5 to 1:1 fallback
  let apiAspectRatio = aspectRatio;
  if (aspectRatio === '4:5') apiAspectRatio = '1:1'; 

  // Process Images
  // We assume: Index 0 is Background/Product. Index 1+ are Logos/Assets.
  for (const ref of referenceImages) {
    if (!ref) continue;
    try {
      let base64Data = '';
      if (ref.startsWith('data:')) {
          base64Data = ref.split(',')[1];
      } else {
          base64Data = await urlToBase64(ref);
      }

      if (base64Data) {
          parts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data,
            },
          });
      }
    } catch (e) {
      console.warn(`Failed to process reference image: ${ref.substring(0, 50)}...`, e);
    }
  }

  // Construct Instruction based on Mode
  let systemInstruction = "";
  
  if (isEditing) {
    // EDIT MODE
    systemInstruction = `
    ROLE: Expert Photo Editor.
    TASK: Modify Image 1 based on the prompt.
    CONSTRAINT: Maintain high resolution and photorealism.
    `;
  } else {
    // CREATION MODE: STRICT COMPOSITOR
    systemInstruction = `
    ROLE: AUTOMATED IMAGE COMPOSITOR & GRAPHIC DESIGNER.
    
    CRITICAL INPUT MAPPING:
    - Input Image [0] (The first image): **THE CANVAS / BACKGROUND**.
      -> RULE: PRESERVE ARCHITECTURAL DETAILS. Do NOT regenerate the building or room. 
      -> ACTION: Use this image as the base layer.
      
    - Input Image [1] onwards (The other images): **LOGOS / ASSETS**.
      -> RULE: MANDATORY INCLUSION. You MUST place these logos on top of the background.
      -> ACTION: Composite these logos into the image (corners or center-bottom).

    TASK STEPS (Follow strictly):
    1. LOAD Image [0] as the background.
    2. OVERLAY Text: "${textOverlay || ''}".
       - Font: Professional, clean, legible.
       - Size: Occupy max 20-30% of space. Do NOT cover key architectural features.
       - Style: ${visualPrompt.substring(0, 100)}...
    3. OVERLAY Logos (from Input Image [1+]):
       - Ensure they are visible. Add a small white/black glow if background is busy.
    4. RENDER FINAL: High quality, photorealistic composite.

    NEGATIVE PROMPT:
    - Do NOT generate a new house.
    - Do NOT forget the logos.
    - Do NOT make text huge.
    `;
  }

  // Combine Prompt
  const finalPromptText = `
  STRICT ORDER:
  1. Use Input[0] as Background (Do not change it).
  2. Overlay Input[1..n] (Logos) on top.
  3. Write Text: "${textOverlay || ''}".
  
  Design Style: ${visualPrompt}
  
  ${systemInstruction}
  `;

  parts.push({
    text: finalPromptText,
  });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        imageConfig: {
            aspectRatio: apiAspectRatio as any,
            imageSize: "1K" 
        }
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    throw new Error("No image generated.");
  } catch (error) {
    console.error("Gemini Image Error:", error);
    throw error;
  }
};