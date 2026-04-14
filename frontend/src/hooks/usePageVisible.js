import { useState, useEffect } from "react";

/**
 * Returns `true` when the browser tab is in the foreground (visible),
 * `false` when the user has switched to another tab.
 *
 * Components can use this to pause sockets, polling, and microphone
 * access when the tab is hidden — preventing resource contention
 * across multiple open tabs.
 */
export default function usePageVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");

  useEffect(() => {
    const handler = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return visible;
}
