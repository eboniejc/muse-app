import { useQuery } from "@tanstack/react-query";
import { getEbooks } from "../endpoints/ebooks/list_GET.schema";

export const useEbooks = () => {
  return useQuery({
    queryKey: ["ebooks", "list"],
    queryFn: async () => {
      const data = await getEbooks();
      return data.ebooks;
    },
  });
};