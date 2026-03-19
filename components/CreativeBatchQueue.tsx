import React, { useEffect, useState, useRef } from 'react';
import { AdConcept, AdAsset, CreativeSet, GenerationConfig, Persona, QueueItem, CreativeIdea } from '../types';
import { generateCreativeIdea, generateCreativeImage } from '../services/geminiService';
import { generateTrackingCode } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface Props {
  queue: QueueItem[];
  setQueue: React.Dispatch<React.SetStateAction<QueueItem[]>>;
  creativeSet: CreativeSet;
  persona: Persona;
  onComplete: () => void;
}

const CreativeBatchQueue: React.FC<Props> = ({ queue, setQueue, creativeSet, persona, onComplete }) => {
  const [processingIndex, setProcessingIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Helper to fetch development/org details for logos
  const [logos, setLogos] = useState<{dev?: string, org?: string}>({});

  useEffect(() => {
    const fetchLogos = async () => {
       let devLogo = '';
       let orgLogo = '';

       // 1. Fetch Development Logo
       if (creativeSet.development_id) {
           const { data } = await supabase.from('developments').select('logo_url').eq('id', creativeSet.development_id).single();
           if (data) devLogo = data.logo_url;
       }

       // 2. Fetch Organization Logo
       try {
           const { data: { user } } = await supabase.auth.getUser();
           
           if (user && user.email) {
               const { data: profile } = await supabase
                 .from('profiles')
                 .select('organization_id')
                 .eq('email', user.email)
                 .single();

               if (profile && profile.organization_id) {
                   const { data: org } = await supabase
                     .from('organizations')
                     .select('logo_url')
                     .eq('id', profile.organization_id)
                     .single();
                   
                   if (org) {
                       orgLogo = org.logo_url;
                   }
               }
           }
       } catch (err) {
           console.error("Error fetching organization logo chain:", err);
       }
       
       setLogos({ dev: devLogo, org: orgLogo });
    };
    fetchLogos();
  }, [creativeSet]);


  useEffect(() => {
    if (queue.length > 0 && !isProcessing && processingIndex < queue.length) {
      processQueueItem(processingIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, processingIndex, isProcessing]);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [processingIndex, queue]);

  const updateItemStatus = (index: number, updates: Partial<QueueItem>) => {
    setQueue(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const processQueueItem = async (index: number) => {
    setIsProcessing(true);
    const item = queue[index];

    try {
      
      // --- TYPE: NEW CONCEPT ---
      if (item.type === 'new_concept' && item.config) {
          
          // 1. GENERATE COPY & CONCEPT
          updateItemStatus(index, { status: 'generating_copy' });
          const idea = await generateCreativeIdea(creativeSet, persona, item.config);
          
          // Store idea in state so user can see the headline while assets generate
          updateItemStatus(index, { generatedIdea: idea });

          // 2. PREPARE REFERENCE IMAGES
          const imageUrlsForGeneration: string[] = [];
          let selectedReferenceUrl: string | undefined = undefined;

          // A) AMENITY (Background Content - MUST BE FIRST)
          if (idea.selected_amenity_id && creativeSet.development_id) {
             const { data } = await supabase
                .from('gallery_amplified')
                .select('generated_image_url, original_image_url')
                .eq('amenity_id', idea.selected_amenity_id)
                .eq('development_id', creativeSet.development_id);

             if (data && data.length > 0) {
                 const randomImg = data[Math.floor(Math.random() * data.length)];
                 const validUrl = randomImg.generated_image_url || randomImg.original_image_url;
                 if (validUrl) {
                     selectedReferenceUrl = validUrl;
                     imageUrlsForGeneration.push(validUrl); // PUSH FIRST
                 }
             }
          }

          // B) LOGOS
          if (item.config.includeDevLogo && logos.dev) imageUrlsForGeneration.push(logos.dev);
          if (item.config.includeOrgLogo && logos.org) imageUrlsForGeneration.push(logos.org);
          if (item.config.includeAdditionalLogo && creativeSet.additional_logo_url) imageUrlsForGeneration.push(creativeSet.additional_logo_url);

          // C) VISUAL STYLE REFERENCES
          if (creativeSet.visual_references && creativeSet.visual_references.length > 0) {
              imageUrlsForGeneration.push(...creativeSet.visual_references.slice(0, 2));
          }
          
          // 3. GENERATE ALL ASSETS (IN MEMORY)
          // We do not save to DB yet. We wait until all are generated.
          updateItemStatus(index, { 
              status: 'generating_assets', 
              totalAssets: item.config.formats.length,
              completedAssets: 0
          });

          // Temporary storage for generated assets before DB insert
          const tempAssets: Array<{
              publicUrl: string;
              format: '1:1' | '9:16' | '16:9' | '4:5';
              promptUsed: string;
              assetType: 'FEED_IMAGE' | 'STORY_IMAGE';
          }> = [];

          let completedCount = 0;
          const safeHeadline = (idea.copy.headline || "Lançamento Exclusivo").substring(0, 40);

          for (const format of item.config.formats) {
              
              const formatAdjustment = idea.visual_prompt.format_variations?.find(v => v.format === format);
              const adjustmentText = formatAdjustment 
                  ? `Adjust layout for ${format} ratio (${formatAdjustment.canvas_ratio}). ${formatAdjustment.layout_adjustments.join('. ')}` 
                  : '';
              
              const finalPrompt = `${idea.visual_prompt.nano_banana_final_prompt}\n\n${adjustmentText}`;

              // Generate Image
              const base64Image = await generateCreativeImage(finalPrompt, imageUrlsForGeneration, format, safeHeadline, false);

              // Upload to Storage immediately to get URL
              const fileName = `${persona.id}/${Date.now()}_${format}_${Math.random().toString(36).substring(7)}.png`;
              const byteCharacters = atob(base64Image);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
              
              const { error: uploadError } = await supabase.storage.from('ad-creatives').upload(fileName, blob, { contentType: 'image/png' });
              if (uploadError) throw uploadError;

              const publicUrl = supabase.storage.from('ad-creatives').getPublicUrl(fileName).data.publicUrl;
              const assetType = (format === '9:16') ? 'STORY_IMAGE' : 'FEED_IMAGE';

              tempAssets.push({
                  publicUrl,
                  format,
                  promptUsed: finalPrompt,
                  assetType
              });

              completedCount++;
              updateItemStatus(index, { completedAssets: completedCount });
              
              // Small delay to be gentle with API
              await new Promise(r => setTimeout(r, 1000));
          }

          // 4. SAVE EVERYTHING TO DB (ATOMICALLY)
          updateItemStatus(index, { status: 'saving_concept' });

          const internalName = generateTrackingCode(creativeSet.name, persona.name);
          const urlTags = `utm_source=meta_ads&utm_medium=paid_social&utm_campaign=${internalName}&utm_content=${item.config.funnelStage}`;

          // Profile Check
          const { data: { user } } = await supabase.auth.getUser();
          const { data: profile } = await supabase.from('profiles').select('organization_id').eq('email', user?.email).single();
          
          let dbCta = 'LEARN_MORE';
          if (idea.copy.cta) {
              if (idea.copy.cta.toUpperCase().includes('WHATSAPP')) dbCta = 'WHATSAPP_MESSAGE';
              else if (idea.copy.cta.toUpperCase().includes('CADASTRE')) dbCta = 'SIGN_UP';
              else if (idea.copy.cta.toUpperCase().includes('OFERTA')) dbCta = 'GET_OFFER';
          }

          const safeBody = (idea.copy.body_optional || "Confira essa oportunidade!").substring(0, 125);
          const safeDesc = (idea.copy.subheadline_optional || "Saiba mais agora").substring(0, 30);

          // A) Insert Concept
          const newConcept: Partial<AdConcept> = {
              development_id: creativeSet.development_id, 
              persona_id: persona.id,
              organization_id: profile?.organization_id,
              internal_name: internalName,
              url_tags: urlTags,
              primary_text: safeBody,
              headline: safeHeadline,
              description: safeDesc,
              call_to_action_type: dbCta as any,
              funnel_stage: item.config.funnelStage,
              status: 'draft',
              created_at: new Date().toISOString()
          };

          const { data: savedConcept, error: conceptError } = await supabase
              .from('ad_concepts')
              .insert(newConcept)
              .select()
              .single();

          if (conceptError) throw conceptError;

          // B) Insert Assets Linked to Concept
          const assetsToInsert = tempAssets.map(asset => ({
              concept_id: savedConcept.id,
              image_url: asset.publicUrl,
              asset_type: asset.assetType,
              aspect_ratio: asset.format,
              prompt_used: asset.promptUsed,
              reference_image_url: selectedReferenceUrl,
              created_at: new Date().toISOString()
          }));

          const { error: assetsError } = await supabase.from('ad_assets').insert(assetsToInsert);
          if (assetsError) throw assetsError;

          updateItemStatus(index, { status: 'completed' });
      }

      // --- TYPE: EDIT ASSET ---
      // Edits are simpler, but we keep the same structure
      if (item.type === 'edit_asset' && item.sourceAsset && item.editInstruction) {
           updateItemStatus(index, { status: 'generating_assets' });
           
           const imageUrlsForGeneration = [item.sourceAsset.image_url];
           if (item.editReferenceImages) imageUrlsForGeneration.push(...item.editReferenceImages);

           const base64Image = await generateCreativeImage(item.editInstruction, imageUrlsForGeneration, item.sourceAsset.aspect_ratio, null, true);

            const fileName = `${persona.id}/edited_${Date.now()}.png`;
            const byteCharacters = atob(base64Image);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });

            const { error: uploadError } = await supabase.storage.from('ad-creatives').upload(fileName, blob, { contentType: 'image/png' });
            if (uploadError) throw uploadError;

            const publicUrl = supabase.storage.from('ad-creatives').getPublicUrl(fileName).data.publicUrl;

            // Save NEW Asset linked to SAME Concept
            const newAsset: Partial<AdAsset> = {
                concept_id: item.sourceAsset.concept_id,
                image_url: publicUrl,
                asset_type: item.sourceAsset.asset_type,
                aspect_ratio: item.sourceAsset.aspect_ratio,
                prompt_used: item.editInstruction,
                reference_image_url: item.sourceAsset.reference_image_url,
                created_at: new Date().toISOString()
            };

            const { error: assetError } = await supabase.from('ad_assets').insert(newAsset);
            if (assetError) throw assetError;

            updateItemStatus(index, { status: 'completed' });
      }

    } catch (err: any) {
      console.error(err);
      updateItemStatus(index, { status: 'error', error: err.message || 'Unknown error' });
    } finally {
      setIsProcessing(false);
      
      // Delay before next item
      setTimeout(() => {
          if (index + 1 < queue.length) {
            setProcessingIndex(index + 1);
          } else {
            onComplete(); 
          }
      }, 1000);
    }
  };

  const getStatusLabel = (item: QueueItem) => {
    switch(item.status) {
      case 'pending': return 'Aguardando...';
      case 'generating_copy': return 'Criando Copy & Conceito...';
      case 'generating_assets': 
        return item.totalAssets 
            ? `Gerando Imagens (${item.completedAssets}/${item.totalAssets})...` 
            : 'Gerando Imagem...';
      case 'saving_concept': return 'Finalizando e Salvando...';
      case 'completed': return 'Concluído';
      case 'error': return 'Falha';
      default: return '';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white shadow-2xl rounded-xl border border-gray-200 overflow-hidden z-40 flex flex-col max-h-[500px]">
      <div className="bg-gray-900 text-white p-3 flex justify-between items-center">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          Processando Batch ({processingIndex + 1}/{queue.length})
        </h3>
        <button className="text-xs text-gray-400 hover:text-white">Minimizar</button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-0" ref={scrollRef}>
        {queue.map((item, idx) => (
          <div key={item.id} className={`p-3 border-b text-sm flex flex-col gap-2 ${idx === processingIndex ? 'bg-blue-50' : ''}`}>
            <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded bg-gray-100 flex items-center justify-center font-bold text-xs text-gray-500">
                {item.type === 'new_concept' ? 'NEW' : 'EDIT'}
                </div>
                <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate flex items-center gap-2">
                    {item.type === 'new_concept' ? `Conceito #${idx + 1}` : 'Editando Criativo'}
                    {item.config?.funnelStage && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold ${
                            item.config.funnelStage === 'top' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                            item.config.funnelStage === 'middle' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                            'bg-emerald-50 text-emerald-600 border-emerald-100'
                        }`}>
                            {item.config.funnelStage === 'top' ? 'Topo' : item.config.funnelStage === 'middle' ? 'Meio' : 'Fundo'}
                        </span>
                    )}
                </p>
                <p className={`text-xs truncate ${item.status === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
                    {item.error ? item.error : getStatusLabel(item)}
                </p>
                </div>
                <div className="flex-shrink-0">
                {item.status === 'completed' && <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                {item.status === 'error' && <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
                {(item.status !== 'completed' && item.status !== 'error' && item.status !== 'pending') && (
                    <svg className="animate-spin w-5 h-5 text-brand" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )}
                </div>
            </div>
            
            {/* Show generated headline preview if available */}
            {item.generatedIdea && (
                <div className="text-xs bg-gray-100 p-2 rounded text-gray-600 italic border-l-2 border-brand">
                    "{item.generatedIdea.copy.headline}"
                </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-2 bg-gray-50 text-xs text-center text-gray-400 border-t">
        A renderização pode levar até 30s por imagem.
      </div>
    </div>
  );
};

export default CreativeBatchQueue;