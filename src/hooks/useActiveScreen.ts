import { useCallback, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { createScreenActivity } from "@/lib/screenActivity";

export function useActiveFocusEffect(effect: () => void | (() => void)) {
  useFocusEffect(useCallback(() => {
    const activity = createScreenActivity(effect);
    activity.update(true, AppState.currentState === "active");
    const subscription = AppState.addEventListener("change", (state) => activity.update(true, state === "active"));
    return () => { subscription.remove(); activity.dispose(); };
  }, [effect]));
}

export function useScreenActive() {
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; };
  }, []));
  return useCallback(() => focused.current && AppState.currentState === "active", []);
}
