import { useEffect, useState } from "react";

type TimeLeft = {
  hours: string;
  minutes: string;
  seconds: string;
  isDone: boolean;
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function useCountdown(target: Date): TimeLeft {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => diff(target));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(diff(target));
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  return timeLeft;
}

function diff(target: Date): TimeLeft {
  const totalMs = target.getTime() - Date.now();
  if (totalMs <= 0) {
    return { hours: "00", minutes: "00", seconds: "00", isDone: true };
  }
  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
    isDone: false,
  };
}
