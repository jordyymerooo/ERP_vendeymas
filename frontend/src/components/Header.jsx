import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import SignatureCanvas from 'react-signature-canvas';
import {
  LogOut,
  User,
  Bell,
  ShieldCheck,
  UserCheck,
  Loader2,
  Menu,
  PenTool,
  ChevronDown,
  X,
  RotateCcw,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Upload,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';

export default function Header({ onToggleSidebar }) {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const initialNotificationsRequested = useRef(false);
  const initialUserRequested = useRef(false);
  const initialSignatureRequested = useRef(false);

  // Estados para Modal Híbrido de Firma Digital
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatureMode, setSignatureMode] = useState('draw'); // 'draw' | 'upload'
  const [uploadedImageBase64, setUploadedImageBase64] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [isDeletingSignature, setIsDeletingSignature] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);
  const [signatureError, setSignatureError] = useState(null);
  const [isLoadingSignature, setIsLoadingSignature] = useState(false);
  const [effectiveSignatureUser, setEffectiveSignatureUser] = useState({
    user_id: null,
    name: '',
    role: '',
    signature_base64: null,
  });

  const sigCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Leer información del usuario logueado desde localStorage
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [currentRole, setCurrentRole] = useState(() => {
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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [notificationsData, setNotificationsData] = useState({
    notifications: [],
    unread_count: 0,
    mora_count: 0,
    pending_tasks_count: 0,
  });

  // Consultar resumen de notificaciones, conteo de mora y tareas pendientes
  const fetchNotificationsSummary = async () => {
    try {
      const activeRole = localStorage.getItem('user_role') || currentRole || 'Super Admin';
      const storedUser = localStorage.getItem('user');
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const adminId = parsedUser?.id || undefined;

      const res = await axios.get('/api/notifications/summary', {
        params: {
          role: activeRole,
          admin_id: adminId,
        },
      });

      if (res.data?.success) {
        const count = res.data.pending_tasks_count ?? 0;
        const mora = res.data.mora_count ?? 0;
        const unread = res.data.unread_count ?? 0;

        setNotificationsData({
          notifications: res.data.notifications || [],
          unread_count: unread,
          mora_count: mora,
          pending_tasks_count: count,
        });
        setPendingTasksCount(count);
        setMoraCount(mora);

        try {
          localStorage.setItem('active_tasks_count', String(count));
          localStorage.setItem('active_mora_count', String(mora));
        } catch (e) {}

        // Sincronizar centralizadamente con el Sidebar sin que este deba llamar a la API
        window.dispatchEvent(
          new CustomEvent('notifications-summary-loaded', {
            detail: {
              mora_count: mora,
              pending_tasks_count: count,
              unread_count: unread,
            },
          })
        );
      }
    } catch (err) {
      // Silencioso
    }
  };

  useEffect(() => {
    // 1. Carga inicial al iniciar sesión / montar
    if (!initialNotificationsRequested.current) {
      initialNotificationsRequested.current = true;
      fetchNotificationsSummary();
    }

    // 2. Disparos controlados por eventos globales específicos
    const handleUpdate = () => fetchNotificationsSummary();
    const handleTasksCountUpdated = (e) => {
      const count = typeof e?.detail === 'number' ? e.detail : parseInt(localStorage.getItem('active_tasks_count') || '0', 10);
      setPendingTasksCount(count);
      setNotificationsData((prev) => ({ ...prev, pending_tasks_count: count }));
      fetchNotificationsSummary();
    };

    window.addEventListener('notifications-updated', handleUpdate);
    window.addEventListener('tasks-count-updated', handleTasksCountUpdated);

    return () => {
      window.removeEventListener('notifications-updated', handleUpdate);
      window.removeEventListener('tasks-count-updated', handleTasksCountUpdated);
    };
  }, []);

  // Consultar datos actualizados del usuario autenticado (incluyendo firma digital)
  const fetchUserData = async () => {
    try {
      const res = await axios.get('/api/user');
      if (res.data) {
        setCurrentUser((prev) => {
          const merged = { ...prev, ...res.data };
          try {
            localStorage.setItem('user', JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (initialUserRequested.current) return;
    initialUserRequested.current = true;
    fetchUserData();
  }, []);

  // Sincronizar estado si cambia el usuario o el rol en localStorage
  useEffect(() => {
    const handleSync = () => {
      try {
        const stored = localStorage.getItem('user');
        setCurrentUser(stored ? JSON.parse(stored) : null);
        setCurrentRole(localStorage.getItem('user_role') || 'Super Admin');
      } catch (err) {
        console.error('Error sincronizando header:', err);
      }
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('auth-change', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('auth-change', handleSync);
    };
  }, []);

  // Cerrar menús desplegables al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await axios.post(`/api/notifications/${notif.id}/read`);
        setNotificationsData((prev) => ({
          ...prev,
          unread_count: Math.max(0, prev.unread_count - 1),
          notifications: prev.notifications.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
        }));
        window.dispatchEvent(new Event('notifications-updated'));
      }
    } catch (err) {
      console.error('Error al marcar notificación:', err);
    } finally {
      setIsNotificationsOpen(false);
      if (notif.action_url) {
        navigate(notif.action_url);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAllRead(true);
    try {
      const activeRole = localStorage.getItem('user_role') || currentRole || 'Super Admin';
      const storedUser = localStorage.getItem('user');
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const adminId = parsedUser?.id || undefined;

      await axios.post(
        '/api/notifications/read-all',
        {},
        {
          params: {
            role: activeRole,
            admin_id: adminId,
          },
        }
      );

      setNotificationsData((prev) => ({
        ...prev,
        unread_count: 0,
        notifications: prev.notifications.map((n) => ({ ...n, is_read: true })),
      }));
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      console.error('Error al marcar todas como leídas:', err);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const isSuperAdmin = currentRole === 'Super Admin';
  const userName = currentUser?.name || 'Administrador';
  const userEmail = currentUser?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();
  const hasSavedSignature = Boolean(effectiveSignatureUser?.signature_base64);

  // Consulta GET /api/profile/signature exclusiva para traer de la BD la firma del usuario efectivo
  const fetchSignatureProfile = async () => {
    setIsLoadingSignature(true);
    setSignatureError(null);
    try {
      const res = await axios.get('/api/profile/signature');
      if (res.data) {
        const uId = res.data.user_id;
        const sig = res.data.signature_base64 || null;
        setEffectiveSignatureUser({
          user_id: uId,
          name: res.data.name || userName,
          role: res.data.role || currentRole,
          signature_base64: sig,
        });

        if (uId) {
          if (sig) {
            localStorage.setItem(`user_signature_${uId}`, sig);
          } else {
            localStorage.removeItem(`user_signature_${uId}`);
          }
        }

        // Si coincide con el usuario logueado en sesión, sincronizar
        if (currentUser && currentUser.id === uId) {
          const updatedUser = { ...currentUser, signature_base64: sig };
          try {
            localStorage.setItem('user', JSON.stringify(updatedUser));
          } catch (e) {}
          setCurrentUser(updatedUser);
        }
      }
    } catch (err) {
      console.warn('Error al consultar firma del perfil:', err);
    } finally {
      setIsLoadingSignature(false);
    }
  };

  useEffect(() => {
    if (initialSignatureRequested.current) return;
    initialSignatureRequested.current = true;
    fetchSignatureProfile();
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      await axios.post('/api/logout');
    } catch (err) {
      console.warn('Advertencia al revocar token:', err);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('user_role');
      navigate('/login', { replace: true });
      setIsLoggingOut(false);
    }
  };

  const handleOpenSignatureModal = () => {
    setIsDropdownOpen(false);
    setSignatureMode('draw');
    setUploadedImageBase64(null);
    setUploadedFileName('');
    setSignatureError(null);
    setSaveSuccessMsg(null);
    setIsSignatureModalOpen(true);
    fetchSignatureProfile();
  };

  const handleClearSignature = () => {
    if (sigCanvasRef.current) {
      sigCanvasRef.current.clear();
    }
    setSignatureError(null);
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setSignatureError('Formato no soportado. Por favor sube una imagen PNG o JPG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSignatureError('La imagen excede el tamaño máximo permitido de 5 MB.');
      return;
    }

    setUploadedFileName(file.name);
    setSignatureError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImageBase64(event.target?.result);
    };
    reader.onerror = () => {
      setSignatureError('Error al procesar el archivo de imagen seleccionado.');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteCurrentSignature = async () => {
    const targetName = effectiveSignatureUser.name || userName;
    if (!confirm(`¿Estás seguro de que deseas eliminar la firma digital de ${targetName}? Los próximos recibos se emitirán sin firma hasta que registres una nueva.`)) {
      return;
    }

    setIsDeletingSignature(true);
    setSignatureError(null);

    try {
      const payload = {};
      if (effectiveSignatureUser.user_id) {
        payload.user_id = effectiveSignatureUser.user_id;
      }
      const res = await axios.delete('/api/profile/signature', { data: payload });

      const uId = res.data?.user_id || effectiveSignatureUser.user_id;
      if (uId) {
        localStorage.removeItem(`user_signature_${uId}`);
      }

      setEffectiveSignatureUser((prev) => ({
        ...prev,
        signature_base64: null,
      }));

      if (currentUser && (!uId || currentUser.id === uId)) {
        const updatedUser = {
          ...currentUser,
          signature_base64: null,
        };
        try {
          localStorage.setItem('user', JSON.stringify(updatedUser));
        } catch (e) {}
        setCurrentUser(updatedUser);
      }

      window.dispatchEvent(new Event('auth-change'));

      if (sigCanvasRef.current) {
        sigCanvasRef.current.clear();
      }
      setUploadedImageBase64(null);
      setUploadedFileName('');

      setSaveSuccessMsg(`Firma digital eliminada correctamente para ${targetName}.`);
      setTimeout(() => {
        setSaveSuccessMsg(null);
      }, 3000);
    } catch (err) {
      console.error('Error eliminando firma:', err);
      setSignatureError(
        err.response?.data?.message || 'Error al eliminar la firma digital. Intenta nuevamente.'
      );
    } finally {
      setIsDeletingSignature(false);
    }
  };

  const handleSaveSignature = async () => {
    let finalBase64 = null;

    if (signatureMode === 'draw') {
      if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
        setSignatureError('Por favor dibuja tu firma en el lienzo antes de guardar.');
        return;
      }
      finalBase64 = sigCanvasRef.current.toDataURL('image/png');
    } else {
      if (!uploadedImageBase64) {
        setSignatureError('Por favor selecciona una imagen PNG o JPG de tu firma antes de guardar.');
        return;
      }
      finalBase64 = uploadedImageBase64;
    }

    setSignatureError(null);
    setIsSavingSignature(true);

    try {
      const payload = {
        signature_base64: finalBase64,
      };
      if (effectiveSignatureUser.user_id) {
        payload.user_id = effectiveSignatureUser.user_id;
      }

      const res = await axios.post('/api/profile/signature', payload);

      const uId = res.data?.user_id || effectiveSignatureUser.user_id;
      const savedName = res.data?.name || effectiveSignatureUser.name || userName;

      if (uId) {
        localStorage.setItem(`user_signature_${uId}`, finalBase64);
      }

      setEffectiveSignatureUser((prev) => ({
        ...prev,
        signature_base64: finalBase64,
      }));

      if (currentUser && (!uId || currentUser.id === uId)) {
        const updatedUser = {
          ...currentUser,
          signature_base64: finalBase64,
        };
        try {
          localStorage.setItem('user', JSON.stringify(updatedUser));
        } catch (e) {}
        setCurrentUser(updatedUser);
      }

      window.dispatchEvent(new Event('auth-change'));

      setSaveSuccessMsg(`¡Firma digital guardada exitosamente para ${savedName}! Se estampará en los recibos emitidos.`);
      setTimeout(() => {
        setSaveSuccessMsg(null);
        setIsSignatureModalOpen(false);
      }, 1400);
    } catch (err) {
      console.error('Error guardando firma:', err);
      setSignatureError(
        err.response?.data?.message || 'Hubo un error al guardar la firma digital. Intenta nuevamente.'
      );
    } finally {
      setIsSavingSignature(false);
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 shadow-xs px-4 sm:px-6 flex items-center justify-between select-none relative z-30">
        {/* Sección Izquierda: Botón Hamburguesa Móvil + Logo / Título Corporativo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden p-2 -ml-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition cursor-pointer"
            title="Abrir menú de navegación"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo oficial visible exclusivamente en dispositivos móviles */}
          <div className="lg:hidden flex items-center">
            <img
              src="/logos/logo-transparent.png"
              alt="Vende & más"
              className="h-8 w-auto object-contain max-w-[130px]"
            />
          </div>

          <h2 className="hidden lg:block text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            Gestión Inmobiliaria
          </h2>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Vende & más &bull; Sucúa
          </span>
        </div>

        {/* Sección Derecha: Usuario y Acciones */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Centro de Notificaciones en Tiempo Real (Campanita Dropdown) */}
          <div className="relative" ref={notificationsRef}>
            {(() => {
              const isAdministradorRole = currentRole === 'Administrador' || currentRole === 'Admin';
              const totalBellAlerts = isAdministradorRole
                ? (notificationsData.unread_count + pendingTasksCount)
                : notificationsData.unread_count;

              return (
                <button
                  type="button"
                  onClick={() => {
                    setIsNotificationsOpen((prev) => {
                      const next = !prev;
                      if (next) {
                        fetchNotificationsSummary();
                      }
                      return next;
                    });
                  }}
                  aria-label="Centro de Notificaciones"
                  title={`Centro de Notificaciones (${totalBellAlerts} alertas)`}
                  className={`relative p-2 rounded-md transition cursor-pointer ${
                    isNotificationsOpen
                      ? 'bg-slate-100 text-teal-700'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  {totalBellAlerts > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-xs animate-pulse">
                      {totalBellAlerts > 99 ? '99+' : totalBellAlerts}
                    </span>
                  )}
                </button>
              );
            })()}

            {/* Menú Desplegable de la Campanita */}
            {isNotificationsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Cabecera del Dropdown */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/90">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Centro de Notificaciones
                    </span>
                    {notificationsData.unread_count > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700">
                        {notificationsData.unread_count} nuevas
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    disabled={isMarkingAllRead || notificationsData.unread_count === 0}
                    className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                  >
                    {isMarkingAllRead ? 'Marcando...' : 'Marcar leídas'}
                  </button>
                </div>

                {/* Fila Fija Compacta de Alertas de Mora (Sin listar clientes) */}
                <div
                  onClick={() => {
                    setIsNotificationsOpen(false);
                    navigate('/alertas-mora');
                  }}
                  className="bg-red-50 hover:bg-red-100 border-b border-red-100 px-4 py-2.5 flex items-center justify-between cursor-pointer transition"
                  title="Ver módulo completo de Alertas de Mora"
                >
                  <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Alertas de Mora</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold text-xs shadow-xs">
                    {notificationsData.mora_count}
                  </span>
                </div>

                {/* Si el rol activo es Administrador: Fila compacta rápida Mis Tareas por Realizar */}
                {(currentRole === 'Administrador' || currentRole === 'Admin') && (
                  <div
                    onClick={() => {
                      setIsNotificationsOpen(false);
                      navigate('/tareas');
                    }}
                    className="bg-amber-50 hover:bg-amber-100 border-b border-amber-100 px-4 py-2.5 flex items-center justify-between cursor-pointer transition"
                    title="Ver Mis Tareas Pendientes"
                  >
                    <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
                      <span className="text-sm">📋</span>
                      <span>Mis Tareas por Realizar</span>
                    </div>
                    {pendingTasksCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-xs shadow-xs">
                        {pendingTasksCount}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold text-xs">
                        0
                      </span>
                    )}
                  </div>
                )}

                {/* Lista de Notificaciones Recientes */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notificationsData.notifications.length === 0 ? (
                    <div className="py-8 px-4 text-center">
                      <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-medium text-slate-600">No hay notificaciones recientes</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Te avisaremos sobre nuevos pagos y tareas</p>
                    </div>
                  ) : (
                    notificationsData.notifications.map((notif) => {
                      let iconEmoji = '🔔';
                      let iconBg = 'bg-slate-100 text-slate-600';

                      if (notif.type === 'payment_created') {
                        iconEmoji = '💵';
                        iconBg = 'bg-emerald-100 text-emerald-700';
                      } else if (notif.type === 'payment_voided') {
                        iconEmoji = '🚫';
                        iconBg = 'bg-rose-100 text-rose-700';
                      } else if (notif.type === 'task_assigned') {
                        iconEmoji = '📌';
                        iconBg = 'bg-amber-100 text-amber-700';
                      } else if (notif.type === 'task_completed') {
                        iconEmoji = '✅';
                        iconBg = 'bg-teal-100 text-teal-700';
                      }

                      return (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-3.5 hover:bg-slate-50 cursor-pointer transition flex items-start gap-3 ${
                            !notif.is_read ? 'bg-slate-50/70 font-semibold' : 'opacity-85'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm shadow-2xs ${iconBg}`}
                          >
                            <span>{iconEmoji}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <p
                                className={`text-xs truncate ${
                                  !notif.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                                }`}
                              >
                                {notif.title}
                              </p>
                              {!notif.is_read && (
                                <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" title="No leída" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">{notif.message}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {notif.time_ago ||
                                (notif.created_at
                                  ? new Date(notif.created_at).toLocaleTimeString('es-EC', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : '')}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="h-5 w-[1px] bg-slate-200 hidden sm:block"></div>

          {/* Perfil del Usuario Autenticado con Menú Desplegable */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2.5 p-1 sm:p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer border border-transparent hover:border-slate-200"
              title="Opciones de perfil y firma"
            >
              {/* Avatar con Inicial del Usuario */}
              <div
                className={`w-8 h-8 rounded-md font-bold flex items-center justify-center text-xs border shrink-0 ${
                  isSuperAdmin
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-teal-700 text-white border-teal-700'
                }`}
              >
                {userInitial}
              </div>

              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 leading-tight">
                  {userName}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  {isSuperAdmin ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                      <ShieldCheck className="w-2.5 h-2.5 text-slate-700" />
                      <span>Super Admin</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                      <UserCheck className="w-2.5 h-2.5 text-teal-700" />
                      <span>{currentRole}</span>
                    </span>
                  )}
                </div>
              </div>

              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180 text-slate-900' : ''
                }`}
              />
            </button>

            {/* Menú Desplegable del Perfil */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100">
                {/* Cabecera del usuario */}
                <div className="px-4 py-2.5">
                  <p className="text-xs font-bold text-slate-900 truncate">{userName}</p>
                  {userEmail && (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{userEmail}</p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200">
                      {currentRole}
                    </span>
                    {hasSavedSignature ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Firma Activa</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                        <PenTool className="w-3 h-3 text-amber-600" />
                        <span>Sin Firma</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones del menú */}
                <div className="py-1">
                  <button
                    type="button"
                    onClick={handleOpenSignatureModal}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer text-left"
                  >
                    <PenTool className="w-4 h-4 text-teal-600 shrink-0" />
                    <div className="flex flex-col">
                      <span>Configurar mi Firma</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {hasSavedSignature ? 'Dibujar, subir o eliminar firma' : 'Dibujar o subir imagen para recibos'}
                      </span>
                    </div>
                  </button>
                </div>

                {/* Opción Cerrar Sesión */}
                <div className="py-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer text-left disabled:opacity-50"
                  >
                    {isLoggingOut ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                      <LogOut className="w-4 h-4 shrink-0" />
                    )}
                    <span>{isLoggingOut ? 'Cerrando sesión...' : 'Cerrar Sesión'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MODAL HÍBRIDO PARA CONFIGURACIÓN DE FIRMA DIGITAL DEL ASESOR */}
      {isSignatureModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <PenTool className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    Firma Digital de: <span className="text-teal-700 font-extrabold">{effectiveSignatureUser.name || userName}</span> ({effectiveSignatureUser.role || currentRole})
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Firma independiente por usuario para emisión de recibos oficiales
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isSavingSignature && !isDeletingSignature) {
                    setIsSignatureModalOpen(false);
                    setSignatureError(null);
                    setSaveSuccessMsg(null);
                  }
                }}
                disabled={isSavingSignature || isDeletingSignature}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 space-y-4 max-h-[calc(85vh-120px)] overflow-y-auto">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[12px] text-blue-900 flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  Esta firma digital se estampará automáticamente en la <strong>columna derecha</strong> de todos los recibos oficiales en PDF que emitas en el sistema.
                </p>
              </div>

              {/* GESTIÓN DE ESTADO ACTUAL: Si ya tiene firma registrada, mostrar preview y botón eliminar */}
              {isLoadingSignature ? (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/80 flex items-center justify-center gap-2 text-slate-500 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                  <span>Cargando firma registrada de {effectiveSignatureUser.name || userName}...</span>
                </div>
              ) : hasSavedSignature ? (
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/80 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Firma Actual de: <strong>{effectiveSignatureUser.name || userName}</strong></span>
                    </span>
                    <button
                      type="button"
                      onClick={handleDeleteCurrentSignature}
                      disabled={isDeletingSignature || isSavingSignature}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition cursor-pointer disabled:opacity-50"
                      title="Eliminar la firma registrada actualmente"
                    >
                      {isDeletingSignature ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Eliminando...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Eliminar Firma Actual</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-center min-h-[70px]">
                    <img
                      src={effectiveSignatureUser.signature_base64}
                      alt={`Firma actual de \${effectiveSignatureUser.name || userName}`}
                      className="max-h-16 max-w-[220px] object-contain"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 text-center">
                    Puedes dibujar o subir una nueva imagen para reemplazarla, o eliminarla para emitir recibos sin firma digital.
                  </p>
                </div>
              ) : (
                <div className="border border-dashed border-amber-200 rounded-xl p-3 bg-amber-50/50 text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span><strong>{effectiveSignatureUser.name || userName}</strong> ({effectiveSignatureUser.role || currentRole}) no tiene firma registrada. Puedes configurarla a continuación.</span>
                </div>
              )}

              {/* Mensaje de Éxito */}
              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-xs font-semibold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Mensaje de Error */}
              {signatureError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs font-semibold animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{signatureError}</span>
                </div>
              )}

              {/* PESTAÑAS / SECCIONES: Opción A (Dibujar) y Opción B (Subir Imagen) */}
              <div>
                <div className="flex border-b border-slate-200 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSignatureMode('draw');
                      setSignatureError(null);
                    }}
                    className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
                      signatureMode === 'draw'
                        ? 'border-slate-900 text-slate-900 bg-slate-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Opción A: Dibujar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSignatureMode('upload');
                      setSignatureError(null);
                    }}
                    className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
                      signatureMode === 'upload'
                        ? 'border-slate-900 text-slate-900 bg-slate-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Opción B: Subir Imagen (PNG/JPG)</span>
                  </button>
                </div>

                {/* OPCIÓN A: DIBUJAR EN EL LIENZO */}
                {signatureMode === 'draw' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-600">
                        Dibuja con ratón o pantalla táctil
                      </span>
                      <button
                        type="button"
                        onClick={handleClearSignature}
                        disabled={isSavingSignature}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rose-600 transition cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Limpiar Trazo</span>
                      </button>
                    </div>

                    <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden relative shadow-inner">
                      <SignatureCanvas
                        ref={sigCanvasRef}
                        penColor="#0f172a"
                        canvasProps={{
                          className: 'w-full h-40 bg-transparent cursor-crosshair',
                        }}
                      />
                      <div className="absolute bottom-2.5 right-3 pointer-events-none text-[10px] text-slate-400 uppercase tracking-widest font-mono select-none">
                        PAD DE FIRMA &bull; VENDE & MÁS
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Realiza el trazo continuo de tu rúbrica en el recuadro blanco.
                    </p>
                  </div>
                )}

                {/* OPCIÓN B: SUBIR IMAGEN */}
                {signatureMode === 'upload' && (
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleImageFileChange}
                      className="hidden"
                      id="signature-file-upload-input"
                    />

                    {!uploadedImageBase64 ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 hover:border-teal-500 hover:bg-teal-50/30 rounded-xl p-6 text-center cursor-pointer transition bg-slate-50 flex flex-col items-center justify-center gap-2 group"
                      >
                        <div className="w-12 h-12 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-teal-600 group-hover:border-teal-300 transition">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            Haz clic aquí para seleccionar el archivo de tu firma
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Formatos admitidos: <strong>PNG o JPG</strong> (máximo 5 MB)
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium bg-white px-2 py-0.5 rounded border border-slate-200">
                          Recomendado: fondo transparente o blanco limpio
                        </span>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 truncate">
                            <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                            <span className="truncate">{uploadedFileName || 'Imagen seleccionada'}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                          >
                            Cambiar imagen
                          </button>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-center min-h-[110px] max-h-40 overflow-hidden">
                          <img
                            src={uploadedImageBase64}
                            alt="Vista previa de firma"
                            className="max-h-36 max-w-full object-contain mx-auto"
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5 text-center">
                          Vista previa de la firma que se estampará en los recibos oficiales.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Pie del Modal con Botones */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <div>
                {signatureMode === 'draw' && (
                  <button
                    type="button"
                    onClick={handleClearSignature}
                    disabled={isSavingSignature || isDeletingSignature}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Limpiar</span>
                  </button>
                )}
                {signatureMode === 'upload' && uploadedImageBase64 && (
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedImageBase64(null);
                      setUploadedFileName('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    disabled={isSavingSignature || isDeletingSignature}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Quitar</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(false)}
                  disabled={isSavingSignature || isDeletingSignature}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveSignature}
                  disabled={isSavingSignature || isDeletingSignature}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:bg-black rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isSavingSignature ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Guardar Firma</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
