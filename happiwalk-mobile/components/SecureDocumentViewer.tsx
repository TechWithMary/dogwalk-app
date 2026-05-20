import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  StatusBar,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { File, Paths, Directory } from 'expo-file-system';
import { X, Loader2, ArrowDownCircle } from './Icons';

interface SecureDocumentViewerProps {
  documentUrl: string;
  documentType: 'image' | 'pdf';
  onClose: () => void;
}

export default function SecureDocumentViewer({
  documentUrl,
  documentType,
  onClose,
}: SecureDocumentViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Pinch-to-zoom state
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else if (scale.value > 5) {
        scale.value = withSpring(5);
        savedScale.value = 5;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const composedGestures = Gesture.Simultaneous(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleImageLoad = useCallback(() => {
    setLoading(false);
  }, []);

  const handleImageError = useCallback(() => {
    setLoading(false);
    setError('No se pudo cargar la imagen');
  }, []);

  const handleDownload = useCallback(async () => {
    if (downloading) return;

    if (documentType === 'pdf') {
      try {
        await Linking.openURL(documentUrl);
      } catch {
        Alert.alert('Error', 'No se pudo abrir el documento');
      }
      return;
    }

    setDownloading(true);
    try {
      const filename = documentUrl.split('/').pop() || 'document.jpg';
      const destDir = new Directory(Paths.document);
      const downloadedFile = await File.downloadFileAsync(documentUrl, new File(destDir, filename));

      Alert.alert('Descargado', `Documento guardado en: ${downloadedFile.uri}`);
    } catch {
      Alert.alert('Error', 'No se pudo descargar el documento');
    } finally {
      setDownloading(false);
    }
  }, [documentUrl, documentType, downloading]);

  const handleOpenPdf = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(documentUrl);
      if (supported) {
        await Linking.openURL(documentUrl);
      } else {
        Alert.alert('Error', 'No hay una aplicación para abrir este documento');
      }
    } catch {
      Alert.alert('Error', 'No se pudo abrir el documento');
    }
  }, [documentUrl]);

  return (
    <View style={styles.overlay}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {documentType === 'pdf' ? 'Documento' : 'Imagen'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleDownload}
            disabled={downloading}
            activeOpacity={0.7}
          >
            {downloading ? (
              <Loader2 size={22} color="#FFFFFF" />
            ) : (
              <ArrowDownCircle size={22} color="#FFFFFF" />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose} activeOpacity={0.7}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {documentType === 'image' ? (
        <View style={styles.imageContainer}>
          {loading && (
            <View style={styles.loadingContainer}>
              <Loader2 size={40} color="#13ec13" />
              <Text style={styles.loadingText}>Cargando...</Text>
            </View>
          )}
          {error && (
            <View style={styles.loadingContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => {
                setError(null);
                setLoading(true);
              }}>
                <Text style={styles.retryBtnText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          )}
          <GestureDetector gesture={composedGestures}>
            <Animated.View style={[styles.imageWrapper, animatedImageStyle]}>
              <Image
                source={{ uri: documentUrl }}
                style={styles.image}
                resizeMode="contain"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            </Animated.View>
          </GestureDetector>
        </View>
      ) : (
        <View style={styles.pdfContainer}>
          <View style={styles.pdfCard}>
            <Text style={styles.pdfIcon}>📄</Text>
            <Text style={styles.pdfTitle}>Documento PDF</Text>
            <Text style={styles.pdfSubtitle}>
              Este documento se abrirá en tu navegador
            </Text>
            <TouchableOpacity
              style={styles.openPdfBtn}
              onPress={handleOpenPdf}
              activeOpacity={0.8}
            >
              <Text style={styles.openPdfBtnText}>Abrir Documento</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {documentType === 'image' && !loading && !error && (
        <View style={styles.footer}>
          <Text style={styles.footerHint}>
            Pellizca para zoom · Doble toque para ampliar
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#13ec13',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pdfContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pdfCard: {
    backgroundColor: '#1F2937',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
    width: '100%',
  },
  pdfIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  pdfTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  pdfSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  openPdfBtn: {
    backgroundColor: '#13ec13',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  openPdfBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footer: {
    paddingBottom: 32,
    alignItems: 'center',
  },
  footerHint: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});