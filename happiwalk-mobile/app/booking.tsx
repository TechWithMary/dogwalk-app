import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform, ActivityIndicator, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { isWithinRadius, calculateDistance } from '../lib/distance';
import { searchAddressSuggestions, getPlaceDetails } from '../lib/addressSearch';
import { createPaymentWithBooking } from '../lib/paymentService';
import { Dog, MapPin, Clock, ChevronLeft, Loader2, Check, Wallet, CreditCard, ArrowLeft } from '../components/Icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const ADDITIONAL_PET_PRICE = 10000;
const CENTER_MEDELLIN = { latitude: 6.2442, longitude: -75.5812 };
const HOURS: Record<string, number> = { '1h': 1, '2h': 2, '3h': 3 };

interface Walker {
  id: string;
  name: string;
  user_id?: string;
  rating: number;
  price: number;
  img?: string;
  service_latitude?: number;
  service_longitude?: number;
  service_radius_km?: number;
  user_profiles?: { first_name?: string; last_name?: string };
}

interface Pet {
  id: string;
  name: string;
  breed?: string;
  size?: string;
  photo_url?: string;
}

const getLocalDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function BookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const walkerId = params.walkerId as string;
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const scrollRef = useRef<ScrollView>(null);

  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPets, setSelectedPets] = useState<string[]>([]);
  const [duration, setDuration] = useState('1h');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [address, setAddress] = useState('');
  const [bookingType, setBookingType] = useState<'schedule' | 'now'>('schedule');
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [nearbyWalkers, setNearbyWalkers] = useState<any[]>([]);
  const [availableWalkers, setAvailableWalkers] = useState(0);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'mercadopago'>('wallet');
  const [selectedWalker, setSelectedWalker] = useState<any>(null);
  const [markerPosition, setMarkerPosition] = useState(CENTER_MEDELLIN);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [region, setRegion] = useState({ ...CENTER_MEDELLIN, latitudeDelta: 0.015, longitudeDelta: 0.015 });
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [isUserEditingAddress, setIsUserEditingAddress] = useState(false);
  const paymentPanelAnim = useRef(null);

  useEffect(() => {
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setAddressSuggestions([]);
        setIsUserEditingAddress(false);
      }
    );
    return () => {
      hideSub.remove();
    };
  }, []);

  const walkerPrice = selectedWalker?.price || nearbyWalkers[0]?.price || 30000;
  const basePrice = walkerPrice * HOURS[duration];
  const petCount = selectedPets.length;
  const totalPrice = basePrice + (petCount > 1 ? (petCount - 1) * ADDITIONAL_PET_PRICE : 0);
  const isReadyForPayment = selectedPets.length > 0 && addressConfirmed && address.trim().length > 0 && (bookingType === 'now' || (date && time));

  useEffect(() => {
    if (!isUserEditingAddress) return;

    const delaySearch = setTimeout(async () => {
      if (address.length > 2) {
        setSearchingAddress(true);
        setAddressError('');
        try {
          const results = await searchAddressSuggestions(address);
          setAddressSuggestions(results);
          if (results.length === 0 && address.length > 3) {
            setAddressError('No se encontraron direcciones');
          }
        } catch {
          setAddressSuggestions([]);
          setAddressError('Error al buscar direcciones');
        } finally {
          setSearchingAddress(false);
        }
      } else {
        setAddressSuggestions([]);
        setAddressError('');
      }
    }, 300);
    return () => clearTimeout(delaySearch);
  }, [address, isUserEditingAddress]);

  useEffect(() => {
    if (bookingType === 'schedule' || bookingType === 'now') {
      checkAvailability();
    }
  }, [date, time, bookingType, markerPosition, bookingType]);

  const handleSelectSuggestion = async (suggestion: any) => {
    setIsUserEditingAddress(false);
    setAddressSuggestions([]);
    setAddress(suggestion.mainText || suggestion.description);
    setAddressConfirmed(false);
    setAddressError('');
    const details = await getPlaceDetails(suggestion.placeId);
    if (details) {
      const pos = { latitude: details.lat, longitude: details.lng };
      setMarkerPosition(pos);
      mapRef.current?.animateToRegion({ ...pos, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 500);
    } else {
      setAddressError('No se pudieron obtener los detalles de la dirección');
    }
    Keyboard.dismiss();
  };

  const fetchData = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      if (currentUser) {
        const { data: petsData } = await supabase
          .from('pets')
          .select('*')
          .eq('owner_id', currentUser.id)
          .eq('is_active', true);
        setPets(petsData || []);

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('balance')
          .eq('user_id', currentUser.id)
          .single();
        setWalletBalance(parseFloat(profile?.balance || 0));
      }
    } catch (error: any) {
      console.error('Error cargando datos:', error);
      Alert.alert('Error', 'No se pudieron cargar tus datos. Intenta de nuevo.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

const checkAvailability = async () => {
    setCheckingAvailability(true);
    try {
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay();
      
      const timeParts = time.toTimeString().slice(0, 5).split(':');
      const hours = parseInt(timeParts[0]);
      const minutes = parseInt(timeParts[1]);
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;

      const { data: availability, error } = await supabase
        .from('walker_availability')
        .select('walker_id')
        .eq('day_of_week', dayOfWeek)
        .lte('start_time', timeStr)
        .gte('end_time', timeStr);

      const walkerIds = availability?.map(a => a.walker_id) || [];

      if (walkerIds.length > 0) {
        const { data: verifiedWalkers } = await supabase
          .from('walkers')
          .select('id, user_id, name, img, rating, price, service_latitude, service_longitude, service_radius_km, user_profiles(first_name, last_name)')
          .eq('overall_verification_status', 'approved')
          .eq('is_online', true)
          .in('id', walkerIds);

        
        
        if (verifiedWalkers && markerPosition) {
          
          
          
          const nearby = verifiedWalkers.filter((walker: any) => {
            if (!walker.service_latitude || !walker.service_longitude || !walker.service_radius_km) return false;
            return isWithinRadius(
              markerPosition.latitude,
              markerPosition.longitude,
              walker.service_latitude,
              walker.service_longitude,
              walker.service_radius_km
            );
          });
          setNearbyWalkers(nearby);
          setAvailableWalkers(nearby.length);
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

  const handleSelectPet = (petId: string) => {
    setSelectedPets(prev =>
      prev.includes(petId)
        ? prev.filter(p => p !== petId)
        : [...prev, petId]
    );
  };

  const handleCurrentLocation = async () => {
    setGettingLocation(true);
    setIsUserEditingAddress(false);
    setAddressSuggestions([]);
    setAddressError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Activa el GPS');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const pos = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setMarkerPosition(pos);
      setRegion({ ...pos, latitudeDelta: 0.015, longitudeDelta: 0.015 });
      mapRef.current?.animateToRegion({ ...pos, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 500);
      setAddressConfirmed(true);

      const geocode = await Location.reverseGeocodeAsync(pos);
      if (geocode[0]) {
        const addr = geocode[0];
        const fullAddress = [
          addr.streetNumber,
          addr.street,
          addr.district,
          addr.subregion,
          addr.region,
        ].filter(Boolean).join(', ');
        setAddress(fullAddress || `${addr.street || ''}, ${addr.subregion || ''}`.replace(/^, |, $/g, ''));
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo obtener la ubicación');
    } finally {
      setGettingLocation(false);
    }
  };

  const createBooking = (statusOverride?: string) => {
    if (!user) throw new Error('No hay usuario conectado');
    if (selectedPets.length === 0) throw new Error('Selecciona al menos una mascota');
    if (!address) throw new Error('Ingresa una dirección');

    const isScheduled = bookingType === 'schedule';
    const finalDate = isScheduled ? date.toISOString().split('T')[0] : getLocalDate();
    const finalTime = isScheduled ? time.toTimeString().slice(0, 5) : `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

    return {
      user_id: user.id,
      address: address,
      duration: duration,
      total_price: totalPrice,
      status: statusOverride || (selectedWalker ? 'accepted' : 'confirmed'),
      walker_id: selectedWalker?.id || null,
      scheduled_date: finalDate,
      scheduled_time: finalTime,
      lat: markerPosition.latitude,
      lng: markerPosition.longitude,
      pet_ids: selectedPets,
    };
  };

  const handlePaymentWithWallet = async () => {
    Keyboard.dismiss();
    if (selectedPets.length === 0) {
      Alert.alert('Error', 'Selecciona al menos una mascota');
      return;
    }
    if (!address) {
      Alert.alert('Error', 'Ingresa una dirección');
      return;
    }

    if (walletBalance < totalPrice) {
      Alert.alert('Error', 'Saldo insuficiente. Usa otro método de pago.');
      return;
    }

    setLoading(true);
    try {
      const bookingData = createBooking('confirmed');

      const { data: newBooking, error } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select()
        .single();

      if (error) throw error;

      if (selectedWalker?.user_id) {
        await supabase.from('notifications').insert({
          user_id: selectedWalker.user_id,
          title: '🐕 Nueva Reserva',
          body: `Nueva reserva programada para ${bookingData.scheduled_date} a las ${bookingData.scheduled_time}`,
          link_to: '/walker-home',
        });

        await supabase.from('conversations').insert({
          participant_one_id: user.id,
          participant_two_id: selectedWalker.user_id,
          booking_id: newBooking.id,
        });
      } else if (nearbyWalkers.length > 0) {
        for (const walker of nearbyWalkers) {
          if (walker.user_id) {
            await supabase.from('notifications').insert({
              user_id: walker.user_id,
              title: '🐕 Nueva Reserva Disponible',
              body: `Nueva reserva en tu zona para ${bookingData.scheduled_date} a las ${bookingData.scheduled_time}. ¡Acepta antes de que otro lo haga!`,
              link_to: '/walker-home',
            });
          }
        }
      }

      await supabase
        .from('user_profiles')
        .update({ balance: walletBalance - totalPrice })
        .eq('user_id', user.id);

      await supabase.from('transactions').insert({
        user_id: user.id,
        booking_id: newBooking.id,
        transaction_type: 'payment',
        amount: Number(totalPrice),
        net_amount: Number(totalPrice),
        payment_method: 'wallet',
        status: 'completed',
        description: `Paseo ${duration} - Pago con saldo de billetera`,
      });

      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      Alert.alert('Éxito', `¡Reserva confirmada! Saldo descontado: $${totalPrice.toLocaleString()}`, [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al procesar el pago');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    Keyboard.dismiss();
    setLoading(true);
    try {
      if (!user) {
        Alert.alert('Error', 'No hay usuario conectado');
        return;
      }

      const scheduledDate = bookingType === 'schedule' 
        ? date.toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0];
      
      const scheduledTime = bookingType === 'schedule'
        ? time.toTimeString().slice(0, 5)
        : `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

      const bookingData = {
        user_id: user.id,
        pet_ids: selectedPets,
        duration: duration,
        address: address,
        lat: markerPosition.latitude,
        lng: markerPosition.longitude,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        total_price: totalPrice,
        booking_type: bookingType
      };

      await createPaymentWithBooking(
        totalPrice,
        `Paseo HappiWalk - ${selectedPets.length} Mascota(s)`,
        bookingData
      );

      Alert.alert(
        'Pago en proceso',
        'Serás redirigido a Mercado Pago para completar el pago. Te notificaremos cuando tu reserva sea confirmada.',
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      console.error('Error en handlePaymentSuccess:', error);
      Alert.alert('Error', error.message || 'No se pudo iniciar el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider="google"
            region={{
              ...markerPosition,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
            onRegionChangeComplete={(r) => {
              if (address.trim().length > 0) {
                setMarkerPosition({ latitude: r.latitude, longitude: r.longitude });
                setAddressConfirmed(true);
              }
            }}
          >
            <Marker
              coordinate={markerPosition}
              draggable
              onDragEnd={(e) => {
                const pos = e.nativeEvent.coordinate;
                setMarkerPosition(pos);
                if (address.trim().length > 0) {
                  setAddressConfirmed(true);
                }
              }}
            />
          </MapView>

          <View style={styles.mapHeader}>
            <TouchableOpacity style={styles.backBtnCompact} onPress={() => router.back()}>
              <ArrowLeft size={22} color="#111827" />
            </TouchableOpacity>
            <View style={styles.gpsWrapper}>
              <TouchableOpacity style={styles.gpsBtn} onPress={handleCurrentLocation}>
                {gettingLocation ? (
                  <ActivityIndicator size="small" color="#0EA5E9" />
                ) : (
                  <MapPin size={20} color="#0EA5E9" />
                )}
              </TouchableOpacity>
              <Text style={styles.gpsLabel}>Mi ubicación</Text>
            </View>
          </View>
        </View>

        <ScrollView ref={scrollRef} style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={styles.label}>¿Quiénes van al paseo?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petsScroll}>
            {pets.map((pet) => (
              <TouchableOpacity
                key={pet.id}
                style={[
                  styles.petButton,
                  selectedPets.includes(pet.id) && styles.petButtonSelected,
                ]}
                onPress={() => handleSelectPet(pet.id)}
              >
                <Dog size={16} color={selectedPets.includes(pet.id) ? '#052e05' : '#9CA3AF'} />
                <Text style={[styles.petName, selectedPets.includes(pet.id) && styles.petNameSelected]}>
                  {pet.name}
                </Text>
                {selectedPets.includes(pet.id) && <Check size={14} color="#052e05" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addPetButton} onPress={() => router.push('/pets')}>
              <Text style={styles.addPetText}>+ Nueva</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.bookingTypeToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, bookingType === 'schedule' && styles.toggleBtnActive]}
              onPress={() => setBookingType('schedule')}
            >
              <Text style={[styles.toggleText, bookingType === 'schedule' && styles.toggleTextActive]}>PROGRAMAR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, bookingType === 'now' && styles.toggleBtnActive]}
              onPress={() => setBookingType('now')}
            >
              <Text style={[styles.toggleText, bookingType === 'now' && styles.toggleTextActive]}>PEDIR YA</Text>
            </TouchableOpacity>
          </View>

          {bookingType === 'schedule' && (
            <>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Clock size={16} color="#9CA3AF" />
                  <View style={styles.dateInputContent}>
                    <Text style={styles.inputLabel}>Fecha</Text>
                    <Text style={styles.dateTimeText}>{date.toLocaleDateString('es-CO')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateInput} onPress={() => setShowTimePicker(true)}>
                  <Clock size={16} color="#9CA3AF" />
                  <View style={styles.dateInputContent}>
                    <Text style={styles.inputLabel}>Hora</Text>
                    <Text style={styles.dateTimeText}>{time.toTimeString().slice(0, 5)}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {checkingAvailability ? (
                <View style={styles.availabilityLoading}>
                  <ActivityIndicator size="small" color="#0EA5E9" />
                  <Text style={styles.availabilityText}>Verificando disponibilidad...</Text>
                </View>
              ) : availableWalkers > 0 ? (
                <View style={[styles.availabilityBox, styles.availabilityYes]}>
                  <Text style={styles.availabilityYesText}>✓</Text>
                  <Text style={styles.availabilityYesLabel}>{availableWalkers} paseador(es) disponible(s) en tu zona</Text>
                </View>
              ) : (
                <View style={styles.noWalkersBox}>
                  <Text style={styles.noWalkersIcon}>🐕</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noWalkersTitle}>No hay paseadores en tu zona</Text>
                    <Text style={styles.noWalkersSubtitle}>Intenta en otro lugar o más tarde</Text>
                  </View>
                </View>
              )}

              {nearbyWalkers.length > 0 && (
                <View style={styles.walkerSelection}>
                  <Text style={styles.labelSmall}>Elige un paseador (opcional)</Text>
                  <TouchableOpacity
                    style={[styles.nearbyWalkerBtn, !selectedWalker && styles.nearbyWalkerSelected]}
                    onPress={() => setSelectedWalker(null)}
                  >
                    <View style={styles.walkerPlaceholder}>
                      <Text style={styles.questionMark}>?</Text>
                    </View>
                    <View style={styles.nearbyWalkerInfo}>
                      <Text style={styles.nearbyWalkerName}>Cualquier paseador</Text>
                      <Text style={styles.nearbyWalkerRating}>El primero disponible</Text>
                    </View>
                    {!selectedWalker && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>
                  {nearbyWalkers.map((walker) => (
                    <TouchableOpacity
                      key={walker.id}
                      style={[styles.nearbyWalkerBtn, selectedWalker?.id === walker.id && styles.nearbyWalkerSelected]}
                      onPress={() => setSelectedWalker(walker)}
                    >
                      <View style={[styles.walkerPlaceholder, styles.walkerImg]}>
                        <Text style={styles.walkerInitial}>{(walker.name || walker.user_profiles?.first_name || 'P')[0]}</Text>
                      </View>
                      <View style={styles.nearbyWalkerInfo}>
                        <Text style={styles.nearbyWalkerName}>{walker.name || walker.user_profiles?.first_name || 'Paseador'}</Text>
                        <Text style={styles.nearbyWalkerRating}>⭐ {walker.rating ? walker.rating.toFixed(1) : 'Nuevo'}</Text>
                      </View>
                      {selectedWalker?.id === walker.id && <Text style={styles.checkMark}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          <Text style={styles.label}>Punto de encuentro</Text>
          <View style={styles.addressInputWrapper}>
            <View style={[styles.addressInput, addressError && styles.addressInputError]}>
              <MapPin size={18} color={addressError ? '#EF4444' : '#0EA5E9'} />
              <TextInput
                style={styles.addressText}
                value={address}
                onChangeText={(text) => { 
                  setIsUserEditingAddress(true);
                  setAddress(text); 
                  setAddressError(''); 
                  if (!text) setAddressSuggestions([]);
                }}
                placeholder="Busca tu dirección..."
                placeholderTextColor="#9CA3AF"
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {searchingAddress && <ActivityIndicator size="small" color="#0EA5E9" style={styles.searchingIndicator} />}
            </View>
            {addressError ? (
              <Text style={styles.addressErrorText}>{addressError}</Text>
            ) : null}
            {isUserEditingAddress && addressSuggestions.length > 0 && !addressError && (
              <View style={styles.suggestionsBox}>
                {addressSuggestions.slice(0, 5).map((suggestion: any, index: number) => (
                  <TouchableOpacity
                    key={suggestion.placeId}
                    style={[
                      styles.suggestionItem,
                      index === addressSuggestions.length - 1 && styles.suggestionItemLast,
                    ]}
                    onPress={() => handleSelectSuggestion(suggestion)}
                  >
                    <MapPin size={14} color="#9CA3AF" />
                    <View style={styles.suggestionText}>
                      <Text style={styles.suggestionMain} numberOfLines={1}>{suggestion.mainText}</Text>
                      <Text style={styles.suggestionSecondary} numberOfLines={1}>{suggestion.secondaryText}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <Text style={styles.durationLabel}>Duración del Paseo</Text>
          <View style={styles.durationRow}>
            {Object.entries(HOURS).map(([key, hours]) => {
              const priceForDuration = walkerPrice * hours;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.durationBtn, duration === key && styles.durationBtnActive]}
                  onPress={() => setDuration(key)}
                >
                  <Text style={[styles.durationText, duration === key && styles.durationTextActive]}>{key}</Text>
                  <Text style={[styles.durationPrice, duration === key && styles.durationPriceActive]}>${(priceForDuration / 1000)}k</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {petCount > 1 && <Text style={styles.petCountText}>{petCount} mascotas</Text>}

          {!isReadyForPayment && (
            <View style={styles.progressHint}>
              <Text style={styles.progressHintText}>
                {selectedPets.length === 0 ? '① Selecciona una mascota' :
                 !address ? '② Ingresa la dirección' :
                 bookingType === 'schedule' && (!date || !time) ? '③ Elige fecha y hora' : ''}
              </Text>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>

        {isReadyForPayment && (
        <View style={styles.fixedBottom}>
          <View style={styles.priceContainer}>
            <Text style={styles.totalLabel}>Total Servicio</Text>
            <Text style={styles.totalPrice}>${totalPrice.toLocaleString('es-CO')}</Text>
            {petCount > 1 && <Text style={styles.petCountSubtext}>{petCount} mascotas</Text>}
          </View>

          {walletBalance > 0 && (
            <View style={styles.paymentToggle}>
              <TouchableOpacity
                style={[styles.paymentBtn, paymentMethod === 'wallet' && styles.paymentBtnActive]}
                onPress={() => setPaymentMethod('wallet')}
              >
                <Wallet size={12} color={paymentMethod === 'wallet' ? '#fff' : '#9CA3AF'} />
                <Text style={[styles.paymentText, paymentMethod === 'wallet' && styles.paymentTextActive]}>
                  Saldo ${walletBalance.toLocaleString()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentBtn, paymentMethod === 'mercadopago' && styles.paymentBtnMP]}
                onPress={() => setPaymentMethod('mercadopago')}
              >
                <CreditCard size={12} color={paymentMethod === 'mercadopago' ? '#fff' : '#9CA3AF'} />
                <Text style={[styles.paymentText, paymentMethod === 'mercadopago' && styles.paymentTextActive]}>
                  Tarjeta
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!walletBalance && (
            <TouchableOpacity onPress={() => setPaymentMethod('mercadopago')} style={styles.addCardLink}>
              <Text style={styles.addCardText}>+ Pagar con tarjeta</Text>
            </TouchableOpacity>
          )}

          {paymentMethod === 'wallet' && walletBalance > 0 && walletBalance < totalPrice && (
            <View style={styles.insufficientBalance}>
              <Text style={styles.insufficientText}>
                Saldo insuficiente (${walletBalance.toLocaleString()}).{' '}
                <Text style={styles.linkText} onPress={() => setPaymentMethod('mercadopago')}>
                  Paga con tarjeta
                </Text>
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.confirmBtnFull, (loading || !isReadyForPayment) && styles.confirmBtnDisabled]}
            onPress={async () => {
              try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              paymentMethod === 'wallet' && walletBalance >= totalPrice ? handlePaymentWithWallet() : handlePaymentSuccess();
            }}
            disabled={!isReadyForPayment || loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={[styles.confirmBtnText, !isReadyForPayment && styles.confirmBtnTextDisabled]}>
                {paymentMethod === 'wallet' && walletBalance >= totalPrice
                  ? 'Pagar con Billetera'
                  : 'Reservar'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        )}

        {showDatePicker && (
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerCancel}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Fecha</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerDone}>Listo</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) setDate(selectedDate);
                }}
                minimumDate={new Date()}
              />
            </View>
          </View>
        )}

        {showTimePicker && (
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={styles.pickerCancel}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Hora</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={styles.pickerDone}>Listo</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={time}
                mode="time"
                display="spinner"
                onChange={(event, selectedTime) => {
                  if (selectedTime) setTime(selectedTime);
                }}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardView: {
    flex: 1,
  },
  mapContainer: {
    height: '30%',
    minHeight: 240,
    width: '100%',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapHeader: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  backBtnCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gpsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  gpsWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  gpsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 200,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
  },
  labelSmall: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  petsScroll: {
    marginBottom: 4,
  },
  petButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    marginRight: 10,
  },
  petButtonSelected: {
    borderColor: '#0EA5E9',
    backgroundColor: '#ECFDF5',
  },
  petName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  petNameSelected: {
    color: '#052e05',
  },
  addPetButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
  },
  addPetText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  addressInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 10,
  },
  addressInputError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  searchingIndicator: {
    marginLeft: 'auto',
  },
  addressErrorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 6,
    marginLeft: 4,
  },
  addressInputWrapper: {
    position: 'relative',
    zIndex: 100,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  suggestionsBox: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 14,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionMain: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  suggestionSecondary: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 2,
  },
  bookingTypeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
    marginTop: 6,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#9CA3AF',
  },
  toggleTextActive: {
    color: '#065F46',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  dateInput: {
    flex: 1,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateInputContent: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dateTimeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  availabilityLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  availabilityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 10,
  },
  availabilityYes: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  availabilityYesText: {
    fontSize: 16,
  },
  availabilityYesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#052e05',
    flex: 1,
  },
  availabilityNoText: {
    fontSize: 16,
  },
  noWalkersBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noWalkersIcon: {
    fontSize: 24,
  },
  noWalkersTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  noWalkersSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#B45309',
    flex: 1,
  },
  walkerSelection: {
    marginTop: 8,
  },
  nearbyWalkerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 8,
  },
  nearbyWalkerSelected: {
    borderColor: '#0EA5E9',
    backgroundColor: '#ECFDF5',
  },
  walkerPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkerImg: {
    backgroundColor: '#ECFDF5',
  },
  walkerInitial: {
    fontSize: 16,
    fontWeight: '900',
    color: '#052e05',
  },
  questionMark: {
    fontSize: 18,
    fontWeight: '900',
    color: '#9CA3AF',
  },
  nearbyWalkerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nearbyWalkerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  nearbyWalkerRating: {
    fontSize: 12,
    color: '#6B7280',
  },
  checkMark: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0EA5E9',
  },
  durationLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 24,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  durationBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    alignItems: 'center',
  },
  durationBtnActive: {
    borderColor: '#0EA5E9',
    backgroundColor: '#ECFDF5',
  },
  durationText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#9CA3AF',
  },
  durationTextActive: {
    color: '#052e05',
  },
  durationPrice: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 4,
  },
  durationPriceActive: {
    color: '#052e05',
  },
  petCountText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
bottomPadding: {
    height: 20,
  },
  progressHint: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  progressHintText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    textAlign: 'center',
  },
  priceContainer: {
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
  },
  petCountSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  confirmBtnFull: {
    backgroundColor: '#0EA5E9',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confirmBtnTextDisabled: {
    color: '#9CA3AF',
  },
  paymentToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginTop: 12,
  },
  paymentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  paymentBtnActive: {
    backgroundColor: '#0EA5E9',
  },
  paymentBtnMP: {
    backgroundColor: '#0EA5E9',
  },
  paymentText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#9CA3AF',
  },
  paymentTextActive: {
    color: '#FFFFFF',
  },
  insufficientBalance: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  insufficientText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C2410C',
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  addCardLink: {
    marginTop: 8,
    alignItems: 'center',
  },
  addCardText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  fixedBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  fixedBottomCollapsed: {
    paddingVertical: 0,
    padding: 16,
    paddingBottom: 34,
    shadowOpacity: 0,
    elevation: 0,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  pickerCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  pickerDone: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0EA5E9',
  },
});