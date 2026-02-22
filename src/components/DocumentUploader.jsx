import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Camera, Upload, X, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const DocumentUploader = ({ type, label, description, value, onChange, cameraMode = 'environment' }) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(value); 

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande (Máx 5MB)');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      
     
      const { error: uploadError, data } = await supabase.storage
        .from('walker_documents') 
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      
      onChange(data.path); 
      
      
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('walker_documents')
        .createSignedUrl(data.path, 60); 

      if (signedUrlData) {
          setPreviewUrl(signedUrlData.signedUrl);
      }

      toast.success('Documento subido correctamente');

    } catch (error) {
      console.error('Error subiendo documento:', error);
      toast.error('Error al subir el documento de seguridad.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onChange(null);
    setPreviewUrl(null);
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 transition-all hover:border-emerald-500/50">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-gray-200">{label}</h3>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
        {value && <CheckCircle className="text-emerald-500 w-5 h-5" />}
      </div>

      {previewUrl || value ? (
        <div className="relative w-full h-40 bg-gray-900 rounded-lg overflow-hidden group">
          
          <img src={previewUrl || (typeof value === 'string' && value.startsWith('http') ? value : '')} alt={label} className="w-full h-full object-cover" />
          <button 
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="relative">
            <input 
                type="file" 
                accept="image/*,application/pdf" 
                capture={cameraMode}
                onChange={handleFileChange}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className={`border-2 border-dashed ${uploading ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700'} rounded-lg h-32 flex flex-col items-center justify-center transition-colors`}>
                {uploading ? (
                    <div className="flex flex-col items-center text-emerald-500">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <span className="text-xs font-bold">Subiendo...</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-gray-400">
                        <div className="flex gap-2 mb-2">
                            <Camera className="w-6 h-6" />
                            <Upload className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-medium">Toca para subir documento</span>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUploader;