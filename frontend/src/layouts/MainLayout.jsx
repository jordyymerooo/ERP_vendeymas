import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Cerrar sidebar automáticamente en celular cuando el usuario navega a otra ruta
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-dvh bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* Sidebar fijo en escritorio / Cajón deslizable en móvil */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Contenedor derecho: Header + Área de trabajo */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

        {/* Área de trabajo con scroll y márgenes uniformes ejecutivos */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="w-full min-w-0 max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
