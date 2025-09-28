import hoarderIllustration from "@/assets/hoarder-illustration.png";
import relaxedPersonIllustration from "@/assets/relaxed-person-illustration.png";

export const HeroSection = () => {
  return (
    <div className="space-y-0">
      {/* First Hero Section - The Hoarder */}
      <section className="bg-hero-bg rounded-3xl mx-8 mb-8 p-16 flex items-center justify-between min-h-[600px]">
        <div className="flex-1 max-w-lg">
          <img 
            src={hoarderIllustration} 
            alt="Person surrounded by cluttered items and belongings"
            className="w-full h-auto"
          />
        </div>
        <div className="flex-1 text-right">
          <h2 className="hero-title mb-6">
            The<br />
            Hoarder
          </h2>
          <p className="hero-subtitle">Or just borrow and live free</p>
        </div>
      </section>

      {/* Second Hero Section - Owning is overrated */}
      <section className="bg-hero-bg rounded-3xl mx-8 p-16 flex items-center justify-between min-h-[600px]">
        <div className="flex-1 pr-16">
          <h2 className="hero-title mb-8 leading-tight">
            Owning is<br />
            overrated.<br />
            <span className="text-primary">BorrowPal:</span>
          </h2>
          <p className="hero-subtitle">Because sanity matters.</p>
        </div>
        <div className="flex-1 max-w-lg">
          <img 
            src={relaxedPersonIllustration} 
            alt="Relaxed person sitting with smartphone showing BorrowPal app"
            className="w-full h-auto"
          />
        </div>
      </section>
    </div>
  );
};