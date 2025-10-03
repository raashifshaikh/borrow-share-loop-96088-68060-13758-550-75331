import { NavLink, useLocation } from "react-router-dom";
import { 
  Home, 
  Package, 
  MessageSquare, 
  User, 
  Settings,
  Plus,
  Search,
  ShoppingBag,
  Heart,
  Bell,
  Trophy
} from "lucide-react";
import logo from "@/assets/borrowpal-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Browse", url: "/browse", icon: Search },
  { title: "My Listings", url: "/my-listings", icon: Package },
  { title: "Orders", url: "/orders", icon: ShoppingBag },
  { title: "Messages", url: "/messages", icon: MessageSquare },
  { title: "Achievements", url: "/gamification", icon: Trophy },
  { title: "Favorites", url: "/favorites", icon: Heart },
  { title: "Notifications", url: "/notifications", icon: Bell },
];

const accountItems = [
  { title: "Profile", url: "/profile", icon: User },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";

  const isActive = (path: string) => location.pathname === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        <div className="p-4">
          <NavLink to="/dashboard" className="block">
            {collapsed ? (
              <div className="flex items-center justify-center">
                <img src={logo} alt="BP" className="h-8 w-8 object-contain" />
              </div>
            ) : (
              <img src={logo} alt="BorrowPal" className="h-10 w-auto" />
            )}
          </NavLink>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accountItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4">
          <SidebarMenuButton asChild>
            <NavLink 
              to="/create-listing" 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 justify-center"
            >
              <Plus className="h-4 w-4" />
              {!collapsed && <span>New Listing</span>}
            </NavLink>
          </SidebarMenuButton>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}