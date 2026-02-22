import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, ArrowLeft, User, Phone, MapPin, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const EditProfile = ({ navigate }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState('owner');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    bio: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const role = user.user_metadata?.role || 'owner';
      setUserRole(role);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(); 

      let fName = profile?.first_name || '';
      let lName = profile?.last_name || '';

      const invalidNames = ['usuario', 'usuario nuevo', 'paseador', 'paseador nuevo'];

      if (!fName || invalidNames.includes(fName.toLowerCase())) {
         const meta = user.user_metadata || {};
         const rawName = meta.first_name || meta.name || meta.full_name || '';
         
         if (rawName) {
             const parts = rawName.trim().split(' ');
             fName = parts[0] || '';
             lName = meta.last_name || parts.slice(1).join(' ') || '';
         } else {
             fName = '';
         }
      }

      setFormData({
        first_name: fName,
        last_name: lName,
        phone: profile?.phone || '',
        address: profile?.address || '',
        bio: profile?.bio || ''
      });
      
    } catch (error) {
      console.error(error);
      toast.error("Error cargando perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingProfile) {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(formData)
          .eq('user_id', user.id);
        
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            role: userRole,
            ...formData
          });
          
        if (insertError) throw insertError;
      }

      if (userRole === 'walker') {
        const fullName = `${formData.first_name} ${formData.last_name}`.trim();
        await supabase.from('walkers').update({ name: fullName }).eq('user_id', user.id);
      }
      
      toast.success('Perfil actualizado correctamente');
      navigate('/profile');
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-emerald-500" /></div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center mb-8">
        <button onClick={() => navigate('/profile')} className="p-2 bg-white rounded-full shadow-sm mr-4">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-2xl font-black text-gray-900">Editar Perfil</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-3xl shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Nombre</label>
            <div className="flex items-center bg-gray-50 rounded-xl px-4 py-3 mt-1 border border-gray-100">
              <User className="w-4 h-4 text-gray-400 mr-2" />
              <input name="first_name" value={formData.first_name} onChange={handleChange} className="bg-transparent w-full outline-none text-sm font-medium" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Apellido</label>
            <div className="flex items-center bg-gray-50 rounded-xl px-4 py-3 mt-1 border border-gray-100">
              <User className="w-4 h-4 text-gray-400 mr-2" />
              <input name="last_name" value={formData.last_name} onChange={handleChange} className="bg-transparent w-full outline-none text-sm font-medium" />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase ml-1">Teléfono</label>
          <div className="flex items-center bg-gray-50 rounded-xl px-4 py-3 mt-1 border border-gray-100">
            <Phone className="w-4 h-4 text-gray-400 mr-2" />
            <input name="phone" value={formData.phone} onChange={handleChange} className="bg-transparent w-full outline-none text-sm font-medium" />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase ml-1">Dirección</label>
          <div className="flex items-center bg-gray-50 rounded-xl px-4 py-3 mt-1 border border-gray-100">
            <MapPin className="w-4 h-4 text-gray-400 mr-2" />
            <input name="address" value={formData.address} onChange={handleChange} className="bg-transparent w-full outline-none text-sm font-medium" />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase ml-1">Biografía corta</label>
          <textarea name="bio" value={formData.bio} onChange={handleChange} rows="3" className="w-full bg-gray-50 rounded-xl px-4 py-3 mt-1 border border-gray-100 outline-none text-sm font-medium resize-none" placeholder="Cuéntanos un poco sobre ti..." />
        </div>

        <button type="submit" disabled={saving} className="w-full h-14 bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-70">
          {saving ? <Loader2 className="animate-spin" /> : <><Save className="w-5 h-5" /> Guardar Cambios</>}
        </button>
      </form>
    </div>
  );
};

export default EditProfile;