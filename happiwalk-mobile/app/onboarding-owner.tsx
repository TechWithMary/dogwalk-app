import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

const BREEDS = [
  "Criollo / Mezcla", "Labrador Retriever", "Golden Retriever", "Pastor Alemán", 
  "Bulldog Francés", "Bulldog Inglés", "Beagle", "Poodle", "Rottweiler", 
  "Yorkshire Terrier", "Boxer", "Dachshund", "Siberian Husky", "Chihuahua", 
  "Border Collie", "Pug", "Shih Tzu", "Cocker Spaniel", "Pitbull", "Doberman",
  "Gran Danés", "Maltés", "Pomerania", "Basset Hound", "Pastor Belga", 
  "Dogo Argentino", "Mastín", "San Bernardo", "Otro"
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
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showBreedPicker, setShowBreedPicker] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

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

  const handleCompleteProfile = async () => {
    if (!petData.name.trim() || !petData.breed) {
      Alert.alert('Error', 'Completa los datos de tu mascota');
      return;
    }
    
    if (!coords.lat || !coords.lng) {
      Alert.alert('Error', 'Selecciona una dirección usando el buscador o GPS');
      return;
    }

    if (petData.breed === 'Otro' && !otherBreed.trim()) {
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

      const finalBreed = petData.breed === 'Otro' ? otherBreed : petData.breed;
      
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

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>🐕</Text>
          </View>
          <Text style={styles.title}>¡Bienvenido!</Text>
          <Text style={styles.subtitle}>Configura el perfil de tu manada</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.formSection}>
            <Text style={styles.label}>¿Dónde vive tu mascota? *</Text>
            <View style={styles.addressInput}>
              <Text style={styles.mapPinIcon}>📍</Text>
              <TextInput
                style={styles.addressTextInput}
                value={address}
                onChangeText={setAddress}
                placeholder="Escribe tu dirección..."
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity 
                style={styles.locationBtn}
                onPress={handleCurrentLocation}
                disabled={gettingLocation}
              >
                <Text style={styles.locationIcon}>{gettingLocation ? '⏳' : '📍'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.formSection}>
            <Text style={styles.label}>Nombre de tu mascota *</Text>
            <TextInput
              style={styles.input}
              value={petData.name}
              onChangeText={(text) => setPetData({ ...petData, name: text })}
              placeholder="Ej. Bruno"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.col, styles.colLeft]}>
              <Text style={styles.label}>Raza *</Text>
              <TouchableOpacity 
                style={styles.selectInput}
                onPress={() => setShowBreedPicker(!showBreedPicker)}
              >
                <Text style={[styles.selectText, !petData.breed && styles.placeholder]}>
                  {petData.breed || 'Selecciona'}
                </Text>
                <Text style={styles.selectArrow}>▼</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.col, styles.colRight]}>
              <Text style={styles.label}>Edad (Años)</Text>
              <TextInput
                style={styles.input}
                value={petData.age_years}
                onChangeText={(text) => setPetData({ ...petData, age_years: text })}
                placeholder="0"
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {showBreedPicker && (
            <View style={styles.breedList}>
              <ScrollView style={styles.breedScroll} nestedScrollEnabled>
                {BREEDS.map((breed) => (
                  <TouchableOpacity
                    key={breed}
                    style={styles.breedOption}
                    onPress={() => {
                      setPetData({ ...petData, breed });
                      setShowBreedPicker(false);
                    }}
                  >
                    <Text style={styles.breedOptionText}>{breed}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {petData.breed === 'Otro' && (
            <View style={styles.formSection}>
              <Text style={styles.label}>Especifica la raza *</Text>
              <TextInput
                style={styles.input}
                value={otherBreed}
                onChangeText={setOtherBreed}
                placeholder="Escribe la raza"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          )}

          <View style={styles.formSection}>
            <Text style={styles.label}>Nivel de Energía</Text>
            <View style={styles.energyOptions}>
              <TouchableOpacity 
                style={[styles.energyBtn, petData.energy_level === 'low' && styles.energyBtnActive]}
                onPress={() => setPetData({ ...petData, energy_level: 'low' })}
              >
                <Text style={[styles.energyText, petData.energy_level === 'low' && styles.energyTextActive]}>Baja</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.energyBtn, petData.energy_level === 'medium' && styles.energyBtnActive]}
                onPress={() => setPetData({ ...petData, energy_level: 'medium' })}
              >
                <Text style={[styles.energyText, petData.energy_level === 'medium' && styles.energyTextActive]}>Media</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.energyBtn, petData.energy_level === 'high' && styles.energyBtnActive]}
                onPress={() => setPetData({ ...petData, energy_level: 'high' })}
              >
                <Text style={[styles.energyText, petData.energy_level === 'high' && styles.energyTextActive]}>Alta</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningIcon}>⚠️</Text>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginTop: 4,
    letterSpacing: 2,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
  },
  formSection: {
    marginBottom: 20,
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
  },
  addressInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  mapPinIcon: {
    fontSize: 18,
    marginRight: 12,
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
    fontSize: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  col: {
    flex: 1,
  },
  colLeft: {
    marginRight: 6,
  },
  colRight: {
    marginLeft: 6,
  },
  selectInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
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
  },
  placeholder: {
    color: '#9CA3AF',
  },
  selectArrow: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  breedList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: 200,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  breedScroll: {
    maxHeight: 200,
  },
  breedOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  breedOptionText: {
    fontSize: 14,
    color: '#111827',
  },
  energyOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  energyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  energyBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#10B981',
  },
  energyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  energyTextActive: {
    color: '#059669',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  warningIcon: {
    fontSize: 18,
    marginRight: 12,
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
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  arrow: {
    fontSize: 18,
    marginLeft: 8,
  },
});
