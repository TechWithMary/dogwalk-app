import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { supabase, STORAGE_URL } from '../lib/supabase';
import { Camera, X, Loader2, CheckCircle } from './Icons';

type DocumentUploaderType = 'camera' | 'gallery' | 'both';

interface DocumentUploaderProps {
  type: DocumentUploaderType;
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  bucket?: string;
  folder?: string;
}

export default function DocumentUploader({
  type,
  label,
  value,
  onChange,
  bucket = 'walker_documents',
  folder = 'documents',
}: DocumentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const resolvePreview = async () => {
      if (!value) {
        setPreviewUrl(null);
        return;
      }

      if (value.startsWith('http')) {
        if (!cancelled) setPreviewUrl(value);
        return;
      }

      const publicUrl = `${STORAGE_URL}${bucket}/${value}`;
      if (!cancelled) {
        setPreviewUrl(publicUrl);
        return;
      }
    };

    resolvePreview();
    return () => { cancelled = true; };
  }, [value, bucket]);

  const pickFromCamera = useCallback(async () => {
    setError(null);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setError('Se requiere permiso de cámara');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        await uploadFile(result.assets[0].uri);
      }
    } catch {
      setError('No se pudo abrir la cámara');
    }
  }, [bucket, folder, onChange]);

  const pickFromGallery = useCallback(async () => {
    setError(null);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Se requiere permiso de galería');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        await uploadFile(result.assets[0].uri);
      }
    } catch {
      setError('No se pudo abrir la galería');
    }
  }, [bucket, folder, onChange]);

  const uploadFile = async (uri: string) => {
    setUploading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario autenticado');

      const file = new File(uri);
      const byteArray = await file.bytes();

      if (!byteArray || byteArray.length === 0) {
        throw new Error('El archivo está vacío');
      }

      if (byteArray.length > 5 * 1024 * 1024) {
        throw new Error('El archivo es demasiado grande (máx 5MB)');
      }

      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${folder}/${user.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from(bucket)
        .upload(fileName, byteArray, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      onChange(data.path);
    } catch (err: any) {
      setError(err.message || 'Error al subir el documento');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = useCallback(() => {
    onChange('');
    setPreviewUrl(null);
    setError(null);
  }, [onChange]);

  const showCamera = type === 'camera' || type === 'both';
  const showGallery = type === 'gallery' || type === 'both';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label} numberOfLines={2}>{label}</Text>
        {value ? (
          <CheckCircle size={18} color="#13ec13" />
        ) : null}
      </View>

      {loadingPreview ? (
        <View style={styles.previewArea}>
          <ActivityIndicator size="small" color="#13ec13" />
        </View>
      ) : previewUrl && value ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: previewUrl }}
            style={styles.previewImage}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={handleRemove}
            activeOpacity={0.7}
          >
            <X size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? (
        <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
      ) : null}

      {uploading ? (
        <View style={styles.uploadingContainer}>
          <Loader2 size={20} color="#13ec13" />
          <Text style={styles.uploadingText}>Subiendo...</Text>
        </View>
      ) : (
        <View style={styles.buttonsRow}>
          {showCamera && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={pickFromCamera}
              activeOpacity={0.7}
              disabled={uploading}
            >
              <Camera size={16} color="#D1D5DB" />
              <Text style={styles.actionBtnText}>Cámara</Text>
            </TouchableOpacity>
          )}
          {showGallery && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={pickFromGallery}
              activeOpacity={0.7}
              disabled={uploading}
            >
              <Text style={styles.galleryIcon}>🖼️</Text>
              <Text style={styles.actionBtnText}>Galería</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E5E7EB',
    flex: 1,
    marginRight: 8,
  },
  previewArea: {
    width: '100%',
    height: 140,
    backgroundColor: '#111827',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  previewContainer: {
    position: 'relative',
    width: '100%',
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#111827',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 8,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  uploadingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#13ec13',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D1D5DB',
  },
  galleryIcon: {
    fontSize: 14,
  },
});
