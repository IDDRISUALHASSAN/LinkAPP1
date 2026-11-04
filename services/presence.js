import { useEffect, useState } from "react";

export function usePresenceClock() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(intervalId);
  }, []);

  return now;
}

export function formatLastSeen(value, now = Date.now()) {
  if (!value) return "Offline";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Offline";

  const elapsedSeconds = Math.max(0, (now - timestamp) / 1000);
  if (elapsedSeconds < 60) return "just now";

  const units = [
    ["year", 365 * 24 * 60 * 60],
    ["month", 30 * 24 * 60 * 60],
    ["day", 24 * 60 * 60],
    ["hour", 60 * 60],
    ["minute", 60],
  ];

  const [unit, secondsPerUnit] = units.find(
    ([, seconds]) => elapsedSeconds >= seconds,
  );
  const amount = Math.floor(elapsedSeconds / secondsPerUnit);
  return `${amount} ${unit}${amount === 1 ? "" : "s"} ago`;
}
