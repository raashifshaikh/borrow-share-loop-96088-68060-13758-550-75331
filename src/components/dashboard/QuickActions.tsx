import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Search, MessageSquare, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

export const QuickActions = () => {
  const actions = [
    {
      title: "Create Listing",
      description: "Share an item or offer a service",
      icon: Plus,
      href: "/create-listing",
      variant: "default" as const
    },
    {
      title: "Browse Items",
      description: "Find what you need to borrow",
      icon: Search,
      href: "/browse",
      variant: "outline" as const
    },
    {
      title: "Check Messages",
      description: "View your conversations",
      icon: MessageSquare,
      href: "/messages",
      variant: "outline" as const
    },
    {
      title: "Manage Listings",
      description: "Edit your active listings",
      icon: Package,
      href: "/my-listings",
      variant: "outline" as const
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => (
            <Link key={action.title} to={action.href}>
              <Button 
                variant={action.variant} 
                className="w-full h-auto flex-col gap-2 p-4"
                size="lg"
              >
                <action.icon className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-medium">{action.title}</div>
                  <div className="text-xs text-muted-foreground">{action.description}</div>
                </div>
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};