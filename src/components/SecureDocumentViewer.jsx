import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; 
import { Loader2, FileText } from 'lucide-react';

const SecureDocumentViewer = ({ path, altText = "Documento" }) => {
  const [signedUrl, setSignedUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUrl = async () => {
      if (!path) {
        setLoading(false);
        return;
      }

      
      if (path.startsWith('http')) {
        setSignedUrl(path);
        setLoading(false);
        return;
      }

      try {
       
        const { data, error } = await supabase.storage
          .from('walker_documents')
          .createSignedUrl(path, 3600);

        if (error) throw error;
        if (data) setSignedUrl(data.signedUrl);
      } catch (error) {
        console.error('Error cargando documento seguro:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUrl();
  }, [path]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-gray-800 rounded-lg border border-gray-700">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mb-2" />
        <span className="text-xs text-gray-400">Desencriptando...</span>
      </div>
    );
  }
  
  if (!signedUrl) {
    return <div className="text-gray-500 text-sm italic">Documento no disponible</div>;
  }

  
  const isPdf = path.toLowerCase().includes('.pdf') || signedUrl.toLowerCase().includes('.pdf');

  if (isPdf) {
    return (
      <a 
        href={signedUrl} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-emerald-500 px-4 py-3 rounded-lg transition-colors border border-gray-700 w-fit"
      >
        <FileText size={20} />
        <span className="text-sm font-medium">Ver documento PDF</span>
      </a>
    );
  }

  // Si es una foto normal (cédula, selfie), la mostramos
  return (
    <div className="rounded-lg overflow-hidden border border-gray-700 bg-gray-900">
      <img 
        src={signedUrl} 
        alt={altText} 
        className="w-full h-auto object-contain max-h-64" 
      />
    </div>
  );
};

export default SecureDocumentViewer;