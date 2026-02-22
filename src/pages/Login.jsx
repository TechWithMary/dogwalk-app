import React, { useState, useEffect } from 'react';
import { Dog, Mail, Key, Eye, EyeOff, ChevronRight, User, Loader2, Info } from 'lucide-react';
import loginBg from '../assets/login-bg.png';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

const SocialButton = ({ icon, onClick }) => (
  <button type="button" onClick={onClick} className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-100 bg-white hover:bg-gray-50 transition-all shadow-sm active:scale-95">
    {icon}
  </button>
);

const GoogleIcon = () => (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>);

const Login = ({ onLogin }) => {
  const [authMode, setAuthMode] = useState('login');
  const [roleMode, setRoleMode] = useState('owner'); 
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        handleSuccessfulLogin(session.user);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        handleSuccessfulLogin(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSuccessfulLogin = async (user) => {
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, first_name, is_profile_complete')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) {
        const pendingRole = localStorage.getItem('oauth_role') || 'owner';
        localStorage.removeItem('oauth_role'); 

        const metaName = user.user_metadata?.full_name || user.user_metadata?.name || 'Usuario';
        const nameParts = metaName.trim().split(' ');
        const fName = nameParts[0] || 'Usuario';
        const lName = nameParts.slice(1).join(' ') || '';
        const photoUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
        
        const { data: newProfile, error } = await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            first_name: fName,
            last_name: lName,
            role: pendingRole, 
            is_profile_complete: false,
            profile_photo_url: photoUrl
          })
          .select('role, first_name, is_profile_complete')
          .maybeSingle();

        if (error || !newProfile) {
            console.warn("No se pudo guardar el perfil, usando datos temporales:", error);
            onLogin(pendingRole, fName, false);
            return;
        }

        onLogin(newProfile.role, newProfile.first_name, newProfile.is_profile_complete);
      } else {
        onLogin(profile.role, profile.first_name, profile.is_profile_complete);
      }
      
    } catch (error) {
      console.error("Fallo general entrando:", error);
      const pendingRole = localStorage.getItem('oauth_role') || 'owner';
      const fallbackName = user.user_metadata?.first_name || user.user_metadata?.full_name?.split(' ')[0] || 'Usuario';
      onLogin(pendingRole, fallbackName, false);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    setLoading(true);
    try {
      if (authMode === 'register') {
        localStorage.setItem('oauth_role', roleMode);
      } else {
        localStorage.removeItem('oauth_role'); 
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error(error);
      toast.error(`Error conectando con ${provider}`);
      setLoading(false);
    }
  };

  const handleAuth = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      if (authMode === 'register') {
        if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
        
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0] || 'Usuario';
        const lastName = nameParts.slice(1).join(' ') || '';

        const { data: authData, error } = await supabase.auth.signUp({
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

        if (error) throw error;

        if (authData?.user) {
          await supabase.from('user_profiles').upsert({
            user_id: authData.user.id,
            first_name: firstName,
            last_name: lastName,
            role: roleMode,
            is_profile_complete: false
          });
        }

        toast.success(`¡Registro exitoso! Por favor revisa tu correo para verificar tu cuenta.`);
        setAuthMode('login');
        setPassword('');
        setLoading(false);

      } else {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          if (authError.message.includes('Email not confirmed')) {
            throw new Error("Por favor verifica tu correo antes de iniciar sesión.");
          }
          throw authError;
        }
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Error de autenticación");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 font-sans overflow-hidden">
      <div className={`relative w-full bg-gray-900 shrink-0 transition-all duration-500 ${authMode === 'register' ? 'h-[25%]' : 'h-[30%]'}`}>
        <img src={loginBg} alt="Background" className="w-full h-full object-cover opacity-80" style={{ objectPosition: 'center' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50"></div>
      </div>

      <div className="flex-1 bg-white rounded-t-[30px] -mt-6 relative z-10 px-6 py-5 shadow-2xl flex flex-col">
          <div className="flex flex-col items-center mb-4 shrink-0">
            <div className="bg-[#13ec13] p-2 rounded-xl shadow-sm rotate-3 mb-2">
                <Dog className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">DogWalk</h1>
            <p className="text-gray-400 font-medium text-[10px] mt-1">
                {authMode === 'login' ? 'Tu perro, nuestra pasión.' : 'Crea tu cuenta en segundos.'}
            </p>
          </div>

          {authMode === 'register' && (
              <div className="flex p-1 bg-gray-100 rounded-xl mb-4 mx-auto max-w-xs w-full shrink-0">
                <button type="button" onClick={() => setRoleMode('owner')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${roleMode === 'owner' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500'}`}>
                  <User className="w-3 h-3" /> Soy Dueño
                </button>
                <button type="button" onClick={() => setRoleMode('walker')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${roleMode === 'walker' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500'}`}>
                  <Dog className="w-3 h-3" /> Soy Paseador
                </button>
              </div>
          )}

          <form onSubmit={handleAuth} className="space-y-3 shrink-0 overflow-y-auto max-h-[280px] px-1 pb-1">
            {authMode === 'register' && (
                <div className="relative animate-fade-in-down"><User className="absolute left-3 top-3 text-gray-400 w-4 h-4" /><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full pl-10 pr-4 h-10 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-[#13ec13] border border-gray-100 font-medium text-sm" placeholder="Tu Nombre Completo" required /></div>
             )}
            <div className="relative"><Mail className="absolute left-3 top-3 text-gray-400 w-4 h-4" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 h-10 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-[#13ec13] border border-gray-100 font-medium text-sm" placeholder="correo@ejemplo.com" required /></div>
            <div className="relative"><Key className="absolute left-3 top-3 text-gray-400 w-4 h-4" /><input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 h-10 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-[#13ec13] border border-gray-100 font-medium text-sm" placeholder="••••••••" required /><button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-gray-400">{showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
            
            <button disabled={loading} className="w-full h-11 mt-2 bg-[#13ec13] hover:bg-[#0fbd0f] text-[#052e05] font-extrabold text-sm rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin w-4 h-4" /> : (authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta')} 
              {!loading && <ChevronRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6">
             {authMode === 'register' && (
               <div className="flex items-start gap-2 bg-emerald-50/50 p-3 rounded-xl mb-4 border border-emerald-100 animate-fade-in-down">
                 <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                 <p className="text-[10px] text-emerald-800 leading-tight font-medium">
                   Asegúrate de seleccionar <b>Soy Dueño</b> o <b>Soy Paseador</b> arriba si vas a registrarte usando Google.
                 </p>
               </div>
             )}

             <div className="mb-4">
               <div className="flex items-center gap-4 mb-4">
                 <div className="h-px bg-gray-200 flex-1"></div>
                 <span className="text-[10px] font-bold text-gray-400 uppercase">o continuar con</span>
                 <div className="h-px bg-gray-200 flex-1"></div>
               </div>
               <div className="flex justify-center gap-3">
                 <SocialButton icon={<GoogleIcon />} onClick={() => handleOAuthLogin('google')} />
               </div>
             </div>
             
             <div className="text-center pb-4"><p className="text-xs font-medium text-gray-400">{authMode === 'login' ? '¿Eres nuevo?' : '¿Ya tienes cuenta?'}<button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setName(''); }} className="ml-1 text-emerald-600 font-bold hover:text-emerald-700 transition-colors">{authMode === 'login' ? 'Regístrate aquí' : 'Inicia Sesión'}</button></p></div>
          </div>
      </div>
    </div>
  );
};

export default Login;