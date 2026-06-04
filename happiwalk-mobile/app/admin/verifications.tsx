import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, User, Check, X, Loader2, Phone, ChevronLeft } from '../../components/Icons';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

interface Walker {
  id: string;
  name: string | null;
  user_id: string;
  overall_verification_status: string;
  id_document_front: string | null;
  id_document_back: string | null;
  selfie_with_id: string | null;
  criminal_record_cert: string | null;
  user_profiles: UserProfile | null;
}

export default function VerificationsScreen() {
  const router = useRouter();
  const [walkers, setWalkers] = useState<Walker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/(auth)/login'); return; }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile?.role !== 'admin') {
        Alert.alert('Acceso Denegado', 'No tienes permisos de administrador');
        router.replace('/(tabs)');
        return;
      }
      setIsAdmin(true);
    })();
  }, []);

  const fetchPendingWalkers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('walkers')
        .select(`
          *,
          user_profiles (
            first_name,
            last_name,
            phone
          )
        `)
        .eq('overall_verification_status', 'pending');

      if (error) throw error;
      setWalkers(data || []);
    } catch (error) {
      console.error('Error fetching walkers:', error);
      Alert.alert('Error', 'Error cargando solicitudes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPendingWalkers();
  };

  useEffect(() => {
    if (isAdmin) fetchPendingWalkers();
  }, [isAdmin]);

  if (isAdmin === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (!isAdmin) return null;

  const handleVerification = (walkerId: string, status: 'approved' | 'rejected') => {
    const action = status === 'approved' ? 'APROBAR' : 'RECHAZAR';
    Alert.alert(
      `¿${action}?`,
      `¿Estás seguro de ${action.toLowerCase()} a este paseador?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: action === 'APROBAR' ? 'Aprobar' : 'Rechazar',
          style: status === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            setProcessingId(walkerId);
            try {
              const { error } = await supabase
                .from('walkers')
                .update({ overall_verification_status: status })
                .eq('id', walkerId);

              if (error) throw error;

              Alert.alert(
                status === 'approved' ? 'Aprobado' : 'Rechazado',
                status === 'approved' ? 'Paseador aprobado exitosamente' : 'Paseador rechazado'
              );
              fetchPendingWalkers();
            } catch (error: any) {
              console.error('Error:', error);
              Alert.alert('Error', error.message || 'Error de base de datos');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const getSignedUrl = async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    try {
      const { data, error } = await supabase.storage
        .from('walker_documents')
        .createSignedUrl(path, 3600);
      if (error) throw error;
      return data?.signedUrl || null;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      return null;
    }
  };

  const getDisplayName = (walker: Walker) => {
    if (walker.user_profiles?.first_name || walker.user_profiles?.last_name) {
      return `${walker.user_profiles?.first_name || ''} ${walker.user_profiles?.last_name || ''}`.trim();
    }
    return walker.name || 'Sin Nombre';
  };

  const getInitial = (walker: Walker) => {
    const name = getDisplayName(walker);
    return name !== 'Sin Nombre' ? name[0].toUpperCase() : '?';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerIcon}>
              <ShieldCheck size={20} color="#0EA5E9" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Verificaciones</Text>
              <Text style={styles.headerSubtitle}>Validar documentos pendientes</Text>
            </View>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.content}>
          <SkeletonList count={3} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerIcon}>
            <ShieldCheck size={20} color="#0EA5E9" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Verificaciones</Text>
            <Text style={styles.headerSubtitle}>Validar documentos pendientes</Text>
          </View>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0EA5E9']} />
        }
      >
        <View style={styles.content}>
          {walkers.length === 0 ? (
            <EmptyState
              icon={<Check size={36} color="#0EA5E9" />}
              title="Todo al día"
              description="No hay solicitudes pendientes de verificación."
              variant="dark"
            />
          ) : (
            <View style={styles.walkersList}>
              {walkers.map((walker) => (
                <View key={walker.id} style={styles.walkerCard}>
                  <View style={styles.walkerHeader}>
                    <View style={styles.walkerInfo}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getInitial(walker)}</Text>
                      </View>
                      <View style={styles.walkerDetails}>
                        <Text style={styles.walkerName}>{getDisplayName(walker)}</Text>
                        <View style={styles.phoneRow}>
                          <Phone size={12} color="#9CA3AF" />
                          <Text style={styles.walkerPhone}>
                            {walker.user_profiles?.phone || 'Sin teléfono'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>PENDIENTE</Text>
                    </View>
                  </View>

                  <View style={styles.documentsSection}>
                    <Text style={styles.documentsLabel}>DOCUMENTOS ADJUNTOS</Text>
                    <View style={styles.documentsGrid}>
                      <DocumentPreview label="Cédula (Frente)" path={walker.id_document_front} getSignedUrl={getSignedUrl} />
                      <DocumentPreview label="Cédula (Reverso)" path={walker.id_document_back} getSignedUrl={getSignedUrl} />
                      <DocumentPreview label="Selfie" path={walker.selfie_with_id} getSignedUrl={getSignedUrl} />
                      <DocumentPreview label="Antecedentes" path={walker.criminal_record_cert} getSignedUrl={getSignedUrl} />
                    </View>
                  </View>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.rejectBtn, processingId === walker.id && styles.actionBtnDisabled]}
                      onPress={() => handleVerification(walker.id, 'rejected')}
                      disabled={processingId === walker.id}
                    >
                      {processingId === walker.id ? (
                        <Loader2 size={18} color="#EF4444" />
                      ) : (
                        <>
                          <X size={18} color="#EF4444" />
                          <Text style={styles.rejectBtnText}>Rechazar</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveBtn, processingId === walker.id && styles.actionBtnDisabled]}
                      onPress={() => handleVerification(walker.id, 'approved')}
                      disabled={processingId === walker.id}
                    >
                      {processingId === walker.id ? (
                        <Loader2 size={18} color="#FFFFFF" />
                      ) : (
                        <>
                          <Check size={18} color="#FFFFFF" />
                          <Text style={styles.approveBtnText}>Aprobar</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function DocumentPreview({ label, path, getSignedUrl }: { label: string; path: string | null; getSignedUrl: (path: string) => Promise<string | null> }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);

  useEffect(() => {
    const loadUrl = async () => {
      if (!path) {
        setLoadingDoc(false);
        return;
      }
      try {
        const url = await getSignedUrl(path);
        setSignedUrl(url);
      } catch (error) {
        console.error('Error loading document:', error);
      } finally {
        setLoadingDoc(false);
      }
    };
    loadUrl();
  }, [path]);

  const isPdf = path?.toLowerCase().includes('.pdf');

  if (loadingDoc) {
    return (
      <View style={styles.docPreview}>
        <Loader2 size={16} color="#0EA5E9" />
        <Text style={styles.docLoadingText}>Cargando...</Text>
      </View>
    );
  }

  if (!signedUrl) {
    return (
      <View style={styles.docPreview}>
        <X size={20} color="#4B5563" />
        <Text style={styles.docMissingText}>No subido</Text>
        <Text style={styles.docLabel}>{label}</Text>
      </View>
    );
  }

  if (isPdf) {
    return (
      <View style={styles.docPreview}>
        <Text style={styles.docPdfIcon}>PDF</Text>
        <Text style={styles.docPdfLabel}>Abrir PDF</Text>
        <Text style={styles.docLabel}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={styles.docPreview}>
      <Image source={{ uri: signedUrl }} style={styles.docImage} resizeMode="cover" />
      <View style={styles.docLabelOverlay}>
        <Text style={styles.docLabelOverlayText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#1F2937',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  headerRight: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  walkersList: {
    gap: 20,
  },
  walkerCard: {
    backgroundColor: '#1F2937',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#374151',
    overflow: 'hidden',
  },
  walkerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  walkerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  walkerDetails: {
    flex: 1,
  },
  walkerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walkerPhone: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  pendingBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#F97316',
    letterSpacing: 1,
  },
  documentsSection: {
    padding: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
  },
  documentsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 2,
    marginBottom: 12,
  },
  documentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  docPreview: {
    width: '47%',
    aspectRatio: 1.3,
    borderRadius: 12,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  docImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  docLabelOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  docLabelOverlayText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  docLoadingText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0EA5E9',
    marginTop: 4,
  },
  docMissingText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
  },
  docLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 4,
    position: 'absolute',
    bottom: 6,
  },
  docPdfIcon: {
    fontSize: 16,
    fontWeight: '900',
    color: '#EF4444',
    marginBottom: 2,
  },
  docPdfLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  actionsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#0EA5E9',
  },
  approveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
});