import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 z-10">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-black text-gray-900">Términos y Condiciones</h1>
      </div>

      <div className="p-6 space-y-6 text-sm text-gray-700">
        <p className="text-gray-400 text-xs">Última actualización: Marzo 2026</p>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">1. Aceptación de Términos</h2>
          <p>Al acceder y utilizar HappiWalk (PaseoMundo), aceptas estar bound by estos Términos y Condiciones. Si no estás de acuerdo, por favor no utilices la aplicación.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">2. Definiciones</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Servicio:</strong> Plataforma que conecta dueños de mascotas con paseadores profesionales.</li>
            <li><strong>Usuario:</strong> Persona que crea una cuenta en la aplicación.</li>
            <li><strong>Paseador:</strong> Usuario registrado que ofrece servicios de paseo de mascotas.</li>
            <li><strong>Dueño:</strong> Usuario que contrata servicios de paseo para su mascota.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">3. Obligations del Paseador</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Proporcionar información veraz y actualizada.</li>
            <li>Contar con los documentos de identificación requeridos.</li>
            <li>Tratamiento respetuoso y seguro de las mascotas.</li>
            <li>Cumplir con los horarios acordados.</li>
            <li>Notificar cualquier incidente inmediatamente.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">4. Obligaciones del Dueño</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Proporcionar información precisa de su mascota.</li>
            <li>Informar sobre condiciones médicas, alergias o comportamiento especial.</li>
            <li>Garantizar que la mascota esté correctamente identificada.</li>
            <li>Pagar los servicios acordados puntualmente.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">5. Pagos y Comisiones</h2>
          <p>Los pagos se procesan a través de MercadoPago. El plataforma retiene una comisión del 20% sobre cada paseo completado. Los paseadores pueden solicitar retiro de sus ganancias una vez alcanzado el monto mínimo de $50,000 COP.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">6. Cancelaciones</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Cancelación con más de 2 horas de anticipación: Sin cargo.</li>
            <li>Cancelación con menos de 2 horas: Cargo del 50% del valor.</li>
            <li>No presentarse: Cargo completo.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">7. Limitación de Responsabilidad</h2>
          <p>HappiWalk actúa como intermediario. No somos responsables de daños, pérdidas o lesiones que puedan ocurrir durante los paseos. Recomendamos a los usuarios verificar la información y tomar precauciones razonables.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">8. Suspensión y Terminación</h2>
          <p>Nos reservamos el derecho de suspender o terminar cuentas que violen estos términos, incluyendo pero no limitado a: comportamiento violento, negligencia, fraude o incumplimiento de obligaciones.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">9. Modificaciones</h2>
          <p>Podemos modificar estos términos en cualquier momento. El uso continuo de la aplicación constituye aceptación de los términos modificados.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-2">10. Contacto</h2>
          <p>Para preguntas sobre estos términos, contáctanos a través de la aplicación o en nuestro correo de soporte.</p>
        </section>
      </div>
    </div>
  );
};

export default Terms;
