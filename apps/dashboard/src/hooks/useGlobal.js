import { useGlobalContext } from "../context/GlobalContext";

export function useGlobal() {
  return useGlobalContext();
}

export default useGlobal;
