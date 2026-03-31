import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, Platform, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { Dog, MapPin, Clock, ChevronLeft, Loader2, Check, Star, CreditCard, Calendar } from '../components/Icons';

const PRICES: any = { '1h': 30000, '2h': 55000, '3h': 75000 };

const CENTER_MEDELLIN = {
  latitude: 6.2442,
  longitude: -75.5812,
};

interface Walker {
  id: string;
  name: string;
  location: string;
  rating: number;
  price: number;
  img: string;
  service_latitude?: number;
  service_longitude?: number;
  service_radius_km?: number;
  user_profiles?: {
    profile_photo_url: string;
    first_name?: string;
    last_name?: string;
  };
}

interface Pet {
  id: string;
  name: string;
  breed?: string;
  size?: string;
  photo_url?: string;
}

export default function BookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const walkerId = params.walkerId as string;

  const mapRef = useRef<MapView>(null);

  const [step, setStep] = useState(1);
  const [walkers, setWalkers] = useState<Walker[]>([]);
  const [selectedWalker, setSelectedWalker] = useState<Walker | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPets, setSelectedPets] = useState<string[]>([]);
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [duration, setDuration] = useState('1h');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [nearbyWalkers, setNearbyWalkers] = useState<any[]>([]);
  const [availableWalkers, setAvailableWalkers] = useState(0);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [bookingType, setBookingType] = useState<'schedule' | 'now'>('schedule');
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'mercadopago'>('wallet');
  const [region, setRegion] = useState({ ...CENTER_MEDELLIN, latitudeDelta: 0.015, longitudeDelta: 0.015 });
  const [markerPosition, setMarkerPosition] = useState(CENTER_MEDELLIN);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (walkerId) {
      const walker = walkers.find(w => w.id === walkerId);
      if (walker) {
        setSelectedWalker(walker);
      }
    }
  }, [walkerId, walkers]);

  useEffect(() => {
    if (bookingType === 'schedule' || bookingType === 'now') {
      checkAvailability();
    }
  }, [date, time, bookingType, markerPosition]);

  const fetchData = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);

    const { data: walkersData } = await supabase
      .from('walkers')
      .select('*, user_profiles(*)')
      .eq('overall_verification_status', 'approved')
      .limit(20);
    setWalkers(walkersData || []);

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

  const handleSelectPet = (petId: string) => {
    setSelectedPets(prev => 
      prev.includes(petId) 
        ? prev.filter(p => p !== petId)
        : [...prev, petId]
    );
  };

  const basePrice = PRICES[duration] || 30000;
  const petCount = selectedPets.length;
  const additionalPetPrice = 10000;
  const totalPrice = basePrice + (petCount > 1 ? (petCount - 1) * additionalPetPrice : 0);

  const formatPrice = (price: number) => {
    return '$' + (price || 0).toLocaleString('es-CO');
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
          addr.country
        ].filter(Boolean).join(', ');
        setAddress(fullAddress || `${addr.street || ''}, ${addr.subregion || ''}, ${addr.region || ''}`.replace(/^, |, $/g, ''));
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo obtener la ubicación');
    } finally {
      setGettingLocation(false);
    }
  };

  const checkAvailability = async () => {
    setCheckingAvailability(true);
    try {
      const { data: verifiedWalkers } = await supabase
        .from('walkers')
        .select('id, user_id, name, img, rating, service_latitude, service_longitude, service_radius_km, user_profiles(first_name, last_name)')
        .eq('overall_verification_status', 'approved');
      
      setNearbyWalkers(verifiedWalkers || []);
      setAvailableWalkers(verifiedWalkers?.length || 0);
    } catch (err) {
      console.error('Error:', err);
      setNearbyWalkers(walkers);
      setAvailableWalkers(walkers.length);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSelectWalker = (walker: Walker | null) => {
    setSelectedWalker(walker);
    setStep(2);
  };

  const handleConfirmBooking = async () => {
    if (selectedPets.length === 0) {
      Alert.alert('Error', 'Selecciona al menos una mascota');
      return;
    }
    if (!address) {
      Alert.alert('Error', 'Ingresa una dirección');
      return;
    }

    const dateStr = date.toISOString().split('T')[0];
    const timeStr = time.toTimeString().slice(0, 5);

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          address: address,
          duration: duration,
          total_price: totalPrice,
          status: selectedWalker ? 'accepted' : 'pending',
          walker_id: selectedWalker?.id || null,
          scheduled_date: dateStr,
          scheduled_time: timeStr,
          pet_count: petCount,
          pet_ids: selectedPets,
          notes: notes,
          lat: markerPosition.latitude,
          lng: markerPosition.longitude,
        })
        .select()
        .single();

      if (error) throw error;

      Alert.alert('Éxito', 'Tu paseo ha sido reservado', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/messages') }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al crear la reserva');
    } finally {
      setLoading(false);
    }
  };

  const isReadyForPayment = selectedPets.length > 0 && address.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'ios' ? undefined : PROVIDER_GOOGLE}
          region={{
            ...markerPosition,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }}
          onRegionChangeComplete={(r) => setMarkerPosition(r)}
        >
          <Marker
            coordinate={markerPosition}
            draggable
            onDragEnd={(e) => {
              setMarkerPosition(e.nativeEvent.coordinate);
            }}
          />
        </MapView>
        
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.gpsFloatingBtn} onPress={handleCurrentLocation}>
          {gettingLocation ? (
            <ActivityIndicator size="small" color="#10B981" />
          ) : (
            <MapPin size={28} color="#10B981" />
          )}
        </TouchableOpacity>


      </View>

      <ScrollView ref={scrollRef} style={styles.content} showsVerticalScrollIndicator={false}>
        {step === 1 ? (
          <>
            <Text style={styles.sectionTitle}>Paseadores Cercanos</Text>
            <TouchableOpacity
              style={[
                styles.walkerOption,
                !selectedWalker && styles.walkerOptionSelected
              ]}
              onPress={() => handleSelectWalker(null)}
            >
              <View style={styles.walkerOptionImg}>
                <Text style={styles.questionMark}>?</Text>
              </View>
              <View style={styles.walkerOptionInfo}>
                <Text style={styles.walkerOptionName}>Cualquier paseador</Text>
                <Text style={styles.walkerOptionSub}>El primero disponible</Text>
              </View>
              {!selectedWalker && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
            {walkers.map((walker) => {
              const fullName = walker.user_profiles 
                ? `${walker.user_profiles.first_name || ''} ${walker.user_profiles.last_name || ''}`.trim() 
                : (walker.name || 'Paseador');
              
              return (
                <TouchableOpacity
                  key={walker.id}
                  style={[
                    styles.walkerOption,
                    selectedWalker?.id === walker.id && styles.walkerOptionSelected
                  ]}
                  onPress={() => handleSelectWalker(walker)}
                >
                  {walker.user_profiles?.profile_photo_url ? (
                    <Image
                      source={{ uri: walker.user_profiles.profile_photo_url }}
                      style={styles.walkerOptionImg}
                    />
                  ) : (
                    <View style={[styles.walkerOptionImg, styles.walkerImgPlaceholder]}>
                      <Text style={styles.walkerInitial}>
                        {(fullName || 'P')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.walkerOptionInfo}>
                    <Text style={styles.walkerOptionName}>{fullName}</Text>
                    <Text style={styles.walkerOptionSub}>⭐ {walker.rating ? walker.rating.toFixed(1) : 'Nuevo'}</Text>
                  </View>
                  {selectedWalker?.id === walker.id && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </>
        ) : (
          <>
            <View style={styles.selectedWalkerCard}>
              <Text style={styles.selectedLabel}>Paseador Seleccionado</Text>
              {selectedWalker ? (
                <View style={styles.selectedWalkerInfo}>
                  {selectedWalker.user_profiles?.profile_photo_url ? (
                    <Image
                      source={{ uri: selectedWalker.user_profiles.profile_photo_url }}
                      style={styles.selectedWalkerImg}
                    />
                  ) : (
                    <View style={[styles.selectedWalkerImg, styles.walkerImgPlaceholder]}>
                      <Text style={styles.walkerInitial}>
                        {(selectedWalker.name || 'P')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.selectedWalkerName}>{selectedWalker.name || 'Paseador'}</Text>
                    <Text style={styles.selectedWalkerPrice}>⭐ {selectedWalker.rating ? selectedWalker.rating.toFixed(1) : 'Nuevo'}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.anyWalkerText}>Cualquier paseador disponible</Text>
              )}
              <TouchableOpacity onPress={() => setStep(1)}>
                <Text style={styles.changeLink}>Cambiar</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>¿Quiénes van al paseo?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petsScroll}>
              {pets.map((pet) => (
                <TouchableOpacity
                  key={pet.id}
                  style={[
                    styles.petButton,
                    selectedPets.includes(pet.id) && styles.petButtonSelected
                  ]}
                  onPress={() => handleSelectPet(pet.id)}
                >
                  <Dog size={16} color={selectedPets.includes(pet.id) ? '#059669' : '#9CA3AF'} />
                  <Text style={[
                    styles.petName,
                    selectedPets.includes(pet.id) && styles.petNameSelected
                  ]}>
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
                <Text style={[styles.toggleText, bookingType === 'schedule' && styles.toggleTextActive]}>
                  PROGRAMAR
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, bookingType === 'now' && styles.toggleBtnActive]}
                onPress={() => setBookingType('now')}
              >
                <Text style={[styles.toggleText, bookingType === 'now' && styles.toggleTextActive]}>
                  PEDIR YA
                </Text>
              </TouchableOpacity>
            </View>

            {bookingType === 'schedule' && (
              <View style={styles.dateTimeRow}>
                <TouchableOpacity style={styles.dateInput} onPress={() => { scrollToTop(); setTimeout(() => setShowDatePicker(true), 300); }}>
                  <Calendar size={16} color="#9CA3AF" />
                  <View style={styles.dateInputContent}>
                    <Text style={styles.inputLabel}>Fecha</Text>
                    <Text style={styles.dateTimeText}>
                      {date.toLocaleDateString('es-CO')}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateInput} onPress={() => { scrollToTop(); setTimeout(() => setShowTimePicker(true), 300); }}>
                  <Clock size={16} color="#9CA3AF" />
                  <View style={styles.dateInputContent}>
                    <Text style={styles.inputLabel}>Hora</Text>
                    <Text style={styles.dateTimeText}>
                      {time.toTimeString().slice(0, 5)}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {bookingType === 'schedule' && (
              <>
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
                        <Text style={styles.availabilityYesLabel}>{availableWalkers} paseador(es) disponible(s)</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.availabilityNoText}>✕</Text>
                        <Text style={styles.availabilityNoLabel}>No hay paseadores disponibles</Text>
                      </>
                    )}
                  </View>
                )}

                {nearbyWalkers.length > 0 && (
                  <View style={styles.walkerSelection}>
                    <Text style={styles.label}>Elige un paseador (opcional)</Text>
                    {nearbyWalkers.map(walker => (
                      <TouchableOpacity
                        key={walker.id}
                        style={[
                          styles.nearbyWalkerBtn,
                          selectedWalker?.id === walker.id && styles.nearbyWalkerSelected
                        ]}
                        onPress={() => setSelectedWalker(walker)}
                      >
                        <View style={styles.nearbyWalkerInfo}>
                          <Text style={styles.nearbyWalkerName}>{walker.name || walker.user_profiles?.first_name || 'Paseador'}</Text>
                          <Text style={styles.nearbyWalkerRating}>⭐ {walker.rating || 'Nuevo'}</Text>
                        </View>
                        {selectedWalker?.id === walker.id && <Check size={16} color="#059669" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            <Text style={styles.label}>Duración del Paseo</Text>
            <View style={styles.durationRow}>
              {Object.entries(PRICES).map(([key, price]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.durationBtn,
                    duration === key && styles.durationBtnActive
                  ]}
                  onPress={() => setDuration(key)}
                >
                  <Text style={[
                    styles.durationText,
                    duration === key && styles.durationTextActive
                  ]}>
                    {key}
                  </Text>
                  <Text style={[
                    styles.durationPrice,
                    duration === key && styles.durationPriceActive
                  ]}>
                    ${(Number(price)/1000)}k
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {petCount > 1 && (
              <Text style={styles.petCountText}>{petCount} mascotas</Text>
            )}

            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total Servicio</Text>
              <Text style={styles.totalPrice}>{formatPrice(totalPrice)}</Text>
            </View>

            {walletBalance > 0 && (
              <View style={styles.paymentToggle}>
                <TouchableOpacity
                  style={[styles.paymentBtn, paymentMethod === 'wallet' && styles.paymentBtnActive]}
                  onPress={() => setPaymentMethod('wallet')}
                >
                  <Text style={[styles.paymentText, paymentMethod === 'wallet' && styles.paymentTextActive]}>
                    Billetera (${walletBalance.toLocaleString()})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.paymentBtn, paymentMethod === 'mercadopago' && styles.paymentBtnMP]}
                  onPress={() => setPaymentMethod('mercadopago')}
                >
                  <Text style={[styles.paymentText, paymentMethod === 'mercadopago' && styles.paymentTextActive]}>
                    Tarjeta
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.confirmBtn, (!isReadyForPayment || loading) && styles.confirmBtnDisabled]}
              onPress={handleConfirmBooking}
              disabled={!isReadyForPayment || loading}
            >
              <Text style={styles.confirmBtnText}>
                {loading ? 'Reservando...' : paymentMethod === 'wallet' ? 'Pagar con Billetera' : 'Pagar con Tarjeta'}
              </Text>
            </TouchableOpacity>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showDatePicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowDatePicker(false)} activeOpacity={1}>
          <View style={styles.modalContent}>
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
        </TouchableOpacity>
      </Modal>

      <Modal visible={showTimePicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowTimePicker(false)} activeOpacity={1}>
          <View style={styles.modalContent}>
            <DateTimePicker
              value={time}
              mode="time"
              display="spinner"
              onChange={(event, selectedTime) => {
                if (selectedTime) setTime(selectedTime);
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    position: 'relative',
  },
  mapContainer: {
    height: 280,
    width: '100%',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
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
  locationBtn: {
    position: 'absolute',
    bottom: 20,
    right: 16,
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
    bottom: 80,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
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
    padding: 20,
    marginTop: -20,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 16,
    marginTop: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 16,
  },
  walkerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 8,
  },
  walkerOptionSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  walkerOptionImg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkerImgPlaceholder: {
    backgroundColor: '#ECFDF5',
  },
  walkerInitial: {
    fontSize: 18,
    fontWeight: '900',
    color: '#059669',
  },
  questionMark: {
    fontSize: 20,
    fontWeight: '900',
    color: '#9CA3AF',
  },
  walkerOptionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  walkerOptionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  walkerOptionSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  checkMark: {
    fontSize: 18,
    fontWeight: '900',
    color: '#10B981',
  },
  selectedWalkerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    marginBottom: 8,
  },
  selectedLabel: {
    position: 'absolute',
    top: -8,
    left: 16,
    fontSize: 10,
    fontWeight: '900',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 4,
  },
  selectedWalkerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedWalkerImg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    marginRight: 12,
  },
  selectedWalkerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  selectedWalkerPrice: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  anyWalkerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  changeLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
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
  addressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addressInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 12,
  },
  locationBtnInline: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 8,
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
  },
  availabilityNoText: {
    fontSize: 16,
  },
  availabilityNoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
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
  nearbyWalkerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  totalSection: {
    marginTop: 24,
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
  paymentToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginTop: 20,
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
  confirmBtn: {
    marginTop: 20,
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
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  pickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
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
    fontWeight: '700',
    color: '#111827',
  },
  pickerCancel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  pickerDone: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  picker: {
    height: 200,
  },
  pickerModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'flex-end',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  pickerNative: {
    backgroundColor: '#FFFFFF',
    height: 250,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    padding: 20,
    alignItems: 'center',
  },
});
