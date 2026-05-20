import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { X, Check, Loader2, Clock, Trash2, PlusCircle } from './Icons';

interface AvailabilitySlot {
  id: string;
  walker_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface AvailabilityManagerProps {
  walkerId: string;
  onClose: () => void;
}

const DAYS_OF_WEEK = [
  { id: 1, name: 'Lunes' },
  { id: 2, name: 'Martes' },
  { id: 3, name: 'Miércoles' },
  { id: 4, name: 'Jueves' },
  { id: 5, name: 'Viernes' },
  { id: 6, name: 'Sábado' },
  { id: 0, name: 'Domingo' },
];

const formatTime = (time: string) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hourNum = parseInt(hours);
  const ampm = hourNum >= 12 ? 'PM' : 'AM';
  const formattedHours = hourNum % 12 || 12;
  return `${formattedHours}:${minutes} ${ampm}`;
};

export default function AvailabilityManager({ walkerId, onClose }: AvailabilityManagerProps) {
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newSlot, setNewSlot] = useState({
    day_of_week: '1',
    start_time: '08:00',
    end_time: '17:00',
  });

  const fetchAvailability = useCallback(async () => {
    setLoading(true);
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
      Alert.alert('Error', 'Error cargando horarios');
    } finally {
      setLoading(false);
    }
  }, [walkerId]);

  useEffect(() => {
    if (walkerId) {
      fetchAvailability();
    }
  }, [fetchAvailability, walkerId]);

  const handleAddSlot = async () => {
    if (!newSlot.start_time || !newSlot.end_time) {
      Alert.alert('Error', 'Selecciona hora de inicio y fin');
      return;
    }
    if (newSlot.start_time >= newSlot.end_time) {
      Alert.alert('Error', 'La hora de fin debe ser después del inicio');
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase.from('walker_availability').insert([
        {
          walker_id: walkerId,
          day_of_week: parseInt(newSlot.day_of_week),
          start_time: newSlot.start_time,
          end_time: newSlot.end_time,
        },
      ]);

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Error', 'Este horario ya existe');
          return;
        }
        throw error;
      }

      Alert.alert('Éxito', 'Horario agregado');
      await fetchAvailability();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error al agregar');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    Alert.alert(
      'Confirmar',
      '¿Borrar este horario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('walker_availability')
                .delete()
                .eq('id', slotId);
              if (error) throw error;
              await fetchAvailability();
              Alert.alert('Éxito', 'Horario eliminado');
            } catch (err) {
              Alert.alert('Error', 'No se pudo eliminar');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Tu Disponibilidad</Text>
            <Text style={styles.headerSubtitle}>Agrega tus bloques de tiempo</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Check size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>Día</Text>
          <View style={styles.dayRow}>
            {DAYS_OF_WEEK.map((day) => (
              <TouchableOpacity
                key={day.id}
                style={[
                  styles.dayBtn,
                  newSlot.day_of_week === String(day.id) && styles.dayBtnActive,
                ]}
                onPress={() =>
                  setNewSlot((p) => ({ ...p, day_of_week: String(day.id) }))
                }
              >
                <Text
                  style={[
                    styles.dayText,
                    newSlot.day_of_week === String(day.id) && styles.dayTextActive,
                  ]}
                >
                  {day.name.slice(0, 3)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.label}>Desde</Text>
              <TextInput
                style={styles.timeInput}
                value={newSlot.start_time}
                onChangeText={(t) => setNewSlot((p) => ({ ...p, start_time: t }))}
                placeholder="08:00"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.label}>Hasta</Text>
              <TextInput
                style={styles.timeInput}
                value={newSlot.end_time}
                onChangeText={(t) => setNewSlot((p) => ({ ...p, end_time: t }))}
                placeholder="17:00"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.addBtn, adding && styles.addBtnDisabled]}
            onPress={handleAddSlot}
            disabled={adding}
          >
            {adding ? (
              <Loader2 size={18} color="#FFFFFF" />
            ) : (
              <PlusCircle size={18} color="#FFFFFF" />
            )}
            <Text style={styles.addBtnText}>
              {adding ? 'Guardando...' : 'Agregar Horario'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {loading && availability.length === 0 ? (
            <View style={styles.loadingCenter}>
              <Loader2 size={32} color="#374151" />
            </View>
          ) : availability.length > 0 ? (
            availability.map((slot) => (
              <View key={slot.id} style={styles.slotCard}>
                <View style={styles.slotInfo}>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>
                      {DAYS_OF_WEEK.find((d) => d.id === slot.day_of_week)?.name.slice(0, 3)}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.slotDay}>
                      {DAYS_OF_WEEK.find((d) => d.id === slot.day_of_week)?.name}
                    </Text>
                    <View style={styles.slotTime}>
                      <Clock size={12} color="#9CA3AF" />
                      <Text style={styles.slotTimeText}>
                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteSlot(slot.id)}
                >
                  <Trash2 size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Clock size={48} color="#374151" />
              <Text style={styles.emptyTitle}>No has agregado horarios</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    backgroundColor: '#111827',
    width: '90%',
    maxHeight: '80%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: '#13ec13',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  formSection: {
    padding: 16,
    backgroundColor: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  dayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  dayBtnActive: {
    backgroundColor: '#13ec13',
    borderColor: '#052e05',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  dayTextActive: {
    color: '#000000',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timeField: {
    flex: 1,
  },
  timeInput: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 12,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  addBtn: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  list: {
    flex: 1,
    padding: 16,
  },
  loadingCenter: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  slotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#13ec13',
  },
  slotDay: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  slotTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slotTimeText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 12,
  },
});
