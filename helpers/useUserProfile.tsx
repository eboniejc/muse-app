import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserProfile } from "../endpoints/user/profile_GET.schema";
import { postUserProfile, InputType } from "../endpoints/user/profile_POST.schema";
import { toast } from "sonner";

export const USER_PROFILE_QUERY_KEY = ["user", "profile"] as const;

export const useUserProfile = () => {
  return useQuery({
    queryKey: USER_PROFILE_QUERY_KEY,
    queryFn: async () => {
      const data = await getUserProfile();
      return data.profile;
    },
  });
};

export const useUpdateUserProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InputType) => {
      return await postUserProfile(data);
    },
    onSuccess: () => {
      toast.success("Profile updated successfully");
      queryClient.invalidateQueries({ queryKey: USER_PROFILE_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    },
  });
};