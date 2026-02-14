import React from "react";
import { useRooms } from "../helpers/useRooms";
import { Skeleton } from "./Skeleton";
import { Badge } from "./Badge";
import { Users, Speaker } from "lucide-react";
import styles from "./RoomList.module.css";

interface RoomListProps {
  selectedRoomId: number | null;
  onSelectRoom: (roomId: number) => void;
}

export const RoomList: React.FC<RoomListProps> = ({ selectedRoomId, onSelectRoom }) => {
  const { data: rooms, isLoading } = useRooms();

  if (isLoading) {
    return (
      <div className={styles.list}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {rooms?.map((room) => (
        <button
          key={room.id}
          className={`${styles.card} ${selectedRoomId === room.id ? styles.selected : ""}`}
          onClick={() => onSelectRoom(room.id)}
        >
          <div className={styles.header}>
            <h3 className={styles.name}>{room.name}</h3>
            <Badge variant={room.isActive ? "success" : "secondary"} className={styles.badge}>
              {room.roomType}
            </Badge>
          </div>
          <p className={styles.description}>{room.description}</p>
          <div className={styles.meta}>
            <div className={styles.metaItem}>
              <Users size={14} />
              <span>Cap: {room.capacity}</span>
            </div>
            <div className={styles.metaItem}>
              <Speaker size={14} />
              <span>{room.equipment?.length || 0} items</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};