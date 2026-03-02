import React, { useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { Dog, ArrowRight, Loader2, AlertTriangle, MapPin } from 'lucide-react';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';

const libraries = ['places'];

const OnboardingOwner = () => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: libraries
  });

  const [petData, setPetData] = useState({ name: '', breed: '', energy_level: 'medium' });
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [loading, setLoading] = useState(false);
  const autoCompleteRef = useRef(null);

  const breeds = [
    "Criollo / Mezcla", "Labrador Retriever", "Golden Retriever", "Pastor Alemán", 
    "Bulldog Francés", "Beagle", "Poodle", "Rottweiler", "Yorkshire Terrier", 
    "Boxer", "Dachshund", "Siberian Husky", "Chihuahua", "Border Collie", "Pug", "Otro"
  ];

  const onLoad = (autocomplete) => {
    autoCompleteRef.current = autocomplete;
  };

  const onPlaceChanged = () => {
    if (autoCompleteRef.current !== null) {
      const place = autoCompleteRef.current.getPlace();
      if (place.geometry) {
        setAddress(place.formatted_address);
        setCoords({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPetData(prev => ({ ...prev, [name]: value }));
  };

  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    if (!petData.name.trim() || !petData.breed) {
      toast.error('Completa los datos de tu mascota');
      return;
    }
    
    if (!coords.lat || !coords.lng) {
      toast.error('Selecciona una dirección de la lista sugerida');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no encontrado');

      const { error: petError } = await supabase.from('pets').insert([
        { 
          name: petData.name,
          breed: petData.breed,
          energy_level: petData.energy_level,
          owner_id: user.id 
        }
      ]);
      
      if (petError) throw petError;
      
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          address: address,
          lat: coords.lat,
          lng: coords.lng,
          is_profile_complete: true
        })
        .eq('user_id', user.id);
        
      if (profileError) throw profileError;

      toast.success('¡Registro completado!');
      window.location.href = '/home';

    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-6">
      <div className="max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
            <div className="mx-auto bg-emerald-100 p-4 rounded-full mb-4 w-fit">
              <Dog className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-gray-800">¡Bienvenido!</h1>
            <p className="text-gray-500 text-sm">Configura tu perfil para empezar.</p>
        </div>

        <form onSubmit={handleCompleteProfile} className="space-y-5 text-left">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">¿Dónde vive tu mascota?</label>
            <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
                <Autocomplete
                  onLoad={onLoad}
                  onPlaceChanged={onPlaceChanged}
                  options={{ componentRestrictions: { country: "co" } }}
                >
                  <input
                    type="text"
                    placeholder="Busca tu dirección..."
                    className="w-full h-12 pl-12 pr-4 bg-white border-2 border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 transition outline-none font-medium"
                    required
                  />
                </Autocomplete>
            </div>
          </div>

          <div className="bg-gray-100 h-[1px] w-full my-6"></div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">Nombre de tu mascota</label>
            <input
              type="text"
              name="name"
              value={petData.name}
              onChange={handleInputChange}
              className="w-full h-12 px-4 bg-white border-2 border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
              placeholder="Ej. Bruno"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">Raza</label>
                <select name="breed" value={petData.breed} onChange={handleInputChange} className="w-full h-12 px-3 bg-white border-2 border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm">
                    <option value="">Selecciona</option>
                    {breeds.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">Nivel de Energía</label>
                <select name="energy_level" value={petData.energy_level} onChange={handleInputChange} className="w-full h-12 px-3 bg-white border-2 border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm">
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                </select>
              </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-100 rounded-2xl text-orange-700">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p className="text-[10px] font-bold uppercase leading-tight">Solo aceptamos mascotas con vacunas completas.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 flex justify-center items-center gap-2 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 active:scale-[0.98] transition-all mt-4"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Finalizar Registro'}
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OnboardingOwner;