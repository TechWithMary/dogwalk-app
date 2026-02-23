import React from 'react';
import { Home, User, ArrowLeft, MessageSquare, Calendar } from 'lucide-react';

const MobileLayout = ({ children, title, showNav = true, activeTab, onViewChange, hideHeader = false, onBack, isWalker }) => {
  
 
  const isActive = (tab) => activeTab === tab;

  
  const activeColor = isWalker ? "text-gray-900" : "text-emerald-600";
  const activeBg = isWalker ? "bg-gray-100" : "bg-emerald-50";

  return (
    <div className="mx-auto w-full h-screen bg-gray-50 flex flex-col max-w-md shadow-2xl overflow-hidden relative font-sans">
      
     
      {!hideHeader && (
        <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
           <div className="flex items-center gap-3">
             {onBack && (
               <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition">
                 <ArrowLeft className="w-5 h-5 text-gray-600" />
               </button>
             )}
             <h1 className="text-lg font-black text-gray-800 tracking-tight">{title}</h1>
           </div>
           
        </div>
      )}

      
      <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
        {children}
      </div>

      
      {showNav && (
        <div className="bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center shrink-0 pb-safe">
          
          
          <button 
            onClick={() => onViewChange('home')}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive('home') ? '-mt-4' : 'opacity-40 hover:opacity-60'}`}
          >
            <div className={`p-3 rounded-full transition-all shadow-sm ${isActive('home') ? `${activeBg} ${activeColor} scale-110 shadow-md` : 'bg-transparent'}`}>
              <Home className="w-6 h-6" />
            </div>
            {isActive('home') && <span className="text-[10px] font-bold text-gray-900">Inicio</span>}
          </button>

          
          <button 
            onClick={() => onViewChange('messages')}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive('messages') ? '-mt-4' : 'opacity-40 hover:opacity-60'}`}
          >
            <div className={`p-3 rounded-full transition-all shadow-sm ${isActive('messages') ? `${activeBg} ${activeColor} scale-110 shadow-md` : 'bg-transparent'}`}>
              <MessageSquare className="w-6 h-6" />
            </div>
            {isActive('messages') && <span className="text-[10px] font-bold text-gray-900">Chat</span>}
          </button>

          
          <button 
            onClick={() => onViewChange('profile')}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive('profile') ? '-mt-4' : 'opacity-40 hover:opacity-60'}`}
          >
            <div className={`p-3 rounded-full transition-all shadow-sm ${isActive('profile') ? `${activeBg} ${activeColor} scale-110 shadow-md` : 'bg-transparent'}`}>
              <User className="w-6 h-6" />
            </div>
            {isActive('profile') && <span className="text-[10px] font-bold text-gray-900">Perfil</span>}
          </button>

        </div>
      )}
    </div>
  );
};

export default MobileLayout;