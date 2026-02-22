import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Bell, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Notifications = ({ onBack }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setNotifications(data);
      } catch {
        toast.error("Error al cargar notificaciones.");
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="p-2 -ml-2 mr-2"><ArrowLeft /></button>
        <h1 className="text-2xl font-bold">Notificaciones</h1>
      </div>

      {loading ? (
        <div className="text-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map(notif => (
            <div key={notif.id} className={`p-4 rounded-xl border ${notif.is_read ? 'bg-white' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${notif.is_read ? 'bg-gray-100' : 'bg-emerald-100'}`}>
                  <Bell className={`w-4 h-4 ${notif.is_read ? 'text-gray-500' : 'text-emerald-600'}`} />
                </div>
                <div>
                  <p className="font-bold">{notif.title}</p>
                  <p className="text-sm text-gray-600">{notif.body}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(notif.created_at).toLocaleString('es-CO')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-500">
          <Bell className="mx-auto w-12 h-12 opacity-50 mb-4" />
          <p>No tienes notificaciones nuevas.</p>
        </div>
      )}
    </div>
  );
};

export default Notifications;
