import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Clock, ArrowLeft, Calendar, Loader2, Navigation, Crosshair } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import MercadoPagoButton from '../components/MercadoPagoButton';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY; 

const containerStyle = { width: '100%', height: '100%' };

const centerMedellin = { lat: 6.2442, lng: -75.5812 };

const Booking = ({ setView, navigate }) => {
  const prices = { 
    '1h': 30000,
    '2h': 55000,
    '3h': 75000
  };

  const [duration, setDuration] = useState('1h');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  const [bookingType, setBookingType] = useState('schedule');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [isReadyForPayment, setIsReadyForPayment] = useState(false);
  
  const [map, setMap] = useState(null);
  const [markerPos, setMarkerPos] = useState(centerMedellin);
  const autocompleteRef = useRef(null);

  const onNavigate = navigate || setView;

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setMarkerPos(userPos);
          if (map) {
            map.panTo(userPos);
            map.setZoom(15);
          }
        },
        (error) => {
          console.log("GPS no permitido, nos quedamos en Medellín.");
        }
      );
    }
  }, [map]);

  useEffect(() => {
    const validateForm = () => {
      if (!address) return false;
      if (bookingType === 'schedule' && (!date || !time)) return false;
      return true;
    };
    setIsReadyForPayment(validateForm());
  }, [address, bookingType, date, time]);

  const handleSuccessfulPayment = async () => {
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
          status: 'pending',
          scheduled_date: finalDate,
          scheduled_time: finalTime,
          lat: markerPos.lat,
          lng: markerPos.lng
      };

      const { error } = await supabase.from('bookings').insert([bookingData]);
      if (error) throw error;

      toast.success('¡Reserva creada con éxito! Buscando paseador...');
      
      if (onNavigate) onNavigate('/home');

    } catch (error) {
      console.error(error);
      toast.error('Error al registrar la reserva: ' + error.message);
    }
  };

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places'] 
  });

  const formatMoney = (val) => '$' + val.toLocaleString('es-CO');

  const onLoad = React.useCallback(function callback(map) {
    setMap(map);
  }, []);

  const getAddressFromCoords = (lat, lng) => {
    if (!window.google || !window.google.maps) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results[0]) {
        setAddress(results[0].formatted_address); 
      } else {
        console.error("Geocoding falló:", status);
      }
    });
  };

  const onMarkerDragEnd = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerPos({ lat, lng });
    getAddressFromCoords(lat, lng);
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current !== null) {
        const place = autocompleteRef.current.getPlace();
        if (place.geometry) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            setMarkerPos({ lat, lng });
            map.panTo({ lat, lng });
            map.setZoom(17);
            setAddress(place.formatted_address || place.name);
        }
    }
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      setGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setMarkerPos(pos);
          if(map) {
              map.panTo(pos);
              map.setZoom(17);
          }
          getAddressFromCoords(pos.lat, pos.lng);
          setGettingLocation(false);
        },
        () => {
          toast.error("No se pudo obtener ubicación GPS.");
          setGettingLocation(false);
        }
      );
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col relative h-screen overflow-hidden">
      
      <div className="absolute top-4 left-4 z-[1000]">
        <button onClick={() => onNavigate('/home')} className="bg-white p-3 rounded-full shadow-lg border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
      </div>
      
      <div className="w-full h-[40%] relative z-0 bg-gray-200 shrink-0">
         {isLoaded ? (
             <GoogleMap
               mapContainerStyle={containerStyle}
               center={centerMedellin}
               zoom={13}
               onLoad={onLoad}
               options={{ disableDefaultUI: true, zoomControl: false }}
             >
                <Marker 
                    position={markerPos} 
                    draggable={true} 
                    onDragEnd={onMarkerDragEnd}
                />
             </GoogleMap>
         ) : (
             <div className="w-full h-full flex items-center justify-center">
                 <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
             </div>
         )}
         
         <button 
            onClick={handleCurrentLocation}
            className="absolute bottom-6 right-4 z-[500] bg-white p-3 rounded-full shadow-xl border border-gray-100 text-gray-700 active:scale-90 transition-transform"
         >
            {gettingLocation ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500"/> : <Crosshair className="w-6 h-6 text-gray-800"/>}
         </button>

         <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg z-[500] text-xs font-bold text-gray-800 border border-gray-200 flex items-center gap-2 whitespace-nowrap">
            <Navigation className="w-3 h-3 text-emerald-600" /> Mueve el pin a tu ubicación
         </div>
      </div>

      <div className="flex-1 bg-white rounded-t-[30px] -mt-6 relative z-10 px-6 py-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] overflow-y-auto pb-48">
        
        <div className="mb-6">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Dirección de recogida</label>
          {isLoaded && (
              <Autocomplete
                onLoad={ref => autocompleteRef.current = ref}
                onPlaceChanged={onPlaceChanged}
              >
                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
                    <MapPin className="w-5 h-5 text-emerald-500 shrink-0" />
                    <input 
                        type="text" 
                        placeholder="Escribe dirección o usa GPS..."
                        className="w-full bg-transparent font-medium text-gray-800 outline-none text-sm"
                        onChange={(e) => setAddress(e.target.value)}
                        value={address}
                    />
                </div>
              </Autocomplete>
          )}
        </div>

        <div className="mb-5">
            <div className="flex p-1 bg-gray-100 rounded-xl">
                <button onClick={() => setBookingType('schedule')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${bookingType === 'schedule' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500'}`}>Programar</button>
                <button onClick={() => setBookingType('now')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${bookingType === 'now' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500'}`}>Pedir Ya</button>
            </div>
        </div>

        {bookingType === 'schedule' && (
            <div className="grid grid-cols-2 gap-4 mb-6 animate-fade-in-down">
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Fecha</label>
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-sm font-bold text-gray-700 outline-none w-full" />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Hora</label>
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-transparent text-sm font-bold text-gray-700 outline-none w-full" />
                    </div>
                </div>
            </div>
        )}

        <h3 className="font-black text-gray-900 text-sm mb-3">Duración del Paseo</h3>
        <div className="grid grid-cols-3 gap-3 mb-10">
          {Object.entries(prices).map(([key, price]) => (
            <button 
                key={key} 
                onClick={() => setDuration(key)} 
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${duration === key ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20' : 'bg-white border-transparent text-gray-400 hover:border-gray-100 shadow-sm'}`}
            >
              <span className="font-bold text-sm">{key}</span>
              <span className="text-[11px] font-medium">{formatMoney(price)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 p-5 pb-8 z-[2000] shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 font-bold uppercase">Total a Pagar</span>
            <span className="text-2xl font-black text-gray-900">{formatMoney(prices[duration])}</span>
          </div>
          {bookingType === 'schedule' && date && (
              <div className="text-right">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Fecha Programada</span>
                  <span className="text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-md">{date} • {time}</span>
              </div>
          )}
        </div>
        
        {isReadyForPayment ? (
          <MercadoPagoButton
            amount={prices[duration]}
            title={`Paseo de ${duration} - PaseoMundo`}
            onSuccess={handleSuccessfulPayment}
          />
        ) : (
          <button disabled={true} className="w-full h-14 bg-gray-100 text-gray-400 rounded-xl flex items-center justify-center font-bold text-sm">
            Selecciona dirección y hora para continuar
          </button>
        )}
      </div>
    </div>
  );
};

export default Booking;