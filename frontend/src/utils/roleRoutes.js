export function getHomeRouteByRole(role) {
  switch (role) {
    case 'Super Admin':
      return '/dashboard';
    case 'Administrador':
    case 'Asesor Comercial':
      return '/proyectos';
    case 'Topógrafo':
    case 'Topografo':
      return '/topografia';
    default:
      return '/login';
  }
}

export function getAuthenticatedRole(user) {
  const roles = Array.isArray(user?.roles) ? user.roles.map((role) => role.name || role) : [];
  return roles.includes('Super Admin') ? 'Super Admin' : roles[0] || user?.role;
}
