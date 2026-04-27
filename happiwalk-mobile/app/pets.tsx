import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, DogIcon, ArrowLeft, ShieldCheck } from '../components/Icons';

interface Pet {
  id: string;
  name: string;
  breed: string;
  age_years: number;
  behavioral_notes: string;
  medical_conditions: string;
  photo_url?: string;
}

const BREEDS = [
  "Criollo / Mezcla", "Labrador Retriever", "Golden Retriever", "Pastor Alemán", 
  "Bulldog Francés", "Bulldog Inglés", "Beagle", "Poodle", "Rottweiler", 
  "Yorkshire Terrier", "Boxer", "Dachshund", "Siberian Husky", "Chihuahua", 
  "Border Collie", "Pug", "Shih Tzu", "Cocker Spaniel", "Pitbull", "Doberman",
  "Gran Danés", "Maltés", "Pomerania", "Basset Hound", "Pastor Belga", 
  "Dogo Argentino", "Mastín", "San Bernardo", "Otro"
];

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
            medical_conditions: petData.medical_conditions
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
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Mascotas</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando...</Text>
          </View>
        ) : pets.length === 0 ? (
          <View style={styles.emptyState}>
            <DogIcon size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No tienes mascotas registradas</Text>
          </View>
        ) : (
          <View style={styles.petsList}>
            {pets.map((pet) => (
              <View key={pet.id} style={styles.petCard}>
                <View style={styles.petInfo}>
                  <View style={styles.petImage}>
                    <DogIcon size={28} color="#6B7280" />
                  </View>
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
                    <Trash2 size={16} color="#DC2626" />
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
    medical_conditions: pet?.medical_conditions || ''
  });
  const [showBreedPicker, setShowBreedPicker] = useState(false);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre de tu mascota');
      return;
    }
    if (!formData.breed) {
      Alert.alert('Error', 'Por favor selecciona una raza');
      return;
    }
    onSave(formData);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
          <ArrowLeft size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pet ? 'Editar Mascota' : 'Añadir Mascota'}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.formSection}>
          <Text style={styles.label}>Información Básica</Text>
          
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Nombre de tu mascota"
            placeholderTextColor="#9CA3AF"
          />

          <TouchableOpacity 
            style={styles.selectInput}
            onPress={() => setShowBreedPicker(!showBreedPicker)}
          >
            <Text style={[styles.selectText, !formData.breed && styles.placeholder]}>
              {formData.breed || 'Selecciona la raza'}
            </Text>
            <Text style={styles.selectArrow}>▼</Text>
          </TouchableOpacity>

          {showBreedPicker && (
            <View style={styles.breedList}>
              <ScrollView style={styles.breedScroll} nestedScrollEnabled>
                {BREEDS.map((breed) => (
                  <TouchableOpacity
                    key={breed}
                    style={styles.breedOption}
                    onPress={() => {
                      setFormData({ ...formData, breed });
                      setShowBreedPicker(false);
                    }}
                  >
                    <Text style={styles.breedOptionText}>{breed}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <TextInput
            style={styles.input}
            value={formData.age_years}
            onChangeText={(text) => setFormData({ ...formData, age_years: text })}
            placeholder="Edad en años"
            keyboardType="numeric"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>Detalles Importantes</Text>
          
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.behavioral_notes}
            onChangeText={(text) => setFormData({ ...formData, behavioral_notes: text })}
            placeholder="¿Cómo se comporta? (ej. le teme a las motos, jala mucho)"
            multiline
            numberOfLines={3}
            placeholderTextColor="#9CA3AF"
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.medical_conditions}
            onChangeText={(text) => setFormData({ ...formData, medical_conditions: text })}
            placeholder="Salud y Vacunas (ej. vacunas al día, alergias)"
            multiline
            numberOfLines={3}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.warningBox}>
          <ShieldCheck size={20} color="#059669" />
          <Text style={styles.warningText}>
            Mantenemos la información de salud privada y solo la compartimos con el paseador asignado.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.fixedBottom}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit}>
          <Text style={styles.saveBtnText}>
            {pet ? 'Actualizar Mascota' : 'Guardar Mascota'}
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
    paddingBottom: 16,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '700',
  },
  petsList: {
    gap: 12,
  },
  petCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
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
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  petName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  petBreed: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  petActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B82F6',
    textTransform: 'uppercase',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    color: '#059669',
    textTransform: 'uppercase',
  },
  formSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    marginBottom: 12,
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
    borderRadius: 16,
    maxHeight: 200,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  breedScroll: {
    maxHeight: 200,
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
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
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
    textTransform: 'uppercase',
    lineHeight: 16,
  },
  fixedBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 34,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  saveBtn: {
    backgroundColor: '#10B981',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});
