import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Circle } from '@react-google-maps/api';
import { supabase } from '../supabaseClient';
import { Save, X, MapPin, Navigation, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const containerStyle = { width: '100%', height: '300px', borderRadius: '16px' };
const defaultCenter = { lat: 6.2442, lng: -75.5812 }; 

const ServiceAreaManager = ({ walkerId, onClose }) => {
  const [center, setCenter] = useState(defaultCenter);
  const [radius, setRadius] = useState(3); 
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [map, setMap] = useState(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  
  useEffect(() => {
    const fetchCurrentLocation = async () => {
      const { data, error } = await supabase
        .from('walkers')
        .select('service_latitude, service_longitude, service_radius_km, location')
        .eq('id', walkerId)
        .single();

      if (data && !error) {
        if (data.service_latitude && data.service_longitude) {
          setCenter({ lat: data.service_latitude, lng: data.service_longitude });
        }
        if (data.service_radius_km) setRadius(data.service_radius_km);
        if (data.location) setAddress(data.location);
      }
    };
    fetchCurrentLocation();
  }, [walkerId]);

 
  const getAddressFromCoords = (lat, lng) => {
    if (!window.google || !window.google.maps) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results[0]) {
        
        const formatted = results[0].address_components
          .filter(c => c.types.includes('neighborhood') || c.types.includes('locality'))
          .map(c => c.long_name)
          .join(', ');
        
        
        const finalAddr = formatted || results[0].formatted_address;
        setAddress(finalAddr);
      }
    });
  };

  
  const onMarkerDragEnd = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setCenter({ lat, lng });
    getAddressFromCoords(lat, lng);
  };

 
  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      toast.loading("Obteniendo ubicación...", { id: 'gps' });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCenter(pos);
          if (map) map.panTo(pos);
          getAddressFromCoords(pos.lat, pos.lng);
          toast.success("Ubicación actualizada", { id: 'gps' });
        },
        () => toast.error("Error al obtener ubicación GPS", { id: 'gps' })
      );
    }
  };

  
  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('walkers')
        .update({
          service_latitude: center.lat,
          service_longitude: center.lng,
          service_radius_km: radius,
          location: address 
        })
        .eq('id', walkerId);

      if (error) throw error;
      toast.success('Zona de servicio actualizada');
      onClose(); 
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar zona');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-fade-in-up">
        
        
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-500" /> Mi Zona
            </h2>
            <p className="text-xs text-gray-500">Define dónde prestas tus servicios</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        
        <div className="relative mb-6 rounded-2xl overflow-hidden border border-gray-200 shadow-inner">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={center}
              zoom={13}
              onLoad={setMap}
              options={{ disableDefaultUI: true, zoomControl: false }}
            >
              
              <Marker
                position={center}
                draggable={true}
                onDragEnd={onMarkerDragEnd}
                animation={window.google?.maps?.Animation.DROP}
              />
              
              <Circle
                center={center}
                radius={radius * 1000} // Metros
                options={{
                  fillColor: '#10b981',
                  fillOpacity: 0.2,
                  strokeColor: '#059669',
                  strokeOpacity: 0.8,
                  strokeWeight: 2,
                }}
              />
            </GoogleMap>
          ) : (
            <div className="h-[300px] bg-gray-100 flex items-center justify-center">
              <Loader2 className="animate-spin text-gray-400" />
            </div>
          )}

          
          <button
            onClick={handleCurrentLocation}
            className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg text-gray-700 hover:text-blue-600 active:scale-95 transition-all"
            title="Usar mi ubicación"
          >
            <Navigation className="w-5 h-5" />
          </button>
        </div>

        
        <div className="space-y-4">
          
          
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center gap-3">
            <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Ubicación central</p>
              <p className="text-sm font-bold text-gray-800 truncate">{address || 'Arrastra el pin en el mapa'}</p>
            </div>
          </div>

         
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-bold text-gray-700">Radio de cobertura</span>
              <span className="text-sm font-black text-emerald-600">{radius} km</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>1 km</span>
              <span>20 km</span>
            </div>
          </div>

          
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-[0.98]"
          >
            {loading ? <Loader2 className="animate-spin" /> : <><Save className="w-5 h-5" /> Guardar Zona</>}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ServiceAreaManager;