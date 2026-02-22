// src/pages/ManageCards.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, ArrowLeft } from 'lucide-react';

const ManageCards = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 bg-gray-50 min-h-full flex flex-col">
      <div className="flex items-center mb-8">
        <button onClick={() => navigate('/wallet')} className="p-2 rounded-full hover:bg-gray-200">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-2xl font-bold ml-4">Mis Tarjetas</h1>
      </div>
      
      <div className="flex-grow flex flex-col items-center justify-center text-center bg-white p-8 rounded-2xl shadow-sm border">
        <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-6">
          <CreditCard className="w-12 h-12 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold mb-2">Próximamente</h2>
        <p className="text-gray-600 max-w-sm">
          Muy pronto, aquí podrás añadir y gestionar tus tarjetas de crédito y débito para realizar recargas y pagos de forma mucho más rápida y segura.
        </p>
        <button 
          onClick={() => navigate('/wallet')} 
          className="mt-8 bg-gray-800 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-900 transition-colors"
        >
          Volver a la Billetera
        </button>
      </div>
    </div>
  );
};

export default ManageCards;
