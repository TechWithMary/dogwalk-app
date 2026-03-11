import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MapPin, Clock, ArrowLeft, Loader2, Crosshair, Star, Check, Dog, ChevronRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import MercadoPagoButton from '../components/MercadoPagoButton';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY; 
const containerStyle = { width: '100%', height: '100%' };
const centerMedellin = { lat: 6.2442, lng: -75.5812 };
const libraries = ['places'];

const Booking = ({ setView, navigate }) => {
  const location = useLocation();
  const preferredWalker = location.state?.preferredWalker || null;
  const onNavigate = navigate || setView;

  const prices = { '1h': 30000, '2h': 55000, '3h': 75000 };

  const [myPets, setMyPets] = useState([]);
  const [selectedPets, setSelectedPets] = useState([]);
  const [duration, setDuration] = useState('1h');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  const [bookingType, setBookingType] = useState('schedule');
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [isReadyForPayment, setIsReadyForPayment] = useState(false);
  
  const [map, setMap] = useState(null);
  const [markerPos, setMarkerPos] = useState(centerMedellin);
  const autocompleteRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
    language: 'es',
    region: 'CO'
  });

  useEffect(() => {
    const fetchPets = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('pets').select('*').eq('owner_id', user.id).eq('is_active', true);
        setMyPets(data || []);
        if (data?.length > 0) setSelectedPets([data[0].id]);
      }
    };
    fetchPets();
  }, []);

  useEffect(() => {
    const validate = () => {
      if (!address || selectedPets.length === 0) return false;
      if (bookingType === 'schedule' && (!date || !time)) return false;
      return true;
    };
    setIsReadyForPayment(validate());
  }, [address, bookingType, date, time, selectedPets]);

  const handlePaymentSuccess = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario conectado');

      const isScheduled = bookingType === 'schedule';
      const finalDate = isScheduled ? date : new Date().toISOString().slice(0, 10);
      const finalTime = isScheduled ? time : new Date().toTimeString().slice(0, 5);

      const bookingData = {
          user_id: user.id,
          address: address,
          duration: duration,
          total_price: prices[duration],
          status: preferredWalker ? 'accepted' : 'pending',
          walker_id: preferredWalker ? preferredWalker.id : null,
          scheduled_date: finalDate,
          scheduled_time: finalTime,
          lat: markerPos.lat,
          lng: markerPos.lng,
          metadata: { pet_ids: selectedPets }
      };

      const { error } = await supabase.from('bookings').insert([bookingData]);
      if (error) throw error;

      toast.success('¡Reserva y pago confirmados!');
      if (onNavigate) onNavigate('/home');

    } catch (error) {
      console.error(error);
      toast.error('Error al registrar la reserva');
    } finally {
      setLoading(false);
    }
  };

  const getAddressFromCoords = (lat, lng) => {
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results[0]) setAddress(results[0].formatted_address);
    });
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      setGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
          setMarkerPos(pos);
          map?.panTo(pos);
          getAddressFromCoords(pos.lat, pos.lng);
          setGettingLocation(false);
        },
        () => { toast.error("Activa el GPS"); setGettingLocation(false); }
      );
    }
  };

  if (!isLoaded) return <div className="h-screen w-full flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;

  return (
    <div className="bg-gray-50 h-screen flex flex-col overflow-hidden relative">
      
      <div className="absolute top-4 left-4 z-[1000]">
        <button onClick={() => onNavigate('/home')} className="bg-white p-3 rounded-full shadow-lg active:scale-95 transition-all">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
      </div>

      <div className="w-full h-[35%] relative z-0 shrink-0">
         <GoogleMap
           mapContainerStyle={containerStyle}
           center={markerPos}
           zoom={15}
           onLoad={setMap}
           options={{ disableDefaultUI: true }}
         >
            <Marker position={markerPos} draggable onDragEnd={(e) => {
              const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
              setMarkerPos(p);
              getAddressFromCoords(p.lat, p.lng);
            }} />
         </GoogleMap>
         <button onClick={handleCurrentLocation} className="absolute bottom-10 right-4 z-[500] bg-white p-3 rounded-full shadow-xl active:scale-90 transition-all">
            {gettingLocation ? <Loader2 className="animate-spin text-emerald-500"/> : <Crosshair className="w-6 h-6 text-emerald-500"/>}
         </button>
      </div>

      <div className="flex-1 bg-white rounded-t-[30px] -mt-8 relative z-10 px-6 py-8 overflow-y-auto pb-80 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        
        <div className="mb-8">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block ml-1">¿Quiénes van al paseo?</label>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {myPets.map(pet => (
              <button 
                key={pet.id} 
                onClick={() => setSelectedPets(prev => prev.includes(pet.id) ? prev.filter(p => p !== pet.id) : [...prev, pet.id])}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl border-2 transition-all shrink-0 ${selectedPets.includes(pet.id) ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 bg-white text-gray-400'}`}
              >
                <Dog size={16} />
                <span className="font-bold text-sm">{pet.name}</span>
                {selectedPets.includes(pet.id) && <Check size={14} className="ml-1" />}
              </button>
            ))}
            <button onClick={() => onNavigate('/manage-pets')} className="px-4 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 text-sm font-bold shrink-0">+ Nueva</button>
          </div>
        </div>

        <div className="mb-8">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block ml-1">Punto de encuentro</label>
          <Autocomplete 
            onLoad={ref => autocompleteRef.current = ref} 
            onPlaceChanged={() => {
              const place = autocompleteRef.current.getPlace();
              if (place.geometry) {
                const p = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
                setMarkerPos(p);
                map.panTo(p);
                setAddress(place.formatted_address);
              }
            }}
          >
            <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-emerald-500 transition-all">
                <MapPin className="w-5 h-5 text-emerald-500" />
                <input type="text" placeholder="Busca tu dirección..." className="w-full bg-transparent font-bold text-gray-800 outline-none text-sm" onChange={(e) => setAddress(e.target.value)} value={address} />
            </div>
          </Autocomplete>
        </div>

        <div className="flex p-1 bg-gray-100 rounded-2xl mb-8">
            <button onClick={() => setBookingType('schedule')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${bookingType === 'schedule' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500'}`}>PROGRAMAR</button>
            <button onClick={() => setBookingType('now')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${bookingType === 'now' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500'}`}>PEDIR YA</button>
        </div>

        {bookingType === 'schedule' && (
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Fecha</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent font-bold text-gray-800 outline-none w-full text-sm" />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Hora</label>
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-transparent font-bold text-gray-800 outline-none w-full text-sm" />
                </div>
            </div>
        )}

        <h3 className="font-black text-gray-900 text-sm mb-4 ml-1">Duración del Paseo</h3>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(prices).map(([key, price]) => (
            <button key={key} onClick={() => setDuration(key)} className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${duration === key ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-white border-gray-100 text-gray-400'}`}>
              <span className="font-black text-base">{key}</span>
              <span className="text-[10px] font-bold opacity-80">${(price/1000)}k</span>
            </button>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 p-6 pb-10 z-[2000] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Total Servicio</span>
            <p className="text-3xl font-black text-gray-900">${prices[duration].toLocaleString('es-CO')}</p>
          </div>
        </div>
        
        {isReadyForPayment ? (
          <MercadoPagoButton
            amount={prices[duration]}
            title={`Paseo HappiWalk - ${selectedPets.length} Mascota(s)`}
            onSuccess={handlePaymentSuccess}
          />
        ) : (
          <button disabled className="w-full h-16 bg-gray-100 text-gray-400 rounded-2xl font-black text-sm uppercase tracking-widest cursor-not-allowed">
            {selectedPets.length === 0 ? 'Selecciona mascota' : 'Completa datos'}
          </button>
        )}
      </div>
    </div>
  );
};

export default Booking;