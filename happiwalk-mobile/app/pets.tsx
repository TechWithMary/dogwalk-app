import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform, Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback, InputAccessoryView } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, DogIcon, ArrowLeft, ShieldCheck, Camera } from '../components/Icons';
import AvatarImage from '../components/AvatarImage';
import EmptyState from '../components/EmptyState';
import { SkeletonList } from '../components/Skeleton';
import BreedPickerField from '../components/BreedPicker';
import { OTHER_BREED_OPTION } from '../constants/pet-breeds';

interface Pet {
  id: string;
  name: string;
  breed: string;
  age_years: number;
  behavioral_notes: string;
  medical_conditions: string;
  photos?: string[];
}

export default function PetManagerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);

  useEffect(() => {
    fetchPets();
  }, []);

  const fetchPets = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPets(data || []);
    } catch (error: any) {
      Alert.alert('Error', 'Error cargando mascotas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePet = async (petData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let error;
      if (editingPet) {
        const { error: updateError } = await supabase
          .from('pets')
          .update({
            name: petData.name,
            breed: petData.breed,
            age_years: parseInt(petData.age_years) || 0,
            behavioral_notes: petData.behavioral_notes,
            medical_conditions: petData.medical_conditions,
            photos: petData.photos
          })
          .eq('id', editingPet.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('pets')
          .insert([{ 
            ...petData, 
            age_years: parseInt(petData.age_years) || 0,
            owner_id: user.id,
            is_active: true 
          }]);
        error = insertError;
      }

      if (error) throw error;
      
      Alert.alert('Éxito', `¡${petData.name} se guardó correctamente!`);
      setShowForm(false);
      setEditingPet(null);
      fetchPets();
    } catch (error: any) {
      Alert.alert('Error', 'Error al guardar: ' + error.message);
    }
  };

  const handleDeletePet = (petId: string) => {
    Alert.alert(
      'Eliminar Mascota',
      '¿Estás seguro de que quieres eliminar esta mascota?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('pets')
                .update({ is_active: false })
                .eq('id', petId);

              if (error) throw error;
              
              Alert.alert('Éxito', 'Mascota eliminada con éxito');
              fetchPets();
            } catch (error: any) {
              Alert.alert('Error', 'No se pudo eliminar: ' + error.message);
            }
          },
        },
      ]
    );
  };

  if (showForm) {
    return (
      <PetForm
        pet={editingPet}
        onSave={handleSavePet}
        onCancel={() => { setShowForm(false); setEditingPet(null); }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Mascotas</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <SkeletonList count={3} />
        ) : pets.length === 0 ? (
          <EmptyState
            icon={<DogIcon size={36} color="#0EA5E9" />}
            title="No tienes mascotas registradas"
            description="Añade tu primera mascota para empezar a reservar paseos."
            actionLabel="Añadir Mascota"
            onAction={() => { setEditingPet(null); setShowForm(true); }}
          />
        ) : (
          <View style={styles.petsList}>
            {pets.map((pet) => (
              <View key={pet.id} style={styles.petCard}>
                <View style={styles.petInfo}>
                  {pet.photos && pet.photos.length > 0 ? (
                    <AvatarImage
                      photoUrl={pet.photos[0]}
                      fallbackInitial={pet.name}
                      size={48}
                      style={styles.petImageRounded}
                      bucket="pet-photos"
                    />
                  ) : (
                    <View style={styles.petImage}>
                      <DogIcon size={24} color="#6B7280" />
                    </View>
                  )}
                  <View>
                    <Text style={styles.petName}>{pet.name}</Text>
                    <Text style={styles.petBreed}>{(pet.breed || 'Criollo')} • {pet.age_years === 1 ? '1 año' : `${pet.age_years} años`}</Text>
                  </View>
                </View>
                <View style={styles.petActions}>
                  <TouchableOpacity 
                    style={styles.editBtn}
                    onPress={() => { setEditingPet(pet); setShowForm(true); }}
                  >
                    <Text style={styles.editBtnText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.deleteBtn}
                    onPress={() => handleDeletePet(pet.id)}
                  >
                    <Trash2 size={14} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => { setEditingPet(null); setShowForm(true); }}
        >
          <Text style={styles.addBtnText}>+ Añadir Nueva Mascota</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function PetForm({ pet, onSave, onCancel }: { pet: Pet | null; onSave: (data: any) => void; onCancel: () => void }) {
  const insets = useSafeAreaInsets();
  const [formData, setFormData] = useState({
    name: pet?.name || '',
    breed: pet?.breed || '',
    age_years: pet?.age_years?.toString() || '',
    behavioral_notes: pet?.behavioral_notes || '',
    medical_conditions: pet?.medical_conditions || '',
    photos: pet?.photos || []
  });
  const [otherBreed, setOtherBreed] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const detailsSectionY = useRef(0);
  const formBlockY = useRef(0);
  const breedFieldY = useRef(0);

  const scrollToField = (y: number) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
    }, Platform.OS === 'ios' ? 100 : 50);
  };

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre de tu mascota');
      return;
    }
    let finalBreed = formData.breed.trim();
    if (finalBreed === OTHER_BREED_OPTION) {
      finalBreed = otherBreed.trim();
    }
    if (!finalBreed) {
      Alert.alert('Error', 'Por favor selecciona o escribe la raza');
      return;
    }
    onSave({ ...formData, breed: finalBreed });
  };

  const pickPetPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el permiso de galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPetPhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const uploadPetPhoto = async (uri: string) => {
    setUploadingPhoto(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario');

      const file = new File(uri);
      const byteArray = await file.bytes();

      if (!byteArray || byteArray.length === 0) {
        throw new Error('El archivo está vacío');
      }

      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}_pet_${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('pet-photos')
        .upload(fileName, byteArray, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      setFormData(prev => ({
        ...prev,
        photos: [...(prev.photos || []), fileName]
      }));

      Alert.alert('Éxito', 'Foto de mascota subida');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo subir la foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const bottomBarHeight = 72 + insets.bottom;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.formContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.formInner}>
            <View style={styles.formHeader}>
              <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
                <ArrowLeft size={20} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{pet ? 'Editar Mascota' : 'Añadir Mascota'}</Text>
              <View style={styles.headerRight} />
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={styles.formScroll}
              showsVerticalScrollIndicator={false}
              scrollEnabled
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentContainerStyle={[
                styles.formScrollContent,
                {
                  flexGrow: 1,
                  paddingBottom: bottomBarHeight + (keyboardVisible ? 24 : 10),
                },
              ]}
            >
              <View style={styles.photoSection}>
                <Text style={styles.labelCentered}>Foto de tu Mascota</Text>
                <TouchableOpacity style={styles.photoUploadBtn} onPress={pickPetPhoto} disabled={uploadingPhoto}>
                  {uploadingPhoto ? (
                    <Text style={styles.photoUploadText}>Subiendo...</Text>
                  ) : formData.photos && formData.photos.length > 0 ? (
                    <AvatarImage
                      photoUrl={formData.photos[0]}
                      fallbackInitial={formData.name || 'M'}
                      size={88}
                      style={styles.petPhoto}
                      bucket="pet-photos"
                    />
                  ) : (
                    <>
                      <Camera size={28} color="#9CA3AF" />
                      <Text style={styles.photoUploadText}>Toca para subir foto</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {!keyboardVisible && <View style={styles.formSpacerSmall} />}

              <View
                style={[
                  styles.formFieldsBlock,
                  keyboardVisible && styles.formFieldsBlockCompact,
                ]}
                onLayout={(e) => {
                  formBlockY.current = e.nativeEvent.layout.y;
                }}
              >
              <View style={styles.formSectionCompact}>
                <Text style={styles.label}>Información Básica</Text>

                <Text style={styles.fieldLabel}>Nombre de tu mascota</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Ej. Luna"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />

                <Text style={styles.fieldLabel}>Edad en años</Text>
                <TextInput
                  style={[styles.input, styles.inputAge]}
                  value={formData.age_years}
                  onChangeText={(text) => setFormData({ ...formData, age_years: text.replace(/[^0-9]/g, '') })}
                  placeholder="3"
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />

                <View
                  onLayout={(e) => {
                    breedFieldY.current = e.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.fieldLabel}>Raza</Text>
                  <BreedPickerField
                    value={formData.breed}
                    onChange={(breed) => setFormData({ ...formData, breed })}
                    otherBreed={otherBreed}
                    onOtherBreedChange={setOtherBreed}
                    onOpenChange={(open) => {
                      if (open) scrollToField(formBlockY.current + breedFieldY.current);
                    }}
                  />
                </View>
              </View>

              <View
                style={styles.formSectionCompact}
                onLayout={(e) => {
                  detailsSectionY.current = e.nativeEvent.layout.y;
                }}
              >
                <Text style={styles.label}>Detalles Importantes</Text>

                <Text style={styles.fieldHint}>
                  ¿Cómo se comporta? (ej. le teme a las motos, jala mucho)
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.behavioral_notes}
                  onChangeText={(text) => setFormData({ ...formData, behavioral_notes: text })}
                  placeholder="Escribe aquí..."
                  multiline
                  numberOfLines={2}
                  placeholderTextColor="#9CA3AF"
                  blurOnSubmit={false}
                  inputAccessoryViewID={Platform.OS === 'ios' ? 'petNotesDone' : undefined}
                  onFocus={() => scrollToField(detailsSectionY.current)}
                />

                <Text style={[styles.fieldHint, styles.fieldHintSpaced]}>
                  Salud y Vacunas (ej. vacunas al día, alergias)
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea, styles.textAreaLast]}
                  value={formData.medical_conditions}
                  onChangeText={(text) => setFormData({ ...formData, medical_conditions: text })}
                  placeholder="Escribe aquí..."
                  multiline
                  numberOfLines={2}
                  placeholderTextColor="#9CA3AF"
                  blurOnSubmit={false}
                  inputAccessoryViewID={Platform.OS === 'ios' ? 'petNotesDone' : undefined}
                  onFocus={() => scrollToField(detailsSectionY.current + 88)}
                />
              </View>

              <View style={styles.warningBox}>
                <ShieldCheck size={18} color="#052e05" />
                <Text style={styles.warningText}>
                  La información de salud es privada y solo se comparte con tu paseador.
                </Text>
              </View>
              </View>
            </ScrollView>

            {Platform.OS === 'ios' && (
              <InputAccessoryView nativeID="petNotesDone">
                <View style={styles.inputAccessory}>
                  <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.doneButton}>
                    <Text style={styles.doneButtonText}>Listo</Text>
                  </TouchableOpacity>
                </View>
              </InputAccessoryView>
            )}

            <View style={[styles.fixedBottom, { paddingBottom: insets.bottom + 8 }]}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit}>
                <Text style={styles.saveBtnText}>
                  {pet ? 'Actualizar Mascota' : 'Guardar Mascota'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 20,
    color: '#374151',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  headerRight: {
    width: 36,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  petsList: {
    gap: 10,
  },
  petCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  petInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petImage: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  petImageRounded: {
    marginRight: 12,
  },
  photoUploadBtn: {
    width: 96,
    height: 96,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  photoUploadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  petPhoto: {
    borderRadius: 20,
  },
  petName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  petBreed: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  petActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
    textTransform: 'uppercase',
  },
  deleteBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 12,
  },
  addBtn: {
    marginTop: 20,
    padding: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#A7F3D0',
    borderRadius: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#052e05',
    textTransform: 'uppercase',
  },
  formContainer: {
    flex: 1,
  },
  formInner: {
    flex: 1,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    paddingHorizontal: 16,
  },
  formSpacerSmall: {
    height: 12,
  },
  formFieldsBlock: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  formFieldsBlockCompact: {
    flexGrow: 0,
    justifyContent: 'flex-start',
    paddingBottom: 0,
  },
  photoSection: {
    alignItems: 'center',
    paddingTop: 20,
    marginBottom: 8,
  },
  labelCentered: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
    alignSelf: 'center',
  },
  formSection: {
    marginBottom: 24,
  },
  formSectionCompact: {
    marginBottom: 8,
  },
  inputAge: {
    width: 72,
    paddingHorizontal: 10,
    paddingVertical: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 14,
    marginLeft: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 4,
    marginLeft: 4,
  },
  fieldHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 6,
    marginLeft: 4,
    lineHeight: 15,
  },
  fieldHintSpaced: {
    marginTop: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    marginBottom: 8,
  },
  textArea: {
    minHeight: 56,
    maxHeight: 56,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  textAreaLast: {
    marginBottom: 0,
  },
  selectInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  placeholder: {
    color: '#9CA3AF',
  },
  selectArrow: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  breedList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    maxHeight: 160,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  breedScroll: {
    maxHeight: 160,
  },
  breedOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  breedOptionText: {
    fontSize: 14,
    color: '#111827',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 8,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
    lineHeight: 14,
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
  fixedBottom: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  saveBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
