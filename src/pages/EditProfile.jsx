import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, ArrowLeft, User, Phone, MapPin, Save, Crosshair } from 'lucide-react';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import toast from 'react-hot-toast';

const libraries = ['places'];

const EditProfile = ({ navigate }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState('owner');
  const [gettingLocation, setGettingLocation] = useState(false);
  const autocompleteRef = useRef(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    bio: ''
  });

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
    language: 'es',
    region: 'CO'
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const role = user.user_metadata?.role || 'owner';
      setUserRole(role);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(); 

      
      const invalidNames = ['usuario', 'usuario nuevo', 'paseador', 'paseador nuevo', 'nuevo', 'walker'];
      
      let fName = profile?.first_name || '';
      let lName = profile?.last_name || '';

      if (invalidNames.includes(fName.toLowerCase()) || invalidNames.includes(lName.toLowerCase())) {
        fName = '';
        lName = '';
      }

      setFormData({
        first_name: fName,
        last_name: lName,
        phone: profile?.phone || '',
        address: profile?.address || '',
        bio: profile?.bio || ''
      });
      
    } catch (error) {
      console.error(error);
      toast.error("Error cargando perfil");
    } finally {
      setLoading(false);
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
            setFormData(prev => ({ ...prev, address: results[0].formatted_address }));
          }
          setGettingLocation(false);
        });
      },
      () => {
        toast.error("Error al obtener ubicación");
        setGettingLocation(false);
      }
    );
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current !== null) {
      const place = autocompleteRef.current.getPlace();
      if (place.formatted_address) {
        setFormData(prev => ({ ...prev, address: place.formatted_address }));
      }
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(formData)
        .eq('user_id', user.id);
      
      if (updateError) throw updateError;

      if (userRole === 'walker') {
        const fullName = `${formData.first_name} ${formData.last_name}`.trim();
        await supabase.from('walkers').update({ name: fullName }).eq('user_id', user.id);
      }
      
      toast.success('Perfil actualizado correctamente');
      navigate('/profile');
    } catch (error) {
      toast.error("Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-emerald-500" /></div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center mb-8">
        <button onClick={() => navigate('/profile')} className="p-2 bg-white rounded-full shadow-sm mr-4 active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-2xl font-black text-gray-900">Editar Perfil</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre</label>
            <div className="flex items-center bg-gray-50 rounded-2xl px-4 py-4 mt-1">
              <User className="w-4 h-4 text-gray-400 mr-2" />
              <input name="first_name" value={formData.first_name} onChange={handleChange} className="bg-transparent w-full outline-none text-sm font-bold text-gray-800" placeholder="Nombre" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Apellido</label>
            <div className="flex items-center bg-gray-50 rounded-2xl px-4 py-4 mt-1">
              <User className="w-4 h-4 text-gray-400 mr-2" />
              <input name="last_name" value={formData.last_name} onChange={handleChange} className="bg-transparent w-full outline-none text-sm font-bold text-gray-800" placeholder="Apellido" />
            </div>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Teléfono</label>
          <div className="flex items-center bg-gray-50 rounded-2xl px-4 py-4 mt-1">
            <Phone className="w-4 h-4 text-gray-400 mr-2" />
            <input name="phone" value={formData.phone} onChange={handleChange} className="bg-transparent w-full outline-none text-sm font-bold text-gray-800" placeholder="Número celular" />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Dirección de residencia</label>
          <div className="relative mt-1">
            {isLoaded ? (
              <Autocomplete onLoad={ref => autocompleteRef.current = ref} onPlaceChanged={onPlaceChanged}>
                <div className="flex items-center bg-gray-50 rounded-2xl px-4 py-4 border border-transparent focus-within:border-emerald-500 transition-all">
                  <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                  <input 
                    name="address" 
                    value={formData.address} 
                    onChange={handleChange} 
                    className="bg-transparent w-full outline-none text-sm font-bold text-gray-800 pr-10" 
                    placeholder="Busca tu dirección o usa el GPS..." 
                  />
                </div>
              </Autocomplete>
            ) : (
              <div className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
            )}
            <button 
              type="button" 
              onClick={handleCurrentLocation} 
              className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 active:scale-90 transition-all"
            >
              {gettingLocation ? <Loader2 className="animate-spin w-5 h-5" /> : <Crosshair size={20} />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sobre ti</label>
          <textarea 
            name="bio" 
            value={formData.bio} 
            onChange={handleChange} 
            rows="3" 
            className="w-full bg-gray-50 rounded-2xl px-4 py-4 mt-1 outline-none text-sm font-bold text-gray-800 resize-none border border-transparent focus:border-emerald-500 transition-all" 
            placeholder="Cuéntanos un poco sobre ti y tu experiencia..." 
          />
        </div>

        <button 
          type="submit" 
          disabled={saving} 
          className="w-full h-16 bg-gray-900 text-[#13ec13] font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 shadow-lg shadow-gray-200 uppercase tracking-widest text-xs"
        >
          {saving ? <Loader2 className="animate-spin" /> : <><Save className="w-5 h-5" /> Guardar Cambios</>}
        </button>
      </form>
    </div>
  );
};

export default EditProfile;