import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, Mail, Eye, EyeOff, AlertCircle, ShieldCheck, UserCheck, ArrowRight, Loader2 } from 'lucide-react';
import Logo from '../components/Logo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const navigate = useNavigate();

  // Si ya tiene sesión activa, redirigir al dashboard
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await axios.post('/api/login', {
        email: email.trim(),
        password: password,
      });

      if (res.data && res.data.token) {
        // Almacenar token y sesión en localStorage
        localStorage.setItem('auth_token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));

        // Determinar rol activo
        const userRoles = res.data.roles || [];
        const activeRole = userRoles.includes('Super Admin') ? 'Super Admin' : (userRoles[0] || 'Asesor Comercial');
        localStorage.setItem('user_role', activeRole);

        // Notificar a otras instancias si es necesario
        window.dispatchEvent(new Event('auth-change'));

        // Redirigir al dashboard
        navigate('/dashboard');
      } else {
        setErrorMessage('Respuesta inesperada del servidor de autenticación.');
      }
    } catch (err) {
      console.error('Error de autenticación:', err);
      const serverMsg =
        err.response?.data?.message ||
        'Credenciales incorrectas. Verifique su correo o contraseña.';
      setErrorMessage(serverMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para rellenar credenciales rápidas de prueba
  const handleQuickFill = (testEmail, testPass) => {
    setEmail(testEmail);
    setPassword(testPass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen w-full bg-slate-100/80 flex flex-col justify-center items-center px-4 py-10 sm:px-6 lg:px-8">
      {/* Contenedor de la Tarjeta */}
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 sm:p-10 transition-all">
          
          {/* Sección de Branding y Logo Oficial */}
          <div className="text-center mb-6">
            <img
              src="/logos/logo-transparent.png"
              alt="Vende & más | Hazlo ya, invierte"
              className="h-20 w-auto mx-auto mb-4 object-contain"
            />
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                Iniciar Sesión
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Acceso al portal corporativo y gestión inmobiliaria
              </p>
            </div>
          </div>

          {/* Mensaje de Error en Rojo */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs font-medium leading-relaxed">
                {errorMessage}
              </div>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Email */}
            <div>
              <label 
                htmlFor="email" 
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@vendeymas.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-400 text-sm font-medium transition focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label 
                  htmlFor="password" 
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
                >
                  Contraseña
                </label>
                <a 
                  href="#recuperar" 
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Para restablecer su contraseña, contacte al Administrador del sistema.');
                  }} 
                  className="text-[11px] font-medium text-slate-600 hover:text-slate-900 transition"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-2.5 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-400 text-sm font-medium transition focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition focus:outline-none cursor-pointer"
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botón de Enviar */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-md text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition shadow-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 text-slate-300" />
                    <span>Verificando credenciales...</span>
                  </>
                ) : (
                  <>
                    <span>Ingresar al Sistema</span>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Accesos Rápidos de Prueba */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block text-center mb-2.5">
              Acceso Rápido al Sistema
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin@vendeymas.com', 'admin123')}
                className="p-2.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-left transition cursor-pointer flex flex-col"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
                  <span>Super Admin</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">admin@vendeymas.com</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('carlos@vendeymas.com', 'asesor123')}
                className="p-2.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-left transition cursor-pointer flex flex-col"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <UserCheck className="w-3.5 h-3.5 text-slate-700" />
                  <span>Asesor Ventas</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">carlos@vendeymas.com</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer legal */}
        <p className="mt-6 text-center text-xs text-slate-400 font-medium">
          &copy; {new Date().getFullYear()} Vende & más. Gestión Inmobiliaria Segura.
        </p>
      </div>
    </div>
  );
}
