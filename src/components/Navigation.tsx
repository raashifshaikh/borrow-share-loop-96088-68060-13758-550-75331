import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export const Navigation = () => {
  return (
    <nav className="flex items-center justify-between px-8 py-6">
      <div className="flex items-center space-x-8">
        <h1 className="text-2xl font-bold text-foreground">BorrowPal</h1>
        <div className="hidden md:flex items-center space-x-8">
          <a href="#browse" className="nav-link">Explore</a>
          <a href="#features" className="nav-link">Features</a>
          <a href="#how-it-works" className="nav-link">How it Works</a>
          <Link to="/auth" className="nav-link">Sign in</Link>
        </div>
      </div>
      <Link to="/auth">
        <Button variant="default" className="px-6 py-2 rounded-full">
          Get Started
        </Button>
      </Link>
    </nav>
  );
};