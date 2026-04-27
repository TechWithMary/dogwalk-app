import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { isWithinRadius } from '../lib/distance';
import { Dog, MapPin, Clock, ChevronLeft, Loader2, Check, Wallet, CreditCard, ArrowLeft } from '../components/Icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const PRICES: Record<string, number> = { '1h': 30000, '2h': 55000, '3h': 75000 };
const ADDITIONAL_PET_PRICE = 10000;
const CENTER_MEDELLIN = { latitude: 6.2442, longitude: -75.5812 };

interface Walker {
  id: string;
  name: string;
  user_id?: string;
  rating: number;
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

  const basePrice = PRICES[duration];
  const petCount = selectedPets.length;
  const totalPrice = basePrice + (petCount > 1 ? (petCount - 1) * ADDITIONAL_PET_PRICE : 0);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (bookingType === 'schedule' || bookingType === 'now') {
      checkAvailability();
    }
  }, [date, time, bookingType, markerPosition, bookingType]);

  const fetchData = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);

    if (currentUser) {
      const { data: petsData } = await supabase
        .from('pets')
        .select('*')
        .eq('owner_id', currentUser.id)
        .eq('is_active', true);
      setPets(petsData || []);
      if (petsData && petsData.length > 0) {
        setSelectedPets([petsData[0].id]);
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('balance')
        .eq('user_id', currentUser.id)
        .single();
      setWalletBalance(parseFloat(profile?.balance || 0));
    }
  };

  const checkAvailability = async () => {
    setCheckingAvailability(true);
    try {
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay();
      const timeStr = time.toTimeString().slice(0, 5);

      const { data: availability, error } = await supabase
        .from('walker_availability')
        .select('walker_id')
        .eq('day_of_week', dayOfWeek)
        .lte('start_time', timeStr)
        .gte('end_time', timeStr);

      if (error) throw error;

      const walkerIds = availability?.map(a => a.walker_id) || [];

      if (walkerIds.length > 0) {
        const { data: verifiedWalkers } = await supabase
          .from('walkers')
          .select('id, user_id, name, img, rating, service_latitude, service_longitude, service_radius_km, user_profiles(first_name, last_name)')
          .eq('overall_verification_status', 'approved')
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
      status: statusOverride || (selectedWalker ? 'accepted' : 'pending'),
      walker_id: selectedWalker?.id || null,
      scheduled_date: finalDate,
      scheduled_time: finalTime,
      lat: markerPosition.latitude,
      lng: markerPosition.longitude,
      pet_ids: selectedPets,
    };
  };

  const handlePaymentWithWallet = async () => {
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
    setLoading(true);
    try {
      const bookingData = createBooking('confirmed');

      const { error } = await supabase.from('bookings').insert(bookingData);
      if (error) throw error;

      const { data: newBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!newBooking) throw new Error('No se pudo crear la reserva');

      await supabase.from('transactions').insert({
        user_id: user.id,
        booking_id: newBooking.id,
        transaction_type: 'payment',
        amount: Number(totalPrice),
        net_amount: Number(totalPrice),
        payment_method: 'credit_card',
        status: 'completed',
        description: `Paseo ${duration} - Pago con tarjeta`,
      });

      Alert.alert('Éxito', '¡Reserva y pago confirmados!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al registrar la reserva');
    } finally {
      setLoading(false);
    }
  };

  const isReadyForPayment = selectedPets.length > 0 && address.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.mapContainer, { paddingTop: insets.top + 8 }]}>
          <MapView
            ref={mapRef}
            style={styles.map}
            region={{
              ...markerPosition,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
            onRegionChangeComplete={(r) => setMarkerPosition({ latitude: r.latitude, longitude: r.longitude })}
          >
            <Marker
              coordinate={markerPosition}
              draggable
              onDragEnd={(e) => {
                const pos = e.nativeEvent.coordinate;
                setMarkerPosition(pos);
              }}
            />
          </MapView>

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.gpsFloatingBtn} onPress={handleCurrentLocation}>
            {gettingLocation ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <MapPin size={24} color="#10B981" />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
                <Dog size={16} color={selectedPets.includes(pet.id) ? '#059669' : '#9CA3AF'} />
                <Text style={[styles.petName, selectedPets.includes(pet.id) && styles.petNameSelected]}>
                  {pet.name}
                </Text>
                {selectedPets.includes(pet.id) && <Check size={14} color="#059669" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addPetButton} onPress={() => router.push('/pets')}>
              <Text style={styles.addPetText}>+ Nueva</Text>
            </TouchableOpacity>
          </ScrollView>

          <Text style={styles.label}>Punto de encuentro</Text>
          <View style={styles.addressInput}>
            <MapPin size={20} color="#10B981" />
            <TextInput
              style={styles.addressText}
              value={address}
              onChangeText={setAddress}
              placeholder="Busca tu dirección..."
              placeholderTextColor="#9CA3AF"
            />
          </View>

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
                  <ActivityIndicator size="small" color="#10B981" />
                  <Text style={styles.availabilityText}>Verificando disponibilidad...</Text>
                </View>
              ) : (
                <View style={[styles.availabilityBox, availableWalkers > 0 ? styles.availabilityYes : styles.availabilityNo]}>
                  {availableWalkers > 0 ? (
                    <>
                      <Text style={styles.availabilityYesText}>✓</Text>
                      <Text style={styles.availabilityYesLabel}>{availableWalkers} paseador(es) disponible(s) en este horario</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.availabilityNoText}>✕</Text>
                      <Text style={styles.availabilityNoLabel}>No hay paseadores disponibles en este horario. Intenta otra hora.</Text>
                    </>
                  )}
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

          <Text style={styles.durationLabel}>Duración del Paseo</Text>
          <View style={styles.durationRow}>
            {Object.entries(PRICES).map(([key, price]) => (
              <TouchableOpacity
                key={key}
                style={[styles.durationBtn, duration === key && styles.durationBtnActive]}
                onPress={() => setDuration(key)}
              >
                <Text style={[styles.durationText, duration === key && styles.durationTextActive]}>{key}</Text>
                <Text style={[styles.durationPrice, duration === key && styles.durationPriceActive]}>${(Number(price) / 1000)}k</Text>
              </TouchableOpacity>
            ))}
          </View>

          {petCount > 1 && <Text style={styles.petCountText}>{petCount} mascotas</Text>}

          <View style={styles.spacer} />
        </ScrollView>

        <View style={styles.fixedBottom}>
          <View style={styles.totalSection}>
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
                <Text style={[styles.paymentText, paymentMethod === 'wallet' && styles.paymentTextActive]}>
                  <Wallet size={14} /> Billetera (${walletBalance.toLocaleString()})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentBtn, paymentMethod === 'mercadopago' && styles.paymentBtnMP]}
                onPress={() => setPaymentMethod('mercadopago')}
              >
                <Text style={[styles.paymentText, paymentMethod === 'mercadopago' && styles.paymentTextActive]}>
                  <CreditCard size={14} /> Tarjeta
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {paymentMethod === 'wallet' && walletBalance < totalPrice && (
            <View style={styles.insufficientBalance}>
              <Text style={styles.insufficientText}>
                Saldo insuficiente (${walletBalance.toLocaleString()}).{' '}
                <Text style={styles.linkText} onPress={() => setPaymentMethod('mercadopago')}>
                  Paga con tarjeta
                </Text>
              </Text>
            </View>
          )}

          {isReadyForPayment ? (
            paymentMethod === 'wallet' && walletBalance >= totalPrice ? (
              <TouchableOpacity
                style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
                onPress={handlePaymentWithWallet}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.confirmBtnText}>Pagar con Billetera</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
                onPress={handlePaymentSuccess}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.confirmBtnText}>Pagar con Tarjeta</Text>
                )}
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity style={[styles.confirmBtn, styles.confirmBtnDisabled]} disabled>
              <Text style={styles.confirmBtnTextDisabled}>
                {selectedPets.length === 0 ? 'Selecciona mascota' : 'Completa datos'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {Platform.OS === 'ios' && showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="spinner"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setDate(selectedDate);
            }}
            minimumDate={new Date()}
          />
        )}

        {Platform.OS === 'ios' && showTimePicker && (
          <DateTimePicker
            value={time}
            mode="time"
            display="spinner"
            onChange={(event, selectedTime) => {
              setShowTimePicker(false);
              if (selectedTime) setTime(selectedTime);
            }}
          />
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
    height: '35%',
    minHeight: 280,
    width: '100%',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  backBtn: {
    position: 'absolute',
    top: 60,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gpsFloatingBtn: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 280,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 16,
  },
  labelSmall: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  petsScroll: {
    marginBottom: 8,
  },
  petButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    marginRight: 12,
  },
  petButtonSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  petName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  petNameSelected: {
    color: '#059669',
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
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  bookingTypeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
    marginTop: 16,
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
    gap: 12,
    marginTop: 16,
  },
  dateInput: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    marginTop: 16,
    gap: 8,
  },
  availabilityYes: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  availabilityNo: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  availabilityYesText: {
    fontSize: 16,
  },
  availabilityYesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    flex: 1,
  },
  availabilityNoText: {
    fontSize: 16,
  },
  availabilityNoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    flex: 1,
  },
  walkerSelection: {
    marginTop: 16,
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
    borderColor: '#10B981',
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
    color: '#059669',
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
    color: '#10B981',
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
    gap: 12,
  },
  durationBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    alignItems: 'center',
  },
  durationBtnActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  durationText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#9CA3AF',
  },
  durationTextActive: {
    color: '#059669',
  },
  durationPrice: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 4,
  },
  durationPriceActive: {
    color: '#059669',
  },
  petCountText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  spacer: {
    height: 40,
  },
  totalSection: {
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  totalPrice: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
  },
  petCountSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  paymentToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginTop: 16,
  },
  paymentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  paymentBtnActive: {
    backgroundColor: '#10B981',
  },
  paymentBtnMP: {
    backgroundColor: '#3B82F6',
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
  confirmBtn: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#10B981',
    borderRadius: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  confirmBtnTextDisabled: {
    fontSize: 14,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
});