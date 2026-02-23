import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient'; 
import { useNavigate } from 'react-router-dom';
import { ChevronRight, User, Dog, Wallet, LogOut, Loader2, Shield, Camera } from 'lucide-react';
import toast from 'react-hot-toast';

const Profile = ({ onLogout, navigate: propNavigate }) => {
  const routerNavigate = useNavigate();
  const navigate = propNavigate || routerNavigate;
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuario no autenticado");

        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        const { data: walkerData } = await supabase
          .from('walkers')
          .select('name, overall_verification_status')
          .eq('user_id', user.id)
          .maybeSingle();

        const isInvalidName = (name) => {
          if (!name) return true;
          const lower = name.toLowerCase();
          return lower.includes('usuario') || lower.includes('paseador');
        };

        let finalFirstName = '';
        let finalLastName = '';
        
        const profileFirst = userProfile?.first_name || '';
        const walkerName = walkerData?.name || '';
        const metaFirst = user.user_metadata?.first_name || user.user_metadata?.name || user.user_metadata?.full_name || '';
        const metaLast = user.user_metadata?.last_name || '';

        if (!isInvalidName(walkerName)) {
            const parts = walkerName.trim().split(' ');
            finalFirstName = parts[0] || '';
            finalLastName = parts.slice(1).join(' ') || '';
        } else if (!isInvalidName(profileFirst)) {
            finalFirstName = profileFirst;
            finalLastName = userProfile?.last_name || '';
        } else {
            const parts = metaFirst.trim().split(' ');
            finalFirstName = parts[0] || '';
            finalLastName = metaLast || parts.slice(1).join(' ') || '';
        }

        const role = walkerData ? 'walker' : (userProfile?.role || user.user_metadata?.role || 'owner');

        setProfile({
            ...userProfile,
            first_name: finalFirstName,
            last_name: finalLastName,
            email: user.email,
            role: role,
            profile_photo_url: userProfile?.profile_photo_url || null,
            verification_status: walkerData?.overall_verification_status || 'pending' 
        });

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handlePhotoUpload = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ profile_photo_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, profile_photo_url: publicUrl });
      toast.success('¡Foto actualizada!');
    } catch (error) {
      toast.error('Error al subir la foto');
    } finally {
      setUploading(false);
    }
  };

  const isWalker = profile?.role === 'walker';

  const ProfileButton = ({ icon, label, onClick }) => (
    <button onClick={onClick} className="bg-white w-full flex items-center p-4 rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="mr-4 bg-gray-100 p-2 rounded-full">{icon}</div>
      <span className="font-bold flex-1 text-left">{label}</span>
      <ChevronRight className="text-gray-400" />
    </button>
  );

  if (loading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin" /></div>;
  }

  const displayName = profile?.first_name 
    ? `${profile.first_name} ${profile.last_name || ''}`.trim() 
    : 'Usuario';

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="text-center mb-8">
        <div 
          onClick={() => !uploading && fileInputRef.current.click()}
          className="relative w-24 h-24 rounded-full bg-gray-200 mx-auto mb-4 flex items-center justify-center overflow-hidden cursor-pointer group border-4 border-white shadow-md"
        >
          {uploading ? (
            <Loader2 className="animate-spin text-emerald-500" />
          ) : profile?.profile_photo_url ? (
            <img src={profile.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User className="w-12 h-12 text-gray-400" />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="text-white w-6 h-6" />
          </div>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handlePhotoUpload} 
          className="hidden" 
          accept="image/*" 
        />
        
        <h1 className="text-2xl font-bold">{displayName}</h1>
        <p className="text-gray-500 mb-2">{profile?.email}</p>

        {isWalker && profile?.verification_status === 'approved' && (
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs px-3 py-1 rounded-full font-bold border border-emerald-200">
            Paseador Verificado
          </span>
        )}
        {isWalker && profile?.verification_status === 'pending' && (
          <span className="inline-block bg-orange-100 text-orange-700 text-xs px-3 py-1 rounded-full font-bold border border-orange-200">
            En Revisión
          </span>
        )}
        {isWalker && profile?.verification_status === 'rejected' && (
          <span className="inline-block bg-red-100 text-red-700 text-xs px-3 py-1 rounded-full font-bold border border-red-200">
            Verificación Rechazada
          </span>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase px-2">Cuenta</h3>
        <ProfileButton icon={<User className="text-gray-600" />} label="Editar Información Personal" onClick={() => navigate('/edit-profile')} />
        
        {!isWalker && (
          <>
            <h3 className="text-xs font-bold text-gray-400 uppercase px-2 mt-6">Mascotas</h3>
            <ProfileButton icon={<Dog className="text-gray-600" />} label="Gestionar Mis Mascotas" onClick={() => navigate('/manage-pets')} />
          </>
        )}
        
        <h3 className="text-xs font-bold text-gray-400 uppercase px-2 mt-6">Pagos</h3>
        <ProfileButton icon={<Wallet className="text-gray-600" />} label={isWalker ? "Mis Ganancias" : "Mi Billetera"} onClick={() => navigate(isWalker ? '/walker-balance' : '/wallet')} />

        {profile?.role === 'admin' && (
          <>
            <h3 className="text-xs font-bold text-gray-400 uppercase px-2 mt-6">Administración</h3>
            <ProfileButton icon={<Shield className="text-emerald-600" />} label="Verificar Paseadores" onClick={() => navigate('/admin/verifications')} />
          </>
        )}

        <div className="pt-6">
          <button onClick={onLogout} className="w-full py-3 flex items-center justify-center gap-2 text-red-500 font-bold bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
            <LogOut className="w-5 h-5" /> Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;