import { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  filterPetBreeds,
  canUseCustomBreed,
  OTHER_BREED_OPTION,
} from '../constants/pet-breeds';

interface BreedPickerProps {
  value: string;
  onChange: (breed: string) => void;
  otherBreed?: string;
  onOtherBreedChange?: (text: string) => void;
  onOpenChange?: (open: boolean) => void;
}

export default function BreedPicker({
  value,
  onChange,
  otherBreed = '',
  onOtherBreedChange,
  onOpenChange,
}: BreedPickerProps) {
  const [query, setQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      if (value === OTHER_BREED_OPTION) {
        setQuery('');
      } else {
        setQuery(value || '');
      }
    }
  }, [value, isOpen]);

  const filteredBreeds = useMemo(() => filterPetBreeds(query), [query]);
  const showCustomOption = canUseCustomBreed(query, filteredBreeds);

  const setOpen = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  const selectBreed = (breed: string) => {
    onChange(breed);
    if (breed === OTHER_BREED_OPTION) {
      setQuery('');
      setOpen(true);
    } else {
      setQuery(breed);
      setOpen(false);
    }
  };

  const openPicker = () => {
    setOpen(true);
    if (!query && value && value !== OTHER_BREED_OPTION) {
      setQuery(value);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setOpen(true);
          }}
          onFocus={openPicker}
          placeholder="Buscar o escribir raza..."
          placeholderTextColor="#9CA3AF"
          autoCorrect={false}
          autoCapitalize="words"
        />
        <TouchableOpacity
          style={[styles.toggleBtn, isOpen && styles.toggleBtnActive]}
          onPress={() => (isOpen ? setOpen(false) : openPicker())}
          accessibilityLabel="Mostrar razas"
        >
          <Text style={styles.toggleBtnText}>{isOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      </View>

      {isOpen && (
        <View style={styles.listBox}>
          <ScrollView
            style={styles.listScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {filteredBreeds.length === 0 ? (
              <Text style={styles.emptyText}>No hay coincidencias</Text>
            ) : (
              filteredBreeds.map((breed) => (
                <TouchableOpacity
                  key={breed}
                  style={[styles.option, value === breed && styles.optionSelected]}
                  onPress={() => selectBreed(breed)}
                >
                  <Text style={[styles.optionText, value === breed && styles.optionTextSelected]}>
                    {breed}
                  </Text>
                </TouchableOpacity>
              ))
            )}
            {showCustomOption && (
              <TouchableOpacity
                style={styles.customOption}
                onPress={() => selectBreed(query.trim())}
              >
                <Text style={styles.customOptionText}>Usar «{query.trim()}»</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      {value === OTHER_BREED_OPTION && onOtherBreedChange && (
        <View style={styles.otherField}>
          <Text style={styles.otherLabel}>Especifica la raza</Text>
          <TextInput
            style={styles.otherInput}
            value={otherBreed}
            onChangeText={onOtherBreedChange}
            placeholder="Escribe la raza de tu mascota"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
    zIndex: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    marginBottom: 0,
  },
  toggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#0EA5E9',
  },
  toggleBtnText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '800',
  },
  listBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    maxHeight: 200,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#0EA5E9',
    overflow: 'hidden',
    zIndex: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  listScroll: {
    maxHeight: 200,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionSelected: {
    backgroundColor: '#ECFDF5',
  },
  optionText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#052e05',
    fontWeight: '800',
  },
  customOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F0F9FF',
    borderTopWidth: 1,
    borderTopColor: '#BAE6FD',
  },
  customOptionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0369A1',
  },
  emptyText: {
    padding: 14,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  otherField: {
    marginTop: 4,
  },
  otherLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 4,
    marginLeft: 4,
  },
  otherInput: {
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
});
