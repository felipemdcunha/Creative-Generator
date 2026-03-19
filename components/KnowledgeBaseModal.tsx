import React, { useState, useEffect } from 'react';
import { CreativeSet } from '../types';
import { supabase } from '../lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  creativeSet: CreativeSet;
  onUpdate: (updatedSet: CreativeSet) => void;
}

const KnowledgeBaseModal: React.FC<Props> = ({ isOpen, onClose, creativeSet, onUpdate }) => {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (creativeSet) {
      setText(creativeSet.knowledge_base_text || '');
    }
  }, [creativeSet, isOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('creative_sets')
        .update({ knowledge_base_text: text })
        .eq('id', creativeSet.id)
        .select()
        .single();

      if (error) throw error;

      onUpdate(data as CreativeSet);
      onClose();
    } catch (error) {
      console.error('Error saving knowledge base:', error);
      alert('Erro ao salvar base de conhecimento.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Base de Conhecimento Estratégica</h2>
            <p className="text-sm text-gray-500">Informações cruciais que a IA deve consultar antes de criar.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 flex-1 flex flex-col">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Contexto do Produto, Diferenciais e Argumentos de Venda</label>
          <p className="text-xs text-gray-500 mb-2">Cole aqui detalhes do memorial descritivo, diferenciais competitivos, regras de desconto, informações da região, ou qualquer dado que um copywriter humano precisaria saber.</p>
          <textarea
            className="flex-1 w-full border border-gray-300 rounded-lg p-4 text-sm focus:ring-2 focus:ring-brand focus:border-transparent outline-none resize-none font-mono leading-relaxed"
            placeholder="Ex: O empreendimento fica a 200m do metrô. Acabamento em mármore travertino. O financiamento é direto com a construtora em 120x..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          ></textarea>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3 rounded-b-xl">
          <button onClick={onClose} disabled={saving} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-5 py-2 bg-brand hover:bg-brand-hover text-white font-medium rounded-lg shadow-lg flex items-center"
          >
            {saving ? 'Salvando...' : 'Salvar Base de Conhecimento'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseModal;