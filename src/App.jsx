import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { useJsApiLoader } from '@react-google-maps/api';

import MobileLayout from './layouts/MobileLayout';
import { Toaster } from 'react-hot-toast';

import { agentRegistry } from './agents/AgentRegistry.js';
import FrontendAgent from './agents/frontend/FrontendAgent.js';
import BackendAgent from './agents/backend/BackendAgent.js';
import PaymentsAgent from './agents/payments/PaymentsAgent.js';

// Code-splitting para mejor rendimiento
const Login = lazy(() => import('./pages/Login'));
const Home = lazy(() => import('./pages/Home'));
const HomeWalker = lazy(() => import('./pages/HomeWalker'));
const Booking = lazy(() => import('./pages/Booking'));
const Wallet = lazy(() => import('./pages/Wallet'));
const Messages = lazy(() => import('./pages/Messages'));
const LiveWalk = lazy(() => import('./pages/LiveWalk'));
const OnboardingOwner = lazy(() => import('./pages/OnboardingOwner'));
const OnboardingWalker = lazy(() => import('./pages/OnboardingWalker'));
const EditProfile = lazy(() => import('./pages/EditProfile.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const PetManager = lazy(() => import('./pages/PetManager.jsx'));
const ManageCards = lazy(() => import('./pages/ManageCards.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const WalkerBalance = lazy(() => import('./pages/WalkerBalance.jsx'));
const AdminVerifications = lazy(() => import('./pages/AdminVerifications.jsx'));
const AdminPayouts = lazy(() => import('./pages/AdminPayouts.jsx'));
const Terms = lazy(() => import('./pages/Terms.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const BookingDetails = lazy(() => import('./pages/BookingDetails.jsx'));

const APP_NAME = "HappiWalk";

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen bg-white">
    <div className="w-12 h-12 border-4 border-gray-100 border-t-emerald-500 rounded-full animate-spin"></div>
  </div>
);

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
    language: 'es',
    region: 'CO'
  });

  const [userRole, setUserRole] = useState('owner');
  const [userName, setUserName] = useState('Usuario');
  const [agentsReady, setAgentsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: walkerData } = await supabase
          .from('walkers')
          .select('name')
          .eq('user_id', user.id)
          .single();
        
        if (walkerData) {
          setUserRole('walker');
          setUserName(walkerData.name || 'Paseador');
        } else {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role, first_name, last_name')
            .eq('user_id', user.id)
            .single();
          
          setUserRole(profile?.role || 'owner');
          setUserName(profile?.first_name || 'Usuario');
        }
      }
    };
    checkUser();
  }, []);

  useEffect(() => {
    const initializeBasicAgents = async () => {
      try {
        agentRegistry.register('FrontendAgent', new FrontendAgent());
        agentRegistry.register('BackendAgent', new BackendAgent());
        agentRegistry.register('PaymentsAgent', new PaymentsAgent());

        await agentRegistry.initializeAll();
        
        const backendAgent = agentRegistry.get('BackendAgent');
        const paymentsAgent = agentRegistry.get('PaymentsAgent');
        if (backendAgent && paymentsAgent) {
            paymentsAgent.setSupabaseClient(backendAgent.supabase);
        }
        
        setAgentsReady(true);

      } catch (error) {
        console.error(error);
        setError(error.message);
        setAgentsReady(true);
      }
    };

    initializeBasicAgents();
  }, []);
  
  const handleLogin = (role, name, isProfileComplete = false) => {
    setUserRole(role);
    setUserName(name || 'Usuario');
    
    if (role === 'admin') {
      navigate('/admin/verifications');
      return;
    }

    if (!isProfileComplete) {
      if (role === 'walker') {
        navigate('/onboarding-walker');
      } else {
        navigate('/onboarding-owner');
      }
    } else {
      if (role === 'walker') {
        navigate('/walker-home');
      } else {
        navigate('/home');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error(err);
    }
    localStorage.clear();
    sessionStorage.clear();
    setUserRole('owner');
    setUserName('Usuario');
    navigate('/login');
  };

  const isWalker = userRole === 'walker';
  const isAdmin = userRole === 'admin';

  const getLayoutProps = () => {
    const path = location.pathname;

    if (path === '/login' || path === '/' || path === '/terminos' || path === '/privacidad') {
      return { showNav: false, hideHeader: true, title: '' };
    }
    if (path === '/onboarding-owner' || path === '/onboarding-walker') {
      return { showNav: false, hideHeader: true, title: '' };
    }
    if (path === '/live-walk') return { showNav: false, hideHeader: true, title: '' };
    if (path === '/walker-home') return { showNav: true, title: 'Panel Paseador', activeTab: 'home' };
    if (path === '/messages') return { showNav: true, title: 'Mensajes', activeTab: 'messages' };
    if (path === '/booking') return { showNav: false, title: 'Reservar Paseo', onBack: () => navigate('/home') };
    if (path === '/wallet') return { showNav: true, title: 'Billetera', onBack: () => navigate('/profile') };
    if (path === '/profile') return { showNav: true, title: 'Mi Perfil', activeTab: 'profile' };
    if (path.startsWith('/admin')) return { showNav: true, title: 'Administración', activeTab: 'profile', onBack: () => navigate('/profile') };

     return { showNav: true, title: APP_NAME, activeTab: 'home' };
  };

  const layoutProps = getLayoutProps();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white p-5 text-center">
        <h3 className="text-red-500 mb-5">⚠️ Error en el sistema</h3>
        <p className="mb-5">{error}</p>
        <button onClick={() => setError(null)} className="px-5 py-2 bg-emerald-500 text-white rounded-lg">Continuar sin agentes</button>
      </div>
    );
  }
  
  if (!agentsReady) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <div className="w-12 h-12 border-4 border-gray-100 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="mt-5 text-gray-500">Iniciando HappiWalk...</p>
      </div>
    );
  }
  
  return (
    <MobileLayout
      title={layoutProps.title}
      activeTab={layoutProps.activeTab}
      onViewChange={(view) => {
         if (isAdmin) navigate('/admin/verifications');
         else if (isWalker && view === 'home') navigate('/walker-home');
         else navigate(`/${view}`);
      }} 
      showNav={layoutProps.showNav}
      hideHeader={layoutProps.hideHeader}
      onBack={layoutProps.onBack}
      isWalker={isWalker}
    >
      <Toaster position="top-center" />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Rutas públicas - sin layout */}
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/terminos" element={<Terms />} />
          <Route path="/privacidad" element={<Privacy />} />
          
          {/* Rutas con layout */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Rutas de Dueño */}
          <Route path="/home" element={isWalker ? <Navigate to="/walker-home" replace /> : isAdmin ? <Navigate to="/admin/verifications" /> : <Home setView={navigate} currentUser={{ name: userName }} navigate={navigate} />} />
          <Route path="/booking" element={<Booking setView={navigate} />} />
          <Route path="/manage-pets" element={<PetManager onBack={() => navigate(-1)} />} />
          
          {/* Rutas de Paseador */}
          <Route path="/walker-home" element={<HomeWalker currentUser={{ name: userName }} />} />
          <Route path="/walker-balance" element={<WalkerBalance onBack={() => navigate('/walker-home')} />} />
          
          {/* Rutas Comunes */}
          <Route path="/messages" element={<Messages isWalker={isWalker} />} />
          <Route path="/wallet" element={<Wallet setView={navigate} currentUser={{ name: userName }} onLogout={handleLogout} />} />
          <Route path="/live-walk" element={<LiveWalk setView={(v) => navigate(v === 'home' ? '/home' : `/${v}`)} />} />
          <Route path="/onboarding-owner" element={<OnboardingOwner />} />
          <Route path="/onboarding-walker" element={<OnboardingWalker />} />
          <Route path="/profile" element={<Profile onLogout={handleLogout} navigate={navigate} />} />
          <Route path="/edit-profile" element={<EditProfile navigate={navigate} />} />
          <Route path="/manage-cards" element={<ManageCards />} />
          <Route path="/notifications" element={<Notifications onBack={() => navigate(-1)} />} />
          <Route path="/booking-details" element={<BookingDetails />} />
          
          {/* Rutas Admin */}
          <Route path="/admin/verifications" element={<AdminVerifications />} />
          <Route path="/admin/payouts" element={<AdminPayouts />} />
          
          <Route path="*" element={<Navigate to={isAdmin ? "/admin/verifications" : "/home"} replace />} />
        </Routes>
      </Suspense>
    </MobileLayout>
  );
};

export default App;