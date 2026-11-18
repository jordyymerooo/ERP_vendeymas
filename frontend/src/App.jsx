import { useAuth } from './context/AuthContext';
import { getAuthenticatedRole, getHomeRouteByRole } from './utils/roleRoutes';
import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Proyectos from './pages/Proyectos';
import ProyectoClientes from './pages/ProyectoClientes';
import ProyectoPagar from './pages/ProyectoPagar';
import TareasAdmin from './pages/TareasAdmin';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Recibos = React.lazy(() => import('./pages/Recibos'));
const Clientes = React.lazy(() => import('./pages/Clientes'));
const Escrituras = React.lazy(() => import('./pages/Escrituras'));
const Topografia = React.lazy(() => import('./pages/Topografia'));
const Cheques = React.lazy(() => import('./pages/Cheques'));
const Usuarios = React.lazy(() => import('./pages/Usuarios'));
const Auditoria = React.lazy(() => import('./pages/Auditoria'));
const AlertasMora = React.lazy(() => import('./pages/AlertasMora'));
const MarketingCRM = React.lazy(() => import('./pages/MarketingCRM'));

// ==========================================================
// CONFIGURACIÓN GLOBAL DE INTERCEPTORES DE AXIOS (SANCTUM)
// ==========================================================
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si el servidor retorna 401 No Autorizado y no estamos en Login, limpiar sesión y redirigir
    if (error.response && error.response.status === 401) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_role');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ==========================================================
// COMPONENTE ENVOLTORIO DE PROTECCIÓN DE RUTAS
// ==========================================================
function ProtectedRoute() {
  const token = localStorage.getItem('auth_token')?.trim();

  // Si no existe token activo en localStorage, redirigir inmediatamente a /login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function RoleRoute({ allowedRoles }) {
  const { user } = useAuth();
  const role = getAuthenticatedRole(user);

  return allowedRoles.includes(role) ? <Outlet /> : <Navigate replace to={getHomeRouteByRole(role)} />;
}

function HomeRedirect() {
  const { user } = useAuth();
  const token = localStorage.getItem('auth_token')?.trim();
  return <Navigate replace to={token ? getHomeRouteByRole(getAuthenticatedRole(user)) : '/login'} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-8 text-slate-500">Cargando módulo...</div>}>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />

          {/* Rutas Protegidas mediante ProtectedRoute y MainLayout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/proyectos" element={<Proyectos />} />
              <Route path="/proyectos/:id/lotes" element={<ProyectoClientes defaultTab="lotes" />} />
              <Route path="/proyectos/:id/clientes" element={<ProyectoClientes defaultTab="cobros" />} />
              <Route path="/proyectos/:id/clientes/pagar" element={<ProyectoPagar />} />
              <Route path="/proyectos/:id/pagar" element={<ProyectoPagar />} />
              {/* Fallback de compatibilidad para ruta previa */}
              <Route path="/proyectos/:id" element={<ProyectoClientes defaultTab="lotes" />} />
              <Route element={<RoleRoute allowedRoles={['Super Admin', 'Topógrafo', 'Topografo']} />}>
                <Route path="/topografia" element={<Topografia />} />
                <Route path="/topografia/cobro" element={<Topografia openCobroModal={true} />} />
              </Route>
              <Route element={<RoleRoute allowedRoles={['Super Admin', 'Asesor Comercial']} />}>
                <Route path="/marketing" element={<MarketingCRM />} />
              </Route>
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/recibos" element={<Recibos />} />
              <Route path="/recibos/emitir" element={<Recibos openDirectPaymentModal={true} />} />
              <Route element={<RoleRoute allowedRoles={['Super Admin', 'Administrador']} />}>
                <Route path="/escrituras" element={<Escrituras />} />
                <Route path="/escrituras/iniciartramite" element={<Escrituras openNewModal={true} />} />
              </Route>
              <Route element={<RoleRoute allowedRoles={['Super Admin', 'Administrador', 'Asesor Comercial']} />}>
                <Route path="/tareas" element={<TareasAdmin />} />
                <Route path="/alertas-mora" element={<AlertasMora />} />
              </Route>
              <Route element={<RoleRoute allowedRoles={['Super Admin']} />}>
                <Route path="/tareas/asignarnuevatarea" element={<TareasAdmin openNewModal={true} />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/cheques" element={<Cheques />} />
                <Route path="/usuarios" element={<Usuarios />} />
                <Route path="/auditoria" element={<Auditoria />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback de redirección */}
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
