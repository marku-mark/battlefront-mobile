export function createScreenActivity(effect: () => void | (() => void)) {
  let running = false;
  let cleanup: void | (() => void);
  return {
    update(focused: boolean, foreground: boolean) {
      const active = focused && foreground;
      if (active === running) return;
      running = active;
      if (active) cleanup = effect();
      else { cleanup?.(); cleanup = undefined; }
    },
    dispose() { running = false; cleanup?.(); cleanup = undefined; },
  };
}
