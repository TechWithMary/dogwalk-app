import React from 'react';
import { MapPin, Star, Calendar, ShieldCheck, ArrowLeft, MessageCircle, Dog } from 'lucide-react';
import { formatMoney } from '../utils/format';

const WalkerProfileView = ({ walker, onNavigate, onBack }) => {

  const profile = walker.user_profiles;
  const fullName = profile ? `${profile.first_name} ${profile.last_name}` : walker.name;

  return (
    <div className="bg-white min-h-screen pb-24 relative animate-in fade-in slide-in-from-right duration-300">
      
      <div className="relative h-72 w-full bg-gray-200">
        <img 
          src={profile?.profile_photo_url || 'https://via.placeholder.com/400'} 
          className="w-full h-full object-cover" 
          alt={fullName}
        />
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg active:scale-90 transition-transform"
        >
          <ArrowLeft size={20} className="text-gray-800" />
        </button>
      </div>

      <div className="px-6 -mt-8 relative z-10 bg-white rounded-t-[32px] pt-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900">{fullName}</h1>
            <p className="text-gray-400 text-sm flex items-center gap-1 mt-1">
              <MapPin size={14} /> {walker.location || 'Medellín, Antioquia'}
            </p>
          </div>
          <div className="bg-emerald-50 px-3 py-2 rounded-2xl flex flex-col items-center">
            <span className="text-emerald-600 font-black text-lg">{walker.rating || '5.0'}</span>
            <div className="flex text-yellow-400"><Star size={10} fill="currentColor" /></div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-gray-50 p-3 rounded-2xl text-center border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Paseos</p>
            <p className="font-black text-gray-800">{walker.reviews || 0}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-2xl text-center border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Precio</p>
            <p className="font-black text-emerald-600">{formatMoney(walker.price || 30000)}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-2xl text-center border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Edad</p>
            <p className="font-black text-gray-800">
                {profile?.age ? (profile.age === 1 ? '1 año' : `${profile.age} años`) : '---'}
            </p>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="font-black text-gray-900 mb-2">Sobre mí</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            {profile?.bio || walker.bio || "Este paseador aún no ha redactado su biografía."}
          </p>
        </div>

        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-3 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
            <ShieldCheck className="text-emerald-600" size={20} />
            <p className="text-xs font-bold text-emerald-800 uppercase">Identidad Verificada por PaseoMundo</p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full p-6 bg-white/90 backdrop-blur-md border-t border-gray-100 flex gap-3 z-50">
        <button className="p-4 bg-gray-100 rounded-2xl text-gray-600 active:scale-95 transition-transform">
          <MessageCircle size={24} />
        </button>
        <button 
          onClick={() => onNavigate('/booking', { state: { preferredWalker: walker } })}
          className="flex-1 bg-gray-900 text-white font-black py-4 rounded-2xl shadow-xl shadow-gray-200 active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <Calendar size={18} /> Reservar con {profile?.first_name || 'este paseador'}
        </button>
      </div>
    </div>
  );
};

export default WalkerProfileView;