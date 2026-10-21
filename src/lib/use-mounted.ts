import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False on the server and while hydrating, true afterwards. For text the browser and the
 * server may write differently (country and currency names come from each one's Intl data).
 */
export function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
