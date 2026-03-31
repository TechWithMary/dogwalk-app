import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Dimensions, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Dog, Mail, Key, Eye, EyeOff, Loader2, User } from '../../components/Icons';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState('login');
  const [roleMode, setRoleMode] = useState('owner');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let authSubscription: any;
    let linkSubscription: any;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await handleSuccessfulLogin(session.user);
        return;
      }

      authSubscription = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await handleSuccessfulLogin(session.user);
        }
      }).data.subscription;

      const handleDeepLink = async (event: { url: string }) => {
        const url = event.url;
        if (url && (url.includes('access_token') || url.includes('#'))) {
          const urlObj = new URL(url);
          
          const hashParams = new URLSearchParams(urlObj.hash.substring(1));
          const searchParams = new URLSearchParams(urlObj.search);
          
          const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
          
          if (accessToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await handleSuccessfulLogin(user);
            }
          }
        }
      };

      linkSubscription = Linking.addEventListener('url', handleDeepLink);
    };

    init();

    return () => {
      if (authSubscription) authSubscription.unsubscribe();
      if (linkSubscription) linkSubscription.remove();
    };
  }, []);

  const handleSuccessfulLogin = async (user: any) => {
    setLoading(true);
    try {
      let { data: profile } = await supabase
        .from('user_profiles')
        .select('role, first_name, is_profile_complete')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) {
        const pendingRole = await AsyncStorage.getItem('oauth_role') || user.user_metadata?.role || 'owner';
        await AsyncStorage.removeItem('oauth_role');
        
        const metaName = user.user_metadata?.full_name || user.user_metadata?.name || 'Usuario';
        const nameParts = metaName.trim().split(' ');
        const fName = nameParts[0] || 'Usuario';
        const lName = nameParts.slice(1).join(' ') || '';
        
        await supabase.from('user_profiles').insert({
          user_id: user.id,
          first_name: fName,
          last_name: lName,
          role: pendingRole,
          is_profile_complete: false,
          profile_photo_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null
        });
        
        router.replace(pendingRole === 'walker' ? '/onboarding-walker' : '/onboarding-owner');
      } else {
        if (!profile.is_profile_complete) {
          router.replace(profile.role === 'walker' ? '/onboarding-walker' : '/onboarding-owner');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (error) {
      console.error(error);
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async () => {
    try {
      setLoading(true);
      await AsyncStorage.setItem('oauth_role', roleMode);
      
      const redirectUrl = Linking.createURL('login');
      console.log('Agregá esta URL en Supabase:', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        }
      });
      
      if (error) throw error;
      
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        
        if (result.type === 'success') {
          await WebBrowser.dismissBrowser();
          
          const url = result.url;
          const hashPart = url.split('#')[1];
          const searchPart = url.split('?')[1];
          const params = new URLSearchParams(hashPart || searchPart);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          
          if (accessToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
          }
        }
      }
    } catch (e: any) {
      console.error('OAuth Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);

    try {
      if (authMode === 'register') {
        if (!name) {
          Alert.alert('Error', 'Por favor ingresa tu nombre');
          setLoading(false);
          return;
        }

        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0] || 'Usuario';
        const lastName = nameParts.slice(1).join(' ') || '';

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              role: roleMode,
              is_profile_complete: false
            }
          }
        });

        if (signUpError) throw signUpError;

        if (authData?.user) {
          await supabase.from('user_profiles').insert({
            user_id: authData.user.id,
            first_name: firstName,
            last_name: lastName,
            role: roleMode,
            is_profile_complete: false
          });
        }

        Alert.alert('Éxito', '¡Registro exitoso! Revisa tu correo para verificar tu cuenta.');
        setAuthMode('login');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Background */}
      <View style={[styles.headerBg, authMode === 'register' ? { height: height * 0.18 } : { height: height * 0.25 }]}>
        <Image 
          source={require('../../assets/login-bg.png')}
          style={styles.headerImage}
          resizeMode="cover"
        />
      </View>

      {/* Form Container */}
      <View style={styles.formContainer}>
        
        {/* Logo Section - EXACTO */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Dog size={24} color="#000000" />
          </View>
          <Text style={styles.title}>HappiWalk</Text>
        </View>

        {/* Role Selector - SOLO EN REGISTRO */}
        {authMode === 'register' && (
          <View style={styles.roleSelector}>
            <TouchableOpacity 
              style={[styles.roleBtn, roleMode === 'owner' && styles.roleBtnActive]}
              onPress={() => setRoleMode('owner')}
            >
              <Text style={[styles.roleBtnText, roleMode === 'owner' && styles.roleBtnTextActive]}>
                SOY DUEÑO
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.roleBtn, roleMode === 'walker' && styles.roleBtnActive]}
              onPress={() => setRoleMode('walker')}
            >
              <Text style={[styles.roleBtnText, roleMode === 'walker' && styles.roleBtnTextActive]}>
                SOY PASEADOR
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Form - EXACTO: space-y-3 */}
        <View style={styles.form}>
          {authMode === 'register' && (
            <View style={styles.inputWrapper}>
              <View style={styles.inputIconContainer}>
                <User size={16} color="#9CA3AF" />
              </View>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nombre Completo"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          )}

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
            />
          </View>

          <View style={styles.inputWrapper}>
            <View style={styles.inputIconContainer}>
              <Key size={16} color="#9CA3AF" />
            </View>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Contraseña"
              secureTextEntry={!showPass}
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity 
              style={styles.eyeBtn}
              onPress={() => setShowPass(!showPass)}
            >
              {showPass ? (
                <EyeOff size={16} color="#9CA3AF" />
              ) : (
                <Eye size={16} color="#9CA3AF" />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={16} color="#000000" />
            ) : (
              <Text style={styles.submitBtnText}>
                {authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider - EXACTO: mt-6 gap-4 mb-4 */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>O continuar con</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Button - GOOGLE SVG */}
        <TouchableOpacity style={styles.socialBtn} onPress={handleOAuthLogin}>
          <View style={styles.socialBtnInner}>
            <GoogleIcon />
          </View>
        </TouchableOpacity>

        {/* Switch Mode - EXACTO: text-xs font-medium text-gray-400 + ml-2 text-emerald-600 font-black underline underline-offset-4 */}
        <View style={styles.switchMode}>
          <Text style={styles.switchModeText}>
            {authMode === 'login' ? '¿Eres nuevo en HappiWalk? ' : '¿Ya eres parte de la familia? '}
            <Text 
              style={styles.switchModeLink}
              onPress={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setName('');
              }}
            >
              {authMode === 'login' ? 'Regístrate aquí' : 'Inicia Sesión'}
            </Text>
          </Text>
        </View>

        {/* Terms - EXACTO: pt-3 border-t border-gray-100 mt-2 */}
        <View style={styles.terms}>
          <Text style={styles.termsText}>
            Al registrarte aceptas nuestros{' '}
            <Text style={styles.termsLink} onPress={() => router.push('/terms')}>Términos</Text>
            {' '}y{' '}
            <Text style={styles.termsLink} onPress={() => router.push('/privacy')}>Política de Privacidad</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

function GoogleIcon() {
  return (
    <View style={googleStyles.container}>
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </Svg>
    </View>
  );
}

const googleStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerBg: {
    width: '100%',
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
  roleSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  roleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  roleBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  roleBtnTextActive: {
    color: '#065F46',
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
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 14,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  socialBtn: {
    alignItems: 'center',
    marginBottom: 24,
  },
  socialBtnInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  switchMode: {
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
  },
  switchModeText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  switchModeLink: {
    color: '#059669',
    fontWeight: '900',
  },
  terms: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
    marginTop: 8,
  },
  termsText: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
  },
  termsLink: {
    color: '#059669',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
