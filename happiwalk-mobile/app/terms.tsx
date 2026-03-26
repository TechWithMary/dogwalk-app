import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Términos y Condiciones</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.lastUpdate}>Última actualización: Enero 2024</Text>

        <Text style={styles.sectionTitle}>1. Aceptación de Términos</Text>
        <Text style={styles.text}>
          Al acceder y utilizar HappiWalk, aceptas estos términos y condiciones. Si no estás de acuerdo, por favor no utilices la aplicación.
        </Text>

        <Text style={styles.sectionTitle}>2. Descripción del Servicio</Text>
        <Text style={styles.text}>
          HappiWalk es una plataforma que conecta a dueños de mascotas con paseadores profesionales en la ciudad de Medellín. Facilitamos la reserva de paseos pero no somos parte de la relación contractual entre el paseador y el dueño de la mascota.
        </Text>

        <Text style={styles.sectionTitle}>3. Obligaciones del Usuario</Text>
        <Text style={styles.text}>
          • Proporcionar información veraz{'\n'}
          • Mantener a tu mascota con vacunas al día{'\n'}
          • Pagar los servicios pactados{'\n'}
          • Tratar con respeto a los paseadores
        </Text>

        <Text style={styles.sectionTitle}>4. Obligaciones del Paseador</Text>
        <Text style={styles.text}>
          • Completar el proceso de verificación{'\n'}
          • Cuidar a las mascotas como si fueran propias{'\n'}
          • Respetar los horarios acordados{'\n'}
          • Mantener comunicación con los dueños
        </Text>

        <Text style={styles.sectionTitle}>5. Precios y Pagos</Text>
        <Text style={styles.text}>
          Los precios son establecidos por los paseadores. HappiWalk cobra una comisión del 15% sobre cada servicio completado. Los pagos se procesan a través de MercadoPago.
        </Text>

        <Text style={styles.sectionTitle}>6. Cancelaciones</Text>
        <Text style={styles.text}>
          • Cancelación +24h antes: Reembolso completo{'\n'}
          • Cancelación 12-24h antes: Reembolso 50%{'\n'}
          • Cancelación -12h: Sin reembolso
        </Text>

        <Text style={styles.sectionTitle}>7. Responsabilidad</Text>
        <Text style={styles.text}>
          HappiWalk actúa como intermediario. No somos responsables por daños, lesiones o pérdidas que puedan ocurrir durante los paseos. Recomendamos verificar la reputación y referencias de los paseadores.
        </Text>

        <Text style={styles.sectionTitle}>8. Privacidad</Text>
        <Text style={styles.text}>
          Tu información personal está protegida según nuestra Política de Privacidad. No compartimos tus datos con terceros sin tu consentimiento.
        </Text>

        <Text style={styles.sectionTitle}>9. Modificaciones</Text>
        <Text style={styles.text}>
          Nos reservamos el derecho de modificar estos términos en cualquier momento. El uso continuo de la app implica aceptación de los cambios.
        </Text>

        <Text style={styles.sectionTitle}>10. Contacto</Text>
        <Text style={styles.text}>
          Para preguntas sobre estos términos:{'\n'}
          📧 contacto@happiwalk.com{'\n'}
          📱 +57 300 123 4567
        </Text>

        <View style={styles.spacer} />
      </ScrollView>
    </View>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
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
    fontSize: 16,
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
  lastUpdate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    marginTop: 20,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  spacer: {
    height: 40,
  },
});
