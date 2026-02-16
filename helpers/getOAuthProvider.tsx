import { OAuthProviderInterface, OAuthProviderType } from "./OAuthProvider";
import { OAuthProvider } from "./FlootOAuthProvider";

export function getOAuthProvider(
  providerName: OAuthProviderType,
  redirectUri: string
): OAuthProviderInterface {
  // For now we have a single generic provider implementation.
  // When multiple providers are added, dispatch on providerName here.
  return new OAuthProvider(redirectUri);
}
