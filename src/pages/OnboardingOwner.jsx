import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { Dog, ArrowRight, Loader2 } from 'lucide-react';

const OnboardingOwner = () => {
  const [petData, setPetData] = useState({ name: '', breed: '', age_years: '' });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPetData(prev => ({ ...prev, [name]: value }));
  };

  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    if (!petData.name.trim()) {
      toast.error('Por favor, dale un nombre a tu mascota.');
      return;
    }
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no encontrado');

      // 1. Guardar la mascota
      const { error: petError } = await supabase.from('pets').insert([
        { 
          name: petData.name,
          breed: petData.breed || null,
          age_years: petData.age_years ? parseInt(petData.age_years) : null,
          owner_id: user.id 
        }
      ]);
      
      if (petError) throw petError;
      
      // 2. Verificar si el perfil ya existe
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingProfile) {
        // Actualizar si ya existe
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ is_profile_complete: true })
          .eq('user_id', user.id);
          
        if (updateError) throw updateError;
      } else {
        // Crear nuevo perfil sin la columna de email que no existe
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            first_name: user.user_metadata?.first_name || user.user_metadata?.name?.split(' ')[0] || 'Usuario',
            last_name: user.user_metadata?.last_name || '',
            role: 'owner',
            is_profile_complete: true
          });
          
        if (insertError) throw insertError;
      }

      toast.success('¡Mascota añadida con éxito!');
      window.location.href = '/home';

    } catch (error) {
      console.error(error);
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 p-6 text-center">
      <div className="flex-1 flex flex-col justify-center">
        <div className="mx-auto bg-emerald-100 p-4 rounded-full mb-6">
          <Dog className="w-10 h-10 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">¡Bienvenido a DogWalk!</h1>
        <p className="text-gray-600 mb-8">
          Cuéntanos un poco sobre tu mascota para encontrarle el mejor paseador.
        </p>

        <form onSubmit={handleCompleteProfile} className="max-w-sm mx-auto w-full space-y-4">
          <input
            type="text"
            name="name"
            value={petData.name}
            onChange={handleInputChange}
            className="w-full h-12 px-4 text-center bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition outline-none font-medium"
            placeholder="Nombre de tu mascota"
            required
          />
          <input
            type="text"
            name="breed"
            value={petData.breed}
            onChange={handleInputChange}
            className="w-full h-12 px-4 text-center bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition outline-none font-medium"
            placeholder="Raza (ej. Labrador)"
          />
          <input
            type="number"
            name="age_years"
            value={petData.age_years}
            onChange={handleInputChange}
            className="w-full h-12 px-4 text-center bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition outline-none font-medium"
            placeholder="Edad (años)"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 flex justify-center items-center gap-2 bg-emerald-500 text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Finalizar y Continuar'}
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OnboardingOwner;