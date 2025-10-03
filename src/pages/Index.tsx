import { Navigation } from "@/components/Navigation";
import { HeroSection } from "@/components/HeroSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Package, MessageSquare, Shield, Sparkles, QrCode, Repeat } from "lucide-react";

const Index = () => {
  const features = [
    {
      icon: Package,
      title: "Borrow & Lend",
      description: "Access items you need without buying. Share what you have and earn."
    },
    {
      icon: QrCode,
      title: "QR Code Verification",
      description: "Secure handover process with QR code scanning for delivery and returns."
    },
    {
      icon: MessageSquare,
      title: "Direct Messaging",
      description: "Chat with owners, negotiate prices, and coordinate seamlessly."
    },
    {
      icon: Shield,
      title: "Secure Payments",
      description: "Protected transactions through Stripe with buyer protection."
    },
    {
      icon: Sparkles,
      title: "Gamification",
      description: "Earn XP, unlock badges, and level up as you participate in the community."
    },
    {
      icon: Repeat,
      title: "Circular Economy",
      description: "Reduce waste and promote sustainable consumption patterns."
    }
  ];

  const howItWorks = [
    { step: 1, title: "Browse Items", description: "Explore available items and services in your area" },
    { step: 2, title: "Place Order", description: "Request to borrow with your preferred terms" },
    { step: 3, title: "Owner Accepts", description: "Owner reviews and accepts your request" },
    { step: 4, title: "Chat & Negotiate", description: "Discuss details and negotiate if needed" },
    { step: 5, title: "Pay Securely", description: "Complete payment through our secure platform" },
    { step: 6, title: "QR Handover", description: "Scan QR code at pickup and return for verification" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pb-16">
        <HeroSection />

        {/* Explore Section */}
        <section id="browse" className="px-8 py-16 scroll-mt-24">
          <div className="max-w-6xl mx-auto text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Explore What's Available</h2>
            <p className="text-xl text-muted-foreground mb-8">
              From power tools to party supplies, find what you need nearby
            </p>
            <Link to="/browse">
              <Button size="lg" className="px-8">
                Start Browsing
              </Button>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="px-8 py-16 bg-muted/30 scroll-mt-24">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-12">Why Choose BorrowPal?</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <feature.icon className="h-12 w-12 text-primary mb-4" />
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="px-8 py-16 scroll-mt-24">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {howItWorks.map((item, index) => (
                <div key={index} className="relative">
                  <div className="flex flex-col items-center text-center p-6">
                    <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mb-4">
                      {item.step}
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </div>
                  {index < howItWorks.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 right-0 w-full h-0.5 bg-border transform translate-x-1/2 -z-10" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-8 py-16 bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4">Ready to Start Borrowing?</h2>
            <p className="text-xl mb-8 opacity-90">
              Join thousands of users sharing and saving together
            </p>
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="px-8">
                Get Started for Free
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;