import React, { createContext, useContext, useMemo, useState } from "react";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [items, setItems] = useState([]);

  const addNotification = (text) => {
    if (!text) return;
    setItems((prev) => [{ id: Date.now(), text }, ...prev].slice(0, 20));
  };

  const clear = () => setItems([]);

  const value = useMemo(() => ({ items, addNotification, clear }), [items]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationContext);
}

