import React from "react";
import styles from "./BrandMark.module.css";

type BrandMarkProps = {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
};

export const BrandMark: React.FC<BrandMarkProps> = ({
  className,
  showText = true,
  size = "md",
}) => {
  return (
    <div className={`${styles.brand} ${className ?? ""}`} data-size={size}>
      <span className={styles.mark} aria-hidden>
        <svg
          viewBox="0 0 100 100"
          className={styles.svg}
          role="img"
          aria-label="MUSE INC logo mark"
        >
          <path
            d="M22 22 H78"
            className={styles.stroke}
          />
          <path
            d="M16 30 L50 84 L84 30"
            className={styles.stroke}
          />
          <path
            d="M33 34 H67"
            className={styles.strokeThin}
          />
          <path
            d="M31 40 L50 70 L69 40"
            className={styles.strokeThin}
          />
          <circle cx="50" cy="50" r="4.8" fill="currentColor" />
        </svg>
      </span>
      {showText ? <span className={styles.wordmark}>MUSE INC</span> : null}
    </div>
  );
};
