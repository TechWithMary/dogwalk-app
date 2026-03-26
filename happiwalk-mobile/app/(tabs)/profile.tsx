import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [walkerData, setWalkerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      if (currentUser) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        const { data: walker } = await supabase
          .from('walkers')
          .select('name, overall_verification_status')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        setWalkerData(walker);

        const isWalker = !!walker;
        const role = isWalker ? 'walker' : (userProfile?.role || 'owner');

        const isInvalidName = (name: string) => {
          if (!name) return true;
          const lower = name.toLowerCase();
          return lower.includes('usuario') || lower.includes('paseador');
        };

        let finalFirstName = '';
        let finalLastName = '';
        
        const profileFirst = userProfile?.first_name || '';
        const walkerName = walker?.name || '';
        const metaFirst = currentUser.user_metadata?.first_name || currentUser.user_metadata?.name || currentUser.user_metadata?.full_name || '';
        const metaLast = currentUser.user_metadata?.last_name || '';

        if (!isInvalidName(walkerName)) {
            const parts = walkerName.trim().split(' ');
            finalFirstName = parts[0] || '';
            finalLastName = parts.slice(1).join(' ') || '';
        } else if (!isInvalidName(profileFirst)) {
            finalFirstName = profileFirst;
            finalLastName = userProfile?.last_name || '';
        } else {
            const parts = metaFirst.trim().split(' ');
            finalFirstName = parts[0] || '';
            finalLastName = metaLast || parts.slice(1).join(' ') || '';
        }

        setProfile({
            ...userProfile,
            first_name: finalFirstName,
            last_name: finalLastName,
            email: currentUser.email,
            role: role,
            profile_photo_url: userProfile?.profile_photo_url || null,
            verification_status: walker?.overall_verification_status || 'pending' 
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cerrar', 
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  const isWalker = profile?.role === 'walker';

  const displayName = profile?.first_name 
    ? `${profile.first_name} ${profile.last_name || ''}`.trim() 
    : 'Usuario';

  const getVerificationBadge = () => {
    if (!isWalker) return null;
    
    const status = profile?.verification_status;
    
    if (status === 'approved') {
      return (
        <View style={styles.verificationBadge}>
          <Text style={styles.verificationText}>Paseador Verificado</Text>
        </View>
      );
    } else if (status === 'pending') {
      return (
        <View style={[styles.verificationBadge, styles.pendingBadge]}>
          <Text style={[styles.verificationText, styles.pendingText]}>En Revisión</Text>
        </View>
      );
    } else if (status === 'rejected') {
      return (
        <View style={[styles.verificationBadge, styles.rejectedBadge]}>
          <Text style={[styles.verificationText, styles.rejectedText]}>Verificación Rechazada</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Profile Header - EXACTAMENTE IGUAL A LA WEB */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            {profile?.profile_photo_url ? (
              <Image 
                source={{ uri: profile.profile_photo_url }}
                style={styles.avatarImg}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {(displayName || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{profile?.email}</Text>
          {getVerificationBadge()}
        </View>

        {/* Menu Items - EXACTAMENTE IGUAL A LA WEB */}
        <View style={styles.menuSection}>
          <Text style={styles.menuHeader}>Cuenta</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/edit-profile')}>
            <View style={styles.menuIconBg}>
              <Text style={styles.menuIcon}>👤</Text>
            </View>
            <Text style={styles.menuLabel}>Editar Información Personal</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          
          {!isWalker && (
            <>
              <Text style={styles.menuHeader}>Mascotas</Text>
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/pets')}>
                <View style={styles.menuIconBg}>
                  <Text style={styles.menuIcon}>🐕</Text>
                </View>
                <Text style={styles.menuLabel}>Gestionar Mis Mascotas</Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
            </>
          )}
          
          <Text style={styles.menuHeader}>Pagos</Text>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/wallet')}
          >
            <View style={styles.menuIconBg}>
              <Text style={styles.menuIcon}>💳</Text>
            </View>
            <Text style={styles.menuLabel}>{isWalker ? 'Mis Ganancias' : 'Mi Billetera'}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout - EXACTAMENTE IGUAL A LA WEB */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Versión 1.0.0</Text>
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
  profileSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '900',
    color: '#10B981',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  verificationBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  rejectedBadge: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  verificationText: {
    color: '#059669',
    fontWeight: '600',
    fontSize: 12,
  },
  pendingText: {
    color: '#D97706',
  },
  rejectedText: {
    color: '#DC2626',
  },
  menuSection: {
    marginBottom: 20,
  },
  menuHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  menuIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuIcon: {
    fontSize: 18,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  menuArrow: {
    fontSize: 20,
    color: '#9CA3AF',
  },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 14,
  },
  version: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 20,
    marginBottom: 40,
  },
});
