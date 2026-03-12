import React from "react";
import styles from "./BrandMark.module.css";

type BrandMarkProps = {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  logoSrc?: string;
};

export const BrandMark: React.FC<BrandMarkProps> = ({
  className,
  showText,
  size = "md",
  logoSrc,
}) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  const resolvedLogoSrc =
    logoSrc || (import.meta as any)?.env?.VITE_BRAND_LOGO_URL || "/brand-logo.png";
  const envIsLockup =
    String((import.meta as any)?.env?.VITE_BRAND_LOGO_IS_LOCKUP ?? "")
      .toLowerCase()
      .trim() === "true";
  const envNeedsBackplate =
    String((import.meta as any)?.env?.VITE_BRAND_LOGO_BACKPLATE ?? "")
      .toLowerCase()
      .trim() === "true";

  // Default behavior:
  // - mark-only image: show text
  // - lockup image: hide text
  // - image failed: show text with fallback SVG
  const effectiveShowText =
    typeof showText === "boolean" ? showText : imgFailed ? true : !envIsLockup;

  return (
    <div
      className={`${styles.brand} ${!imgFailed ? styles.hasImg : ""} ${
        envNeedsBackplate ? styles.backplate : ""
      } ${className ?? ""}`}
      data-size={size}
    >
      <span className={styles.mark} aria-hidden>
        {!imgFailed ? (
          <img
            src={resolvedLogoSrc}
            alt=""
            className={styles.img}
            onError={() => setImgFailed(true)}
            decoding="async"
            loading="eager"
          />
        ) : (
          <svg
            viewBox="0 0 100 100"
            className={styles.svg}
            role="img"
            aria-label="MUSE INC logo mark"
          >
            <path d="M22 22 H78" className={styles.stroke} />
            <path d="M16 30 L50 84 L84 30" className={styles.stroke} />
            <path d="M33 34 H67" className={styles.strokeThin} />
            <path d="M31 40 L50 70 L69 40" className={styles.strokeThin} />
            <circle cx="50" cy="50" r="4.8" fill="currentColor" />
          </svg>
        )}
      </span>
      {effectiveShowText ? <span className={styles.wordmark}>MUSE INC</span> : null}
    </div>
  );
};
