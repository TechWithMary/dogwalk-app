import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform, Keyboard, ActivityIndicator, KeyboardAvoidingView, TouchableWithoutFeedback, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { searchAddressSuggestions, getPlaceDetails } from '../lib/addressSearch';
import { Dog, MapPin, ChevronDown, AlertCircle, Crosshair } from '../components/Icons';
import { PET_BREEDS, OTHER_BREED_OPTION } from '../constants/pet-breeds';

const ENERGY_LEVELS = [
  { value: 'low', label: 'Baja - Tranquilo' },
  { value: 'medium', label: 'Media - Activo' },
  { value: 'high', label: 'Alta - Muy energético' },
];

export default function OnboardingOwnerScreen() {
  const router = useRouter();
  const [petData, setPetData] = useState({
    name: '',
    breed: '',
    energy_level: 'medium',
    age_years: ''
  });
  const [otherBreed, setOtherBreed] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showBreedPicker, setShowBreedPicker] = useState(false);
  const [showEnergyPicker, setShowEnergyPicker] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [isUserEditingAddress, setIsUserEditingAddress] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

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

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos tu ubicación para encontrar paseadores cercanos');
      }
    } catch (error) {
      console.error('Error requesting location:', error);
    }
  };

  const handleCurrentLocation = async () => {
    try {
      setGettingLocation(true);
      setIsUserEditingAddress(false);
      setAddressSuggestions([]);
      setAddressError('');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Activa el GPS en configuración');
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;

      setCoords({ lat: latitude, lng: longitude });

      const [addressResult] = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      if (addressResult) {
        const fullAddress = [
          addressResult.street,
          addressResult.streetNumber,
          addressResult.district,
          addressResult.city
        ].filter(Boolean).join(', ');
        setAddress(fullAddress);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo obtener la ubicación');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSelectSuggestion = async (suggestion: any) => {
    setIsUserEditingAddress(false);
    setAddressSuggestions([]);
    setAddressError('');
    const details = await getPlaceDetails(suggestion.placeId);
    if (details) {
      setAddress(details.address);
      setCoords({ lat: details.lat, lng: details.lng });
    } else {
      setAddress(suggestion.mainText || suggestion.description);
      setAddressError('No se pudieron obtener los detalles de la dirección');
    }
    Keyboard.dismiss();
  };

  const handleCompleteProfile = async () => {
    if (!petData.name.trim() || !petData.breed) {
      Alert.alert('Error', 'Completa los datos de tu mascota');
      return;
    }

    if (!coords.lat || !coords.lng) {
      Alert.alert('Error', 'Selecciona una dirección usando el buscador o GPS');
      return;
    }

    if (petData.breed === OTHER_BREED_OPTION && !otherBreed.trim()) {
      Alert.alert('Error', 'Especifica la raza de tu mascota');
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

      const finalBreed = petData.breed === OTHER_BREED_OPTION ? otherBreed.trim() : petData.breed.trim();

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

      Alert.alert('Éxito', '¡Registro completado!');
      router.replace('/(tabs)');

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedEnergyLabel = ENERGY_LEVELS.find(e => e.value === petData.energy_level)?.label || 'Media - Activo';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Dog size={32} color="#059669" />
            </View>
            <Text style={styles.title}>¡Bienvenido!</Text>
            <Text style={styles.subtitle}>Configura el perfil de tu manada</Text>
          </View>

          <View style={styles.form}>
            <View>
              <Text style={styles.label}>¿Dónde vive tu mascota? *</Text>
              <View style={styles.addressInputWrapper}>
                <View style={[styles.addressInput, addressError && styles.addressInputError]}>
                  <MapPin size={18} color="#9CA3AF" />
                  <TextInput
                    style={styles.addressTextInput}
                    value={address}
                    onChangeText={(text) => {
                      setIsUserEditingAddress(true);
                      setAddress(text);
                      setAddressError('');
                      if (!text) setAddressSuggestions([]);
                    }}
                    placeholder="Escribe tu dirección..."
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                  {searchingAddress && <ActivityIndicator size="small" color="#059669" style={styles.searchingIndicator} />}
                  <TouchableOpacity
                    style={styles.locationBtn}
                    onPress={handleCurrentLocation}
                    disabled={gettingLocation}
                  >
                    {gettingLocation ? <Text style={styles.locationIcon}>⏳</Text> : <Crosshair size={18} color="#059669" />}
                  </TouchableOpacity>
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
            </View>

            <View style={styles.divider} />

            <View>
              <Text style={styles.label}>Nombre de tu mascota *</Text>
              <TextInput
                style={styles.input}
                value={petData.name}
                onChangeText={(text) => setPetData({ ...petData, name: text })}
                placeholder="Ej. Bruno"
                placeholderTextColor="#9CA3AF"
                returnKeyType="next"
              />
            </View>

            <View style={styles.row}>
              <View style={styles.colLeft}>
                <Text style={styles.label}>Raza *</Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => setShowBreedPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.selectText, !petData.breed && styles.placeholder]}>
                    {petData.breed === OTHER_BREED_OPTION
                      ? otherBreed || 'Selecciona'
                      : petData.breed || 'Selecciona'}
                  </Text>
                  <ChevronDown size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <View style={styles.colRight}>
                <Text style={styles.label}>Edad (Años)</Text>
                <TextInput
                  style={styles.input}
                  value={petData.age_years}
                  onChangeText={(text) => setPetData({ ...petData, age_years: text })}
                  placeholder="0"
                  keyboardType="number-pad"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>
            </View>

            <View>
              <Text style={styles.label}>Nivel de Energía</Text>
              <TouchableOpacity
                style={styles.selectInput}
                onPress={() => setShowEnergyPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.selectText}>{selectedEnergyLabel}</Text>
                <ChevronDown size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.warningBox}>
              <AlertCircle size={18} color="#059669" />
              <Text style={styles.warningText}>
                Es obligatorio que tu mascota tenga sus vacunas al día para usar el servicio.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleCompleteProfile}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>
                {loading ? '⏳' : 'Finalizar Registro'}
              </Text>
              {!loading && <Text style={styles.arrow}>→</Text>}
            </TouchableOpacity>
          </View>

          {/* Breed Picker Modal */}
          <Modal visible={showBreedPicker} transparent animationType="fade" onRequestClose={() => setShowBreedPicker(false)}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowBreedPicker(false)}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Selecciona la raza</Text>
                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  {PET_BREEDS.map((breed: string) => (
                    <TouchableOpacity
                      key={breed}
                      style={styles.modalOption}
                      onPress={() => {
                        setPetData({ ...petData, breed });
                        setShowBreedPicker(false);
                        if (breed !== OTHER_BREED_OPTION) setOtherBreed('');
                      }}
                    >
                      <Text style={[styles.modalOptionText, petData.breed === breed && styles.modalOptionTextActive]}>
                        {breed}
                      </Text>
                      {petData.breed === breed && <Text style={styles.modalCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                  {petData.breed === OTHER_BREED_OPTION && (
                    <View style={styles.modalOtherInput}>
                      <TextInput
                        style={styles.modalTextInput}
                        value={otherBreed}
                        onChangeText={setOtherBreed}
                        placeholder="Escribe la raza..."
                        placeholderTextColor="#9CA3AF"
                        autoFocus
                      />
                    </View>
                  )}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Energy Picker Modal */}
          <Modal visible={showEnergyPicker} transparent animationType="fade" onRequestClose={() => setShowEnergyPicker(false)}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEnergyPicker(false)}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Nivel de Energía</Text>
                {ENERGY_LEVELS.map((level) => (
                  <TouchableOpacity
                    key={level.value}
                    style={styles.modalOption}
                    onPress={() => {
                      setPetData({ ...petData, energy_level: level.value });
                      setShowEnergyPicker(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, petData.energy_level === level.value && styles.modalOptionTextActive]}>
                      {level.label}
                    </Text>
                    {petData.energy_level === level.value && <Text style={styles.modalCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginTop: 4,
    letterSpacing: 1,
  },
  form: {
    gap: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    height: 56,
  },
  addressInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    height: 56,
    gap: 12,
  },
  addressTextInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  locationBtn: {
    padding: 4,
  },
  locationIcon: {
    fontSize: 18,
  },
  addressInputWrapper: {
    position: 'relative',
    zIndex: 100,
  },
  addressInputError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  searchingIndicator: {
    marginLeft: 4,
  },
  addressErrorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 6,
    marginLeft: 4,
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
    zIndex: 200,
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
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  colLeft: {
    flex: 1,
  },
  colRight: {
    flex: 1,
  },
  selectInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    height: 56,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  placeholder: {
    color: '#9CA3AF',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 12,
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    color: '#065F46',
    textTransform: 'uppercase',
    lineHeight: 16,
  },
  submitBtn: {
    backgroundColor: '#13EC13',
    borderRadius: 24,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    gap: 8,
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  arrow: {
    fontSize: 18,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxHeight: '60%',
    padding: 20,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalScroll: {
    maxHeight: 300,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  modalOptionTextActive: {
    color: '#059669',
    fontWeight: '900',
  },
  modalCheck: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '900',
  },
  modalOtherInput: {
    paddingVertical: 8,
  },
  modalTextInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
});
