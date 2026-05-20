import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Modal,
} from 'react-native';
import MapView, { Marker, Circle, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Svg, { Polygon } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { MapPin, X, Save, Loader2 } from './Icons';

function Navigation({ size = 24, color = '#000000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="3 11 22 2 13 21 11 13 3 11" />
    </Svg>
  );
}

const DEFAULT_LAT = 6.2442;
const DEFAULT_LNG = -75.5812;
const DEFAULT_RADIUS = 3;
const MIN_RADIUS = 2;
const MAX_RADIUS = 20;

interface ServiceAreaManagerProps {
  walkerId: string;
  onClose: () => void;
  onSave?: () => void;
}

interface Coordinate {
  latitude: number;
  longitude: number;
}

export default function ServiceAreaManager({ walkerId, onClose, onSave }: ServiceAreaManagerProps) {
  const [center, setCenter] = useState<Coordinate>({ latitude: DEFAULT_LAT, longitude: DEFAULT_LNG });
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const fetchServiceArea = async () => {
      try {
        const { data, error } = await supabase
          .from('walkers')
          .select('service_latitude, service_longitude, service_radius_km, location')
          .eq('id', walkerId)
          .single();

        if (data && !error) {
          const rVal = data.service_radius_km ? Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, data.service_radius_km)) : DEFAULT_RADIUS;
          if (data.service_radius_km) {
            setRadius(rVal);
          }
          if (data.service_latitude && data.service_longitude) {
            const newCenter = {
              latitude: data.service_latitude,
              longitude: data.service_longitude,
            };
            setCenter(newCenter);
            setTimeout(() => {
              mapRef.current?.animateToRegion({
                ...newCenter,
                latitudeDelta: rVal * 0.035,
                longitudeDelta: rVal * 0.035,
              });
            }, 300);
          }
          if (data.location) {
            setAddress(data.location);
          }
        }
      } catch (err) {
        console.error('Error fetching service area:', err);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchServiceArea();
  }, [walkerId]);

  const getAddressFromCoords = useCallback(async (lat: number, lng: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results && results.length > 0) {
        const r = results[0];
        const parts = [r.district, r.city, r.region].filter(Boolean);
        const formatted = parts.join(', ') || r.formattedAddress || '';
        setAddress(formatted);
      }
    } catch {
      // Address is supplementary — silent failure is acceptable
    }
  }, []);

  const onMarkerDragEnd = useCallback(
    (e: any) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      const newCenter = { latitude, longitude };
      setCenter(newCenter);
      getAddressFromCoords(latitude, longitude);
    },
    [getAddressFromCoords]
  );

  const handleCurrentLocation = useCallback(async () => {
    try {
      setGettingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Activa el acceso a ubicación en configuración');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = position.coords;
      const newCenter = { latitude, longitude };
      setCenter(newCenter);

      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: radius * 0.035,
        longitudeDelta: radius * 0.035,
      });

      getAddressFromCoords(latitude, longitude);
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ubicación GPS');
    } finally {
      setGettingLocation(false);
    }
  }, [getAddressFromCoords, radius]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('walkers')
        .update({
          service_latitude: center.latitude,
          service_longitude: center.longitude,
          service_radius_km: radius,
          location: address,
        })
        .eq('id', walkerId);

      if (error) throw error;

      Alert.alert('Éxito', 'Zona de servicio actualizada');
      onSave?.();
      onClose();
    } catch (err: any) {
      console.error('Error saving service area:', err);
      Alert.alert('Error', err.message || 'No se pudo guardar la zona');
    } finally {
      setLoading(false);
    }
  }, [center, radius, address, walkerId, onSave, onClose]);

  const handleRadiusChange = useCallback((newRadius: number) => {
    setRadius(newRadius);
    mapRef.current?.animateToRegion({
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: newRadius * 0.035,
      longitudeDelta: newRadius * 0.035,
    }, 300);
  }, [center]);

  const mapRegion: Region = {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: radius * 0.035,
    longitudeDelta: radius * 0.035,
  };

  const radiusSteps = Array.from({ length: MAX_RADIUS - MIN_RADIUS + 1 }, (_, i) => i + MIN_RADIUS);

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MapPin size={20} color="#F43F5E" />
              <View style={styles.headerText}>
                <Text style={styles.title}>Mi Zona</Text>
                <Text style={styles.subtitle}>Define dónde prestas tus servicios</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
  
          <View style={styles.mapContainer}>
            {initialLoading ? (
              <View style={styles.mapLoading}>
                <Loader2 size={32} color="#13ec13" />
              </View>
            ) : (
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={mapRegion}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                showsScale={false}
                toolbarEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={center}
                  draggable
                  onDragEnd={onMarkerDragEnd}
                  pinColor="#F43F5E"
                />
                <Circle
                  center={center}
                  radius={radius * 1000}
                  fillColor="rgba(16, 185, 129, 0.2)"
                  strokeColor="#052e05"
                  strokeWidth={2}
                />
              </MapView>
            )}
  
            <TouchableOpacity
              style={styles.gpsBtn}
              onPress={handleCurrentLocation}
              disabled={gettingLocation}
              activeOpacity={0.7}
            >
              {gettingLocation ? (
                <Loader2 size={20} color="#374151" />
              ) : (
                <Navigation size={20} color="#374151" />
              )}
            </TouchableOpacity>
          </View>
  
          <ScrollView
            style={styles.controls}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.addressCard}>
              <MapPin size={18} color="#9CA3AF" />
              <View style={styles.addressText}>
                <Text style={styles.addressLabel}>UBICACIÓN CENTRAL</Text>
                <Text style={styles.addressValue} numberOfLines={2}>
                  {address || 'Arrastra el pin en el mapa'}
                </Text>
              </View>
            </View>
  
            <View style={styles.radiusSection}>
              <View style={styles.radiusHeader}>
                <Text style={styles.radiusLabel}>Radio de cobertura</Text>
                <Text style={styles.radiusValue}>{radius} km</Text>
              </View>
  
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radiusOptions}>
                {radiusSteps.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.radiusBtn, radius === r && styles.radiusBtnActive]}
                    onPress={() => handleRadiusChange(r)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.radiusBtnText, radius === r && styles.radiusBtnTextActive]}>
                      {r} km
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
  
            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <Loader2 size={20} color="#FFFFFF" />
              ) : (
                <>
                  <Save size={20} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Guardar Zona</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flexShrink: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapContainer: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: 280,
  },
  mapLoading: {
    width: '100%',
    height: 280,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  controls: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 20,
  },
  addressText: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  addressValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  radiusSection: {
    marginBottom: 24,
  },
  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E5E7EB',
  },
  radiusValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#13ec13',
  },
  radiusOptions: {
    gap: 8,
    paddingBottom: 4,
  },
  radiusBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1F2937',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  radiusBtnActive: {
    backgroundColor: '#064E3B',
    borderColor: '#13ec13',
  },
  radiusBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  radiusBtnTextActive: {
    color: '#13ec13',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#13ec13',
    borderRadius: 20,
    paddingVertical: 18,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});