import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 z-10">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-black text-gray-900">Política de Privacidad</h1>
      </div>

      <div className="p-6 space-y-6 text-sm text-gray-700">
        <p className="text-gray-400 text-xs">Última actualización: Marzo 2026</p>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">1. Información que Recopilamos</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Información de cuenta:</strong> Nombre, correo electrónico, número de teléfono.</li>
            <li><strong>Información de perfil:</strong> Foto, dirección, datos de pago.</li>
            <li><strong>Información de mascotas:</strong> Nombre, raza, edad, condiciones médicas, fotografías.</li>
            <li><strong>Documentos de identificación:</strong> Cédula, antecedentes judiciales (para paseadores).</li>
            <li><strong>Ubicación:</strong> Datos de geolocalización durante los paseos.</li>
            <li><strong>Historial:</strong> Reservas, pagos, calificaciones y reseñas.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">2. Cómo Usamos tu Información</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Proveer y mantener nuestros servicios.</li>
            <li>Procesar pagos y transacciones.</li>
            <li>Verificar la identidad de paseadores.</li>
            <li>Conectar usuarios con paseadores cercanos.</li>
            <li>Enviar notificaciones sobre reservas y actualizaciones.</li>
            <li>Mejorar la experiencia del usuario.</li>
            <li>Cumplir con obligaciones legales.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">3. Compartir Información</h2>
          <p>Compartimos información con:</p>
          <ul className="list-disc pl-4 space-y-1 mt-2">
            <li><strong>Paseadores/Dueños:</strong> Información necesaria para completar el servicio.</li>
            <li><strong>Proveedores de pago:</strong> Para procesar transacciones (MercadoPago).</li>
            <li><strong>Autoridades:</strong> Cuando sea requerido por ley.</li>
            <li><strong>Servicios de análisis:</strong> Para mejorar nuestra aplicación.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">4. Seguridad de tus Datos</h2>
          <p>Implementamos medidas de seguridad técnicas y organizativas para proteger tu información personal:</p>
          <ul className="list-disc pl-4 space-y-1 mt-2">
            <li>Encriptación de datos en tránsito y en reposo.</li>
            <li>Almacenamiento seguro de documentos de identificación.</li>
            <li>Acceso limitado a información personal.</li>
            <li>Monitoreo continuo de我们的 sistemas.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">5. Retención de Datos</h2>
          <p>Conservamos tu información mientras tengas una cuenta activa y por un período razonable después de su eliminación. Los datos de transacciones se mantienen por requisitos legales y fiscales.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">6. Tus Derechos</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Acceder a tu información personal.</li>
            <li>Corregir datos inaccurate.</li>
            <li>Solicitar eliminación de tu cuenta.</li>
            <li>Oponerte al procesamiento de tus datos.</li>
            <li>Exportar tus datos en formato legible.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">7. Cookies y Tecnologías Similares</h2>
          <p>Utilizamos cookies y tecnologías similares para mejorar tu experiencia, analizar tráfico y personalizar contenido. Puedes configurar tu navegador para rechazar cookies, pero esto puede afectar la funcionalidad.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">8. Menores de Edad</h2>
          <p>Nuestro servicio está dirigido a personas mayores de 18 años. No recopilamos intencionalmente información de menores.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">9. Cambios a esta Política</h2>
          <p>Podemos actualizar esta política periodically. Notificaremos cambios significativos a través de la aplicación o correo electrónico.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">10. Contacto</h2>
          <p>Para preguntas sobre esta política de privacidad, contáctanos a través de la aplicación.</p>
        </section>
      </div>
    </div>
  );
};

export default Privacy;
