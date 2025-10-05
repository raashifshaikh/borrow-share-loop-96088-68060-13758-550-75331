import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NotificationBell } from './NotificationBell';

export const Header = () => {
  const { signOut, user } = useAuth();

  return (
    <header className="border-b border-border bg-card px-3 sm:px-6 py-3 flex items-center justify-between">
      <SidebarTrigger />
      
      <div className="flex items-center gap-2">
        <NotificationBell />
        <Link to="/profile">
          <Button variant="ghost" size="sm" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{user?.email}</span>
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};
