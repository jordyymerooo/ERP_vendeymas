import useSingleSubmit from '../hooks/useSingleSubmit';
import ActionButton from '../components/ActionButton';
import { useAuth } from '../context/AuthContext';
import { getAuthenticatedRole, getHomeRouteByRole } from '../utils/roleRoutes';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import Logo from '../components/Logo';
import PasswordRecoveryDialog from '../components/PasswordRecoveryDialog';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const navigate = useNavigate();

  const { user } = useAuth();

  useEffect(() => {
    const home = getHomeRouteByRole(getAuthenticatedRole(user));
    if (localStorage.getItem('auth_token')?.trim() && home !== '/login') {
      navigate(home, { replace: true });
    }
  }, [navigate, user]);

  const [handleSubmit, handleSubmitPending] = useSingleSubmit(async (e) => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await axios.post('/api/login', {
        email: email.trim(),
        password: password,
      });

      if (res.data && res.data.token) {
        const userData = res.data.user;
        const activeRole = getAuthenticatedRole(userData);
        localStorage.setItem('auth_token', res.data.token);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('user_role', activeRole || '');

        window.dispatchEvent(new Event('auth-change'));
        navigate(getHomeRouteByRole(activeRole), { replace: true });
      } else {
        setErrorMessage('Respuesta inesperada del servidor de autenticación.');
      }
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error de autenticación:', err);
      const serverMsg =
        err.response?.data?.message ||
        'Credenciales incorrectas. Verifique su correo o contraseña.';
      setErrorMessage(serverMsg);
    } finally {
      setIsLoading(false);
    }
  }, { form: true });

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
                <input name="email"
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
                <button
                  type="button"
                  onClick={() => setRecoveryOpen(true)}
                  className="text-[11px] font-medium text-slate-600 hover:text-slate-900 transition"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input name="password"
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
              <ActionButton loading={handleSubmitPending}
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
              </ActionButton>
            </div>
          </form>

        </div>

        {/* Footer legal */}
        <p className="mt-6 text-center text-xs text-slate-400 font-medium">
          &copy; {new Date().getFullYear()} Vende & más. Gestión Inmobiliaria Segura.
        </p>
      </div>
      {recoveryOpen && <PasswordRecoveryDialog initialEmail={email} onClose={() => setRecoveryOpen(false)} />}
    </div>
  );
}
