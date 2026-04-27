import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { Loader2, Camera, User, ChevronRight, DogIcon } from '../../components/Icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isMounted = useRef(true);
  const [profile, setProfile] = useState<any>(null);
  const [walkerData, setWalkerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    fetchProfile();
    return () => { isMounted.current = false; };
  }, []);

  const fetchProfile = async () => {
    if (!isMounted.current) return;
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || !isMounted.current) return;

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

      if (!isMounted.current) return;
      setWalkerData(walker);
      const isWalker = !!walker;

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

      if (!isMounted.current) return;
      setProfile({
          ...userProfile,
          first_name: finalFirstName,
          last_name: finalLastName,
          email: currentUser.email,
          role: isWalker ? 'walker' : (userProfile?.role || 'owner'),
          profile_photo_url: userProfile?.profile_photo_url || null,
          verification_status: walker?.overall_verification_status || 'pending' 
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el permiso de cámara para subir fotos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const uploadPhoto = async (uri: string) => {
    if (!isMounted.current) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario');

      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error('Error reading file'));
        xhr.open('GET', uri);
        xhr.responseType = 'blob';
        xhr.send();
      });

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ profile_photo_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      if (isMounted.current) {
        setProfile((prev: any) => ({ ...prev, profile_photo_url: publicUrl }));
        Alert.alert('Exito', 'Foto actualizada');
      }
    } catch (error: any) {
      if (isMounted.current) Alert.alert('Error', error.message || 'Error al subir la foto');
    } finally {
      if (isMounted.current) setUploading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar Sesion',
      'Estas seguro de que quieres cerrar sesion?',
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
      return <View style={styles.verificationBadge}><Text style={styles.verificationText}>Paseador Verificado</Text></View>;
    } else if (status === 'pending') {
      return <View style={[styles.verificationBadge, styles.pendingBadge]}><Text style={[styles.verificationText, styles.pendingText]}>En Revision</Text></View>;
    } else if (status === 'rejected') {
      return <View style={[styles.verificationBadge, styles.rejectedBadge]}><Text style={[styles.verificationText, styles.rejectedText]}>Verificacion Rechazada</Text></View>;
    }
    return null;
  };

if (loading) {
    return <SafeAreaView style={styles.loadingContainer}><Loader2 size={32} color="#10B981" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileSection}>
          <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} disabled={uploading}>
            {uploading ? (
              <View style={styles.avatarPlaceholder}><Loader2 size={24} color="#10B981" /></View>
            ) : profile?.profile_photo_url ? (
              <Image source={{ uri: profile.profile_photo_url }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{(displayName || 'U')[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.cameraOverlay}><Camera size={16} color="#FFFFFF" /></View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{profile?.email}</Text>
          {getVerificationBadge()}
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuHeader}>Cuenta</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/edit-profile')}>
            <View style={styles.menuIconBg}><User size={20} color="#6B7280" /></View>
            <Text style={styles.menuLabel}>Editar Información Personal</Text>
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>
          
          {!isWalker && (
            <>
              <Text style={styles.menuHeader}>Mascotas</Text>
<TouchableOpacity style={styles.menuItem} onPress={() => router.push('/pets')}>
            <View style={styles.menuIconBg}><DogIcon size={20} color="#6B7280" /></View>
            <Text style={styles.menuLabel}>Gestionar Mis Mascotas</Text>
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>
            </>
          )}
          
          <Text style={styles.menuHeader}>Pagos</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push(isWalker ? '/walker-balance' : '/wallet')}>
            <View style={styles.menuIconBg}><Text style={styles.menuIcon}>💳</Text></View>
            <Text style={styles.menuLabel}>{isWalker ? 'Mis Ganancias' : 'Mi Billetera'}</Text>
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

<TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Versión 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  content: { flex: 1, padding: 24 },
  scrollContent: { paddingBottom: 40 },
  profileSection: { alignItems: 'center', marginBottom: 30, marginTop: 40 },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatarImg: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 36, fontWeight: '900', color: '#10B981' },
  cameraOverlay: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF' },
  profileName: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  profileEmail: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  verificationBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#A7F3D0' },
  pendingBadge: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  rejectedBadge: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  verificationText: { color: '#059669', fontWeight: '600', fontSize: 12 },
  pendingText: { color: '#D97706' },
  rejectedText: { color: '#DC2626' },
  menuSection: { marginBottom: 20 },
  menuHeader: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase' },
  menuItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 8, 
    borderWidth: 1, 
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  menuIconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuIcon: { fontSize: 20 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  menuArrow: { fontSize: 20, color: '#9CA3AF' },
  logoutButton: { backgroundColor: '#FEE2E2', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  logoutText: { color: '#EF4444', fontSize: 15, fontWeight: '800' },
  version: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 20, marginBottom: 40 },
});