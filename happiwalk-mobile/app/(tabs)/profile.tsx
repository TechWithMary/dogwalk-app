import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActionSheetIOS, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { supabase, STORAGE_URL, getSignedAvatarUrl, getAvatarUploadPath } from '../../lib/supabase';
import { Loader2, Camera, User, ChevronRight, DogIcon, HelpCircle, Shield, CreditCard } from '../../components/Icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkeletonProfile } from '../../components/Skeleton';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isMounted = useRef(true);
  const [profile, setProfile] = useState<any>(null);
  const [walkerData, setWalkerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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

      const photoPath = userProfile?.profile_photo_url || null;
      const resolvedAvatarUrl = await getSignedAvatarUrl(photoPath);
      if (resolvedAvatarUrl) {
        setAvatarUrl(resolvedAvatarUrl);
      }

      setProfile({
          ...userProfile,
          first_name: finalFirstName,
          last_name: finalLastName,
          email: currentUser.email,
          role: isWalker ? 'walker' : (userProfile?.role || 'owner'),
          profile_photo_url: photoPath,
          verification_status: walker?.overall_verification_status || 'pending'
      });
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'No se pudo cargar tu perfil. Intenta de nuevo.');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const pickImage = async () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancelar', 'Tomar Foto', 'Elegir de Galería'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            await takePhoto();
          } else if (buttonIndex === 2) {
            await pickFromGallery();
          }
        }
      );
    } else {
      Alert.alert(
        'Seleccionar Foto',
        'Elige una opción',
        [
          { text: 'Tomar Foto', onPress: () => takePhoto() },
          { text: 'Elegir de Galería', onPress: () => pickFromGallery() },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el permiso de cámara para tomar fotos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el permiso de galería para subir fotos');
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

      

      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = getAvatarUploadPath(user.id, fileExt);

      

      const file = new File(uri);
      const byteArray = await file.bytes();

      if (!byteArray || byteArray.length === 0) {
        throw new Error('El archivo está vacío');
      }

      

      
      const { error: uploadError, data } = await supabase.storage
        .from('avatars')
        .upload(fileName, byteArray, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error upload Supabase:', uploadError.message);
        throw new Error('Error al subir: ' + uploadError.message);
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ profile_photo_url: fileName })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error update profile:', updateError);
        throw updateError;
      }

      const signedUrl = await getSignedAvatarUrl(fileName);

      if (isMounted.current) {
        setProfile((prev: any) => ({ ...prev, profile_photo_url: fileName }));
        if (signedUrl) setAvatarUrl(signedUrl);
        Alert.alert('Exito', 'Foto actualizada');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Error al subir la foto';
      console.error('Error completo:', error);

      if (errorMsg.includes('bucket') || errorMsg.includes('storage')) {
        Alert.alert('Configuración necesaria', 'El almacenamiento no está configurado. Contacta al administrador.');
      } else if (errorMsg.includes('.empty') || errorMsg.includes('vacío')) {
        Alert.alert('Error', 'El archivo está vacío. Intenta con otra foto.');
      } else {
        Alert.alert('Error', errorMsg);
      }
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
            try {
              await supabase.auth.signOut();
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'No se pudo cerrar sesión. Intenta de nuevo.');
            }
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
    return <SafeAreaView style={styles.container} edges={['top']}><SkeletonProfile /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}>
        <View style={{ flex: 1 }}>
          <View style={styles.profileSection}>
            <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} disabled={uploading}>
              {uploading ? (
                <View style={styles.avatarPlaceholder}><Loader2 size={24} color="#0EA5E9" /></View>
              ) : avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImg}
                  resizeMode="cover"
                  onLoadEnd={() => {}}
                  onError={(err) => {
                    console.error('Error cargando avatar:', err.nativeEvent);
                    setAvatarUrl(null);
                  }}
                />
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

            <Text style={styles.menuHeader}>Soporte</Text>
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/support')}>
              <View style={styles.menuIconBg}><HelpCircle size={20} color="#6B7280" /></View>
              <Text style={styles.menuLabel}>Centro de Ayuda</Text>
              <ChevronRight size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {profile?.role === 'admin' && (
            <View style={styles.menuSection}>
              <Text style={styles.menuHeader}>Administración</Text>
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/admin/verifications')}>
                <View style={styles.menuIconBg}><Shield size={20} color="#0EA5E9" /></View>
                <Text style={styles.menuLabel}>Verificar Paseadores</Text>
                <ChevronRight size={20} color="#9CA3AF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/admin/payouts')}>
                <View style={styles.menuIconBg}><CreditCard size={20} color="#0EA5E9" /></View>
                <Text style={styles.menuLabel}>Gestionar Pagos</Text>
                <ChevronRight size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.version}>Versión 1.0.0</Text>
          <Text style={styles.footerText}>Hecho con ❤️ en Medellín</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  profileSection: { alignItems: 'center', marginBottom: 16, marginTop: 8 },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatarImg: { width: 76, height: 76, borderRadius: 38 },
  avatarPlaceholder: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 28, fontWeight: '900', color: '#0EA5E9' },
  cameraOverlay: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  profileName: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 2 },
  profileEmail: { fontSize: 13, color: '#6B7280', marginBottom: 6 },
  verificationBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#A7F3D0' },
  pendingBadge: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  rejectedBadge: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  verificationText: { color: '#052e05', fontWeight: '600', fontSize: 12 },
  pendingText: { color: '#D97706' },
  rejectedText: { color: '#DC2626' },
  menuSection: { marginBottom: 12 },
  menuHeader: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', marginBottom: 6, marginLeft: 4, textTransform: 'uppercase' },
  menuItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    padding: 13, 
    borderRadius: 13, 
    marginBottom: 6, 
    borderWidth: 1, 
    borderColor: '#F3F4F6',
  },
  menuIconBg: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuIcon: { fontSize: 20 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  menuArrow: { fontSize: 20, color: '#9CA3AF' },
  logoutButton: { backgroundColor: '#FEE2E2', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 14 },
  logoutText: { color: '#EF4444', fontSize: 15, fontWeight: '800' },
  footer: { alignItems: 'center', marginTop: 14, marginBottom: 2 },
  version: { textAlign: 'center', color: '#9CA3AF', fontSize: 11, marginBottom: 2 },
  footerText: { textAlign: 'center', color: '#D1D5DB', fontSize: 10 },
  urlDebug: { fontSize: 8, color: '#FF0000', marginTop: 4, textAlign: 'center' },
});