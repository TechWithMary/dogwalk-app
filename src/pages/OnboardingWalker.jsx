import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Phone, MapPin, Calendar as CalendarIcon, ArrowRight, Loader2, CreditCard, User, FileText, Briefcase, Shield, CheckCircle, Info, Crosshair } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '../lib/mapsConfig';
import ServiceAreaManager from '../components/ServiceAreaManager';
import AvailabilityManager from '../components/AvailabilityManager';
import DocumentUploader from '../components/DocumentUploader';
import toast from 'react-hot-toast';

const libraries = ['places'];

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
  const [gettingLocation, setGettingLocation] = useState(false);
  const autocompleteRef = useRef(null);

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

const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
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

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) return toast.error("GPS no soportado");
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
          if (status === "OK" && results[0]) {
            setFormData(prev => ({ ...prev, address: results[0].formatted_address }));
          }
          setGettingLocation(false);
        });
      },
      () => { toast.error("Activa el GPS"); setGettingLocation(false); }
    );
  };

  const onPlaceChanged = () => {
    const place = autocompleteRef.current.getPlace();
    if (place.formatted_address) {
      setFormData(prev => ({ ...prev, address: place.formatted_address }));
    }
  };

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
        
      const invalidTerms = ['usuario', 'nuevo', 'paseador', 'walker'];
      
      const rawFirstName = profile?.first_name || user.user_metadata?.first_name || user.user_metadata?.full_name?.split(' ')[0] || '';
      const rawLastName = profile?.last_name || user.user_metadata?.last_name || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '';
      
      const cleanFirstName = rawFirstName && !invalidTerms.includes(rawFirstName.toLowerCase()) ? rawFirstName : '';
      const cleanLastName = rawLastName && !invalidTerms.includes(rawLastName.toLowerCase()) ? rawLastName : '';
      
      const realName = cleanFirstName && cleanLastName 
        ? `${cleanFirstName} ${cleanLastName}`.trim() 
        : cleanFirstName || 'Paseador';

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
        first_name: cleanFirstName || 'Paseador', 
        last_name: cleanLastName || '',
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
        name: realName,
        bio: formData.bio,
        price: parseInt(formData.price || 30000),
        service_radius_km: parseInt(formData.service_radius_km || 3),
        id_document_front: formData.id_document_front,
        id_document_back: formData.id_document_back,
        criminal_record_cert: formData.criminal_record_cert,
        selfie_with_id: formData.selfie_with_id,
      };

      const { data: updatedWalker, error: walkerError } = await supabase
        .from('walkers')
        .upsert(walkerData, { onConflict: 'user_id' })
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
        <div className="bg-[#13ec13] h-2 rounded-full transition-all duration-300" style={{ width: `${(step / 7) * 100}%` }}></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 pb-20 font-sans">
      <ProgressBar />

      {step === 1 && (
        <div className="flex flex-col justify-center max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center mb-8">
            <User className="w-16 h-16 mx-auto mb-4 text-[#13ec13]" />
            <h1 className="text-3xl font-black mb-2 uppercase tracking-tighter">Datos Personales</h1>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Queremos conocerte mejor</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Teléfono *</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full pl-12 pr-4 py-4 bg-gray-800 border-2 border-transparent focus:border-[#13ec13] rounded-2xl outline-none font-bold transition-all" placeholder="Ej: 312..." required />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Cédula de Ciudadanía *</label>
              <input type="number" name="id_number" value={formData.id_number} onChange={handleChange} className="w-full px-4 py-4 bg-gray-800 border-2 border-transparent focus:border-[#13ec13] rounded-2xl outline-none font-bold transition-all" placeholder="Número de documento" required />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Fecha de Nacimiento *</label>
              <div className="relative">
                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className="w-full pl-12 pr-4 py-4 bg-gray-800 border-2 border-transparent focus:border-[#13ec13] rounded-2xl outline-none font-bold transition-all text-gray-200" required />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Dirección (Usa el GPS) *</label>
              <div className="relative">
                {isLoaded ? (
                  <Autocomplete onLoad={ref => autocompleteRef.current = ref} onPlaceChanged={onPlaceChanged}>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input 
                        type="text" 
                        name="address" 
                        value={formData.address} 
                        onChange={handleChange} 
                        className="w-full pl-12 pr-12 py-4 bg-gray-800 border-2 border-transparent focus:border-[#13ec13] rounded-2xl outline-none font-bold transition-all" 
                        placeholder="Busca tu dirección..." 
                        required 
                      />
                    </div>
                  </Autocomplete>
                ) : (
                  <div className="w-full h-14 bg-gray-800 rounded-2xl animate-pulse" />
                )}
                <button type="button" onClick={handleCurrentLocation} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#13ec13] active:scale-90 transition-all">
                  {gettingLocation ? <Loader2 className="animate-spin w-5 h-5" /> : <Crosshair size={20} />}
                </button>
              </div>
            </div>

            <button onClick={() => { if (!formData.phone || !formData.id_number || !formData.date_of_birth || !formData.address) { toast.error('Por favor completa todos los campos'); return; } handleNext(); }} disabled={loading} className="w-full bg-[#13ec13] text-black py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-6">
              {loading ? <Loader2 className="animate-spin" /> : <>Continuar <ArrowRight size={18}/></>}
            </button>
          </div>
        </div>
      )}

      
      {step === 2 && (
        <div className="animate-in fade-in slide-in-from-right-4">
          <div className="text-center mb-8"><Shield className="w-16 h-16 mx-auto mb-4 text-[#13ec13]" /><h1 className="text-3xl font-black mb-2 uppercase tracking-tighter">Verificación</h1></div>
          <div className="space-y-3">
            <DocumentUploader type="id_front" label="Cédula (Frente)" value={formData.id_document_front} onChange={(url) => setFormData(p => ({...p, id_document_front: url}))} cameraMode="environment" />
            <DocumentUploader type="id_back" label="Cédula (Reverso)" value={formData.id_document_back} onChange={(url) => setFormData(p => ({...p, id_document_back: url}))} cameraMode="environment" />
            <DocumentUploader type="selfie" label="Selfie con Cédula" value={formData.selfie_with_id} onChange={(url) => setFormData(p => ({...p, selfie_with_id: url}))} cameraMode="user" />
            <DocumentUploader type="criminal_record" label="Antecedentes Judiciales" value={formData.criminal_record_cert} onChange={(url) => setFormData(p => ({...p, criminal_record_cert: url}))} cameraMode="environment" />
          </div>
          <div className="flex gap-3 mt-8">
            <button onClick={() => setStep(1)} className="flex-1 bg-gray-800 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest">Atrás</button>
            <button onClick={() => { if (!formData.id_document_front) { toast.error('Sube los documentos para continuar'); return; } handleNext(); }} disabled={loading} className="flex-1 bg-[#13ec13] text-black py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest">{loading ? <Loader2 className="animate-spin" /> : 'Continuar'}</button>
          </div>
        </div>
      )}

      
      {step === 3 && (
        <div className="animate-in fade-in slide-in-from-right-4">
          <div className="text-center mb-8"><Briefcase className="w-16 h-16 mx-auto mb-4 text-[#13ec13]" /><h1 className="text-3xl font-black mb-2 uppercase tracking-tighter">Tu Experiencia</h1></div>
          <div className="space-y-4">
            <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Sobre ti / Biografía *</label><textarea name="bio" value={formData.bio} onChange={handleChange} rows="4" className="w-full px-4 py-4 bg-gray-800 border-2 border-transparent focus:border-[#13ec13] rounded-2xl outline-none font-bold transition-all text-sm" placeholder="Cuéntanos por qué eres el mejor paseador..." required></textarea></div>
            <div className="grid grid-cols-2 gap-4">
               <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Años Exp.</label><input type="number" name="experience_years" value={formData.experience_years} onChange={handleChange} className="w-full px-4 py-4 bg-gray-800 border-2 border-transparent focus:border-[#13ec13] rounded-2xl outline-none font-bold transition-all" placeholder="0" /></div>
               <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Precio x Hora</label><input type="number" name="price" value={String(formData.price)} onChange={handleChange} className="w-full px-4 py-4 bg-gray-800 border-2 border-transparent focus:border-[#13ec13] rounded-2xl outline-none font-bold transition-all" placeholder="30000" /></div>
            </div>
            <div className="bg-gray-800 p-5 rounded-2xl border-2 border-transparent hover:border-gray-700 transition-all"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" name="has_own_dogs" checked={formData.has_own_dogs} onChange={handleChange} className="w-5 h-5 accent-[#13ec13]" /><span className="font-bold text-sm">Tengo mascotas propias</span></label></div>
            <div className="flex gap-3 mt-6"><button onClick={() => setStep(2)} className="flex-1 bg-gray-800 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest">Atrás</button><button onClick={handleNext} disabled={loading} className="flex-1 bg-[#13ec13] text-black py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest">{loading ? <Loader2 className="animate-spin" /> : 'Continuar'}</button></div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="animate-in fade-in slide-in-from-right-4">
          <div className="text-center mb-8"><CreditCard className="w-16 h-16 mx-auto mb-4 text-[#13ec13]" /><h1 className="text-3xl font-black mb-2 uppercase tracking-tighter">Datos de Pago</h1></div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3"><button onClick={() => setFormData(p => ({...p, bank_account_type: 'nequi'}))} className={`p-5 rounded-2xl border-2 font-black text-xs uppercase transition-all ${formData.bank_account_type === 'nequi' ? 'border-[#13ec13] bg-emerald-500/10 text-[#13ec13]' : 'border-gray-700 bg-gray-800 text-gray-500'}`}>Nequi</button><button onClick={() => setFormData(p => ({...p, bank_account_type: 'banco'}))} className={`p-5 rounded-2xl border-2 font-black text-xs uppercase transition-all ${formData.bank_account_type === 'banco' ? 'border-[#13ec13] bg-emerald-500/10 text-[#13ec13]' : 'border-gray-700 bg-gray-800 text-gray-500'}`}>Cuenta Banco</button></div>
            <div><label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Número de Cuenta o Celular *</label><input type="tel" name="bank_account_number" value={formData.bank_account_number} onChange={handleChange} className="w-full px-4 py-4 bg-gray-800 border-2 border-transparent focus:border-[#13ec13] rounded-2xl outline-none font-bold" placeholder="Escribe el número" /></div>
            <div className="flex gap-3 mt-8"><button onClick={() => setStep(3)} className="flex-1 bg-gray-800 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest">Atrás</button><button onClick={handleNext} disabled={loading} className="flex-1 bg-[#13ec13] text-black py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest">Continuar</button></div>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4">
          <div className="text-center mb-6"><MapPin className="w-16 h-16 mx-auto mb-4 text-[#13ec13]" /><h1 className="text-3xl font-black mb-2 uppercase tracking-tighter">Tu Zona</h1><p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">Define tu radio de cobertura</p></div>
          <div className="flex-1 mb-6">{walkerId && <ServiceAreaManager walkerId={walkerId} onClose={() => setStep(6)} />}</div>
          <button onClick={() => setStep(4)} className="w-full bg-gray-800 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest">Atrás</button>
        </div>
      )}

      {step === 6 && (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4">
          <div className="text-center mb-6"><CalendarIcon className="w-16 h-16 mx-auto mb-4 text-[#13ec13]" /><h1 className="text-3xl font-black mb-2 uppercase tracking-tighter">Tu Horario</h1><p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">Selecciona tus días disponibles</p></div>
          <div className="flex-1 mb-6">{walkerId && <AvailabilityManager walkerId={walkerId} onClose={() => setStep(7)} />}</div>
          <button onClick={() => setStep(5)} className="w-full bg-gray-800 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest">Atrás</button>
        </div>
      )}

      {step === 7 && (
        <div className="flex flex-col justify-center max-w-md mx-auto animate-in zoom-in-95 text-center py-10">
          <div className="w-24 h-24 bg-[#13ec13] rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/20"><CheckCircle className="w-12 h-12 text-black" /></div>
          <h1 className="text-4xl font-black mb-4 uppercase tracking-tighter">¡Todo Listo!</h1>
          <p className="text-gray-400 font-bold mb-10">Tu perfil entrará en revisión. Te notificaremos cuando puedas empezar a recibir paseos.</p>
          <button onClick={handleComplete} disabled={loading} className="w-full bg-[#13ec13] text-black py-5 rounded-3xl font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            {loading ? <Loader2 className="animate-spin" /> : 'Ir a mi Panel'}
          </button>
        </div>
      )}
    </div>
  );
};

export default OnboardingWalker;