import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { PlusCircle, Trash2, Clock, Loader2, AlertTriangle, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';


const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${minutes} ${ampm}`;
};

const AvailabilityManager = ({ walkerId, onClose }) => {
    const [availability, setAvailability] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    
    
    const [newSlot, setNewSlot] = useState({ 
        day_of_week: '1', 
        start_time: '08:00', 
        end_time: '17:00' 
    });

    const daysOfWeek = [
        { id: 1, name: 'Lunes' },
        { id: 2, name: 'Martes' },
        { id: 3, name: 'Miércoles' },
        { id: 4, name: 'Jueves' },
        { id: 5, name: 'Viernes' },
        { id: 6, name: 'Sábado' },
        { id: 0, name: 'Domingo' },
    ];

    const fetchAvailability = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('walker_availability')
                .select('*')
                .eq('walker_id', walkerId)
                .order('day_of_week', { ascending: true })
                .order('start_time', { ascending: true });

            if (error) throw error;
            setAvailability(data);
        } catch (err) {
            console.error(err);
            toast.error('Error cargando horarios');
        } finally {
            setLoading(false);
        }
    }, [walkerId]);

    useEffect(() => {
        if (walkerId) {
            fetchAvailability();
        }
    }, [fetchAvailability, walkerId]);

    const handleAddSlot = async (e) => {
        e.preventDefault(); // Evita recargas
        
        if (!newSlot.start_time || !newSlot.end_time) {
            toast.error("Selecciona hora de inicio y fin");
            return;
        }
        if (newSlot.start_time >= newSlot.end_time) {
            toast.error("La hora de fin debe ser después del inicio");
            return;
        }

        setAdding(true);
        try {
            const { error } = await supabase.from('walker_availability').insert([
                {
                    walker_id: walkerId,
                    day_of_week: parseInt(newSlot.day_of_week),
                    start_time: newSlot.start_time,
                    end_time: newSlot.end_time,
                },
            ]);

            if (error) {
                if (error.code === '23505') throw new Error('Este horario ya existe.');
                throw error;
            }

            toast.success("Horario agregado");
            await fetchAvailability(); 
        } catch (err) {
            toast.error(err.message || 'Error al agregar');
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteSlot = async (slotId) => {
        if(!confirm("¿Borrar este horario?")) return;
        
        try {
            const { error } = await supabase.from('walker_availability').delete().eq('id', slotId);
            if (error) throw error;
            await fetchAvailability();
            toast.success("Horario eliminado");
        } catch (err) {
            toast.error('Error al eliminar');
        }
    };

    return (
        
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[9999] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                
                
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-lg font-black text-gray-900">Tu Disponibilidad</h2>
                        <p className="text-xs text-gray-500">Agrega tus bloques de tiempo</p>
                    </div>
                    
                    <button 
                        onClick={onClose} 
                        className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 active:scale-95 transition-all shadow-lg shadow-emerald-200"
                    >
                        <Check className="w-4 h-4" /> Listo
                    </button>
                </div>

                
                <div className="p-4 bg-white border-b shrink-0">
                    <form onSubmit={handleAddSlot} className="space-y-3">
                        <div className="grid grid-cols-12 gap-2">
                           
                            <div className="col-span-12 sm:col-span-4">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Día</label>
                                <select
                                    value={newSlot.day_of_week}
                                    onChange={(e) => setNewSlot({ ...newSlot, day_of_week: e.target.value })}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    {daysOfWeek.map(day => (
                                        <option key={day.id} value={day.id}>{day.name}</option>
                                    ))}
                                </select>
                            </div>

                            
                            <div className="col-span-6 sm:col-span-4">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Desde</label>
                                <input
                                    type="time"
                                    value={newSlot.start_time}
                                    onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                />
                            </div>

                           
                            <div className="col-span-6 sm:col-span-4">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Hasta</label>
                                <input
                                    type="time"
                                    value={newSlot.end_time}
                                    onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={adding} 
                            className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-all"
                        >
                            {adding ? <Loader2 className="animate-spin" /> : <PlusCircle size={18} />}
                            {adding ? 'Guardando...' : 'Agregar Horario'}
                        </button>
                    </form>
                </div>

                
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    {loading && availability.length === 0 ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
                    ) : availability.length > 0 ? (
                        <div className="space-y-2">
                            {availability.map((slot) => (
                                <div key={slot.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm animate-fade-in-up">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold text-xs">
                                            {daysOfWeek.find(d => d.id === slot.day_of_week)?.name.substring(0, 3)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{daysOfWeek.find(d => d.id === slot.day_of_week)?.name}</p>
                                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                                <Clock size={10}/> {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteSlot(slot.id)} 
                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 opacity-50">
                            <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm text-gray-400">No has agregado horarios aún.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AvailabilityManager;