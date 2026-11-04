import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Proyectos from './pages/Proyectos';
import ProyectoClientes from './pages/ProyectoClientes';
import ProyectoPagar from './pages/ProyectoPagar';
import Topografia from './pages/Topografia';
import Marketing from './pages/Marketing';
import Clientes from './pages/Clientes';
import Recibos from './pages/Recibos';
import Usuarios from './pages/Usuarios';
import Auditoria from './pages/Auditoria';
import AlertasMora from './pages/AlertasMora';
import Escrituras from './pages/Escrituras';
import TareasAdmin from './pages/TareasAdmin';
import Cheques from './pages/Cheques';

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

// Guard de ruta exclusivo para el CEO (Super Admin)
function CeoRoute({ children }) {
  let userRoles = [];
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    userRoles = Array.isArray(user?.roles) ? user.roles.map((role) => role.name) : [];
  } catch {
    userRoles = [];
  }
  const isSuperAdmin = userRoles.includes('Super Admin');

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* Rutas Protegidas mediante ProtectedRoute y MainLayout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/proyectos" element={<Proyectos />} />
            <Route path="/proyectos/:id/lotes" element={<ProyectoClientes defaultTab="lotes" />} />
            <Route path="/proyectos/:id/clientes" element={<ProyectoClientes defaultTab="cobros" />} />
            <Route path="/proyectos/:id/clientes/pagar" element={<ProyectoPagar />} />
            <Route path="/proyectos/:id/pagar" element={<ProyectoPagar />} />
            {/* Fallback de compatibilidad para ruta previa */}
            <Route path="/proyectos/:id" element={<ProyectoClientes defaultTab="lotes" />} />
            <Route path="/topografia" element={<Topografia />} />
            <Route path="/topografia/cobro" element={<Topografia openCobroModal={true} />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/recibos" element={<Recibos />} />
            <Route path="/recibos/emitir" element={<Recibos openDirectPaymentModal={true} />} />
            <Route path="/escrituras" element={<Escrituras />} />
            <Route path="/escrituras/iniciartramite" element={<Escrituras openNewModal={true} />} />
            <Route path="/tareas" element={<TareasAdmin />} />
            <Route path="/tareas/asignarnuevatarea" element={<TareasAdmin openNewModal={true} />} />
            <Route path="/alertas-mora" element={<AlertasMora />} />
            <Route
              path="/cheques"
              element={
                <CeoRoute>
                  <Cheques />
                </CeoRoute>
              }
            />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/auditoria" element={<Auditoria />} />
          </Route>
        </Route>

        {/* Fallback de redirección */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
