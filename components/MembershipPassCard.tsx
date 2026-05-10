import React from "react";
import styles from "./MembershipPassCard.module.css";

interface MembershipPassCardProps {
  name: string;
  price: string;
  imageUrl: string;
}

export const MembershipPassCard: React.FC<MembershipPassCardProps> = ({ name, price, imageUrl }) => {
  return (
    <div className={styles.card}>
      <img src={imageUrl} alt={name} className={styles.image} loading="lazy" />
      <div className={styles.body}>
        <div className={styles.badge}>Membership Pass</div>
        <h3 className={styles.name}>{name}</h3>
        <div className={styles.price}>{price}</div>
      </div>
    </div>
  );
};
