import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

function readUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);

  useEffect(() => {
    const syncUser = () => setUser(readUser());
    window.addEventListener('storage', syncUser);
    window.addEventListener('auth-change', syncUser);
    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('auth-change', syncUser);
    };
  }, []);

  function updateUser(attributes, notify = true) {
    const storedUser = readUser();
    if (!storedUser || (attributes.id != null && attributes.id !== storedUser.id)) return;

    const updatedUser = { ...storedUser, ...attributes };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    if (notify) window.dispatchEvent(new Event('auth-change'));
  }

  return (
    <AuthContext.Provider value={{ user, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
