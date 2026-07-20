import { usePageContext } from "../context/PageContext";

export function usePages() {
  return usePageContext();
}

export default usePages;
