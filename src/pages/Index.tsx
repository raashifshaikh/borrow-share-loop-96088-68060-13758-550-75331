import { Navigation } from "@/components/Navigation";
import { HeroSection } from "@/components/HeroSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pb-16">
        <HeroSection />
      </main>
    </div>
  );
};

export default Index;