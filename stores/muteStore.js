import { useCallback, useEffect, useState } from "react";

let listeners = new Set();
let _isMuted = false;

export const muteStore = {
  get isMuted() {
    return _isMuted;
  },
  setMuted(value) {
    _isMuted = value;
    listeners.forEach((listener) => listener(value));
  },
  toggle() {
    _isMuted = !_isMuted;
    listeners.forEach((listener) => listener(_isMuted));
  },
  subscribe(listener) {
    listeners.add(listener);
    listener(_isMuted);
    return () => listeners.delete(listener);
  },
};

export function useMuteStore() {
  const [isMuted, setIsMuted] = useState(muteStore.isMuted);

  useEffect(() => {
    return muteStore.subscribe(setIsMuted);
  }, []);

  const setMuted = useCallback((value) => muteStore.setMuted(value), []);
  const toggleMuted = useCallback(() => muteStore.toggle(), []);

  return { isMuted, setMuted, toggleMuted };
}

export default muteStore;
