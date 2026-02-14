import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "./Tooltip";
import { ThemeModeProvider } from "../helpers/themeMode";
import { SonnerToaster } from "./SonnerToaster";
import { ScrollToHashElement } from "./ScrollToHashElement";
import { AuthProvider } from "../helpers/useAuth";
import "../helpers/i18n";
import { useOneSignal } from "../helpers/useOneSignal";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  },
});

const OneSignalInitializer = () => {
  useOneSignal();
  return null;
};

export const GlobalContextProviders = ({
  children,
}: {
  children: ReactNode;
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <ScrollToHashElement />
        <AuthProvider>
          <OneSignalInitializer />
          <TooltipProvider>
            {children}
            <SonnerToaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeModeProvider>
    </QueryClientProvider>
  );
};
