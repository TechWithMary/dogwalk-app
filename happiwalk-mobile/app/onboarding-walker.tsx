import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

export default function OnboardingWalkerScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    bio: '',
    address: '',
    serviceRadius: '3',
    price: '30000'
  });
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [gettingLocation, setGettingLocation] = useState(false);

  const handleCurrentLocation = async () => {
    try {
      setGettingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Activa el GPS');
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
        setFormData({ ...formData, address: fullAddress });
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo obtener la ubicación');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleComplete = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Ingresa tu nombre');
      return;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Error', 'Ingresa tu número de teléfono');
      return;
    }
    if (!coords.lat || !coords.lng) {
      Alert.alert('Error', 'Selecciona tu ubicación');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no encontrado');

      const nameParts = formData.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: formData.phone,
          address: formData.address,
          lat: coords.lat,
          lng: coords.lng,
          is_profile_complete: true
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      const { error: walkerError } = await supabase
        .from('walkers')
        .insert({
          user_id: user.id,
          name: formData.name,
          bio: formData.bio,
          service_latitude: coords.lat,
          service_longitude: coords.lng,
          service_radius_km: parseInt(formData.serviceRadius),
          price: parseInt(formData.price),
          overall_verification_status: 'pending'
        });

      if (walkerError) throw walkerError;

      Alert.alert('Éxito', '¡Tu perfil de paseador ha sido creado!正在审核中。');
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
            <Text style={styles.logoIcon}>🚶</Text>
          </View>
          <Text style={styles.title}>¡Conviértete en Paseador!</Text>
          <Text style={styles.subtitle}>Completa tu perfil para comenzar</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.formSection}>
            <Text style={styles.label}>Nombre completo *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="Tu nombre"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Teléfono *</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              placeholder="300 123 4567"
              keyboardType="phone-pad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Tu zona de servicio *</Text>
            <View style={styles.addressInput}>
              <Text style={styles.mapPinIcon}>📍</Text>
              <TextInput
                style={styles.addressTextInput}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholder="Tu dirección"
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

          <View style={styles.formSection}>
            <Text style={styles.label}>Radio de servicio (km)</Text>
            <View style={styles.radiusOptions}>
              {['2', '3', '5', '10'].map((r) => (
                <TouchableOpacity 
                  key={r}
                  style={[styles.radiusBtn, formData.serviceRadius === r && styles.radiusBtnActive]}
                  onPress={() => setFormData({ ...formData, serviceRadius: r })}
                >
                  <Text style={[styles.radiusText, formData.serviceRadius === r && styles.radiusTextActive]}>
                    {r} km
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Precio por hora</Text>
            <View style={styles.priceOptions}>
              {['25000', '30000', '35000', '40000'].map((p) => (
                <TouchableOpacity 
                  key={p}
                  style={[styles.priceBtn, formData.price === p && styles.priceBtnActive]}
                  onPress={() => setFormData({ ...formData, price: p })}
                >
                  <Text style={[styles.priceText, formData.price === p && styles.priceTextActive]}>
                    ${parseInt(p).toLocaleString('es-CO')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Cuéntanos sobre ti (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.bio}
              onChangeText={(text) => setFormData({ ...formData, bio: text })}
              placeholder="Experiencia con perros, disponibilidad, etc."
              multiline
              numberOfLines={3}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
              Tu perfil será revisado por nuestro equipo. Te notificaremos cuando estés habilitado para recibir paseos.
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleComplete}
            disabled={loading}
          >
            <Text style={styles.submitBtnText}>
              {loading ? '⏳' : 'Completar Perfil'}
            </Text>
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
    fontSize: 24,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
  radiusOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  radiusBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#10B981',
  },
  radiusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  radiusTextActive: {
    color: '#059669',
  },
  priceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priceBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  priceBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#10B981',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  priceTextActive: {
    color: '#059669',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#DBEAFE',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  infoIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: '#10B981',
    borderRadius: 24,
    paddingVertical: 20,
    alignItems: 'center',
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
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});
