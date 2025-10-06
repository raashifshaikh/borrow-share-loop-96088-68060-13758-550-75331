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

  const [selectedConversation, setSelectedConversation] = useState<{ sellerId: string, listingId: string } | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNegotiationDialog, setShowNegotiationDialog] = useState(false);
  const [negotiationAmount, setNegotiationAmount] = useState('');
  const [negotiationMessage, setNegotiationMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Fetch possible chats (listings user bought or sold)
  const { data: possibleChats } = useQuery({
    queryKey: ['possible-chats', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const selling = await supabase
        .from('listings')
        .select('id, title, seller_id, profiles(name, avatar_url)')
        .eq('seller_id', user.id);

      const buying = await supabase
        .from('orders')
        .select('id, listing_id, seller_id, buyer_id, listings(title, seller_id, profiles(name, avatar_url))')
        .eq('buyer_id', user.id);

      const chats: any[] = [];

      if (selling.data) {
        for (const listing of selling.data) {
          const buyers = await supabase
            .from('orders')
            .select('buyer_id, profiles(name, avatar_url)')
            .eq('listing_id', listing.id);

          if (buyers.data) {
            for (const buyer of buyers.data) {
              if (buyer.buyer_id !== user.id) {
                chats.push({
                  otherUserId: buyer.buyer_id,
                  listingId: listing.id,
                  otherUser: buyer.profiles || { name: 'Unknown User', avatar_url: '' },
                  listingTitle: listing.title
                });
              }
            }
          }
        }
      }

      if (buying.data) {
        for (const order of buying.data) {
          if (order.seller_id !== user.id) {
            chats.push({
              otherUserId: order.seller_id,
              listingId: order.listing_id,
              otherUser: order.listings?.profiles || { name: 'Unknown User', avatar_url: '' },
              listingTitle: order.listings?.title || ''
            });
          }
        }
      }

      // Remove duplicates
      const unique = new Map();
      for (const chat of chats) {
        const key = `${chat.otherUserId}_${chat.listingId}`;
        if (!unique.has(key)) unique.set(key, chat);
      }
      return Array.from(unique.values());
    },
    enabled: !!user?.id
  });

  // Fetch messages per listing+seller
  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConversation?.sellerId, selectedConversation?.listingId, user?.id],
    queryFn: async () => {
      if (!selectedConversation || !user?.id) return [];

      const { data } = await supabase
        .from('chat_messages')
        .select(`*, from_profile:profiles!fk_chat_from_profile(name, avatar_url), to_profile:profiles!fk_chat_to_profile(name, avatar_url)`)
        .or(
          `and(from_user_id.eq.${user.id},to_user_id.eq.${selectedConversation.sellerId}),and(from_user_id.eq.${selectedConversation.sellerId},to_user_id.eq.${user.id})`
        )
        .eq('listing_id', selectedConversation.listingId)
        .order('created_at', { ascending: true });

      return data || [];
    },
    enabled: !!selectedConversation && !!user?.id
  });

  // Auto-select conversation from params
  useEffect(() => {
    if (sellerId && listingId && user) {
      if (sellerId !== user.id) setSelectedConversation({ sellerId, listingId });
    }
  }, [sellerId, listingId, user]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user?.id) {
      toast({ title: 'Cannot send empty message or conversation missing', variant: 'destructive' });
      return;
    }

    const payload = {
      from_user_id: user.id,
      to_user_id: selectedConversation.sellerId,
      listing_id: selectedConversation.listingId,
      message_text: newMessage.trim(),
      order_id: orderId || null
    };

    setIsSending(true);
    setNewMessage('');

    const { data, error } = await supabase.from('chat_messages').insert([payload]).select();

    if (error || !data) {
      toast({ title: 'Failed to send message', description: error?.message || 'Unknown error', variant: 'destructive' });
      setNewMessage(payload.message_text);
      setIsSending(false);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.sellerId, selectedConversation.listingId, user?.id] });
    setIsSending(false);
  };

  // Send negotiation
  const sendNegotiationMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error('Order ID missing');

      const { data, error } = await supabase
        .from('order_negotiations')
        .insert([{
          order_id: orderId,
          from_user_id: user?.id,
          action: 'counter',
          amount: parseFloat(negotiationAmount),
          message: negotiationMessage
        }])
        .select();

      if (error || !data) throw error || new Error('Failed to insert negotiation');
      return data[0];
    },
    onSuccess: (data) => {
      toast({ title: 'Counter offer sent!', description: 'It is now visible in the chat.' });
      setShowNegotiationDialog(false);
      setNegotiationAmount('');
      setNegotiationMessage('');
      // Add negotiation message to chat
      if (selectedConversation) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.sellerId, selectedConversation.listingId, user?.id] });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Failed to send offer', description: error.message, variant: 'destructive' });
    }
  });

  // Realtime subscription
  useEffect(() => {
    if (!selectedConversation || !user?.id) return;

    const channel = supabase
      .channel('chat_messages_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const newMsg = payload.new;
        if ([newMsg.from_user_id, newMsg.to_user_id].includes(user.id) &&
            [newMsg.from_user_id, newMsg.to_user_id].includes(selectedConversation.sellerId) &&
            newMsg.listing_id === selectedConversation.listingId) {
          queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.sellerId, selectedConversation.listingId, user.id] });
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedConversation, user?.id, queryClient]);

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-200px)] gap-4">
        {/* Conversation List */}
        <Card className="w-full lg:w-80 flex flex-col max-h-[500px]">
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-full">
              {(!possibleChats?.length) ? (
                <div className="p-6 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No conversations yet</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {possibleChats.map(chat => {
                    const isActive = selectedConversation?.sellerId === chat.otherUserId && selectedConversation?.listingId === chat.listingId;
                    return (
                      <button
                        key={`${chat.otherUserId}_${chat.listingId}`}
                        onClick={() => setSelectedConversation({ sellerId: chat.otherUserId, listingId: chat.listingId })}
                        className={`w-full p-3 rounded-lg text-left transition-colors ${isActive ? 'bg-accent' : 'hover:bg-accent/50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={chat.otherUser?.avatar_url || ''} />
                            <AvatarFallback>{chat.otherUser?.name?.[0] || 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{chat.otherUser?.name || 'Unknown'}</p>
                            <p className="text-muted-foreground text-sm truncate">{chat.listingTitle}</p>
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

        {/* Messages */}
        <Card className="flex-1 flex flex-col max-h-[500px]">
          <CardHeader>
            <CardTitle>{selectedConversation ? `Chat with ${possibleChats?.find(c => c.sellerId === selectedConversation.sellerId && c.listingId === selectedConversation.listingId)?.otherUser?.name}` : 'Select a conversation'}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4 overflow-y-auto flex flex-col gap-2">
            {messages?.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.from_user_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                {msg.from_user_id !== user?.id && (
                  <Avatar>
                    <AvatarImage src={msg.from_profile?.avatar_url || ''} />
                    <AvatarFallback>{msg.from_profile?.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                )}
                <div className={`px-4 py-2 rounded-lg max-w-xs ${msg.from_user_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                  <p>{msg.message_text}</p>
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(msg.created_at))} ago</span>
                </div>
              </div>
            ))}
          </CardContent>
          {selectedConversation && (
            <div className="flex gap-2 p-2 border-t">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
              />
              <Button onClick={sendMessage} disabled={!newMessage.trim() || isSending}>
                <Send className="w-4 h-4 mr-1" /> Send
              </Button>
              <Button variant="outline" onClick={() => setShowNegotiationDialog(true)}>
                <DollarSign className="w-4 h-4 mr-1" /> Counter
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Negotiation Dialog */}
      <Dialog open={showNegotiationDialog} onOpenChange={setShowNegotiationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Counter Offer</DialogTitle>
            <DialogDescription>Set amount and optional message for counter.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                value={negotiationAmount}
                onChange={e => setNegotiationAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                value={negotiationMessage}
                onChange={e => setNegotiationMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNegotiationDialog(false)}>Cancel</Button>
            <Button onClick={() => sendNegotiationMutation.mutate()}>Send Counter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Messages;
