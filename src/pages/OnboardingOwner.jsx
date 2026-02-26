import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { Dog, ArrowRight, Loader2, AlertTriangle, MapPin } from 'lucide-react';

const OnboardingOwner = () => {
  const [petData, setPetData] = useState({ name: '', breed: '', age_years: '' });
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(null);
  const autoCompleteRef = useRef(null);

  useEffect(() => {
    if (window.google) {
      autoCompleteRef.current = new window.google.maps.places.Autocomplete(
        document.getElementById('address-input'),
        {
          componentRestrictions: { country: "co" },
          fields: ["address_components", "geometry", "formatted_address"],
        }
      );

      autoCompleteRef.current.addListener("place_changed", () => {
        const place = autoCompleteRef.current.getPlace();
        if (place.geometry) {
          setAddress(place.formatted_address);
          setCoords({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      });
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPetData(prev => ({ ...prev, [name]: value }));
  };

  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    if (!petData.name.trim() || !petData.breed || !petData.age_years) {
      toast.error('Completa los datos de tu mascota');
      return;
    }
    if (!coords.lat) {
      toast.error('Por favor selecciona una dirección válida del buscador');
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
          age_years: petData.age_years, 
          owner_id: user.id 
        }
      ]);
      
      if (petError) throw petError;
      
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          address: address,
          lat: coords.lat,
          lat: coords.lng,
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

  return (
    <div className="flex flex-col h-full bg-gray-50 p-6">
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
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    id="address-input"
                    type="text"
                    placeholder="Busca tu dirección..."
                    className="w-full h-12 pl-12 pr-4 bg-white border-2 border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 transition outline-none font-medium"
                    required
                />
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
                    <option value="Criollo">Criollo</option>
                    <option value="Labrador">Labrador</option>
                    <option value="Golden">Golden</option>
                    <option value="Poodle">Poodle</option>
                    <option value="Bulldog">Bulldog</option>
                    <option value="Otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">Edad</label>
                <select name="age_years" value={petData.age_years} onChange={handleInputChange} className="w-full h-12 px-3 bg-white border-2 border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm">
                    <option value="">Selecciona</option>
                    <option value="Cachorro">Cachorro</option>
                    <option value="Joven">Joven</option>
                    <option value="Adulto">Adulto</option>
                    <option value="Senior">Senior</option>
                </select>
              </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-100 rounded-2xl text-orange-700">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p className="text-[10px] font-bold uppercase leading-tight">Solo aceptamos mascotas de 5 meses en adelante con vacunas completas.</p>
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