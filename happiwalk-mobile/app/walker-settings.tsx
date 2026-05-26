import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { ChevronRight, MapPin, Calendar, LogOut, Bell } from '../components/Icons';
import ServiceAreaManager from '../components/ServiceAreaManager';
import AvailabilityManager from '../components/AvailabilityManager';

export default function WalkerSettingsScreen() {
  const router = useRouter();
  const [walkerId, setWalkerId] = useState<string | null>(null);
  const [showServiceArea, setShowServiceArea] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingPreference, setSavingPreference] = useState(false);
  const [preferences, setPreferences] = useState({ push: true, email: true, sms: false });

  useEffect(() => {
    const fetchWalker = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: walker } = await supabase
          .from('walkers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (walker) setWalkerId(walker.id);

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('notification_preferences')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile?.notification_preferences) {
          const prefs = profile.notification_preferences;
          setPreferences(prefs);
          setNotificationsEnabled(prefs.push ?? true);
        }
      } catch (err) {
        console.error('Error fetching walker:', err);
        Alert.alert('Error', 'No se pudo cargar la configuración. Intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };
    fetchWalker();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'No se pudo cerrar sesión. Intenta de nuevo.');
    }
  };

  const handleNotificationsChange = async (value: boolean) => {
    setNotificationsEnabled(value);
    setSavingPreference(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newPreferences = { ...preferences, push: value };
      setPreferences(newPreferences);

      const { error } = await supabase
        .from('user_profiles')
        .update({ notification_preferences: newPreferences })
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (err) {
      console.error('Error saving notification preferences:', err);
      setNotificationsEnabled(!value);
      setPreferences({ ...preferences, push: !value });
      Alert.alert('Error', 'No se pudieron guardar las preferencias de notificación.');
    } finally {
      setSavingPreference(false);
    }
  };

  const menuItems = [
    {
      icon: <MapPin size={20} color="#0EA5E9" />,
      label: 'Zona de Servicio',
      subtitle: 'Editar tu radio de cobertura',
      onPress: () => setShowServiceArea(true),
    },
    {
      icon: <Calendar size={20} color="#0EA5E9" />,
      label: 'Disponibilidad',
      subtitle: 'Gestionar tus horarios',
      onPress: () => setShowAvailability(true),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Configuración</Text>
        <Text style={styles.headerSubtitle}>Gestiona tu cuenta</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Servicio</Text>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>{item.icon}</View>
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <ChevronRight size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferencias</Text>
          <View style={styles.menuItem}>
            <View style={styles.iconContainer}>
              <Bell size={20} color="#0EA5E9" />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuLabel}>Notificaciones</Text>
              <Text style={styles.menuSubtitle}>Recibir alertas de paseos</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsChange}
              trackColor={{ false: '#E5E7EB', true: '#0EA5E9' }}
              thumbColor="#FFFFFF"
              disabled={savingPreference}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cuenta</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
            <LogOut size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Versión 1.0.0</Text>
      </ScrollView>

      {showServiceArea && walkerId && (
        <ServiceAreaManager walkerId={walkerId} onClose={() => setShowServiceArea(false)} />
      )}
      {showAvailability && walkerId && (
        <AvailabilityManager walkerId={walkerId} onClose={() => setShowAvailability(false)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#111827',
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '800',
  },
  version: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 20,
    marginBottom: 40,
  },
});
