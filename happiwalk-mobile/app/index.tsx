import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role, is_profile_complete')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (profile) {
            if (!profile.is_profile_complete) {
              router.replace(profile.role === 'walker' ? '/onboarding-walker' : '/onboarding-owner');
            } else if (profile.role === 'walker') {
              router.replace('/walker-home');
            } else {
              router.replace('/(tabs)');
            }
          } else {
            router.replace('/(auth)/login');
          }
        } else {
          router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        router.replace('/(auth)/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  return null;
}