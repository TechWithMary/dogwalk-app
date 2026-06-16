import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Dimensions, Alert, Platform, Keyboard, TouchableWithoutFeedback, ScrollView, KeyboardAvoidingView } from 'react-native';
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
  const scrollViewRef = useRef<ScrollView>(null);
  const isNavigating = useRef(false);
  const hasProcessedOAuth = useRef(false);
  const deepLinkUrl = Linking.useLinkingURL();
  const [activeUser, setActiveUser] = useState<any>(null);

  WebBrowser.maybeCompleteAuthSession();

  useEffect(() => {
    if (deepLinkUrl) {
      console.log('[DEEP LINK] Received URL:', deepLinkUrl);
      if (deepLinkUrl.startsWith('happiwalk://login')) {
        WebBrowser.dismissAuthSession();
        processOAuthUrl(deepLinkUrl);
      }
    }
  }, [deepLinkUrl]);

  useEffect(() => {
    if (activeUser && !isNavigating.current) {
      console.log('[EFFECT] Active user detected, starting navigation...');
      navigateAfterLogin(activeUser);
    }
  }, [activeUser]);

  useEffect(() => {
    let authSubscription: any;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        console.log('[INIT] Session found, setting active user...');
        setActiveUser(session.user);
      }

      authSubscription = supabase.auth.onAuthStateChange((event, session) => {
        console.log('[AUTH EVENT]', event, session ? 'user=' + session.user.id : 'no session');
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[AUTH EVENT] SIGNED_IN detected, setting active user...');
          setActiveUser(session.user);
        } else if (event === 'SIGNED_OUT') {
          setActiveUser(null);
        }
      }).data.subscription;
    };

    init();

    return () => {
      if (authSubscription) authSubscription.unsubscribe();
    };
  }, []);

  const navigateAfterLogin = async (user: any) => {
    console.log('[NAVIGATE] Starting for user:', user.id);
    if (isNavigating.current) {
      console.log('[NAVIGATE] Already navigating, skipping');
      return;
    }
    isNavigating.current = true;
    setLoading(true);

    try {
      console.log('[NAVIGATE] Querying profile...');
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role, is_profile_complete')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[NAVIGATE] Profile query error:', error.message);
      }

      let route: string;
      
      if (profile) {
        await AsyncStorage.setItem('cached_profile_role', profile.role);
        await AsyncStorage.setItem('cached_profile_complete', String(profile.is_profile_complete));
        route = profile.is_profile_complete
          ? (profile.role === 'walker' ? '/walker-home' : '/(tabs)')
          : (profile.role === 'walker' ? '/onboarding-walker' : '/onboarding-owner');
        console.log('[NAVIGATE] Existing profile, to:', route);
      } else {
        const cachedRole = await AsyncStorage.getItem('cached_profile_role');
        const cachedComplete = await AsyncStorage.getItem('cached_profile_complete') === 'true';
        const oauthRole = await AsyncStorage.getItem('oauth_role');
        const fallbackRole = oauthRole || cachedRole || 'owner';

        if (oauthRole || cachedRole) {
          console.log('[NAVIGATE] Using role from storage:', fallbackRole);
          route = cachedComplete
            ? (fallbackRole === 'walker' ? '/walker-home' : '/(tabs)')
            : (fallbackRole === 'walker' ? '/onboarding-walker' : '/onboarding-owner');
        } else {
          console.log('[NAVIGATE] No profile found, using default route');
          route = '/onboarding-owner';
        }
      }
      
      await AsyncStorage.removeItem('oauth_role');
      
      console.log('[NAVIGATE] Navigating to:', route);
      setLoading(false);
      
      setTimeout(() => {
        router.replace(route);
        isNavigating.current = false;
        console.log('[NAVIGATE] Finished');
      }, 50);
    } catch (e: any) {
      console.error('[NAVIGATE ERROR]', e.message);
      isNavigating.current = false;
      setLoading(false);
    }
  };

  const processOAuthUrl = async (urlString: string) => {
    if (hasProcessedOAuth.current) {
      console.log('[OAUTH] Already processed, skipping duplicate');
      return;
    }
    hasProcessedOAuth.current = true;

    console.log('[OAUTH] Processing URL:', urlString.substring(0, 120));
    try {
      // Safe string parsing for custom scheme URLs to avoid Hermes 'new URL' issues
      let code: string | null = null;
      let accessToken: string | null = null;
      let refreshToken: string | null = null;

      // Parse query params (e.g. ?code=...)
      const queryIndex = urlString.indexOf('?');
      if (queryIndex !== -1) {
        const queryString = urlString.substring(queryIndex + 1).split('#')[0];
        const searchParams = new URLSearchParams(queryString);
        code = searchParams.get('code');
      }

      // Parse hash params (e.g. #access_token=...)
      const hashIndex = urlString.indexOf('#');
      if (hashIndex !== -1) {
        const hashString = urlString.substring(hashIndex + 1);
        const hashParams = new URLSearchParams(hashString);
        accessToken = hashParams.get('access_token');
        refreshToken = hashParams.get('refresh_token');
      }

      console.log('[OAUTH] Parsed: code=' + (code ? 'yes' : 'no') + ', token=' + (accessToken ? 'yes' : 'no'));

      if (code) {
        console.log('[OAUTH] PKCE code found, exchanging...');
        const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          console.error('[OAUTH] Exchange error:', exchangeError);
          Alert.alert('Error', exchangeError.message);
          setLoading(false);
        } else if (exchangeData?.session?.user) {
          console.log('[OAUTH] Exchange success, navigating...');
          await navigateAfterLogin(exchangeData.session.user);
        }
      } else if (accessToken) {
        console.log('[OAUTH] Access token in hash, setting session...');
        
        let sessionUser: any = null;
        try {
          const setSessionPromise = supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('setSession timeout')), 8000);
          });
          const { data: sessionData, error: sessionError } = await Promise.race([setSessionPromise, timeoutPromise]) as any;
          
          if (sessionError) {
            console.error('[OAUTH] Set session error:', sessionError);
          } else if (sessionData?.session?.user) {
            sessionUser = sessionData.session.user;
          }
        } catch (e: any) {
          console.log('[OAUTH] setSession timed out, decoding JWT...');
        }

        if (!sessionUser) {
          try {
            const payload = JSON.parse(atob(accessToken.split('.')[1]));
            console.log('[OAUTH] JWT decoded, sub:', payload.sub);
            sessionUser = { id: payload.sub, user_metadata: payload.user_metadata || {} };
          } catch (decodeErr) {
            console.error('[OAUTH] JWT decode failed');
          }
        }

        if (sessionUser) {
          console.log('[OAUTH] Navigating with user:', sessionUser.id);
          await navigateAfterLogin(sessionUser);
        } else {
          Alert.alert('Error', 'No se pudo establecer la sesión');
          setLoading(false);
        }
      } else {
        console.log('[OAUTH] No code or token in URL');
        Alert.alert('Error', 'No se recibieron datos de autenticación');
        setLoading(false);
      }
    } catch (e: any) {
      console.error('[OAUTH] URL processing error:', e.message);
      Alert.alert('Error', e.message);
      setLoading(false);
    }
  };

  const handleOAuthLogin = async () => {
    try {
      setLoading(true);
      hasProcessedOAuth.current = false;
      await AsyncStorage.setItem('oauth_role', roleMode);

      const redirectUrl = 'happiwalk://login';
      console.log('[OAUTH] Starting with redirect:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        }
      });

      if (error) {
        console.error('[OAUTH] signInWithOAuth error:', error);
        Alert.alert('Error de Configuración', error.message || 'No se pudo iniciar sesión con Google. Verifica que el provider esté configurado en Supabase.');
        setLoading(false);
        return;
      }

      if (!data?.url) {
        console.error('[OAUTH] No URL returned from signInWithOAuth');
        Alert.alert('Error', 'No se pudo obtener la URL de autenticación de Google. Revisa la consola para más detalles.');
        setLoading(false);
        return;
      }

      console.log('[OAUTH] Opening auth session... URL:', data.url.substring(0, 100) + '...');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      console.log('[OAUTH] Result:', result.type, result.type === 'success' ? result.url?.substring(0, 100) : 'no url');

      if (result.type === 'success' && result.url) {
        await processOAuthUrl(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        console.log('[OAUTH] User cancelled or dismissed');
        if (!hasProcessedOAuth.current) {
          setLoading(false);
        }
      } else {
        console.log('[OAUTH] Not success:', result.type);
        if (!hasProcessedOAuth.current) {
          setLoading(false);
        }
      }
    } catch (e: any) {
      console.error('[OAUTH] Error:', e.message);
      Alert.alert('Error', e.message);
      if (!hasProcessedOAuth.current) {
        setLoading(false);
      }
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
          const { error: insertError } = await supabase.from('user_profiles').insert({
            user_id: authData.user.id,
            first_name: firstName,
            last_name: lastName,
            role: roleMode,
            is_profile_complete: false
          });
          if (insertError) {
            console.error('[SIGNUP] Profile insert error:', insertError);
          }
        }

        await AsyncStorage.setItem('oauth_role', roleMode);

        if (authData?.session) {
          // Email confirm OFF — navigateAfterLogin (from auth event) handles onboarding redirect
        } else {
          Alert.alert('Éxito', '¡Registro exitoso! Revisa tu correo para verificar tu cuenta.');
          setAuthMode('login');
        }
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
          <View style={[styles.headerBg, { height: height * 0.28 }]}>
            <Image
              source={require('../../assets/login-bg.png')}
              style={styles.headerImage}
              resizeMode="cover"
            />
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.formContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.logoSection}>
              <View style={styles.logoCircle}>
                <Dog size={24} color="#000000" />
              </View>
              <Text style={styles.title}>HappiWalk</Text>
            </View>

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
                    returnKeyType="next"
                    onFocus={() => scrollViewRef.current?.scrollTo({ y: 100, animated: true })}
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
                  returnKeyType="next"
                  onFocus={() => scrollViewRef.current?.scrollTo({ y: 150, animated: true })}
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
                  returnKeyType="done"
                  onFocus={() => scrollViewRef.current?.scrollTo({ y: 200, animated: true })}
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

              {authMode === 'login' && (
                <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
                  <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
                </TouchableOpacity>
              )}

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

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>O continuar con</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.socialBtn} onPress={handleOAuthLogin}>
              <View style={styles.socialBtnInner}>
                <GoogleIcon />
              </View>
            </TouchableOpacity>

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

            {authMode === 'register' && (
              <View style={[styles.terms, { marginTop: -8 }]}>
                <Text style={styles.termsText}>
                  Al registrarte aceptas nuestros{' '}
                  <Text style={styles.termsLink} onPress={() => router.push('/terms')}>Términos</Text>
                  {' '}y{' '}
                  <Text style={styles.termsLink} onPress={() => router.push('/privacy')}>Política de Privacidad</Text>
                </Text>
              </View>
            )}
            
            {authMode === 'login' && (
              <View style={styles.copyright}>
                <Text style={styles.copyrightText}>
                  © 2025 HappiWalk. Todos los derechos reservados.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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
  innerContainer: {
    flex: 1,
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    backgroundColor: '#13EC13',
    padding: 12,
    borderRadius: 16,
    transform: [{ rotate: '3deg' }],
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 1,
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
    gap: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    height: 52,
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
  forgotPasswordText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#052e05',
    textAlign: 'right',
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#13EC13',
    borderRadius: 14,
    height: 52,
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
    marginTop: 16,
    marginBottom: 12,
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
    marginBottom: 16,
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
    marginBottom: 8,
    paddingBottom: 8,
    marginTop: 12,
  },
  switchModeText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  switchModeLink: {
    color: '#052e05',
    fontWeight: '900',
  },
  terms: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
    marginTop: 8,
  },
  termsText: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
  },
  termsLink: {
    color: '#052e05',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  copyright: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
    marginTop: 16,
  },
  copyrightText: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
