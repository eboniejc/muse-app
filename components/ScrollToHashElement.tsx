import { useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";

export const ScrollToHashElement = () => {
  const location = useLocation();

  const hashElement = useMemo(() => {
    const hash = location.hash;
    if (hash) {
      return document.getElementById(hash.slice(1));
    }
    return null;
  }, [location]);

  useEffect(() => {
    if (hashElement) {
      hashElement.scrollIntoView({
        behavior: "smooth",
        inline: "nearest",
      });
    }
  }, [hashElement]);

  return null;
};
