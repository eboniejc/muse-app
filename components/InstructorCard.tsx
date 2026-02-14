import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "./Avatar";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { MessageCircle } from "lucide-react";
import { Instructor } from "../endpoints/instructors/list_GET.schema";
import styles from "./InstructorCard.module.css";

interface InstructorCardProps {
  instructor: Instructor;
}

export const InstructorCard: React.FC<InstructorCardProps> = ({ instructor }) => {
  const initials = instructor.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const whatsappUrl = instructor.whatsappNumber
    ? `https://wa.me/${instructor.whatsappNumber.replace(/\D/g, "")}`
    : null;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <Avatar className={styles.avatar}>
          <AvatarImage src={instructor.avatarUrl || undefined} alt={instructor.displayName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className={styles.info}>
          <h3 className={styles.name}>{instructor.displayName}</h3>
          <Badge variant="secondary" className={styles.badge}>Instructor</Badge>
        </div>
      </div>
      
            <div className={styles.actions}>
        {whatsappUrl ? (
          <Button 
            className={styles.whatsappButton}
            size="sm"
            onClick={() => (window.top || window).open(whatsappUrl, "_blank")}
          >
              <MessageCircle size={16} />
              Chat on WhatsApp
          </Button>
        ) : (
          <Button disabled size="sm" variant="outline" className={styles.disabledButton}>
            <MessageCircle size={16} />
            No Contact Info
          </Button>
        )}
      </div>
    </div>
  );
};