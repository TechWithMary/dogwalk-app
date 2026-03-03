import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Dog, Plus, Loader2, ArrowLeft, Trash2, ShieldCheck, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const PetManager = ({ onBack }) => {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPet, setEditingPet] = useState(null);

  useEffect(() => {
    fetchPets();
  }, []);

  const fetchPets = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no encontrado");

      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPets(data || []);
    } catch (error) {
      toast.error("Error cargando mascotas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePet = async (petData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let error;
      if (editingPet) {
        const { error: updateError } = await supabase
          .from('pets')
          .update({
            name: petData.name,
            breed: petData.breed,
            age_years: parseInt(petData.age_years) || 0,
            behavioral_notes: petData.behavioral_notes,
            medical_conditions: petData.medical_conditions
          })
          .eq('id', editingPet.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('pets')
          .insert([{ 
            ...petData, 
            age_years: parseInt(petData.age_years) || 0,
            owner_id: user.id,
            is_active: true 
          }]);
        error = insertError;
      }

      if (error) throw error;
      
      toast.success(`¡${petData.name} se guardó correctamente!`);
      setShowForm(false);
      setEditingPet(null);
      fetchPets();
    } catch (error) {
      toast.error("Error al guardar: " + error.message);
    }
  };

  const handleDeletePet = async (petId) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta mascota?")) return;
    
    try {
      const { error } = await supabase
        .from('pets')
        .update({ is_active: false })
        .eq('id', petId);

      if (error) throw error;
      
      toast.success("Mascota eliminada con éxito");
      fetchPets();
    } catch (error) {
      toast.error("No se pudo eliminar: " + error.message);
    }
  };
  
  if (showForm) {
    return (
      <PetForm 
        pet={editingPet} 
        onSave={handleSavePet} 
        onCancel={() => { setShowForm(false); setEditingPet(null); }} 
      />
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center mb-8">
        <button onClick={onBack} className="bg-white p-2 rounded-xl shadow-sm mr-4 active:scale-90 transition-all">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-2xl font-black text-gray-900">Mis Mascotas</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500 w-8 h-8" /></div>
      ) : (
        <div className="space-y-4">
          {pets.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl border-2 border-dashed border-gray-200">
               <Dog className="w-12 h-12 text-gray-300 mx-auto mb-3" />
               <p className="text-gray-400 font-bold">No tienes mascotas registradas</p>
            </div>
          ) : (
            pets.map(pet => (
              <div key={pet.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                    <Dog className="w-7 h-7 text-emerald-600"/>
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-lg">{pet.name}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">{pet.breed || 'Criollo'} • {pet.age_years} años</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setEditingPet(pet); setShowForm(true); }} className="p-2 bg-gray-50 rounded-lg font-bold text-xs text-blue-600 uppercase active:scale-90 transition-all">Editar</button>
                  <button onClick={() => handleDeletePet(pet.id)} className="p-2 bg-red-50 rounded-lg active:scale-90 transition-all"><Trash2 className="w-4 h-4 text-red-500"/></button>
                </div>
              </div>
            ))
          )}
          
          <button onClick={() => { setEditingPet(null); setShowForm(true); }} className="w-full py-5 border-2 border-dashed border-emerald-200 rounded-3xl flex items-center justify-center gap-2 text-emerald-600 font-black text-sm uppercase bg-emerald-50/30 hover:bg-emerald-50 transition-all mt-6">
            <Plus className="w-5 h-5" /> Añadir Nueva Mascota
          </button>
        </div>
      )}
    </div>
  );
};

const PetForm = ({ pet, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        name: pet?.name || '',
        breed: pet?.breed || '',
        age_years: pet?.age_years || '',
        behavioral_notes: pet?.behavioral_notes || '',
        medical_conditions: pet?.medical_conditions || ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="p-6 bg-white min-h-screen flex flex-col">
            <div className="flex items-center mb-8">
              <button onClick={onCancel} className="bg-gray-100 p-2 rounded-xl mr-4"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
              <h1 className="text-2xl font-black text-gray-900">{pet ? 'Editar Mascota' : 'Añadir Mascota'}</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 flex-1">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block tracking-widest">Información Básica</label>
                  <div className="space-y-3">
                    <input name="name" value={formData.name} onChange={handleChange} placeholder="Nombre de tu mascota" className="w-full h-14 px-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none font-bold transition-all" required />
                    <input name="breed" value={formData.breed} onChange={handleChange} placeholder="Raza (ej. Labrador)" className="w-full h-14 px-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none font-bold transition-all" />
                    <input type="number" name="age_years" value={formData.age_years} onChange={handleChange} placeholder="Edad en años" className="w-full h-14 px-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none font-bold transition-all" required />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block tracking-widest">Detalles Importantes</label>
                  <div className="space-y-3">
                    <textarea name="behavioral_notes" value={formData.behavioral_notes} onChange={handleChange} placeholder="¿Cómo se comporta? (ej. le teme a las motos, jala mucho)" className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none font-bold h-24 transition-all" />
                    <textarea name="medical_conditions" value={formData.medical_conditions} onChange={handleChange} placeholder="Salud y Vacunas (ej. vacunas al día, alergias)" className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none font-bold h-24 transition-all" />
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-emerald-800 uppercase leading-tight">Mantenemos la información de salud privada y solo la compartimos con el paseador asignado.</p>
                </div>

                <div className="flex gap-4 pt-4 mt-auto">
                    <button type="submit" className="w-full h-16 bg-emerald-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-100 active:scale-95 transition-all">
                      {pet ? 'Actualizar Mascota' : 'Guardar Mascota'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PetManager;