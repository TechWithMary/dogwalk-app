import React, { useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { Dog, ArrowRight, Loader2, AlertTriangle, MapPin, Crosshair } from 'lucide-react';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '../lib/mapsConfig';

const libraries = ['places'];

const OnboardingOwner = () => {
const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [petData, setPetData] = useState({ name: '', breed: '', energy_level: 'medium', age_years: '' });
  const [otherBreed, setOtherBreed] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const autoCompleteRef = useRef(null);

  const breeds = [
    "Criollo / Mezcla", "Labrador Retriever", "Golden Retriever", "Pastor Alemán", 
    "Bulldog Francés", "Bulldog Inglés", "Beagle", "Poodle", "Rottweiler", 
    "Yorkshire Terrier", "Boxer", "Dachshund", "Siberian Husky", "Chihuahua", 
    "Border Collie", "Pug", "Shih Tzu", "Cocker Spaniel", "Pitbull", "Doberman",
    "Gran Danés", "Maltés", "Pomerania", "Basset Hound", "Pastor Belga", 
    "Dogo Argentino", "Mastín", "San Bernardo", "Otro"
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

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) return toast.error("GPS no soportado");
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
          if (status === "OK" && results[0]) {
            setAddress(results[0].formatted_address);
            setCoords({ lat: latitude, lng: longitude });
          }
          setGettingLocation(false);
        });
      },
      () => {
        toast.error("Activa el GPS");
        setGettingLocation(false);
      }
    );
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
      toast.error('Selecciona una dirección usando el buscador o GPS');
      return;
    }

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
      
      const cleanFirstName = profile?.first_name && !invalidTerms.includes(profile.first_name.toLowerCase()) 
        ? profile.first_name 
        : (user.user_metadata?.first_name || user.user_metadata?.name?.split(' ')[0] || '');
        
      const cleanLastName = profile?.last_name && !invalidTerms.includes(profile.last_name.toLowerCase()) 
        ? profile.last_name 
        : (user.user_metadata?.last_name || '');

      const finalBreed = petData.breed === 'Otro' ? otherBreed : petData.breed;
      
      if (petData.breed === 'Otro' && !otherBreed.trim()) {
        toast.error('Especifica la raza de tu mascota');
        return;
      }

      const { error: petError } = await supabase.from('pets').insert([
        { 
          name: petData.name,
          breed: finalBreed,
          energy_level: petData.energy_level,
          age_years: petData.age_years ? parseInt(petData.age_years) : null,
          owner_id: user.id,
          is_active: true
        }
      ]);
      
      if (petError) throw petError;
      
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          first_name: cleanFirstName || 'Dueño',
          last_name: cleanLastName || '',
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
      <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-6 font-sans">
      <div className="max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
            <div className="mx-auto bg-emerald-100 p-4 rounded-full mb-4 w-fit animate-in zoom-in duration-500">
              <Dog className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">¡Bienvenido!</h1>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Configura el perfil de tu manada</p>
        </div>

        <form onSubmit={handleCompleteProfile} className="space-y-5">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-2 block tracking-widest">¿Dónde vive tu mascota? *</label>
            <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
                <Autocomplete
                  onLoad={onLoad}
                  onPlaceChanged={onPlaceChanged}
                  options={{ componentRestrictions: { country: "co" } }}
                >
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Escribe tu dirección..."
                    className="w-full h-14 pl-12 pr-12 bg-white border-2 border-gray-100 rounded-2xl focus:border-emerald-500 transition-all outline-none font-bold text-sm shadow-sm text-gray-800"
                    required
                  />
                </Autocomplete>
                <button type="button" onClick={handleCurrentLocation} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 z-10 active:scale-90 transition-all">
                   {gettingLocation ? <Loader2 className="animate-spin w-5 h-5" /> : <Crosshair size={20} />}
                </button>
            </div>
          </div>

          <div className="bg-gray-200 h-[1px] w-full my-6 opacity-50"></div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-2 block tracking-widest">Nombre de tu mascota *</label>
            <input
              type="text"
              name="name"
              value={petData.name}
              onChange={handleInputChange}
              className="w-full h-14 px-5 bg-white border-2 border-gray-100 rounded-2xl focus:border-emerald-500 outline-none font-bold shadow-sm text-gray-800"
              placeholder="Ej. Bruno"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-2 block tracking-widest">Raza *</label>
                <select name="breed" value={petData.breed} onChange={handleInputChange} className="w-full h-14 px-3 bg-white border-2 border-gray-100 rounded-2xl focus:border-emerald-500 outline-none font-bold text-xs shadow-sm appearance-none text-gray-800" required>
                    <option value="">Selecciona</option>
                    {breeds.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-2 block tracking-widest">Edad (Años)</label>
                <input
                  type="number"
                  name="age_years"
                  value={petData.age_years}
                  onChange={handleInputChange}
                  className="w-full h-14 px-5 bg-white border-2 border-gray-100 rounded-2xl focus:border-emerald-500 outline-none font-bold shadow-sm text-gray-800"
                  placeholder="0"
                />
              </div>
          </div>

          {petData.breed === 'Otro' && (
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-2 block tracking-widest">Especifica la raza *</label>
              <input
                type="text"
                value={otherBreed}
                onChange={(e) => setOtherBreed(e.target.value)}
                className="w-full h-14 px-5 bg-white border-2 border-gray-100 rounded-2xl focus:border-emerald-500 outline-none font-bold shadow-sm text-gray-800"
                placeholder="Escribe la raza"
                required
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-2 block tracking-widest">Nivel de Energía</label>
            <select name="energy_level" value={petData.energy_level} onChange={handleInputChange} className="w-full h-14 px-3 bg-white border-2 border-gray-100 rounded-2xl focus:border-emerald-500 outline-none font-bold text-xs shadow-sm text-gray-800">
                <option value="low">Baja - Tranquilo</option>
                <option value="medium">Media - Activo</option>
                <option value="high">Alta - Muy energético</option>
            </select>
          </div>

          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800">
            <AlertTriangle size={18} className="shrink-0 text-emerald-600" />
            <p className="text-[10px] font-black uppercase leading-tight tracking-tight">Es obligatorio que tu mascota tenga sus vacunas al día para usar el servicio.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-16 flex justify-center items-center gap-2 bg-[#13ec13] text-black font-black rounded-[24px] shadow-xl shadow-emerald-200 active:scale-[0.97] transition-all mt-4 uppercase text-xs tracking-[0.2em]"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Finalizar Registro'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OnboardingOwner;