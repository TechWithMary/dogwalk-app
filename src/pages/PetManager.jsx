import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { agentRegistry } from '../agents/AgentRegistry';
import { Dog, Plus, Loader2, ArrowLeft, Trash2 } from 'lucide-react';
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
      const user = agentRegistry.get('BackendAgent').getUser();
      if (!user) throw new Error("Usuario no encontrado");

      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('owner_id', user.id);
      
      if (error) throw error;
      setPets(data);
    } catch (error) {
      toast.error("Error cargando mascotas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePet = async (petData) => {
    try {
      const user = agentRegistry.get('BackendAgent').getUser();
      let error;
      if (editingPet) {
        // Update
        ({ error } = await supabase.from('pets').update(petData).eq('id', editingPet.id));
      } else {
        // Insert
        ({ error } = await supabase.from('pets').insert({ ...petData, owner_id: user.id }));
      }
      if (error) throw error;
      toast.success(`Mascota ${editingPet ? 'actualizada' : 'guardada'} con éxito!`);
      setShowForm(false);
      setEditingPet(null);
      fetchPets();
    } catch (error) {
      toast.error("Error guardando mascota: " + error.message);
    }
  };

  const handleDeletePet = async (petId) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta mascota?")) return;
    try {
      const { error } = await supabase.from('pets').delete().eq('id', petId);
      if (error) throw error;
      toast.success("Mascota eliminada.");
      fetchPets();
    } catch (error) {
      toast.error("Error eliminando mascota: " + error.message);
    }
  };
  
  if (showForm) {
    return <PetForm pet={editingPet} onSave={handleSavePet} onCancel={() => { setShowForm(false); setEditingPet(null); }} />;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="p-2 -ml-2 mr-2"><ArrowLeft /></button>
        <h1 className="text-2xl font-bold">Mis Mascotas</h1>
      </div>

      {loading ? <Loader2 className="animate-spin" /> : (
        <div className="space-y-4">
          {pets.map(pet => (
            <div key={pet.id} className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center"><Dog className="w-6 h-6 text-gray-400"/></div>
                <div>
                  <p className="font-bold">{pet.name}</p>
                  <p className="text-sm text-gray-500">{pet.breed || 'Raza no especificada'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingPet(pet); setShowForm(true); }} className="text-xs font-bold text-blue-500">Editar</button>
                <button onClick={() => handleDeletePet(pet.id)}><Trash2 className="w-4 h-4 text-red-400"/></button>
              </div>
            </div>
          ))}
          <button onClick={() => { setEditingPet(null); setShowForm(true); }} className="w-full py-4 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 text-gray-500 hover:bg-gray-100">
            <Plus /> Añadir Mascota
          </button>
        </div>
      )}
    </div>
  );
};

// Componente del formulario para añadir/editar mascota
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
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">{pet ? 'Editar Mascota' : 'Añadir Mascota'}</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input name="name" value={formData.name} onChange={handleChange} placeholder="Nombre" className="w-full p-3 border rounded-xl" required />
                <input name="breed" value={formData.breed} onChange={handleChange} placeholder="Raza" className="w-full p-3 border rounded-xl" />
                <input type="number" name="age_years" value={formData.age_years} onChange={handleChange} placeholder="Edad (años)" className="w-full p-3 border rounded-xl" />
                <textarea name="behavioral_notes" value={formData.behavioral_notes} onChange={handleChange} placeholder="Notas de comportamiento (ej. le teme a las motos)" className="w-full p-3 border rounded-xl h-24"></textarea>
                <textarea name="medical_conditions" value={formData.medical_conditions} onChange={handleChange} placeholder="Condiciones médicas y vacunas" className="w-full p-3 border rounded-xl h-24"></textarea>
                <div className="flex gap-4">
                    <button type="button" onClick={onCancel} className="w-full py-3 bg-gray-200 rounded-xl font-bold">Cancelar</button>
                    <button type="submit" className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold">Guardar</button>
                </div>
            </form>
        </div>
    );
};


export default PetManager;
