import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { Send, MessageSquare, Package, DollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const Messages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order');
  const sellerId = searchParams.get('seller');
  const listingId = searchParams.get('listing');

  const [selectedConversation, setSelectedConversation] = useState<{ sellerId: string, listingId: string, orderId?: string } | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNegotiationDialog, setShowNegotiationDialog] = useState(false);
  const [negotiationAmount, setNegotiationAmount] = useState('');
  const [negotiationMessage, setNegotiationMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Fetch possible chats (all buyers/sellers per listing)
  const { data: possibleChats } = useQuery({
    queryKey: ['possible-chats', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // As seller
      const { data: selling } = await supabase
        .from('listings')
        .select('id, title, seller_id, profiles(name, avatar_url)')
        .eq('seller_id', user.id);

      const chats: any[] = [];

      if (selling) {
        for (const listing of selling) {
          const { data: buyers } = await supabase
            .from('orders')
            .select('buyer_id, id as order_id, profiles(name, avatar_url)')
            .eq('listing_id', listing.id);

          if (buyers) {
            for (const buyer of buyers) {
              if (buyer.buyer_id !== user.id) {
                chats.push({
                  otherUserId: buyer.buyer_id,
                  listingId: listing.id,
                  orderId: buyer.order_id,
                  otherUser: buyer.profiles || { name: 'Unknown User', avatar_url: '' },
                  listingTitle: listing.title
                });
              }
            }
          }
        }
      }

      // As buyer
      const { data: buying } = await supabase
        .from('orders')
        .select('id, listing_id, seller_id, listings(title, seller_id, profiles(name, avatar_url))')
        .eq('buyer_id', user.id);

      if (buying) {
        for (const order of buying) {
          if (order.seller_id !== user.id) {
            chats.push({
              otherUserId: order.seller_id,
              listingId: order.listing_id,
              orderId: order.id,
              otherUser: order.listings?.profiles || { name: 'Unknown User', avatar_url: '' },
              listingTitle: order.listings?.title || ''
            });
          }
        }
      }

      // Remove duplicates using composite key: otherUser + listing + order
      const unique = new Map();
      for (const chat of chats) {
        const key = `${chat.otherUserId}_${chat.listingId}_${chat.orderId ?? 'none'}`;
        if (!unique.has(key)) unique.set(key, chat);
      }
      return Array.from(unique.values());
    },
    enabled: !!user?.id
  });

  // Fetch messages for selected conversation
  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConversation?.sellerId, selectedConversation?.listingId, selectedConversation?.orderId, user?.id],
    queryFn: async () => {
      if (!selectedConversation || !user?.id) return [];

      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .or(
          `and(from_user_id.eq.${user.id},to_user_id.eq.${selectedConversation.sellerId}),and(from_user_id.eq.${selectedConversation.sellerId},to_user_id.eq.${user.id})`
        )
        .eq('listing_id', selectedConversation.listingId)
        .order('created_at', { ascending: true });

      return data || [];
    },
    enabled: !!selectedConversation && !!user?.id
  });

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user?.id) return;

    const payload = {
      from_user_id: user.id,
      to_user_id: selectedConversation.sellerId,
      listing_id: selectedConversation.listingId,
      order_id: selectedConversation.orderId || null,
      message_text: newMessage.trim()
    };

    setIsSending(true);
    setNewMessage('');

    const { data, error } = await supabase.from('chat_messages').insert([payload]);

    if (error) {
      toast({ title: 'Failed to send message', description: error.message, variant: 'destructive' });
      setNewMessage(payload.message_text);
    } else {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.sellerId, selectedConversation.listingId, selectedConversation.orderId, user.id] });
      queryClient.invalidateQueries({ queryKey: ['possible-chats', user.id] });
    }

    setIsSending(false);
  };

  // Negotiation mutation
  const sendNegotiationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConversation?.orderId) throw new Error('No order associated with this chat');

      const { error } = await supabase
        .from('order_negotiations')
        .insert([{
          order_id: selectedConversation.orderId,
          from_user_id: user?.id,
          action: 'counter',
          amount: parseFloat(negotiationAmount),
          message: negotiationMessage
        }]);
      if (error) throw error;

      // Insert system message into chat
      await supabase.from('chat_messages').insert([{
        from_user_id: user?.id,
        to_user_id: selectedConversation.sellerId,
        listing_id: selectedConversation.listingId,
        order_id: selectedConversation.orderId,
        message_text: `Proposed a counter offer: $${negotiationAmount}`,
        is_system_message: true
      }]);
    },
    onSuccess: () => {
      toast({ title: 'Counter offer sent' });
      setNegotiationAmount('');
      setNegotiationMessage('');
      setShowNegotiationDialog(false);
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation?.sellerId, selectedConversation?.listingId, selectedConversation?.orderId, user?.id] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to send negotiation', description: error.message, variant: 'destructive' });
    }
  });

  // Auto-select conversation if URL params exist
  useEffect(() => {
    if (sellerId && listingId && user) {
      setSelectedConversation({ sellerId, listingId });
    }
  }, [sellerId, listingId, user]);

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-200px)] gap-4">
        {/* Conversations */}
        <Card className="w-full lg:w-80 flex flex-col max-h-[500px]">
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-full">
              {possibleChats?.length === 0 ? (
                <div className="p-6 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No conversations yet</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {possibleChats.map(chat => {
                    const isActive = selectedConversation?.sellerId === chat.otherUserId && selectedConversation?.listingId === chat.listingId && selectedConversation?.orderId === chat.orderId;
                    return (
                      <button
                        key={`${chat.otherUserId}_${chat.listingId}_${chat.orderId ?? 'none'}`}
                        onClick={() => setSelectedConversation({ sellerId: chat.otherUserId, listingId: chat.listingId, orderId: chat.orderId })}
                        className={`w-full p-3 rounded-lg text-left transition-colors ${isActive ? 'bg-accent' : 'hover:bg-accent/50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={chat.otherUser?.avatar_url || ''} />
                            <AvatarFallback>{chat.otherUser?.name?.[0] || 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{chat.otherUser?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground truncate">{chat.listingTitle}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              <CardContent className="flex-1 p-4 space-y-4 overflow-y-auto">
                {messages?.map(msg => (
                  <div key={msg.id} className={`flex ${msg.from_user_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-sm px-4 py-2 rounded-lg ${msg.is_system_message ? 'bg-yellow-100 text-yellow-800' : msg.from_user_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {msg.message_text}
                      <div className="text-xs mt-1 text-right text-muted-foreground">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>

              <div className="flex gap-2 p-4 border-t border-border">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                />
                <Button onClick={sendMessage} disabled={isSending}>
                  <Send className="w-4 h-4 mr-1
                  /> Send
                </Button>
                <Button variant="outline" onClick={() => setShowNegotiationDialog(true)}>
                  <DollarSign className="w-4 h-4 mr-1" /> Counter
                </Button>
              </div>

              {/* Negotiation Dialog */}
              <Dialog open={showNegotiationDialog} onOpenChange={setShowNegotiationDialog}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Send Counter Offer</DialogTitle>
                    <DialogDescription>
                      Enter the amount and message for your negotiation.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="amount">Amount</Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Enter amount"
                        value={negotiationAmount}
                        onChange={e => setNegotiationAmount(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="message">Message (optional)</Label>
                      <Textarea
                        id="message"
                        placeholder="Message"
                        value={negotiationMessage}
                        onChange={e => setNegotiationMessage(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowNegotiationDialog(false)}>Cancel</Button>
                    <Button onClick={() => sendNegotiationMutation.mutate()}>Send</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>Select a conversation to start chatting</p>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Messages;
