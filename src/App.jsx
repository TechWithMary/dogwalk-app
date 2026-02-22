import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

import MobileLayout from './layouts/MobileLayout';
import Login from './pages/Login';
import Home from './pages/Home';
import HomeWalker from './pages/HomeWalker';
import Booking from './pages/Booking';
import Wallet from './pages/Wallet';
import Messages from './pages/Messages';
import LiveWalk from './pages/LiveWalk';
import OnboardingOwner from './pages/OnboardingOwner';
import OnboardingWalker from './pages/OnboardingWalker';
import { Toaster } from 'react-hot-toast';

import { agentRegistry } from './agents/AgentRegistry.js';
import FrontendAgent from './agents/frontend/FrontendAgent.js';
import BackendAgent from './agents/backend/BackendAgent.js';
import PaymentsAgent from './agents/payments/PaymentsAgent.js';
import EditProfile from './pages/EditProfile.jsx';
import Profile from './pages/Profile.jsx';
import PetManager from './pages/PetManager.jsx';
import ManageCards from './pages/ManageCards.jsx';
import Notifications from './pages/Notifications.jsx';
import WalkerBalance from './pages/WalkerBalance.jsx';
import AdminVerifications from './pages/AdminVerifications.jsx';

const APP_NAME = "DogWalk";

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [userRole, setUserRole] = useState('owner');
  const [userName, setUserName] = useState('Usuario');
  const [agentsReady, setAgentsReady] = useState(false);
  const [error, setError] = useState(null);

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

  const getLayoutProps = () => {
    const path = location.pathname;

    if (path === '/login' || path === '/') {
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
    if (path === '/admin/verifications') return { showNav: false, title: 'Verificar Paseadores', onBack: () => navigate('/profile') };

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
        <p className="mt-5 text-gray-500">Iniciando DogWalk...</p>
      </div>
    );
  }
  
  return (
    <MobileLayout
      title={layoutProps.title}
      activeTab={layoutProps.activeTab}
      onViewChange={(view) => {
         if (isWalker && view === 'home') navigate('/walker-home');
         else navigate(`/${view}`);
      }} 
      showNav={layoutProps.showNav}
      hideHeader={layoutProps.hideHeader}
      onBack={layoutProps.onBack}
      isWalker={isWalker}
    >
      <Toaster position="top-center" />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/home" element={<Home setView={navigate} currentUser={{ name: userName }} navigate={navigate} />} />
        <Route path="/walker-home" element={<HomeWalker currentUser={{ name: userName }} />} />
        <Route path="/messages" element={<Messages isWalker={isWalker} />} />
        <Route path="/booking" element={<Booking setView={navigate} />} />
        <Route path="/wallet" element={<Wallet setView={navigate} currentUser={{ name: userName }} onLogout={handleLogout} />} />
        <Route path="/live-walk" element={<LiveWalk setView={(v) => navigate(v === 'home' ? '/home' : `/${v}`)} />} />
        <Route path="/onboarding-owner" element={<OnboardingOwner />} />
        <Route path="/onboarding-walker" element={<OnboardingWalker />} />
        <Route path="/profile" element={<Profile onLogout={handleLogout} navigate={navigate} />} />
        <Route path="/edit-profile" element={<EditProfile navigate={navigate} />} />
        <Route path="/manage-pets" element={<PetManager onBack={() => navigate(-1)} />} />
        <Route path="/manage-cards" element={<ManageCards />} />
        <Route path="/notifications" element={<Notifications onBack={() => navigate(-1)} />} />
        <Route path="/walker-balance" element={<WalkerBalance onBack={() => navigate('/walker-home')} />} />
        <Route path="/admin/verifications" element={<AdminVerifications />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </MobileLayout>
  );
};

export default App;