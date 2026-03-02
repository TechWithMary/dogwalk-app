import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Phone, MapPin, Calendar as CalendarIcon, ArrowRight, Loader2, CreditCard, User, FileText, Briefcase, Shield, CheckCircle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ServiceAreaManager from '../components/ServiceAreaManager';
import AvailabilityManager from '../components/AvailabilityManager';
import DocumentUploader from '../components/DocumentUploader';
import toast from 'react-hot-toast';

const calculateAge = (birthday) => {
  if (!birthday) return null;
  const ageDifMs = Date.now() - new Date(birthday).getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const OnboardingWalker = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [walkerId, setWalkerId] = useState(null);

  const [formData, setFormData] = useState({
    phone: '',
    id_number: '',
    date_of_birth: '',
    address: '',
    bio: '',
    experience_years: '',
    has_own_dogs: false,
    price: 30000,
    service_radius_km: 3,
    bank_account_type: 'nequi',
    bank_account_number: '',
    bank_name: '',
    id_document_front: null,
    id_document_back: null,
    criminal_record_cert: null,
    selfie_with_id: null
  });

  useEffect(() => {
    const initData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: walker } = await supabase.from('walkers').select('*').eq('user_id', user.id).maybeSingle();
        if (walker) {
          setWalkerId(walker.id);
          setFormData(prev => ({ ...prev, bio: walker.bio || '', price: walker.price || 30000 }));
        }

        const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle();
        if (profile) {
          setFormData(prev => ({
            ...prev,
            phone: profile.phone || '',
            id_number: profile.id_number || '',
            date_of_birth: profile.date_of_birth || '',
            address: profile.address || '',
            experience_years: profile.experience_years || '',
            has_own_dogs: profile.has_own_dogs || false,
            bank_account_type: profile.bank_account_type || 'nequi',
            bank_account_number: profile.bank_account_number || '',
            bank_name: profile.bank_name || ''
          }));
        }
      } catch (error) {
        console.error("Error cargando datos", error);
      }
    };
    initData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no encontrado');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle(); 
        
      const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
      const realName = (profile && profile.first_name) 
      ? `${profile.first_name} ${profile.last_name}`.trim() 
      : metaName || ''; 

      const profileData = {
        user_id: user.id, 
        phone: formData.phone,
        id_number: formData.id_number,
        date_of_birth: formData.date_of_birth,
        age: calculateAge(formData.date_of_birth),
        address: formData.address,
        experience_years: formData.experience_years ? parseInt(formData.experience_years) : 0,
        has_own_dogs: formData.has_own_dogs,
        bank_account_type: formData.bank_account_type,
        bank_account_number: formData.bank_account_number,
        bank_name: formData.bank_name,
        first_name: profile?.first_name || 'Usuario', 
        last_name: profile?.last_name || 'Nuevo',
        role: 'walker'
      };

      const cleanProfileData = Object.fromEntries(
        Object.entries(profileData).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
      );
      
      const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert(cleanProfileData, { onConflict: 'user_id' });

      if (profileError) throw profileError;

      const walkerData = {
        user_id: user.id,
        name: realName || 'Paseador Nuevo',
        bio: formData.bio,
        price: parseInt(formData.price || 30000),
        service_radius_km: parseInt(formData.service_radius_km || 3),
        id_document_front: formData.id_document_front,
        id_document_back: formData.id_document_back,
        criminal_record_cert: formData.criminal_record_cert,
        selfie_with_id: formData.selfie_with_id,
      };

      const cleanWalkerData = Object.fromEntries(
        Object.entries(walkerData).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
      );

      const { data: updatedWalker, error: walkerError } = await supabase
        .from('walkers')
        .upsert(cleanWalkerData, { onConflict: 'user_id' })
        .select()
        .single();

      if (walkerError) throw walkerError;
      setWalkerId(updatedWalker.id);

      setStep(prev => prev + 1);
      window.scrollTo(0, 0);

    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('user_profiles').update({ is_profile_complete: true }).eq('user_id', user.id);
      toast.success('¡Perfil completado!');
      navigate('/walker-home');
    } catch (error) {
      toast.error("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const ProgressBar = () => (
    <div className="mb-8 mt-4">
      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>Paso {step} de 7</span>
        <span>{Math.round((step / 7) * 100)}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(step / 7) * 100}%` }}></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 pb-20">
      <ProgressBar />

      {step === 1 && (
        <div className="flex flex-col justify-center max-w-md mx-auto animate-fade-in-up">
          <div className="text-center mb-8"><User className="w-16 h-16 mx-auto mb-4 text-emerald-500" /><h1 className="text-3xl font-bold mb-2">Datos Personales</h1></div>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium mb-2">Teléfono *</label><div className="relative"><Phone className="absolute left-3 top-3 text-gray-400 w-5 h-5" /><input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full pl-11 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl" required /></div></div>
            <div><label className="block text-sm font-medium mb-2">Cédula *</label><input type="number" name="id_number" value={formData.id_number} onChange={handleChange} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl" required /></div>
            <div><label className="block text-sm font-medium mb-2">Fecha de Nacimiento *</label><div className="relative"><CalendarIcon className="absolute left-3 top-3 text-gray-400 w-5 h-5" /><input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className="w-full pl-11 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl" required /></div></div>
            <div><label className="block text-sm font-medium mb-2">Dirección *</label><div className="relative"><MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" /><input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full pl-11 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl" required /></div></div>
            <button onClick={() => { if (!formData.phone || !formData.id_number || !formData.date_of_birth || !formData.address) { toast.error('Completa los campos'); return; } handleNext(); }} disabled={loading} className="w-full bg-emerald-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <>Continuar <ArrowRight /></>}</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-fade-in-up">
          <div className="text-center mb-8"><Shield className="w-16 h-16 mx-auto mb-4 text-emerald-500" /><h1 className="text-3xl font-bold mb-2">Verificación</h1></div>
          <div className="space-y-3">
            <DocumentUploader type="id_front" label="Cédula (Frente)" value={formData.id_document_front} onChange={(url) => setFormData(p => ({...p, id_document_front: url}))} cameraMode="environment" />
            <DocumentUploader type="id_back" label="Cédula (Reverso)" value={formData.id_document_back} onChange={(url) => setFormData(p => ({...p, id_document_back: url}))} cameraMode="environment" />
            <DocumentUploader type="selfie" label="Selfie con Cédula" value={formData.selfie_with_id} onChange={(url) => setFormData(p => ({...p, selfie_with_id: url}))} cameraMode="user" />
            <DocumentUploader type="criminal_record" label="Antecedentes" value={formData.criminal_record_cert} onChange={(url) => setFormData(p => ({...p, criminal_record_cert: url}))} cameraMode="environment" />
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep(1)} className="flex-1 bg-gray-800 py-4 rounded-xl font-bold">Atrás</button>
            <button onClick={() => { if (!formData.id_document_front) { toast.error('Sube los documentos'); return; } handleNext(); }} disabled={loading} className="flex-1 bg-emerald-500 py-4 rounded-xl font-bold">{loading ? <Loader2 className="animate-spin" /> : 'Continuar'}</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="animate-fade-in-up">
          <div className="text-center mb-8"><Briefcase className="w-16 h-16 mx-auto mb-4 text-emerald-500" /><h1 className="text-3xl font-bold mb-2">Tu Experiencia</h1></div>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium mb-2">Bio / Presentación *</label><textarea name="bio" value={formData.bio} onChange={handleChange} rows="4" className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl outline-none" required></textarea></div>
            <div><label className="block text-sm font-medium mb-2">Años de experiencia *</label><input type="number" name="experience_years" value={formData.experience_years} onChange={handleChange} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl" /></div>
            <div><label className="block text-sm font-medium mb-2">Precio por Paseo (COP)</label><input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl" /></div>
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" name="has_own_dogs" checked={formData.has_own_dogs} onChange={handleChange} className="w-5 h-5" /><span>Tengo perros propios</span></label></div>
            <div className="flex gap-3 mt-4"><button onClick={() => setStep(2)} className="flex-1 bg-gray-800 py-4 rounded-xl font-bold">Atrás</button><button onClick={handleNext} disabled={loading} className="flex-1 bg-emerald-500 py-4 rounded-xl font-bold">{loading ? <Loader2 className="animate-spin" /> : 'Continuar'}</button></div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="animate-fade-in-up">
          <div className="text-center mb-8"><CreditCard className="w-16 h-16 mx-auto mb-4 text-emerald-500" /><h1 className="text-3xl font-bold mb-2">Datos de Pago</h1></div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3"><button onClick={() => setFormData(p => ({...p, bank_account_type: 'nequi'}))} className={`p-4 rounded-xl border-2 font-bold ${formData.bank_account_type === 'nequi' ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-700 bg-gray-800'}`}>Nequi</button><button onClick={() => setFormData(p => ({...p, bank_account_type: 'banco'}))} className={`p-4 rounded-xl border-2 font-bold ${formData.bank_account_type === 'banco' ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-700 bg-gray-800'}`}>Banco</button></div>
            <div><label className="block text-sm font-medium mb-2">Número de Cuenta / Celular *</label><input type="tel" name="bank_account_number" value={formData.bank_account_number} onChange={handleChange} className="w-full px-4 py-3 bg-gray-800 border-gray-700 rounded-xl" /></div>
            <div className="flex gap-3 mt-6"><button onClick={() => setStep(3)} className="flex-1 bg-gray-800 py-4 rounded-xl font-bold">Atrás</button><button onClick={handleNext} disabled={loading} className="flex-1 bg-emerald-500 py-4 rounded-xl font-bold">Continuar</button></div>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col h-full animate-fade-in-up">
          <div className="text-center mb-6"><MapPin className="w-16 h-16 mx-auto mb-4 text-emerald-500" /><h1 className="text-3xl font-bold mb-2">Tu Zona</h1></div>
          <div className="flex-1 mb-6">{walkerId && <ServiceAreaManager walkerId={walkerId} onClose={() => setStep(6)} />}</div>
          <button onClick={() => setStep(4)} className="w-full bg-gray-800 py-4 rounded-xl font-bold">Atrás</button>
        </div>
      )}

      {step === 6 && (
        <div className="flex flex-col h-full animate-fade-in-up">
          <div className="text-center mb-6"><CalendarIcon className="w-16 h-16 mx-auto mb-4 text-emerald-500" /><h1 className="text-3xl font-bold mb-2">Tu Horario</h1></div>
          <div className="flex-1 mb-6">{walkerId && <AvailabilityManager walkerId={walkerId} onClose={() => setStep(7)} />}</div>
          <button onClick={() => setStep(5)} className="w-full bg-gray-800 py-4 rounded-xl font-bold">Atrás</button>
        </div>
      )}

      {step === 7 && (
        <div className="flex flex-col justify-center max-w-md mx-auto animate-fade-in-up text-center">
          <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce"><CheckCircle className="w-12 h-12 text-white" /></div>
          <h1 className="text-3xl font-bold mb-2">¡Todo Listo!</h1>
          <button onClick={handleComplete} disabled={loading} className="w-full bg-emerald-500 py-4 rounded-xl font-bold">{loading ? <Loader2 className="animate-spin" /> : 'Ir a mi Panel'}</button>
        </div>
      )}
    </div>
  );
};

export default OnboardingWalker;