import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Dimensions, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Dog, Mail, ArrowLeft, Loader2 } from '../../components/Icons';

const { width, height } = Dimensions.get('window');

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu correo electrónico');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'happiwalk://login',
      });

      if (error) throw error;

      setSent(true);
      Alert.alert(
        'Correo enviado',
        'Te hemos enviado un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.'
      );
    } catch (error: any) {
      if (error.message?.includes('rate limit') || error.message?.includes('too many')) {
        Alert.alert('Error', 'Demasiados intentos. Espera un momento antes de intentar de nuevo.');
      } else {
        Alert.alert('Error', error.message || 'No se pudo enviar el correo. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.headerBg}>
            <Image
              source={require('../../assets/login-bg.png')}
              style={styles.headerImage}
              resizeMode="cover"
            />
          </View>

          <View style={styles.formContainer}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <ArrowLeft size={20} color="#111827" />
              <Text style={styles.backBtnText}>Volver</Text>
            </TouchableOpacity>

            <View style={styles.logoSection}>
              <View style={styles.logoCircle}>
                <Dog size={24} color="#000000" />
              </View>
              <Text style={styles.title}>HappiWalk</Text>
            </View>

            <Text style={styles.subtitle}>
              {sent
                ? 'Revisa tu correo electrónico'
                : '¿Olvidaste tu contraseña?'}
            </Text>
            <Text style={styles.description}>
              {sent
                ? `Enviamos un enlace a ${email} para que puedas restablecer tu contraseña.`
                : 'Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.'}
            </Text>

            {!sent && (
              <View style={styles.form}>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconContainer}>
                    <Mail size={16} color="#9CA3AF" />
                  </View>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="correo@ejemplo.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholderTextColor="#9CA3AF"
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 size={16} color="#000000" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      Enviar enlace
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {sent && (
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={() => setSent(false)}
              >
                <Text style={styles.submitBtnText}>
                  Enviar de nuevo
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.loginLink}>
              <Text style={styles.loginLinkText}>
                ¿Ya recuerdas tu contraseña?{' '}
                <Text
                  style={styles.loginLinkHighlight}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  Inicia sesión
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerBg: {
    width: '100%',
    height: height * 0.2,
    backgroundColor: '#111827',
    overflow: 'hidden',
  },
  headerImage: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoCircle: {
    backgroundColor: '#13EC13',
    padding: 8,
    borderRadius: 12,
    transform: [{ rotate: '3deg' }],
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
    lineHeight: 20,
    marginBottom: 24,
  },
  form: {
    gap: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    height: 44,
    position: 'relative',
  },
  inputIconContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    paddingLeft: 40,
    paddingRight: 16,
  },
  submitBtn: {
    backgroundColor: '#13EC13',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: 12,
  },
  loginLinkText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  loginLinkHighlight: {
    color: '#052e05',
    fontWeight: '900',
  },
});