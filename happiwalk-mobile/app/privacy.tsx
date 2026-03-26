import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Política de Privacidad</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.lastUpdate}>Última actualización: Enero 2024</Text>

        <Text style={styles.sectionTitle}>1. Información que Recopilamos</Text>
        <Text style={styles.text}>
          <Text style={styles.bold}>Información de cuenta:</Text> Nombre, email, número de teléfono{'\n'}
          <Text style={styles.bold}>Información de perfil:</Text> Foto de perfil, dirección, ubicación GPS{'\n'}
          <Text style={styles.bold}>Información de mascotas:</Text> Nombre, raza, edad, comportamiento, condiciones médicas{'\n'}
          <Text style={styles.bold}>Información de pagos:</Text> Métodos de pago guardados (procesados por MercadoPago){'\n'}
          <Text style={styles.bold}>Ubicación:</Text> GPS durante paseos en vivo
        </Text>

        <Text style={styles.sectionTitle}>2. Cómo Usamos tu Información</Text>
        <Text style={styles.text}>
          • Proporcionar y mejorar nuestros servicios{'\n'}
          • Conectar contigo y con los paseadores{'\n'}
          • Procesar pagos{'\n'}
          • Enviar notificaciones sobre reservas{'\n'}
          • Verificar identidad de paseadores{'\n'}
          • Atención al cliente
        </Text>

        <Text style={styles.sectionTitle}>3. Compartir Información</Text>
        <Text style={styles.text}>
          <Text style={styles.bold}>Con paseadores:</Text> Tu nombre, dirección (para el punto de encuentro), información de tu mascota (para su cuidado){'\n\n'}
          <Text style={styles.bold}>Con otros usuarios:</Text> Tu nombre y foto de perfil son visibles en la app{'\n\n'}
          <Text style={styles.bold}>Con proveedores de pago:</Text> MercadoPago procesa tus pagos de forma segura{'\n\n'}
          <Text style={styles.bold}>Por requerimiento legal:</Text> Cuando sea requerido por autoridades
        </Text>

        <Text style={styles.sectionTitle}>4. Seguridad de Datos</Text>
        <Text style={styles.text}>
          Utilizamos medidas de seguridad estándar de la industria:{'\n'}
          • Encriptación SSL para transmisiones{'\n'}
          • Almacenamiento encriptado en Supabase{'\n'}
          • Verificación de identidad para paseadores{'\n'}
          • Acceso limitado a información personal
        </Text>

        <Text style={styles.sectionTitle}>5. Tus Derechos</Text>
        <Text style={styles.text}>
          Tienes derecho a:{'\n'}
          • Acceder a tu información personal{'\n'}
          • Corregir datos incorrectos{'\n'}
          • Solicitar eliminación de tu cuenta{'\n'}
          • Exportar tus datos{'\n'}
          • Opt-out de notificaciones
        </Text>

        <Text style={styles.sectionTitle}>6. Retención de Datos</Text>
        <Text style={styles.text}>
          Mantenemos tu información mientras tu cuenta esté activa. Puedes solicitar eliminación en cualquier momento. Algunos datos pueden mantenerse por razones legales o de facturación.
        </Text>

        <Text style={styles.sectionTitle}>7. Datos de Mascotas</Text>
        <Text style={styles.text}>
          La información de salud y comportamiento de tus mascotas solo se comparte con el paseador asignado después de confirmar una reserva. No hacemos pública esta información.
        </Text>

        <Text style={styles.sectionTitle}>8. Menores de Edad</Text>
        <Text style={styles.text}>
          Nuestros servicios están diseñados para adultos. No recopilamos intencionalmente información de menores. Si crees que tu hijo ha proporcionado datos, contáctanos para eliminarlos.
        </Text>

        <Text style={styles.sectionTitle}>9. Cambios a esta Política</Text>
        <Text style={styles.text}>
          Podemos actualizar esta política periódicamente. Notificaremos cambios significativos a través de la app. El uso continuo implica aceptación de los cambios.
        </Text>

        <Text style={styles.sectionTitle}>10. Contacto</Text>
        <Text style={styles.text}>
          Para preguntas sobre privacidad:{'\n'}
          📧 privacidad@happiwalk.com{'\n'}
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
  bold: {
    fontWeight: '700',
    color: '#111827',
  },
  spacer: {
    height: 40,
  },
});
