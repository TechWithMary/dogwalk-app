import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { supabase } from '../lib/supabase';
import { Dog } from '../components/Icons';

interface Booking {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  duration: string;
  status: string;
  pet_ids: string[];
  address: string;
  walker_id: string;
  lat: number | null;
  lng: number | null;
  walk_start_time: string | null;
  walkers?: {
    id: string;
    name: string;
    location: string;
    user_id: string;
  };
  pet?: {
    name: string;
  };
}

function haversineDistance(
  p1: { latitude: number; longitude: number },
  p2: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.latitude * Math.PI) / 180) *
      Math.cos((p2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateRouteDistance(points: { latitude: number; longitude: number }[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1], points[i]);
  }
  return total;
}

const ACCURACY_THRESHOLD = 100;

export default function LiveWalkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = params.bookingId as string;

  const mapRef = useRef<MapView>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [walkerLocation, setWalkerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [route, setRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [walkStartTime, setWalkStartTime] = useState<Date | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [gpsDistance, setGpsDistance] = useState(0);
  const [showMapTimeout, setShowMapTimeout] = useState(false);

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
    }
  }, [bookingId]);

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => setShowMapTimeout(true), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!bookingId) return;
    console.log('[LiveWalk] Starting with bookingId:', bookingId);

    const processLocation = (lat: number, lng: number, source: string) => {
      console.log('[LiveWalk] Location from', source, ':', lat, lng);
      setWalkerLocation({ latitude: lat, longitude: lng });
      setLastUpdate(new Date());
      setRoute(prev => {
        const point = { latitude: lat, longitude: lng };
        const newRoute = [...prev, point];
        setGpsDistance(calculateRouteDistance(newRoute));
        return newRoute;
      });
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
    };

    const channel = supabase
      .channel(`live-walk-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'locations', filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const loc = payload.new as any;
          const lat = Number(loc.latitude);
          const lng = Number(loc.longitude);
          const acc = loc.accuracy != null ? Number(loc.accuracy) : null;
          if (acc !== null && acc > ACCURACY_THRESHOLD) return;
          processLocation(lat, lng, 'realtime');
        },
      )
      .subscribe();

    const pollInterval = setInterval(async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('latitude, longitude, accuracy')
        .eq('booking_id', bookingId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error('[LiveWalk] Poll error:', error);
        return;
      }
      if (data) {
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);
        const acc = data.accuracy != null ? Number(data.accuracy) : null;
        if (acc !== null && acc > ACCURACY_THRESHOLD) return;
        processLocation(lat, lng, 'poll');
      } else {
        console.log('[LiveWalk] Poll: no data found');
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [bookingId]);

  useEffect(() => {
    if (!walkStartTime) return;

    const updateElapsed = () => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - walkStartTime.getTime()) / 1000);
      setElapsedTime(diff);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [walkStartTime]);

  useEffect(() => {
    const updateFreshness = setInterval(() => {
      if (lastUpdate) {
        setLastUpdate(new Date(lastUpdate.getTime()));
      }
    }, 10000);
    return () => clearInterval(updateFreshness);
  }, [lastUpdate]);

  const pickupLocation = booking?.lat != null && booking?.lng != null
    ? { latitude: booking.lat, longitude: booking.lng }
    : null;

  useEffect(() => {
    if (!mapRef.current) return;
    if (walkerLocation && pickupLocation) {
      mapRef.current.fitToCoordinates([walkerLocation, pickupLocation], {
        edgePadding: { top: 120, right: 60, bottom: 280, left: 60 },
        animated: true,
      });
    }
  }, [walkerLocation, pickupLocation]);

  const fetchBooking = async () => {
    try {
      console.log('[LiveWalk] Fetching booking:', bookingId);
      const { data, error } = await supabase
        .from('bookings')
        .select('*, walkers(*)')
        .eq('id', bookingId)
        .single();

      if (error) {
        console.error('[LiveWalk] Booking fetch error:', error);
        throw error;
      }

      let bookingWithPet = { ...data };

      if (data?.pet_ids && data.pet_ids.length > 0) {
        const { data: petData } = await supabase
          .from('pets')
          .select('name')
          .eq('id', data.pet_ids[0])
          .single();
        if (petData) {
          bookingWithPet.pet = petData;
        }
      }

      setBooking(bookingWithPet);
      if (data?.walk_start_time) {
        setWalkStartTime(new Date(data.walk_start_time));
      }

      const { data: locationData } = await supabase
        .from('locations')
        .select('latitude, longitude, accuracy, timestamp')
        .eq('booking_id', bookingId)
        .order('timestamp', { ascending: true });

      if (locationData && locationData.length > 0) {
        console.log('[LiveWalk] Found', locationData.length, 'existing locations');
        const filtered = locationData.filter(
          loc => loc.accuracy == null || Number(loc.accuracy) <= ACCURACY_THRESHOLD,
        );
        console.log('[LiveWalk] After accuracy filter:', filtered.length, 'locations');

        if (filtered.length > 0) {
          const points = filtered.map(loc => ({
            latitude: Number(loc.latitude),
            longitude: Number(loc.longitude),
          }));

          setRoute(points);
          setGpsDistance(calculateRouteDistance(points));

          const last = points[points.length - 1];
          setWalkerLocation(last);
          setLastUpdate(new Date(filtered[filtered.length - 1].timestamp));

          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: last.latitude,
              longitude: last.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 500);
          }
        }
      } else {
        console.log('[LiveWalk] No existing locations found');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getLastUpdateText = () => {
    if (!lastUpdate) return null;
    const diff = Math.floor((new Date().getTime() - lastUpdate.getTime()) / 1000);
    if (diff < 10) return 'Ahora';
    if (diff < 60) return `Hace ${diff}s`;
    const mins = Math.floor(diff / 60);
    return `Hace ${mins}min`;
  };

  const statusLabel = walkerLocation
    ? getLastUpdateText() || 'Esperando...'
    : 'Sin señal';

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const isWaitingForGPS =
    (booking?.status === 'picked_up' || booking?.status === 'in_progress') &&
    !walkerLocation &&
    !showMapTimeout;

  const isWaitingToStart =
    booking?.status !== 'picked_up' &&
    booking?.status !== 'in_progress' &&
    !walkerLocation &&
    !showMapTimeout;

  if (isWaitingForGPS || isWaitingToStart) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.waitingIcon}>
          <Dog size={48} color="#0EA5E9" />
        </View>
        <Text style={styles.waitingTitle}>
          {isWaitingForGPS ? 'Esperando GPS...' : 'Esperando inicio del paseo'}
        </Text>
        <Text style={styles.waitingSubtitle}>
          {isWaitingForGPS
            ? `${booking?.walkers?.name || 'El paseador'} aún no activó el GPS del paseo`
            : `${booking?.walkers?.name || 'El paseador'} está por iniciar el paseo`}
        </Text>
        {booking?.address && (
          <View style={styles.pickupInfo}>
            <Text style={styles.pickupLabel}>📍 Punto de recogida</Text>
            <Text style={styles.pickupAddress}>{booking.address}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const fallbackCenter = walkerLocation || pickupLocation || {
    latitude: 6.2476,
    longitude: -75.5658,
  };

  const initialRegion = {
    latitude: fallbackCenter.latitude,
    longitude: fallbackCenter.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
      >
        {pickupLocation && (
          <Marker
            coordinate={pickupLocation}
            title="Punto de recogida"
            description={booking?.address || 'Donde se recogió la mascota'}
            pinColor="#F59E0B"
          />
        )}

        {route.length > 0 && (
          <Marker
            coordinate={route[0]}
            title="Inicio del recorrido"
            description="Punto de partida del paseo"
          >
            <View style={styles.startMarker}>
              <Dog size={18} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {walkerLocation && (
          <Marker
            coordinate={walkerLocation}
            title={booking?.walkers?.name || 'Paseador'}
            description="Ubicación actual de tu mascota"
          >
            <View style={styles.markerContainer}>
              <Dog size={22} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {route.length > 1 && (
          <Polyline
            coordinates={route}
            strokeColor="#0EA5E9"
            strokeWidth={4}
          />
        )}
      </MapView>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Paseo en Vivo</Text>
          <Text style={styles.headerSubtitle}>
            {booking?.pet?.name} con {booking?.walkers?.name}
          </Text>
        </View>
        <TouchableOpacity style={styles.callBtn}>
          <Text style={styles.callBtnText}>📞</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
          <Text style={styles.statLabel}>Tiempo</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{gpsDistance.toFixed(2)} km</Text>
          <Text style={styles.statLabel}>Distancia</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {walkerLocation ? '🟢' : '🔴'}
          </Text>
          <Text style={styles.statLabel}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Paseador</Text>
          <Text style={styles.infoValue}>{booking?.walkers?.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Mascota</Text>
          <Text style={styles.infoValue}>{booking?.pet?.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Duración</Text>
          <Text style={styles.infoValue}>{booking?.duration || '-'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 24,
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  map: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 20,
    color: '#374151',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnText: {
    fontSize: 18,
  },
  startMarker: {
    backgroundColor: '#052e05',
    borderRadius: 16,
    padding: 6,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  markerContainer: {
    backgroundColor: '#0EA5E9',
    borderRadius: 20,
    padding: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  loadingText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 16,
  },
  waitingIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  waitingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  pickupInfo: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    maxWidth: 320,
  },
  pickupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  pickupAddress: {
    fontSize: 13,
    color: '#78350F',
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  statsCard: {
    position: 'absolute',
    bottom: 200,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  infoCard: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
});
