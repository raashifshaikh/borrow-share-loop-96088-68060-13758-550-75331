import { Button } from "@/components/ui/button";

export const Navigation = () => {
  return (
    <nav className="flex items-center justify-between px-8 py-6">
      <div className="flex items-center space-x-8">
        <h1 className="text-2xl font-bold text-foreground">BorrowPal</h1>
        <div className="hidden md:flex items-center space-x-8">
          <a href="#" className="nav-link">Explore</a>
          <a href="#" className="nav-link">Create</a>
          <a href="#" className="nav-link">Post</a>
          <a href="#" className="nav-link">App</a>
          <a href="#" className="nav-link">Sign in</a>
        </div>
      </div>
      <Button variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-full">
        Dashboard
      </Button>
    </nav>
  );
};