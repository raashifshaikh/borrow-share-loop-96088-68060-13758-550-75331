import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import logo from "@/assets/borrowpal-logo.png";

export const Navigation = () => {
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.querySelector(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="flex items-center justify-between px-8 py-6 sticky top-0 bg-background/95 backdrop-blur-sm z-50 border-b">
      <div className="flex items-center space-x-8">
        <Link to="/" className="flex items-center space-x-2">
          <img src={logo} alt="BorrowPal" className="h-10 w-auto" />
        </Link>
        <div className="hidden md:flex items-center space-x-8">
          <a href="#browse" onClick={(e) => scrollToSection(e, '#browse')} className="nav-link">Explore</a>
          <a href="#features" onClick={(e) => scrollToSection(e, '#features')} className="nav-link">Features</a>
          <a href="#how-it-works" onClick={(e) => scrollToSection(e, '#how-it-works')} className="nav-link">How it Works</a>
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