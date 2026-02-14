import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./DropdownMenu";
import { Avatar, AvatarFallback, AvatarImage } from "./Avatar";
import { Button } from "./Button";
import { useAuth } from "../helpers/useAuth";
import { LogOut, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const UserDropdown = () => {
  const { authState, logout } = useAuth();
  const navigate = useNavigate();

  if (authState.type !== "authenticated") return null;

  const { user } = authState;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 w-10 rounded-full p-0">
          <Avatar>
            <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName} />
            <AvatarFallback>{user.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span>{user.displayName}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 'normal' }}>{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/dashboard")}>
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Dashboard</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-500 focus:text-red-500">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};