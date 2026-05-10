import { SupabaseLoginButton } from "./SupabaseLoginButton";
import styles from "./OAuthButtonGroup.module.css";

interface OAuthButtonGroupProps {
  className?: string;
  disabled?: boolean;
}

export const OAuthButtonGroup = ({
  className,
  disabled,
}: OAuthButtonGroupProps) => {
  return (
    <div className={`${styles.container} ${className || ""}`}>
      <SupabaseLoginButton disabled={disabled} />
      {/* Add more buttons here for other oauth providers as needed */}
    </div>
  );
};
