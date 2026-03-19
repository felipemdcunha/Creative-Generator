import React, { useState, useEffect } from 'react';
import { CreativeSet } from '../types';
import { supabase } from '../lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  creativeSet: CreativeSet;
  onUpdate: (updatedSet: CreativeSet) => void;
}

const BrandSettingsModal: React.FC<Props> = ({ isOpen, onClose, creativeSet, onUpdate }) => {
  const [colors, setColors] = useState({
    primary: '#000000',
    secondary: '#000000',
    tertiary: '#000000',
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  
  // Visual References
  const [visualReferences, setVisualReferences] = useState<string[]>([]);
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refPreviews, setRefPreviews] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (creativeSet) {
      if (creativeSet.brand_colors) {
        setColors({
          primary: creativeSet.brand_colors.primary || '#000000',
          secondary: creativeSet.brand_colors.secondary || '#000000',
          tertiary: creativeSet.brand_colors.tertiary || '#000000',
        });
      }
      setLogoUrl(creativeSet.additional_logo_url || null);
      setVisualReferences(creativeSet.visual_references || []);
    }
  }, [creativeSet, isOpen]);

  const handleColorChange = (key: 'primary' | 'secondary' | 'tertiary', value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleRefFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      setRefFiles(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(f => URL.createObjectURL(f));
      setRefPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeExistingRef = (urlToRemove: string) => {
      setVisualReferences(prev => prev.filter(url => url !== urlToRemove));
  };

  const removeNewRef = (index: number) => {
      setRefFiles(prev => prev.filter((_, i) => i !== index));
      setRefPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let finalLogoUrl = logoUrl;
      let finalVisualRefs = [...visualReferences];

      // 1. Upload Logo if selected
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `logo-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('brand-assets').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('brand-assets').getPublicUrl(fileName);
        finalLogoUrl = data.publicUrl;
      }

      // 2. Upload New Visual References
      for (const refFile of refFiles) {
          const fileExt = refFile.name.split('.').pop();
          const fileName = `ref-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('brand-assets').upload(fileName, refFile);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('brand-assets').getPublicUrl(fileName);
          finalVisualRefs.push(data.publicUrl);
      }

      // 3. Update Database
      const updatedData = {
        brand_colors: colors,
        additional_logo_url: finalLogoUrl,
        visual_references: finalVisualRefs
      };

      const { data, error } = await supabase
        .from('creative_sets')
        .update(updatedData)
        .eq('id', creativeSet.id)
        .select()
        .single();

      if (error) throw error;

      onUpdate(data as CreativeSet);
      
      // Clear temp files
      setFile(null);
      setRefFiles([]);
      setRefPreviews([]);
      
      onClose();
    } catch (error) {
      console.error('Error saving brand settings:', error);
      alert('Erro ao salvar configurações da marca.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h2 className="text-xl font-bold text-slate-800">Identidade Visual e Referências</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Colors */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 border-b pb-2">1. Paleta de Cores</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                <input 
                  type="color" 
                  value={colors.primary} 
                  onChange={(e) => handleColorChange('primary', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                />
                <div className="flex-1">
                  <label className="block text-[10px] uppercase text-gray-500 font-bold">Primária</label>
                  <input type="text" value={colors.primary} onChange={(e) => handleColorChange('primary', e.target.value)} className="w-full text-xs bg-transparent border-none focus:ring-0 p-0" />
                </div>
              </div>
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                <input 
                  type="color" 
                  value={colors.secondary} 
                  onChange={(e) => handleColorChange('secondary', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                />
                <div className="flex-1">
                    <label className="block text-[10px] uppercase text-gray-500 font-bold">Secundária</label>
                    <input type="text" value={colors.secondary} onChange={(e) => handleColorChange('secondary', e.target.value)} className="w-full text-xs bg-transparent border-none focus:ring-0 p-0" />
                </div>
              </div>
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                <input 
                  type="color" 
                  value={colors.tertiary} 
                  onChange={(e) => handleColorChange('tertiary', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                />
                <div className="flex-1">
                    <label className="block text-[10px] uppercase text-gray-500 font-bold">Terciária</label>
                    <input type="text" value={colors.tertiary} onChange={(e) => handleColorChange('tertiary', e.target.value)} className="w-full text-xs bg-transparent border-none focus:ring-0 p-0" />
                </div>
              </div>
            </div>
          </div>

          {/* Logo */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 border-b pb-2">2. Logo Adicional</h3>
            <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center border">
                    {file ? (
                        <span className="text-xs text-green-600 font-bold">Novo</span>
                    ) : logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="max-w-full max-h-full p-2 object-contain" />
                    ) : (
                        <span className="text-xs text-gray-400">Vazio</span>
                    )}
                </div>
                <div>
                     <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition shadow-sm">
                        Escolher Arquivo
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                     </label>
                     <p className="text-xs text-gray-400 mt-2">Recomendado: PNG Transparente</p>
                </div>
            </div>
          </div>

          {/* Visual References */}
          <div>
            <div className="flex justify-between items-end border-b pb-2 mb-3">
                <h3 className="text-sm font-bold text-gray-700 uppercase">3. Referências Visuais (Estilo)</h3>
                <span className="text-xs text-gray-400">A IA tentará imitar o estilo destes criativos</span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {/* Existing References */}
                {visualReferences.map((url, idx) => (
                    <div key={`exist-${idx}`} className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border">
                        <img src={url} alt="Ref" className="w-full h-full object-cover" />
                        <button 
                            onClick={() => removeExistingRef(url)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                ))}

                {/* New File Previews */}
                {refPreviews.map((src, idx) => (
                    <div key={`new-${idx}`} className="relative group aspect-square bg-green-50 rounded-lg overflow-hidden border border-green-200">
                        <img src={src} alt="New Ref" className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-xs font-bold text-green-700 bg-white bg-opacity-80 px-2 py-1 rounded">Novo</span>
                        </div>
                         <button 
                            onClick={() => removeNewRef(idx)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-100 transition cursor-pointer"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                ))}

                {/* Upload Button */}
                <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition text-gray-400 hover:text-brand hover:border-brand">
                    <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    <span className="text-xs font-medium">Adicionar</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleRefFilesChange} />
                </label>
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3 rounded-b-xl">
          <button onClick={onClose} disabled={saving} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-5 py-2 bg-brand hover:bg-brand-hover text-white font-medium rounded-lg shadow-lg flex items-center"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BrandSettingsModal;