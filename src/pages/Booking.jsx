import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MapPin, Clock, ArrowLeft, Loader2, Crosshair, Star, Check, Dog, ChevronRight, Wallet, CreditCard } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES, centerMedellin } from '../lib/mapsConfig';
import MercadoPagoButton from '../components/MercadoPagoButton';
import { isWithinRadius } from '../utils/distance';

const containerStyle = { width: '100%', height: '100%' };

const getLocalDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Booking = ({ setView, navigate }) => {
  const location = useLocation();
  const preferredWalker = location.state?.preferredWalker || null;
  const onNavigate = navigate || setView;

  const prices = { '1h': 30000, '2h': 55000, '3h': 75000 };
  const additionalPetPrice = 10000;

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
  
  const basePrice = prices[duration];
  const petCount = selectedPets.length;
  const totalPrice = basePrice + (petCount > 1 ? (petCount - 1) * additionalPetPrice : 0);
  
  
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('wallet'); 
  const [selectedWalker, setSelectedWalker] = useState(null);
  const [nearbyWalkers, setNearbyWalkers] = useState([]);
  
  const [map, setMap] = useState(null);
  const [markerPos, setMarkerPos] = useState(centerMedellin);
  const autocompleteRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
    language: 'es',
    region: 'CO'
  });

  useEffect(() => {
    const fetchPetsAndWallet = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        
        const { data } = await supabase.from('pets').select('*').eq('owner_id', user.id).eq('is_active', true);
        setMyPets(data || []);
        if (data?.length > 0) setSelectedPets([data[0].id]);
        
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('balance')
          .eq('user_id', user.id)
          .single();
        setWalletBalance(parseFloat(profile?.balance || 0));
      }
    };
    fetchPetsAndWallet();
  }, []);

  
  const [availableWalkers, setAvailableWalkers] = useState(0);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const checkWalkerAvailability = async (selectedDate, selectedTime) => {
    if (!selectedDate || !selectedTime) {
      setAvailableWalkers(0);
      setNearbyWalkers([]);
      return;
    }

    setCheckingAvailability(true);
    try {
      const dateObj = new Date(selectedDate + 'T00:00:00');
      const dayOfWeek = dateObj.getDay();
      
      const { data: availability, error } = await supabase
        .from('walker_availability')
        .select('walker_id')
        .eq('day_of_week', dayOfWeek)
        .lte('start_time', selectedTime)
        .gte('end_time', selectedTime);

      if (error) throw error;
      
      const walkerIds = availability?.map(a => a.walker_id) || [];
      
      if (walkerIds.length > 0) {
        const { data: verifiedWalkers } = await supabase
          .from('walkers')
          .select('id, user_id, name, img, rating, service_latitude, service_longitude, service_radius_km, user_profiles(first_name, last_name)')
          .eq('overall_verification_status', 'approved')
          .in('id', walkerIds);
        
        if (verifiedWalkers && markerPos) {
          const nearbyWalkers = verifiedWalkers.filter(walker => {
            if (!walker.service_latitude || !walker.service_longitude || !walker.service_radius_km) return false;
            return isWithinRadius(
              markerPos.lat, markerPos.lng,
              walker.service_latitude, walker.service_longitude,
              walker.service_radius_km
            );
          });
          setNearbyWalkers(nearbyWalkers);
          setAvailableWalkers(nearbyWalkers.length);
        } else {
          setNearbyWalkers(verifiedWalkers || []);
          setAvailableWalkers(verifiedWalkers?.length || 0);
        }
      } else {
        setNearbyWalkers([]);
        setAvailableWalkers(0);
      }
    } catch (err) {
      console.error('Error verificando disponibilidad:', err);
      setNearbyWalkers([]);
      setAvailableWalkers(0);
    } finally {
      setCheckingAvailability(false);
    }
  };

  useEffect(() => {
    if (bookingType === 'schedule' && date && time) {
      checkWalkerAvailability(date, time);
    } else if (bookingType === 'now' && markerPos) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const currentDate = getLocalDate();
      checkWalkerAvailability(currentDate, currentTime);
    }
  }, [date, time, bookingType, markerPos]);

  useEffect(() => {
    const validate = () => {
      if (!address || selectedPets.length === 0) return false;
      if (bookingType === 'schedule' && (!date || !time)) return false;
      return true;
    };
    setIsReadyForPayment(validate());
  }, [address, bookingType, date, time, selectedPets]);

  const createBooking = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No hay usuario conectado');

    const isScheduled = bookingType === 'schedule';
    const finalDate = isScheduled ? date : getLocalDate();
    const finalTime = isScheduled ? time : `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

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
        lng: markerPos.lng
    };

    return bookingData;
  };

  const handlePaymentWithWallet = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario conectado');

      const price = totalPrice;
      
      if (walletBalance < price) {
        throw new Error('Saldo insuficiente. Usa otro método de pago.');
      }

      const isScheduled = bookingType === 'schedule';
      const finalDate = isScheduled ? date : getLocalDate();
      const finalTime = isScheduled ? time : `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

      const bookingData = {
        user_id: user.id,
        address: address,
        duration: duration,
        total_price: price,
        status: selectedWalker ? 'accepted' : 'confirmed',
        walker_id: selectedWalker ? selectedWalker.id : null,
        scheduled_date: finalDate,
        scheduled_time: finalTime,
        lat: markerPos.lat,
        lng: markerPos.lng,
        pet_count: petCount,
        pet_ids: selectedPets
      };

      const { error: bookingError } = await supabase.from('bookings').insert([bookingData]);
      if (bookingError) throw bookingError;

      const { data: newBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (selectedWalker && selectedWalker.user_id) {
        try {
          await supabase.from('notifications').insert({
            user_id: selectedWalker.user_id,
            title: '🐕 Nueva Reserva',
            body: `Tienes una nueva reserva programada para ${finalDate} a las ${finalTime}`,
            link_to: '/walker-home'
          });
        } catch (e) {
          console.error('Error notificacion:', e);
        }
      } else if (nearbyWalkers.length > 0) {
        for (const walker of nearbyWalkers) {
          if (walker.user_id) {
            try {
              await supabase.from('notifications').insert({
                user_id: walker.user_id,
                title: '🐕 Nueva Reserva Disponible',
                body: `Nueva reserva en tu zona para ${finalDate} a las ${finalTime}. ¡Accepta antes de que otro lo haga!`,
                link_to: '/walker-home'
              });
            } catch (e) {
              console.error('Error notificacion walker:', walker.user_id, e);
            }
          }
        }
      }

      const newBalance = walletBalance - price;
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ balance: newBalance })
        .eq('user_id', user.id);
      
      if (updateError) throw updateError;

      await supabase.from('transactions').insert({
        user_id: user.id,
        booking_id: newBooking.id,
        transaction_type: 'payment',
        amount: price,
        net_amount: price,
        payment_method: 'wallet',
        status: 'completed',
        description: `Paseo ${duration} - Pago con saldo de billetera`
      });

      toast.success('¡Reserva confirmada! Saldo descontado: $' + price.toLocaleString());
      if (onNavigate) onNavigate('/home');

    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error al procesar el pago');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario conectado');

      const bookingData = await createBooking();

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
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Fecha</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent font-bold text-gray-800 outline-none w-full text-sm" />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Hora</label>
                    <input 
                      type="time" 
                      value={time} 
                      onChange={(e) => setTime(e.target.value)} 
                      min="06:00" 
                      max="18:00"
                      className="bg-transparent font-bold text-gray-800 outline-none w-full text-sm" 
                    />
                </div>
              </div>
              
              {checkingAvailability ? (
                <div className="bg-gray-50 p-3 rounded-xl mb-6 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin"></div>
                  <span className="text-xs text-gray-500 font-bold">Verificando disponibilidad...</span>
                </div>
              ) : date && time && (
                <div className={`p-3 rounded-xl mb-4 flex items-center gap-2 ${availableWalkers > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                  {availableWalkers > 0 ? (
                    <>
                      <span className="text-emerald-600 text-lg">✓</span>
                      <span className="text-xs text-emerald-700 font-bold">{availableWalkers} paseador(es) disponible(s) en este horario</span>
                    </>
                  ) : (
                    <>
                      <span className="text-red-600 text-lg">✕</span>
                      <span className="text-xs text-red-700 font-bold">No hay paseadores disponibles en este horario. Intenta otra hora.</span>
                    </>
                  )}
                </div>
              )}

              {nearbyWalkers.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-xs font-black text-gray-400 uppercase mb-3">Elige un paseador (opcional)</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedWalker(null)}
                      className={`w-full p-3 rounded-xl border flex items-center gap-3 transition-all ${!selectedWalker ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 bg-white'}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-500 font-bold">?</span>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-sm text-gray-800">Cualquier paseador</p>
                        <p className="text-xs text-gray-500">El primero disponible</p>
                      </div>
                      {!selectedWalker && <span className="text-emerald-500">✓</span>}
                    </button>
                    {nearbyWalkers.map(walker => (
                      <button
                        key={walker.id}
                        onClick={() => setSelectedWalker(walker)}
                        className={`w-full p-3 rounded-xl border flex items-center gap-3 transition-all ${selectedWalker?.id === walker.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 bg-white'}`}
                      >
                        <img src={walker.img || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full object-cover" />
                        <div className="flex-1 text-left">
                          <p className="font-bold text-sm text-gray-800">{walker.name || walker.user_profiles?.first_name || 'Paseador'}</p>
                          <p className="text-xs text-gray-500">⭐ {walker.rating || 'Nuevo'}</p>
                        </div>
                        {selectedWalker?.id === walker.id && <span className="text-emerald-500">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
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

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 px-6 py-4 pb-10 z-[2000] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="flex justify-between items-center mb-3">
          <div>
            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Total Servicio</span>
            <p className="text-2xl font-black text-gray-900">${totalPrice.toLocaleString('es-CO')}</p>
            {petCount > 1 && <span className="text-xs text-gray-500">{petCount} mascotas</span>}
          </div>
        </div>
        
        {walletBalance > 0 && (
          <div className="flex p-1 bg-gray-100 rounded-xl mb-3">
            <button 
              onClick={() => setPaymentMethod('wallet')} 
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 ${paymentMethod === 'wallet' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500'}`}
            >
              <Wallet size={12} />
              Saldo ${walletBalance.toLocaleString()}
            </button>
            <button 
              onClick={() => setPaymentMethod('mercadopago')} 
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 ${paymentMethod === 'mercadopago' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500'}`}
            >
              <CreditCard size={12} />
              Tarjeta
            </button>
          </div>
        )}
        {!walletBalance && (
          <button 
            onClick={() => setPaymentMethod('mercadopago')} 
            className="w-full py-2 text-xs font-black text-gray-400 mb-3"
          >
            + Pagar con tarjeta
          </button>
        )}
        
        {paymentMethod === 'wallet' && walletBalance < prices[duration] && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 text-center">
            <p className="text-xs text-orange-600 font-bold">
              Saldo insuficiente (${walletBalance.toLocaleString()}). 
              <button onClick={() => setPaymentMethod('mercadopago')} className="underline ml-1">Paga con tarjeta</button>
            </p>
          </div>
        )}
        
        {isReadyForPayment ? (
          paymentMethod === 'wallet' && walletBalance >= prices[duration] ? (
            <button 
              onClick={handlePaymentWithWallet}
              disabled={loading}
              className="w-full h-16 bg-emerald-500 text-black rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <>Pagar con Billetera</>}
            </button>
          ) : paymentMethod === 'wallet' ? (
            <button disabled className="w-full h-16 bg-gray-100 text-gray-400 rounded-2xl font-black text-sm uppercase tracking-widest cursor-not-allowed">
              Saldo insuficiente
            </button>
          ) : (
            <MercadoPagoButton
              amount={prices[duration]}
              title={`Paseo HappiWalk - ${selectedPets.length} Mascota(s)`}
              onSuccess={handlePaymentSuccess}
            />
          )
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