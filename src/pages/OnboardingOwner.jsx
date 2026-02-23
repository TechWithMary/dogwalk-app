import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { Dog, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';

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
    if (!petData.breed) {
      toast.error('Por favor, selecciona una raza.');
      return;
    }
    if (!petData.age_years) {
      toast.error('Por favor, selecciona el rango de edad.');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no encontrado');

      // Guardar la mascota con los nuevos datos de los selectores
      const { error: petError } = await supabase.from('pets').insert([
        { 
          name: petData.name,
          breed: petData.breed,
          age_years: petData.age_years, 
          owner_id: user.id 
        }
      ]);
      
      if (petError) throw petError;
      
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingProfile) {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ is_profile_complete: true })
          .eq('user_id', user.id);
        if (updateError) throw updateError;
      } else {
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
        <div className="mx-auto bg-emerald-100 p-4 rounded-full mb-6 w-fit">
          <Dog className="w-10 h-10 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">¡Bienvenido a HappiWalk!</h1>
        <p className="text-gray-600 mb-8">
          Cuéntanos sobre tu mascota para encontrarle el mejor paseador.
        </p>

        <form onSubmit={handleCompleteProfile} className="max-w-sm mx-auto w-full space-y-5 text-left">
          {/* NOMBRE */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 mb-1 block">¿Cómo se llama?</label>
            <input
              type="text"
              name="name"
              value={petData.name}
              onChange={handleInputChange}
              className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition outline-none font-medium"
              placeholder="Nombre de tu mascota"
              required
            />
          </div>

          {/* RAZA */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 mb-1 block">¿De qué raza es?</label>
            <select
              name="breed"
              value={petData.breed}
              onChange={handleInputChange}
              className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition outline-none font-medium"
              required
            >
              <option value="">Selecciona una raza</option>
              <option value="Criollo">Criollo / Mestizo</option>
              <option value="Labrador">Labrador Retriever</option>
              <option value="Golden">Golden Retriever</option>
              <option value="Poodle">French Poodle</option>
              <option value="Pastor Alemán">Pastor Alemán</option>
              <option value="Bulldog">Bulldog Francés/Inglés</option>
              <option value="Schnauzer">Schnauzer</option>
              <option value="Beagle">Beagle</option>
              <option value="Pitbull">Pitbull</option>
              <option value="Pinscher">Pinscher</option>
              <option value="Otro">Otra raza...</option>
            </select>
          </div>

          {/* EDAD CON ADVERTENCIA */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 mb-1 block">¿Qué edad tiene?</label>
            <select
              name="age_years"
              value={petData.age_years}
              onChange={handleInputChange}
              className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition outline-none font-medium"
              required
            >
              <option value="">Selecciona el rango de edad</option>
              <option value="Cachorro">Cachorro (5 - 12 meses)</option>
              <option value="Joven">Joven (1 - 3 años)</option>
              <option value="Adulto">Adulto (3 - 7 años)</option>
              <option value="Senior">Senior (7+ años)</option>
            </select>
            
            <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-orange-700">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold leading-tight uppercase">
                Importante: Solo aceptamos mascotas de 5 meses en adelante con vacunas completas.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 flex justify-center items-center gap-2 bg-emerald-500 text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all mt-4"
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