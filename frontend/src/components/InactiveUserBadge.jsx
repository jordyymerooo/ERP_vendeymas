export function isUserInactive(user) {
  return Boolean(user?.deleted_at) || user?.is_active === false;
}

export default function InactiveUserBadge({ user }) {
  if (!isUserInactive(user)) return null;

  return (
    <span className="inline-flex shrink-0 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
      Inactivo
    </span>
  );
}
