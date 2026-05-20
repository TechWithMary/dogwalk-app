import { Tabs, useRouter } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { Home, MessageSquare, User, House } from '../../components/Icons';

export default function TabLayout() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const getRole = async () => {
      try {
        let cachedRole = await AsyncStorage.getItem('cached_profile_role');
        if (!cachedRole) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('role')
              .eq('user_id', user.id)
              .maybeSingle();
            cachedRole = profile?.role || null;
            if (cachedRole) {
              await AsyncStorage.setItem('cached_profile_role', cachedRole);
            }
          }
        }
        setRole(cachedRole);
      } catch (err) {
        console.error('Error getting cached role in TabLayout:', err);
      }
    };
    getRole();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabButton}>
              <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
                <House size={24} color={focused ? '#052e05' : '#9CA3AF'} />
              </View>
              {focused && <Text style={styles.tabLabel}>Inicio</Text>}
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            if (role === 'walker') {
              e.preventDefault();
              router.replace('/walker-home');
            }
          },
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabButton, !focused && styles.tabButtonInactive]}>
              <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
                <MessageSquare size={24} color={focused ? '#052e05' : '#9CA3AF'} />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabButton, !focused && styles.tabButtonInactive]}>
              <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
                <User size={24} color={focused ? '#052e05' : '#9CA3AF'} />
              </View>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    height: 70,
    paddingBottom: 8,
    paddingTop: 4,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: -16,
  },
  tabButtonInactive: {
    opacity: 0.4,
  },
  iconCircle: {
    padding: 12,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  iconCircleActive: {
    backgroundColor: '#ECFDF5',
    transform: [{ scale: 1.1 }],
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
});