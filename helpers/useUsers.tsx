import { useQuery } from "@tanstack/react-query";
import superjson from "superjson";

export type UserSummary = { id: number; displayName: string | null; email: string };

export const useUsers = () => {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async (): Promise<UserSummary[]> => {
      const res = await fetch("/_api/admin/users/list");
      if (!res.ok) return [];
      const data = superjson.parse<{ users: any[] }>(await res.text());
      return (data.users ?? []).map((u: any) => ({
        id: u.id,
        displayName: u.displayname ?? u.displayName ?? null,
        email: u.email,
      }));
    },
  });
};
