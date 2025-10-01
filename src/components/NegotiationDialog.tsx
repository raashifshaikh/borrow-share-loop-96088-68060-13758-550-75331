import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface NegotiationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: any;
  quantity: number;
  notes: string;
}

export const NegotiationDialog = ({
  open,
  onOpenChange,
  listing,
  quantity,
  notes
}: NegotiationDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [offerAmount, setOfferAmount] = useState(listing.price * quantity);
  const [offerMessage, setOfferMessage] = useState('');

  const createOrderWithNegotiationMutation = useMutation({
    mutationFn: async () => {
      // Create the order first
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          buyer_id: user?.id,
          seller_id: listing.seller_id,
          listing_id: listing.id,
          original_price: listing.price,
          negotiated_price: offerAmount / quantity,
          final_amount: offerAmount,
          quantity,
          notes,
          status: 'pending'
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create negotiation record
      const { error: negError } = await supabase
        .from('order_negotiations')
        .insert([{
          order_id: order.id,
          from_user_id: user?.id,
          action: 'offer',
          amount: offerAmount / quantity,
          message: offerMessage
        }]);

      if (negError) throw negError;

      return order;
    },
    onSuccess: () => {
      toast({
        title: 'Offer sent!',
        description: 'The seller will review your offer'
      });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onOpenChange(false);
      navigate('/orders');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send offer',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make an Offer</DialogTitle>
          <DialogDescription>
            The listed price is ${listing.price} per unit. Make your best offer for {quantity} unit(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="offer">Your Offer</Label>
            <Input
              id="offer"
              type="number"
              step="0.01"
              value={offerAmount}
              onChange={(e) => setOfferAmount(parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              ${(offerAmount / quantity).toFixed(2)} per unit
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Explain why you're offering this price..."
              value={offerMessage}
              onChange={(e) => setOfferMessage(e.target.value)}
            />
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Original Price:</span>
              <span>${(listing.price * quantity).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Your Offer:</span>
              <span className="font-bold text-primary">${offerAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Savings:</span>
              <span className="text-green-600">
                ${((listing.price * quantity) - offerAmount).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createOrderWithNegotiationMutation.mutate()}
            disabled={createOrderWithNegotiationMutation.isPending || offerAmount <= 0}
          >
            Send Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
