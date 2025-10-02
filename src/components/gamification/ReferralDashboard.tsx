import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, Users } from 'lucide-react';
import { toast } from 'sonner';

export const ReferralDashboard = () => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: referralCount = 0 } = useQuery({
    queryKey: ['referral-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', user.id)
        .eq('status', 'completed');
      return count || 0;
    },
    enabled: !!user?.id,
  });

  const referralLink = profile?.referral_code 
    ? `${window.location.origin}/?ref=${profile.referral_code}`
    : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Refer Friends & Earn Rewards</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="text-2xl font-bold text-primary">{referralCount}</div>
            <div className="text-sm text-muted-foreground">Successful Referrals</div>
          </div>
          
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="text-2xl font-bold text-primary">{referralCount * 100} XP</div>
            <div className="text-sm text-muted-foreground">XP Earned from Referrals</div>
          </div>
        </div>

        {profile?.referral_code && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Referral Link</label>
            <div className="flex gap-2">
              <Input
                value={referralLink}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                onClick={copyToClipboard}
                variant="outline"
                size="icon"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="pt-4 border-t space-y-2">
          <h4 className="font-semibold text-sm">Referral Rewards</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Both you and your friend get 100 XP instantly</li>
            <li>• Earn badges for referring 1, 5, 10, 20, and 50 users</li>
            <li>• Increase your trust score with each referral</li>
            <li>• Unlock exclusive features at higher referral tiers</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};
