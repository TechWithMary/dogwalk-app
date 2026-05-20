import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActionSheetIOS, Platform, Image, Keyboard, ActivityIndicator, InputAccessoryView } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { File } from 'expo-file-system';
import { supabase, getSignedAvatarUrl, getAvatarUploadPath } from '../lib/supabase';
import { searchAddressSuggestions, getPlaceDetails } from '../lib/addressSearch';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, User, Phone, MapPin, Save, Camera, Loader2 } from '../components/Icons';

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    bio: ''
  });
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [addressLat, setAddressLat] = useState<number | null>(null);
  const [addressLng, setAddressLng] = useState<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isGpsLocation, setIsGpsLocation] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const bioInputRef = useRef<TextInput>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (isGpsLocation) {
      setIsGpsLocation(false);
      return;
    }
    
    const delaySearch = setTimeout(async () => {
      if (formData.address.length > 2) {
        setSearchingAddress(true);
        setAddressError('');
        try {
          const results = await searchAddressSuggestions(formData.address);
          setAddressSuggestions(results);
          if (results.length === 0 && formData.address.length > 3) {
            setAddressError('No se encontraron direcciones');
          }
        } catch {
          setAddressSuggestions([]);
          setAddressError('Error al buscar direcciones');
        } finally {
          setSearchingAddress(false);
        }
      } else {
        setAddressSuggestions([]);
        setAddressError('');
      }
    }, 300);
    return () => clearTimeout(delaySearch);
  }, [formData.address]);

  const handleSelectSuggestion = async (suggestion: any) => {
    setAddressSuggestions([]);
    setAddressError('');
    const details = await getPlaceDetails(suggestion.placeId);
    if (details) {
      setFormData({ ...formData, address: details.address });
      setAddressLat(details.lat);
      setAddressLng(details.lng);
    } else {
      setFormData({ ...formData, address: suggestion.mainText || suggestion.description });
      setAddressError('No se pudieron obtener los detalles de la dirección');
    }
    Keyboard.dismiss();
  };

  const handleCurrentLocation = async () => {
    setGettingLocation(true);
    setAddressSuggestions([]);
    setAddressError('');
    setIsGpsLocation(true);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Activa el permiso de ubicación');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setAddressLat(location.coords.latitude);
      setAddressLng(location.coords.longitude);

      if (geocode[0]) {
        const addr = geocode[0];
        const fullAddress = [
          addr.streetNumber,
          addr.street,
          addr.district,
          addr.subregion,
          addr.region,
        ].filter(Boolean).join(', ');
        setFormData({ ...formData, address: fullAddress || `${addr.street || ''}, ${addr.subregion || ''}`.replace(/^, |, $/g, '') });
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo obtener la ubicación');
    } finally {
      setGettingLocation(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
        setFormData({
          first_name: profileData.first_name || '',
          last_name: profileData.last_name || '',
          phone: profileData.phone || '',
          address: profileData.address || '',
          bio: profileData.bio || ''
        });
        if (profileData.lat != null) setAddressLat(profileData.lat);
        if (profileData.lng != null) setAddressLng(profileData.lng);
        const resolved = await getSignedAvatarUrl(profileData.profile_photo_url);
        if (resolved) setAvatarUrl(resolved);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo cargar tu perfil. Intenta de nuevo.');
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
        Alert.alert('Permiso requerido', 'Activa el permiso de cámara');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const file = new File(uri);
      const byteArray = await file.bytes();

      if (!byteArray || byteArray.length === 0) {
        throw new Error('El archivo está vacío');
      }

      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = getAvatarUploadPath(user.id, fileExt);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, byteArray, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      await supabase
        .from('user_profiles')
        .update({ profile_photo_url: fileName })
        .eq('user_id', user.id);

      const signedUrl = await getSignedAvatarUrl(fileName);
      setProfile({ ...profile, profile_photo_url: fileName });
      if (signedUrl) setAvatarUrl(signedUrl);
      Alert.alert('Éxito', 'Foto actualizada');
    } catch (error: any) {
      console.error('Error uploading:', error);
      Alert.alert('Error', error.message || 'No se pudo subir la foto');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.first_name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updateData: any = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          address: formData.address,
          bio: formData.bio
        };
        if (addressLat !== null) updateData.lat = addressLat;
        if (addressLng !== null) updateData.lng = addressLng;

        const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) throw error;

      Alert.alert('Éxito', 'Perfil actualizado');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Perfil</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} disabled={loading}>
              {loading ? (
                <View style={styles.avatarPlaceholder}><Loader2 size={24} color="#0EA5E9" /></View>
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} resizeMode="cover" onError={(err) => { console.error('Error avatar edit-profile:', err.nativeEvent); setAvatarUrl(null); }} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{(formData.first_name || 'U')[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.cameraOverlay}><Camera size={16} color="#FFFFFF" /></View>
            </TouchableOpacity>
            <Text style={styles.changePhotoText}>Cambiar foto</Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Nombre</Text>
                <View style={styles.inputContainer}>
                  <User size={16} color="#9CA3AF" />
                  <TextInput
                    style={styles.input}
                    value={formData.first_name}
                    onChangeText={(text) => setFormData({ ...formData, first_name: text })}
                    placeholder="Nombre"
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </View>
              </View>

              <View style={styles.halfField}>
                <Text style={styles.label}>Apellido</Text>
                <View style={styles.inputContainer}>
                  <User size={16} color="#9CA3AF" />
                  <TextInput
                    style={styles.input}
                    value={formData.last_name}
                    onChangeText={(text) => setFormData({ ...formData, last_name: text })}
                    placeholder="Apellido"
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </View>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Teléfono</Text>
              <View style={styles.inputContainer}>
                <Phone size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.input}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="Número celular"
                  keyboardType="phone-pad"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  onFocus={() => scrollViewRef.current?.scrollTo({ y: 200, animated: true })}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Dirección de residencia</Text>
              <View style={styles.addressInputWrapper}>
                <View style={[styles.inputContainer, addressError && styles.inputContainerError]}>
                  <MapPin size={16} color={addressError ? '#EF4444' : '#9CA3AF'} />
                  <TextInput
                    style={styles.input}
                    value={formData.address}
                    onChangeText={(text) => { 
                      setFormData({ ...formData, address: text }); 
                      setAddressError('');
                      if (!text) setAddressSuggestions([]);
                    }}
                    placeholder="Busca tu dirección..."
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    onFocus={() => scrollViewRef.current?.scrollTo({ y: 280, animated: true })}
                  />
                  <TouchableOpacity onPress={handleCurrentLocation} style={styles.gpsBtn} disabled={gettingLocation}>
                    {gettingLocation ? (
                      <ActivityIndicator size="small" color="#0EA5E9" />
                    ) : (
                      <MapPin size={16} color="#0EA5E9" />
                    )}
                  </TouchableOpacity>
                  {searchingAddress && <ActivityIndicator size="small" color="#0EA5E9" style={styles.searchingIndicator} />}
                </View>
                {addressError ? (
                  <Text style={styles.addressErrorText}>{addressError}</Text>
                ) : null}
                {addressSuggestions.length > 0 && !addressError && (
                  <View style={styles.suggestionsBox}>
                    {addressSuggestions.slice(0, 5).map((suggestion: any, index: number) => (
                      <TouchableOpacity
                        key={suggestion.placeId}
                        style={[
                          styles.suggestionItem,
                          index === addressSuggestions.length - 1 && styles.suggestionItemLast,
                        ]}
                        onPress={() => handleSelectSuggestion(suggestion)}
                      >
                        <MapPin size={14} color="#9CA3AF" />
                        <View style={styles.suggestionText}>
                          <Text style={styles.suggestionMain} numberOfLines={1}>{suggestion.mainText}</Text>
                          <Text style={styles.suggestionSecondary} numberOfLines={1}>{suggestion.secondaryText}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

          <View style={styles.field}>
            <Text style={styles.label}>Sobre ti</Text>
            <TextInput
              ref={bioInputRef}
              style={[styles.input, styles.textArea]}
              value={formData.bio}
              onChangeText={(text) => setFormData({ ...formData, bio: text })}
              placeholder="Cuéntanos un poco sobre ti..."
              multiline
              numberOfLines={3}
              maxLength={500}
              placeholderTextColor="#9CA3AF"
              blurOnSubmit={false}
              onFocus={() => scrollViewRef.current?.scrollTo({ y: 350, animated: true })}
              inputAccessoryViewID="bioDone"
            />
            <InputAccessoryView nativeID="bioDone">
              <View style={styles.inputAccessory}>
                <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.doneButton}>
                  <Text style={styles.doneButtonText}>Listo</Text>
                </TouchableOpacity>
              </View>
            </InputAccessoryView>
          </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

      <View style={[styles.buttonContainer, { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity 
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Save size={20} color="#0EA5E9" />
          <Text style={styles.saveBtnText}>
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    marginBottom: 16,
  },
  halfField: {
    flex: 1,
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  buttonContainer: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0EA5E9',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottomSpacer: {
    height: 80,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 0,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0EA5E9',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  addressInputWrapper: {
    position: 'relative',
    zIndex: 100,
  },
  inputContainerError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  gpsBtn: {
    padding: 4,
    marginLeft: 4,
  },
  searchingIndicator: {
    marginLeft: 4,
  },
  addressErrorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 6,
    marginLeft: 4,
  },
  suggestionsBox: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 14,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    zIndex: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionMain: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  suggestionSecondary: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 2,
  },
  inputAccessory: {
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'flex-end',
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#111827',
    borderRadius: 8,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});