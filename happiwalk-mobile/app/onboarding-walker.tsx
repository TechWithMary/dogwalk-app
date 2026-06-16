import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image, Switch, Platform, Keyboard, InteractionManager, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { Crosshair, Camera, ShieldCheck, Check } from '../components/Icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const TOTAL_STEPS = 7;

const DAYS_OF_WEEK = [
  { id: 1, name: 'Lunes' },
  { id: 2, name: 'Martes' },
  { id: 3, name: 'Miércoles' },
  { id: 4, name: 'Jueves' },
  { id: 5, name: 'Viernes' },
  { id: 6, name: 'Sábado' },
  { id: 0, name: 'Domingo' },
];

export default function OnboardingWalkerScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [walkerId, setWalkerId] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    id_number: '',
    date_of_birth: '',
    address: '',
    bio: '',
    experience_years: '',
    has_own_dogs: false,
    price: '30000',
    serviceRadius: '3',
    bank_account_type: 'nequi',
    bank_account_number: '',
    bank_name: '',
    id_document_front: null as string | null,
    id_document_back: null as string | null,
    criminal_record_cert: null as string | null,
    selfie_with_id: null as string | null,
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [coords, setCoords] = useState({ lat: null as number | null, lng: null as number | null });
  const [availability, setAvailability] = useState<any[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const scrollViewRef = useRef<ScrollView>(null);

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
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);
  const [newSlot, setNewSlot] = useState({ start_time: '08:00', end_time: '17:00' });

  useEffect(() => {
    const initData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: walker } = await supabase.from('walkers').select('*').eq('user_id', user.id).maybeSingle();
        if (walker) {
          setWalkerId(walker.id);
          setFormData(prev => ({
            ...prev,
            bio: walker.bio || '',
            price: String(walker.price || 30000),
            id_document_front: walker.id_document_front || null,
            id_document_back: walker.id_document_back || null,
            criminal_record_cert: walker.criminal_record_cert || null,
            selfie_with_id: walker.selfie_with_id || null,
          }));
          ['id_document_front', 'id_document_back', 'criminal_record_cert', 'selfie_with_id'].forEach(f => {
            const path = (walker as any)[f];
            if (path) refreshSignedUrl(path);
          });
          if (walker.service_latitude && walker.service_longitude) {
            setCoords({ lat: walker.service_latitude, lng: walker.service_longitude });
          }
          if (walker.service_radius_km) {
            setFormData(prev => ({ ...prev, serviceRadius: String(walker.service_radius_km) }));
          }
        }

        const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle();
        if (profile) {
          setFormData(prev => ({
            ...prev,
            name: profile.first_name || '',
            phone: profile.phone || '',
            id_number: profile.id_number || '',
            date_of_birth: profile.date_of_birth || '',
            address: profile.address || '',
            experience_years: profile.experience_years ? String(profile.experience_years) : '',
            has_own_dogs: profile.has_own_dogs || false,
            bank_account_type: profile.bank_account_type || 'nequi',
            bank_account_number: profile.bank_account_number || '',
            bank_name: profile.bank_name || '',
          }));
          if (profile.date_of_birth) setDateOfBirth(new Date(profile.date_of_birth));
          if (profile.lat && profile.lng && !coords.lat) {
            setCoords({ lat: profile.lat, lng: profile.lng });
          }
        }
      } catch (error) {
        console.error('Error cargando datos', error);
        Alert.alert('Error', 'No se pudieron cargar tus datos. Intenta de nuevo.');
      }
    };
    initData();
  }, []);

  useEffect(() => {
    if (walkerId) {
      fetchAvailability();
    }
  }, [walkerId]);

  const fetchAvailability = async () => {
    if (!walkerId) return;
    try {
      const { data, error } = await supabase
        .from('walker_availability')
        .select('*')
        .eq('walker_id', walkerId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });
      if (error) throw error;
      setAvailability(data || []);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'No se pudo cargar la disponibilidad. Intenta de nuevo.');
    }
  };

  const refreshSignedUrl = async (path: string) => {
    const { data } = await supabase.storage.from('walker_documents').createSignedUrl(path, 60 * 60);
    if (data) setSignedUrls(prev => ({ ...prev, [path]: data.signedUrl }));
  };

  const getPriceFromExperience = (years: string): number => {
    if (!years || years === '0') return 25000;
    const y = parseInt(years);
    if (y >= 3) return 40000;
    if (y >= 2) return 35000;
    if (y >= 1) return 30000;
    return 25000;
  };

  const formatBankNumber = (text: string, type: string, bank?: string): string => {
    const digits = text.replace(/\D/g, '');
    if (type === 'nequi') {
      return digits.replace(/(\d{3})(\d{1,4})?(\d{0,4})?/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' ')).slice(0, 13);
    }
    const maxDigits = bank === 'Davivienda' ? 10 : 11;
    const clean = digits.slice(0, maxDigits);
    return clean.replace(/(\d{1,3})(\d{0,6})(\d{0,2})/, (_, a, b, c) => [a, b, c].filter(Boolean).join('-')).slice(0, 14);
  };

  const BANKS = ['Bancolombia', 'Davivienda'];

  const calculateAge = (birthday: string) => {
    if (!birthday) return null;
    const ageDifMs = Date.now() - new Date(birthday).getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

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
      const [addressResult] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addressResult) {
        const fullAddress = [
          addressResult.street, addressResult.streetNumber, addressResult.district, addressResult.city
        ].filter(Boolean).join(', ');
        setFormData(prev => ({ ...prev, address: fullAddress }));
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo obtener la ubicación');
    } finally {
      setGettingLocation(false);
    }
  };

  const pickDocument = async (field: 'id_document_front' | 'id_document_back' | 'selfie_with_id' | 'criminal_record_cert', cameraType: 'camera' | 'gallery') => {
    try {
      let result;
      if (cameraType === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permiso requerido', 'Activa la cámara'); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permiso requerido', 'Activa la galería'); return; }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
      }
      if (!result.canceled && result.assets[0]) {
        await uploadDocument(result.assets[0].uri, field);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const uploadDocument = async (uri: string, field: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario');

      const file = new File(uri);
      const byteArray = await file.bytes();

      if (!byteArray || byteArray.length === 0) {
        throw new Error('El archivo está vacío');
      }

      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/jpeg', webp: 'image/webp' };
      const contentType = mimeMap[fileExt] || 'image/jpeg';
      const fileName = `${user.id}_${field}_${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('walker_documents')
        .upload(fileName, byteArray, { contentType, cacheControl: '3600' });

      if (uploadError) throw uploadError;

      setFormData(prev => ({ ...prev, [field]: data.path }));
      refreshSignedUrl(data.path);
      Alert.alert('Éxito', 'Documento subido');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo subir el documento');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStep = async () => {
    Keyboard.dismiss();
    setShowDatePicker(false);
    await new Promise(resolve => InteractionManager.runAfterInteractions(resolve));
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no encontrado');

      const nameParts = formData.name.trim().split(' ');
      const firstName = nameParts[0] || '.';
      const lastName = nameParts.slice(1).join(' ') || '.';

      const profileData: any = {
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        phone: formData.phone,
        id_number: formData.id_number,
        date_of_birth: formData.date_of_birth,
        address: formData.address,
        lat: coords.lat,
        lng: coords.lng,
        experience_years: formData.experience_years ? parseInt(formData.experience_years) : 0,
        has_own_dogs: formData.has_own_dogs,
        bank_account_type: formData.bank_account_type,
        bank_account_number: formData.bank_account_number.replace(/\D/g, ''),
        bank_name: formData.bank_account_type === 'nequi' ? '' : formData.bank_name,
        role: 'walker',
      };

      const cleanProfileData = Object.fromEntries(Object.entries(profileData).filter(([_, v]) => v !== '' && v !== null && v !== undefined));
      const { error: profileError } = await supabase.from('user_profiles').upsert(cleanProfileData, { onConflict: 'user_id' });
      if (profileError) throw profileError;

      const walkerData: any = {
        user_id: user.id,
        name: formData.name || 'Paseador',
        bio: formData.bio,
        price: parseInt(formData.price || '30000'),
        service_latitude: coords.lat,
        service_longitude: coords.lng,
        service_radius_km: parseInt(formData.serviceRadius || '3'),
        id_document_front: formData.id_document_front,
        id_document_back: formData.id_document_back,
        criminal_record_cert: formData.criminal_record_cert,
        selfie_with_id: formData.selfie_with_id,
      };

      const { data: updatedWalker, error: walkerError } = await supabase
        .from('walkers')
        .upsert(walkerData, { onConflict: 'user_id' })
        .select()
        .single();

      if (walkerError) throw walkerError;
      setWalkerId(updatedWalker.id);
      setStep(prev => prev + 1);
    } catch (error: any) {
      Alert.alert('Error al guardar', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSlot = async () => {
    if (!walkerId) return;
    if (selectedDays.length === 0) {
      Alert.alert('Error', 'Selecciona al menos un día');
      return;
    }
    if (newSlot.start_time >= newSlot.end_time) {
      Alert.alert('Error', 'La hora de fin debe ser después del inicio');
      return;
    }
    try {
      const slots = selectedDays.map(dayId => ({
        walker_id: walkerId,
        day_of_week: dayId,
        start_time: newSlot.start_time,
        end_time: newSlot.end_time,
      }));
      const { error } = await supabase.from('walker_availability').insert(slots);
      if (error) {
        if (error.code === '23505') { Alert.alert('Error', 'Uno o más de los horarios seleccionados ya existen'); return; }
        throw error;
      }
      Alert.alert('Éxito', 'Horarios agregados');
      await fetchAvailability();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo agregar');
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      const { error } = await supabase.from('walker_availability').delete().eq('id', slotId);
      if (error) throw error;
      await fetchAvailability();
    } catch (err) {
      Alert.alert('Error', 'No se pudo eliminar');
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('user_profiles').update({ is_profile_complete: true }).eq('user_id', user?.id);
      Alert.alert('¡Todo Listo!', 'Tu perfil entrará en revisión. Te notificaremos cuando puedas empezar.');
      router.replace('/walker-home');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const ProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>Paso {step} de {TOTAL_STEPS}</Text>
        <Text style={styles.progressText}>{Math.round((step / TOTAL_STEPS) * 100)}%</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>
    </View>
  );

  const getDocUrl = (path: string) => signedUrls[path] || '';

  const DocumentCard = ({ label, value, onCamera, onGallery }: { label: string; value: string | null; onCamera: () => void; onGallery: () => void }) => (
    <View style={[styles.docCard, value && styles.docCardDone]}>
      <View style={styles.docHeader}>
        <Text style={styles.docLabel}>{label}</Text>
        {value && <Check size={16} color="#13ec13" />}
      </View>
      {value ? (
        <View style={styles.docUploaded}>
          <Image source={{ uri: getDocUrl(value) }} style={styles.docThumb} resizeMode="cover" />
          <View style={styles.docActions}>
            <TouchableOpacity style={styles.docActionBtn} onPress={() => Linking.openURL(getDocUrl(value))}>
              <Text style={styles.docActionText}>Ver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.docActionBtn} onPress={onCamera}>
              <Camera size={14} color="#FFFFFF" />
              <Text style={styles.docActionText}>Tomar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.docButtons}>
          <TouchableOpacity style={styles.docBtn} onPress={onCamera}>
            <Camera size={14} color="#FFFFFF" />
            <Text style={styles.docBtnText}>Cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.docBtn} onPress={onGallery}>
            <Text style={styles.docBtnText}>Galería</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const canProceed = () => {
    switch (step) {
      case 1: return formData.name.trim() && formData.phone.trim() && formData.id_number.trim() && formData.date_of_birth && formData.address.trim();
      case 2: return formData.id_document_front !== null;
      case 3: return formData.bio.trim();
      case 4:
        if (formData.bank_account_type === 'nequi') return formData.bank_account_number.trim();
        return formData.bank_account_number.trim() && formData.bank_name.trim();
      case 5: return true;
      case 6: return true;
      default: return true;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProgressBar />
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={{ padding: 16, paddingBottom: keyboardHeight + 40, flexGrow: 1 }}
      >

        {step === 1 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepEmoji}>👤</Text>
              <Text style={styles.stepTitle}>Datos Personales</Text>
              <Text style={styles.stepSubtitle}>Queremos conocerte mejor</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.label}>Nombre completo *</Text>
              <TextInput style={styles.input} value={formData.name} onChangeText={t => setFormData(p => ({ ...p, name: t }))} placeholder="Tu nombre" placeholderTextColor="#9CA3AF" />

              <Text style={styles.label}>Teléfono *</Text>
              <TextInput style={styles.input} value={formData.phone} onChangeText={t => setFormData(p => ({ ...p, phone: t }))} placeholder="300 123 4567" keyboardType="phone-pad" placeholderTextColor="#9CA3AF" />

              <Text style={styles.label}>Cédula de Ciudadanía *</Text>
              <TextInput style={styles.input} value={formData.id_number} onChangeText={t => setFormData(p => ({ ...p, id_number: t }))} placeholder="Número de documento" keyboardType="number-pad" placeholderTextColor="#9CA3AF" />

              <Text style={styles.label}>Fecha de Nacimiento *</Text>
              <TouchableOpacity style={styles.input} onPress={() => { setShowDatePicker(true); setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150); }} activeOpacity={0.7}>
                <Text style={[styles.dateText, !formData.date_of_birth && styles.datePlaceholder]}>
                  {formData.date_of_birth || 'Selecciona tu fecha de nacimiento'}
                </Text>
              </TouchableOpacity>
              {showDatePicker && Platform.OS === 'ios' && (
                <View style={styles.datePickerContainer}>
                  <DateTimePicker
                    value={dateOfBirth || new Date(2000, 0, 1)}
                    mode="date"
                    display="spinner"
                    maximumDate={new Date()}
                    themeVariant="light"
                    onChange={(_event: any, selectedDate?: Date) => {
                      if (selectedDate) {
                        setDateOfBirth(selectedDate);
                        const year = selectedDate.getFullYear();
                        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const day = String(selectedDate.getDate()).padStart(2, '0');
                        setFormData(p => ({ ...p, date_of_birth: `${year}-${month}-${day}` }));
                      }
                    }}
                  />
                  <TouchableOpacity style={styles.dateDoneBtn} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.dateDoneText}>Listo</Text>
                  </TouchableOpacity>
                </View>
              )}
              {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={dateOfBirth || new Date(2000, 0, 1)}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(_event: any, selectedDate?: Date) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setDateOfBirth(selectedDate);
                      const year = selectedDate.getFullYear();
                      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                      const day = String(selectedDate.getDate()).padStart(2, '0');
                      setFormData(p => ({ ...p, date_of_birth: `${year}-${month}-${day}` }));
                    }
                  }}
                />
              )}

              <Text style={styles.label}>Dirección (Usa el GPS) *</Text>
              <View style={styles.addressInput}>
                <TextInput style={styles.addressTextInput} value={formData.address} onChangeText={t => setFormData(p => ({ ...p, address: t }))} placeholder="Tu dirección" placeholderTextColor="#9CA3AF" />
                <TouchableOpacity onPress={handleCurrentLocation} disabled={gettingLocation}>
                  {gettingLocation ? <Text style={styles.locationIcon}>⏳</Text> : <Crosshair size={20} color="#13ec13" />}
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.primaryBtn, !canProceed() && styles.btnDisabled]} onPress={handleSaveStep} disabled={!canProceed() || loading}>
                <Text style={styles.primaryBtnText}>{loading ? 'Guardando...' : 'Continuar →'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <ShieldCheck size={40} color="#13ec13" />
              <Text style={styles.stepTitle}>Verificación</Text>
              <Text style={styles.stepSubtitle}>Sube tus documentos</Text>
            </View>

            <View style={styles.formCard}>
              <DocumentCard label="Cédula (Frente)" value={formData.id_document_front} onCamera={() => pickDocument('id_document_front', 'camera')} onGallery={() => pickDocument('id_document_front', 'gallery')} />
              <DocumentCard label="Cédula (Reverso)" value={formData.id_document_back} onCamera={() => pickDocument('id_document_back', 'camera')} onGallery={() => pickDocument('id_document_back', 'gallery')} />
              <DocumentCard label="Selfie con Cédula" value={formData.selfie_with_id} onCamera={() => pickDocument('selfie_with_id', 'camera')} onGallery={() => pickDocument('selfie_with_id', 'gallery')} />
              <DocumentCard label="Antecedentes Judiciales" value={formData.criminal_record_cert} onCamera={() => pickDocument('criminal_record_cert', 'camera')} onGallery={() => pickDocument('criminal_record_cert', 'gallery')} />

              <View style={styles.navButtons}>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(1)}>
                    <Text style={styles.secondaryBtnText}>Atrás</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity style={[styles.primaryBtn, !canProceed() && styles.btnDisabled]} onPress={handleSaveStep} disabled={!canProceed() || loading}>
                    <Text style={styles.primaryBtnText}>{loading ? 'Guardando...' : 'Continuar'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepEmoji}>💼</Text>
              <Text style={styles.stepTitle}>Tu Experiencia</Text>
              <Text style={styles.stepSubtitle}>Cuéntanos sobre ti</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.label}>Sobre ti / Biografía *</Text>
              <TextInput style={[styles.input, styles.textArea]} value={formData.bio} onChangeText={t => setFormData(p => ({ ...p, bio: t }))} placeholder="Cuéntanos por qué eres el mejor paseador..." multiline numberOfLines={4} placeholderTextColor="#9CA3AF" />

              <Text style={styles.label}>Años de Experiencia</Text>
              <View style={styles.optionsGrid}>
                {[
                  { value: '0', label: 'Sin experiencia' },
                  { value: '1', label: '6 meses - 1 año' },
                  { value: '2', label: '1 - 2 años' },
                  { value: '3', label: '2+ años' },
                ].map(opt => (
                  <TouchableOpacity key={opt.value} style={[styles.optionChip, formData.experience_years === opt.value && styles.optionChipActive]} onPress={() => {
                    setFormData(prev => ({ ...prev, experience_years: opt.value, price: String(getPriceFromExperience(opt.value)) }));
                  }}>
                    <Text style={[styles.optionChipText, formData.experience_years === opt.value && styles.optionChipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.priceSuggestion}>
                <Text style={styles.priceSuggestionText}>Sugerido: ${getPriceFromExperience(formData.experience_years).toLocaleString('es-CO')}/hr</Text>
              </View>

              <Text style={styles.label}>Tu Precio por Hora</Text>
              <View style={styles.optionsGrid}>
                {['25000', '30000', '35000', '40000'].map(p => (
                  <TouchableOpacity key={p} style={[styles.optionChipBig, formData.price === p && styles.optionChipBigActive]} onPress={() => setFormData(prev => ({ ...prev, price: p }))}>
                    <Text style={[styles.optionChipBigText, formData.price === p && styles.optionChipBigTextActive]}>${parseInt(p).toLocaleString('es-CO')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Tengo mascotas propias</Text>
                <Switch value={formData.has_own_dogs} onValueChange={v => setFormData(p => ({ ...p, has_own_dogs: v }))} trackColor={{ false: '#E5E7EB', true: '#13ec13' }} thumbColor={formData.has_own_dogs ? '#FFFFFF' : '#FFFFFF'} />
              </View>

              <View style={styles.navButtons}>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(2)}>
                    <Text style={styles.secondaryBtnText}>Atrás</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity style={[styles.primaryBtn, !canProceed() && styles.btnDisabled]} onPress={handleSaveStep} disabled={!canProceed() || loading}>
                    <Text style={styles.primaryBtnText}>{loading ? 'Guardando...' : 'Continuar'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepEmoji}>💳</Text>
              <Text style={styles.stepTitle}>Datos de Pago</Text>
              <Text style={styles.stepSubtitle}>Cómo recibirás tus ganancias</Text>
            </View>

            <View style={styles.formCard}>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.typeBtn, formData.bank_account_type === 'nequi' && styles.typeBtnActive]} onPress={() => setFormData(p => ({ ...p, bank_account_type: 'nequi', bank_name: '' }))}>
                  <Text style={[styles.typeText, formData.bank_account_type === 'nequi' && styles.typeTextActive]}>Nequi</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.typeBtn, (formData.bank_account_type === 'ahorros' || formData.bank_account_type === 'corriente') && styles.typeBtnActive]} onPress={() => setFormData(p => ({ ...p, bank_account_type: 'ahorros' }))}>
                  <Text style={[styles.typeText, (formData.bank_account_type === 'ahorros' || formData.bank_account_type === 'corriente') && styles.typeTextActive]}>Cuenta Banco</Text>
                </TouchableOpacity>
              </View>

              {(formData.bank_account_type === 'ahorros' || formData.bank_account_type === 'corriente') && (
                <>
                  <Text style={styles.label}>Banco *</Text>
                  <View style={styles.bankGrid}>
                    {BANKS.map(bank => (
                      <TouchableOpacity key={bank} style={[styles.bankChip, formData.bank_name === bank && styles.bankChipActive]} onPress={() => setFormData(p => ({ ...p, bank_name: bank, bank_account_number: '' }))}>
                        <Text style={[styles.bankChipText, formData.bank_name === bank && styles.bankChipTextActive]}>{bank}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.row}>
                    <TouchableOpacity style={[styles.subTypeBtn, formData.bank_account_type === 'ahorros' && styles.subTypeBtnActive]} onPress={() => setFormData(p => ({ ...p, bank_account_type: 'ahorros' }))}>
                      <Text style={[styles.subTypeText, formData.bank_account_type === 'ahorros' && styles.subTypeTextActive]}>Ahorros</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.subTypeBtn, formData.bank_account_type === 'corriente' && styles.subTypeBtnActive]} onPress={() => setFormData(p => ({ ...p, bank_account_type: 'corriente' }))}>
                      <Text style={[styles.subTypeText, formData.bank_account_type === 'corriente' && styles.subTypeTextActive]}>Corriente</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <Text style={styles.label}>Número de Cuenta o Celular *</Text>
              <TextInput style={styles.input} value={formData.bank_account_number} onChangeText={t => setFormData(p => ({ ...p, bank_account_number: formatBankNumber(t, formData.bank_account_type, formData.bank_name) }))} placeholder={formData.bank_account_type === 'nequi' ? '300 123 4567' : `${formData.bank_name === 'Davivienda' ? '123-456789-0' : '007-1234567-01'}`} keyboardType="number-pad" placeholderTextColor="#9CA3AF" />

              <View style={{ flex: 1 }} />
              <View style={styles.navButtons}>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(3)}>
                    <Text style={styles.secondaryBtnText}>Atrás</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity style={[styles.primaryBtn, !canProceed() && styles.btnDisabled]} onPress={handleSaveStep} disabled={!canProceed() || loading}>
                    <Text style={styles.primaryBtnText}>{loading ? 'Guardando...' : 'Continuar'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {step === 5 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepEmoji}>📍</Text>
              <Text style={styles.stepTitle}>Tu Zona</Text>
              <Text style={styles.stepSubtitle}>Define tu radio de cobertura</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.label}>Radio de servicio (km)</Text>
              <View style={styles.radiusOptions}>
                {['2', '3', '5', '10', '15', '20'].map(r => (
                  <TouchableOpacity key={r} style={[styles.radiusBtn, formData.serviceRadius === r && styles.radiusBtnActive]} onPress={() => setFormData(p => ({ ...p, serviceRadius: r }))}>
                    <Text style={[styles.radiusText, formData.serviceRadius === r && styles.radiusTextActive]}>{r} km</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.gpsBtn} onPress={handleCurrentLocation} disabled={gettingLocation}>
                <Text style={styles.gpsBtnText}>{gettingLocation ? 'Obteniendo...' : '📍 Usar mi ubicación actual'}</Text>
              </TouchableOpacity>

              {coords.lat && (
                <Text style={styles.coordsText}>Lat: {coords.lat?.toFixed(4)}, Lng: {coords.lng?.toFixed(4)}</Text>
              )}

              <View style={styles.navButtons}>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(4)}>
                    <Text style={styles.secondaryBtnText}>Atrás</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveStep} disabled={loading}>
                    <Text style={styles.primaryBtnText}>{loading ? 'Guardando...' : 'Continuar'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {step === 6 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepEmoji}>📅</Text>
              <Text style={styles.stepTitle}>Tu Horario</Text>
              <Text style={styles.stepSubtitle}>Selecciona tus días disponibles</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.label}>Día</Text>
              <View style={styles.dayRow}>
                {DAYS_OF_WEEK.map(d => {
                  const isSelected = selectedDays.includes(d.id);
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.dayBtn, isSelected && styles.dayBtnActive]}
                      onPress={() => {
                        if (isSelected) {
                          setSelectedDays(selectedDays.filter(id => id !== d.id));
                        } else {
                          setSelectedDays([...selectedDays, d.id]);
                        }
                      }}
                    >
                      <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>
                        {d.name.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.shortcutsRow}>
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => setSelectedDays([1, 2, 3, 4, 5])}>
                  <Text style={styles.shortcutText}>Lun a Vie</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => setSelectedDays([6, 0])}>
                  <Text style={styles.shortcutText}>Fin de Sem</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => setSelectedDays([1, 2, 3, 4, 5, 6, 0])}>
                  <Text style={styles.shortcutText}>Todos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => setSelectedDays([])}>
                  <Text style={styles.shortcutText}>Limpiar</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>Inicio</Text>
                  <TextInput style={styles.input} value={newSlot.start_time} onChangeText={t => setNewSlot(p => ({ ...p, start_time: t }))} placeholder="08:00" placeholderTextColor="#9CA3AF" />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>Fin</Text>
                  <TextInput style={styles.input} value={newSlot.end_time} onChangeText={t => setNewSlot(p => ({ ...p, end_time: t }))} placeholder="17:00" placeholderTextColor="#9CA3AF" />
                </View>
              </View>

              <TouchableOpacity style={styles.addBtn} onPress={handleAddSlot}>
                <Text style={styles.addBtnText}>+ Agregar Horario</Text>
              </TouchableOpacity>

              <View style={styles.slotList}>
                {availability.map(slot => {
                  const day = DAYS_OF_WEEK.find(d => d.id === slot.day_of_week)?.name;
                  return (
                    <View key={slot.id} style={styles.slotItem}>
                      <Text style={styles.slotText}>{day}: {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}</Text>
                      <TouchableOpacity onPress={() => handleDeleteSlot(slot.id)}>
                        <Text style={styles.slotDelete}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              <View style={styles.navButtons}>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(5)}>
                    <Text style={styles.secondaryBtnText}>Atrás</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(7)}>
                    <Text style={styles.primaryBtnText}>Continuar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {step === 7 && (
          <View style={styles.stepContainer}>
            <View style={styles.successBox}>
              <Text style={styles.successEmoji}>✅</Text>
              <Text style={styles.successTitle}>¡Todo Listo!</Text>
              <Text style={styles.successText}>Tu perfil entrará en revisión. Te notificaremos cuando puedas empezar a recibir paseos.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleComplete} disabled={loading}>
                <Text style={styles.primaryBtnText}>{loading ? '...' : 'Ir a mi Panel'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { flex: 1, padding: 20 },
  progressContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, backgroundColor: '#111827', borderBottomWidth: 1, borderBottomColor: '#374151' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase' },
  progressBarBg: { height: 4, backgroundColor: '#374151', borderRadius: 2 },
  progressBarFill: { height: 4, backgroundColor: '#13ec13', borderRadius: 2 },
  stepContainer: { flex: 1 },
  stepHeader: { alignItems: 'center', marginVertical: 16 },
  stepEmoji: { fontSize: 40, marginBottom: 8 },
  stepTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 },
  stepSubtitle: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', marginTop: 4, letterSpacing: 2 },
  formCard: { flex: 1, backgroundColor: '#1F2937', borderRadius: 24, padding: 16, gap: 12 },
  label: { fontSize: 10, fontWeight: '900', color: '#6B7280', textTransform: 'uppercase', marginBottom: 6, marginLeft: 4 },
  input: { backgroundColor: '#374151', borderRadius: 16, padding: 16, fontSize: 14, fontWeight: '700', color: '#FFFFFF', borderWidth: 2, borderColor: 'transparent' },
  textArea: { height: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  addressInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#374151', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: 'transparent' },
  addressTextInput: { flex: 1, fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  locationIcon: { fontSize: 20, marginLeft: 8 },
  dateText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  datePlaceholder: { color: '#9CA3AF' },
  datePickerContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  dateDoneBtn: { backgroundColor: '#13ec13', borderRadius: 12, padding: 12, alignItems: 'center', marginHorizontal: 12, marginBottom: 12 },
  dateDoneText: { fontSize: 13, fontWeight: '900', color: '#052e05', textTransform: 'uppercase' },
  primaryBtn: { flex: 1, backgroundColor: '#13ec13', borderRadius: 24, paddingVertical: 18, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { fontSize: 13, fontWeight: '900', color: '#052e05', textTransform: 'uppercase', letterSpacing: 1 },
  secondaryBtn: { backgroundColor: '#374151', borderRadius: 24, paddingVertical: 18, alignItems: 'center', flex: 1, marginTop: 8 },
  secondaryBtnText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 },
  btnDisabled: { opacity: 0.5 },
  navButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  docCard: { backgroundColor: '#1F2937', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 2, borderColor: '#374151' },
  docCardDone: { borderColor: '#065f46' },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  docLabel: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  docUploaded: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  docThumb: { width: 56, height: 56, borderRadius: 10 },
  docActions: { flexDirection: 'row', gap: 8 },
  docActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#374151', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  docActionText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  docButtons: { flexDirection: 'row', gap: 10 },
  docBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#374151', borderRadius: 12, paddingVertical: 12 },
  docBtnText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: '#374151', borderWidth: 2, borderColor: 'transparent' },
  optionChipActive: { backgroundColor: '#052e05', borderColor: '#13ec13' },
  optionChipText: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  optionChipTextActive: { color: '#13ec13' },
  bankGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bankChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#374151', borderWidth: 2, borderColor: 'transparent' },
  bankChipActive: { backgroundColor: '#052e05', borderColor: '#13ec13' },
  bankChipText: { fontSize: 11, fontWeight: '700', color: '#9CA3AF' },
  bankChipTextActive: { color: '#13ec13' },
  optionChipBig: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: '#374151', borderWidth: 2, borderColor: 'transparent', alignItems: 'center' },
  optionChipBigActive: { backgroundColor: '#052e05', borderColor: '#13ec13' },
  optionChipBigText: { fontSize: 13, fontWeight: '900', color: '#9CA3AF' },
  optionChipBigTextActive: { color: '#13ec13' },
  priceSuggestion: { backgroundColor: '#1F2937', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  priceSuggestionText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1F2937', borderRadius: 16, padding: 16 },
  switchLabel: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  typeBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: '#374151', borderWidth: 2, borderColor: 'transparent', alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#052e05', borderColor: '#13ec13' },
  typeText: { fontSize: 12, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase' },
  typeTextActive: { color: '#13ec13' },
  subTypeBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#374151', borderWidth: 2, borderColor: 'transparent', alignItems: 'center' },
  subTypeBtnActive: { backgroundColor: '#1F2937', borderColor: '#13ec13' },
  subTypeText: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase' },
  subTypeTextActive: { color: '#13ec13' },
  radiusOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radiusBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: '#374151', borderWidth: 2, borderColor: 'transparent' },
  radiusBtnActive: { backgroundColor: '#1F2937', borderColor: '#13ec13' },
  radiusText: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  radiusTextActive: { color: '#13ec13' },
  gpsBtn: { backgroundColor: '#1F2937', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#374151' },
  gpsBtnText: { fontSize: 13, fontWeight: '700', color: '#13ec13' },
  coordsText: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayBtn: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: '#374151' },
  dayBtnActive: { backgroundColor: '#13ec13' },
  dayText: { fontSize: 11, fontWeight: '700', color: '#9CA3AF' },
  dayTextActive: { color: '#052e05' },
  addBtn: { backgroundColor: '#111827', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 8 },
  addBtnText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase' },
  slotList: { marginTop: 16, gap: 8 },
  slotItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1F2937', borderRadius: 12, padding: 12 },
  slotText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  slotDelete: { fontSize: 16 },
  successBox: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  successEmoji: { fontSize: 48, marginBottom: 16 },
  successTitle: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', marginBottom: 8 },
  successText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  shortcutsRow: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 4, flexWrap: 'wrap' },
  shortcutBtn: { backgroundColor: '#374151', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#4B5563' },
  shortcutText: { color: '#9CA3AF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});
