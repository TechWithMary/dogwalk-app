import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Check, X, Loader2, Shield, User, FileText, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminVerifications = () => {
  const [walkers, setWalkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchPendingWalkers();
  }, []);

  const fetchPendingWalkers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('walkers')
        .select(`
          *,
          user_profiles (
            first_name,
            last_name,
            phone
          )
        `)
        .eq('overall_verification_status', 'pending');

      if (error) throw error;
      setWalkers(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Error cargando solicitudes");
    } finally {
      setLoading(false);
    }
  };
  const handleVerification = async (walkerId, status, userId) => {
    if (!confirm(`¿Estás seguro de ${status === 'approved' ? 'APROBAR' : 'RECHAZAR'} a este paseador?`)) return;

    setProcessingId(walkerId);
    try {
      const { error } = await supabase
        .from('walkers')
        .update({ overall_verification_status: status })
        .eq('id', walkerId);

      if (error) throw error;

      if (status === 'approved') {
         toast.success("¡Paseador aprobado exitosamente!");
      } else {
         toast.success("Paseador rechazado.");
      }

      fetchPendingWalkers();

    } catch (error) {
      console.error(error);
      toast.error("Error de base de datos: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };
  
  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-emerald-500 w-10 h-10" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 p-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-emerald-100 p-3 rounded-xl">
            <Shield className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
            <h1 className="text-2xl font-black text-gray-900">Verificaciones</h1>
            <p className="text-gray-400 text-sm">Validar documentos pendientes</p>
        </div>
      </div>

      {walkers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-400">Todo al día</h3>
          <p className="text-xs text-gray-300">No hay solicitudes pendientes</p>
        </div>
      ) : (
        <div className="space-y-6">
          {walkers.map((walker) => (
            <div key={walker.id} className="bg-white rounded-3xl shadow-lg shadow-gray-200/50 overflow-hidden border border-gray-100">
              <div className="p-6 border-b border-gray-50">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                            {walker.name ? walker.name[0] : <User />}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-gray-900">{walker.name || 'Sin Nombre'}</h3>
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                                <Smartphone size={14}/> {walker.user_profiles?.phone || 'Sin teléfono'}
                            </p>
                        </div>
                    </div>
                    <span className="bg-orange-100 text-orange-600 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider">
                        Pendiente
                    </span>
                </div>
              </div>

              <div className="p-6 bg-gray-50/50 space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Documentos Adjuntos</h4>
                
                <div className="grid grid-cols-2 gap-4">
                    <DocumentPreview label="Cédula (Frente)" url={walker.id_document_front} isSelfie={false} isDoc={false} />
                    <DocumentPreview label="Cédula (Reverso)" url={walker.id_document_back} isSelfie={false} isDoc={false} />
                    <DocumentPreview label="Selfie" url={walker.selfie_with_id} isSelfie={true} isDoc={false} />
                    <DocumentPreview label="Antecedentes" url={walker.criminal_record_cert} isSelfie={false} isDoc={true} />
                </div>
              </div>

              <div className="p-4 bg-white border-t border-gray-100 flex gap-3">
                <button 
                    onClick={() => handleVerification(walker.id, 'rejected', walker.user_id)}
                    disabled={processingId === walker.id}
                    className="flex-1 py-3 rounded-xl border-2 border-red-100 text-red-500 font-bold hover:bg-red-50 transition-colors flex justify-center items-center gap-2"
                >
                    <X size={18} /> Rechazar
                </button>
                <button 
                    onClick={() => handleVerification(walker.id, 'approved', walker.user_id)}
                    disabled={processingId === walker.id}
                    className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-200 active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                    {processingId === walker.id ? <Loader2 className="animate-spin" /> : <><Check size={18} /> Aprobar</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DocumentPreview = ({ label, url, isSelfie, isDoc }) => {
  const [signedUrl, setSignedUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUrl = async () => {
      if (!url) {
        setLoading(false);
        return;
      }
      if (url.startsWith('http')) {
        setSignedUrl(url);
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.storage
          .from('walker_documents')
          .createSignedUrl(url, 3600);
        if (error) throw error;
        if (data) setSignedUrl(data.signedUrl);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchUrl();
  }, [url]);

  const isPdf = isDoc || (url && url.toLowerCase().includes('.pdf')) || (signedUrl && signedUrl.toLowerCase().includes('.pdf'));

  return (
    <div className={`relative group overflow-hidden rounded-xl border border-gray-200 bg-white ${isSelfie ? 'row-span-2 aspect-[3/4]' : 'aspect-video'}`}>
        {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-emerald-500">
                <Loader2 className="animate-spin w-6 h-6 mb-2" />
                <span className="text-[10px] font-bold">Cargando...</span>
            </div>
        ) : signedUrl ? (
            <a href={signedUrl} target="_blank" rel="noreferrer" className="block w-full h-full">
                {isPdf ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 hover:text-emerald-500 transition-colors bg-gray-50">
                        <FileText size={32} />
                        <span className="text-[10px] font-bold mt-2">Abrir PDF</span>
                    </div>
                ) : (
                    <img src={signedUrl} alt={label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 backdrop-blur-sm">
                    <p className="text-[10px] text-white font-bold text-center">{label}</p>
                </div>
            </a>
        ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-300">
                <X size={24} />
                <span className="text-[10px] mt-1">No subido</span>
                <p className="absolute bottom-2 text-[10px] text-gray-400 font-bold">{label}</p>
            </div>
        )}
    </div>
  );
};

export default AdminVerifications;