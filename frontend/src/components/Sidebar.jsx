import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard,
  Map,
  Mountain,
  Megaphone,
  Users,
  Receipt,
  ShieldCheck,
  UserCheck,
  Building2,
  Scale,
  CheckSquare,
  RefreshCw,
  Activity,
  X,
  AlertTriangle,
  ChevronDown,
  Landmark,
} from 'lucide-react';

const SYSTEM_ROLES = [
  {
    id: 'Super Admin',
    alias: 'CEO / Gerente',
    desc: 'Ve todo, asigna proyectos y tareas a Administradores, supervisa 4 reciberas',
  },
  {
    id: 'Administrador',
    alias: 'Administrador',
    desc: 'Ve solo proyectos asignados por CEO, 12 etapas de Escrituras, Tareas y ADM-',
  },
  {
    id: 'Asesor Comercial',
    alias: 'Asesor Comercial',
    desc: 'Ve Proyectos, cartera en CRM, Clientes y Recibera ASE-',
  },
  {
    id: 'Topógrafo',
    alias: 'Topógrafo',
    desc: 'Ve únicamente Topografía y Recibera Topográfica TOP-',
  },
];

export default function Sidebar({ isOpen, onClose }) {
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('user_role') || 'Super Admin';
  });
  const [moraCount, setMoraCount] = useState(0);
  const [pendingTasksCount, setPendingTasksCount] = useState(() => {
    try {
      const cached = localStorage.getItem('active_tasks_count');
      return cached !== null ? parseInt(cached, 10) : 0;
    } catch (e) {
      return 0;
    }
  });
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  useEffect(() => {
    const handleSync = () => {
      setUserRole(localStorage.getItem('user_role') || 'Super Admin');
    };
    const handleTasksCountUpdated = (e) => {
      if (typeof e?.detail === 'number') {
        setPendingTasksCount(e.detail);
      } else {
        try {
          const cached = localStorage.getItem('active_tasks_count');
          if (cached !== null) {
            setPendingTasksCount(parseInt(cached, 10));
          }
        } catch (err) {}
      }
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('auth-change', handleSync);
    window.addEventListener('tasks-count-updated', handleTasksCountUpdated);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('auth-change', handleSync);
      window.removeEventListener('tasks-count-updated', handleTasksCountUpdated);
    };
  }, []);

  // Sincronizar contadores centralizadamente desde el Header sin realizar peticiones redundantes
  useEffect(() => {
    const handleSummaryLoaded = (e) => {
      if (e?.detail) {
        if (typeof e.detail.mora_count === 'number') {
          setMoraCount(e.detail.mora_count);
        }
        if (typeof e.detail.pending_tasks_count === 'number') {
          setPendingTasksCount(e.detail.pending_tasks_count);
        }
      }
    };

    window.addEventListener('notifications-summary-loaded', handleSummaryLoaded);

    return () => {
      window.removeEventListener('notifications-summary-loaded', handleSummaryLoaded);
    };
  }, []);

  // Verificar de forma estricta si el usuario logueado real es Super Admin
  const isRealSuperAdmin = (() => {
    try {
      const stored = localStorage.getItem('user');
      if (!stored) return false;
      const u = JSON.parse(stored);
      if (u.id === 1) return true;
      if (u.roles && Array.isArray(u.roles)) {
        return u.roles.some((r) => r.name === 'Super Admin');
      }
      return u.role === 'Super Admin';
    } catch (e) {
      return false;
    }
  })();

  const isSuperAdmin = userRole === 'Super Admin' || userRole === 'CEO / Gerente';
  const isAdministrador = userRole === 'Administrador';
  const isAsesor = userRole === 'Asesor Comercial';
  const isTopografo = userRole === 'Topógrafo';

  const displayRoleLabel = isSuperAdmin ? 'CEO / Gerente' : userRole;

  const handleSelectRole = (nextRole) => {
    setUserRole(nextRole);
    localStorage.setItem('user_role', nextRole);
    window.dispatchEvent(new Event('auth-change'));
    setRoleDropdownOpen(false);
  };

  const handleCycleRole = () => {
    const rolesList = ['Super Admin', 'Administrador', 'Asesor Comercial', 'Topógrafo'];
    const currentNormalized = isSuperAdmin ? 'Super Admin' : userRole;
    const currentIndex = rolesList.indexOf(currentNormalized);
    const nextIndex = (currentIndex + 1) % rolesList.length;
    handleSelectRole(rolesList[nextIndex]);
  };

  // Construcción de la navegación adaptada por rol
  const getNavigationForRole = () => {
    const items = [];

    // 1. Dashboard (Exclusivo Super Admin)
    if (isSuperAdmin) {
      items.push({
        name: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
      });
    }

    // 2. Proyectos / Inventario de Lotes
    if (isSuperAdmin || isAdministrador || isAsesor) {
      let label = 'Proyectos';
      if (isAdministrador) label = 'Proyectos Asignados';
      if (isAsesor) label = 'Inventario de Lotes';

      items.push({
        name: label,
        path: '/proyectos',
        icon: Map,
      });
    }

    // 3. Escrituras (Super Admin y Administrador)
    if (isSuperAdmin || isAdministrador) {
      items.push({
        name: 'Escrituras (12 Etapas)',
        path: '/escrituras',
        icon: Scale,
      });
    }

    // 4. Tareas Administrativas (Super Admin y Administrador)
    if (isSuperAdmin || isAdministrador) {
      items.push({
        name: isSuperAdmin ? 'Tareas del CEO' : 'Mis Tareas',
        path: '/tareas',
        icon: CheckSquare,
        isTaskItem: true,
      });
    }

    // 5. Topografía (Super Admin y Topógrafo)
    if (isSuperAdmin || isTopografo) {
      items.push({
        name: 'Topografía',
        path: '/topografia',
        icon: Mountain,
      });
    }

    // 6. Marketing & CRM (Super Admin y Asesor Comercial)
    if (isSuperAdmin || isAsesor) {
      items.push({
        name: 'Marketing & CRM',
        path: '/marketing',
        icon: Megaphone,
      });
    }

    // 7. Clientes & Ventas (Super Admin, Administrador y Asesor Comercial)
    if (isSuperAdmin || isAdministrador || isAsesor) {
      items.push({
        name: 'Clientes & Ventas',
        path: '/clientes',
        icon: Users,
      });
    }

    // 8. Recibos & Caja con subtítulo por Recibera Oficial
    let recibosLabel = 'Recibos & Auditoría';
    if (isAdministrador) recibosLabel = 'Recibos & Caja (ADM)';
    if (isAsesor) recibosLabel = 'Recibos & Caja (ASE)';
    if (isTopografo) recibosLabel = 'Recibos Topografía (TOP)';

    items.push({
      name: recibosLabel,
      path: '/recibos',
      icon: Receipt,
    });

    // 9. Alertas de Mora (Super Admin, Administrador y Asesor Comercial)
    if (isSuperAdmin || isAdministrador || isAsesor) {
      items.push({
        name: 'Alertas de Mora',
        path: '/alertas-mora',
        icon: AlertTriangle,
        badge: moraCount > 0 ? moraCount : null,
        badgeClass: 'bg-rose-600 text-white font-bold text-xs px-2 py-0.5 rounded-full',
      });
    }

    // 10. Control de Cheques (Única y exclusivamente Super Admin / CEO)
    if (isSuperAdmin) {
      items.push({
        name: 'Control de Cheques',
        path: '/cheques',
        icon: Landmark,
      });
    }

    // 11. Usuarios y Permisos (Solo Super Admin)
    if (isSuperAdmin) {
      items.push({
        name: 'Usuarios y Permisos',
        path: '/usuarios',
        icon: ShieldCheck,
      });
    }

    // 11. Auditoría y Logs (Solo Super Admin)
    if (isSuperAdmin) {
      items.push({
        name: 'Auditoría y Logs',
        path: '/auditoria',
        icon: Activity,
      });
    }

    return items;
  };

  const navigation = getNavigationForRole();

  return (
    <>
      {/* Fondo semitransparente oscuro en móviles */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Aside Fijo */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-screen bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Cabecera / Identidad Corporativa Oficial */}
        <div className="h-20 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900/90">
          <NavLink to="/" className="flex items-center py-2 group">
            <img
              src="/logos/logo-dark-bg.png"
              alt="Vende & más | Hazlo ya, invierte"
              className="h-12 w-auto object-contain max-w-[195px] transition-transform duration-150 group-hover:scale-102"
            />
          </NavLink>

          {/* Botón Cerrar en Móvil */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conmutador Rápido de Roles (Exclusivo Super Admin / CEO) */}
        {isRealSuperAdmin ? (
          <div className="px-3.5 pt-3 pb-2 relative">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-md p-2 flex items-center justify-between">
              <div
                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                title="Haz clic para seleccionar rol"
              >
                {isSuperAdmin ? (
                  <div className="w-6 h-6 rounded bg-slate-700 text-slate-200 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                ) : isAdministrador ? (
                  <div className="w-6 h-6 rounded bg-indigo-900/60 text-indigo-300 flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                ) : isTopografo ? (
                  <div className="w-6 h-6 rounded bg-cyan-900/60 text-cyan-300 flex items-center justify-center shrink-0">
                    <Mountain className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded bg-teal-900/60 text-teal-300 flex items-center justify-center shrink-0">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-black">
                    PERFIL DE ACCESO
                  </span>
                  <span
                    className={`text-xs font-black truncate block ${
                      isSuperAdmin
                        ? 'text-slate-100'
                        : isAdministrador
                        ? 'text-indigo-300'
                        : isTopografo
                        ? 'text-cyan-300'
                        : 'text-teal-300'
                    }`}
                  >
                    {displayRoleLabel}
                  </span>
                </div>

                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              <button
                type="button"
                onClick={handleCycleRole}
                title="Cambiar al siguiente rol en 1 clic"
                className="p-1.5 ml-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Menú Desplegable con los 4 Roles Oficiales */}
            {roleDropdownOpen && (
              <div className="absolute left-3.5 right-3.5 top-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-2xl py-1 z-50 text-xs font-semibold max-h-72 overflow-y-auto">
                <div className="px-3 py-1 text-[10px] text-slate-400 uppercase font-black border-b border-slate-700">
                  Alternar Perfil de Acceso:
                </div>
                {SYSTEM_ROLES.map((r) => {
                  const isSelected = (r.id === userRole) || (r.id === 'Super Admin' && isSuperAdmin);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleSelectRole(r.id)}
                      className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 transition cursor-pointer border-b border-slate-700/50 last:border-0 ${
                        isSelected
                          ? 'bg-slate-700/90 text-white font-bold'
                          : 'text-slate-300 hover:bg-slate-700/40 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{r.alias}</span>
                        {isSelected && <span className="w-2 h-2 rounded-full bg-teal-400"></span>}
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal leading-tight">
                        {r.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Para usuarios normales: Insignia de Rol Asignado Oficial (Sin selector ni simulación) */
          <div className="px-3.5 pt-3 pb-2">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-md p-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-slate-700/70 text-teal-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-black">
                  ROL ASIGNADO
                </span>
                <span className="text-xs font-bold text-slate-200 truncate block">
                  {displayRoleLabel}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Menú de Navegación por Rol */}
        <nav className="flex-1 px-2.5 py-2 space-y-1 overflow-y-auto">
          <div className="px-3 pb-1.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            {isSuperAdmin
              ? 'Administración General'
              : isAdministrador
              ? 'Gestión Administrativa'
              : isTopografo
              ? 'Operaciones Topográficas'
              : 'Gestión Comercial'}
          </div>

          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-slate-800 text-white font-bold border-l-2 border-teal-500 shadow-xs'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border-l-2 border-transparent'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 transition-colors shrink-0 ${
                          isActive ? 'text-teal-400' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>

                    {item.isTaskItem ? (
                      pendingTasksCount > 0 && (
                        <span className="ml-auto bg-amber-500 text-slate-950 font-bold text-xs px-2 py-0.5 rounded-full">
                          {pendingTasksCount}
                        </span>
                      )
                    ) : (
                      item.badge != null && (
                        <span
                          className={`ml-2 shrink-0 ${
                            item.badgeClass || 'px-2 py-0.5 text-xs font-bold rounded-full bg-rose-600 text-white'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Pie de Sidebar */}
        <div className="p-3.5 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-400">Vende & más ERP &bull; Sucúa</span>
          <span className="inline-flex items-center gap-1.5 text-teal-400 text-[10px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
            Activo
          </span>
        </div>
      </aside>
    </>
  );
}
