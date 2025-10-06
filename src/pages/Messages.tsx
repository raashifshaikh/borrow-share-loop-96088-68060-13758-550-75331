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

  // --- Fetch possible chats ---
  const { data: possibleChats } = useQuery({
    queryKey: ['possible-chats', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: selling } = await supabase
        .from('listings')
        .select('id, title, seller_id, profiles(name, avatar_url)')
        .eq('seller_id', user.id);

      const { data: buying } = await supabase
        .from('orders')
        .select('id, listing_id, seller_id, buyer_id, listings(title, seller_id, profiles(name, avatar_url))')
        .eq('buyer_id', user.id);

      const chats: any[] = [];
      if (selling) {
        for (const listing of selling) {
          const { data: buyers } = await supabase
            .from('orders')
            .select('buyer_id, profiles(name, avatar_url)')
            .eq('listing_id', listing.id);
          if (buyers) {
            for (const buyer of buyers) {
              if (buyer.buyer_id !== user.id) {
                chats.push({
                  otherUserId: buyer.buyer_id,
                  listingId: listing.id,
                  otherUser: buyer.profiles || { name: 'Unknown', avatar_url: '' },
                  listingTitle: listing.title,
                });
              }
            }
          }
        }
      }
      if (buying) {
        for (const order of buying) {
          if (order.seller_id !== user.id) {
            chats.push({
              otherUserId: order.seller_id,
              listingId: order.listing_id,
              otherUser: order.listings?.profiles || { name: 'Unknown', avatar_url: '' },
              listingTitle: order.listings?.title || '',
            });
          }
        }
      }

      const unique = new Map();
      for (const chat of chats) {
        const key = `${chat.otherUserId}_${chat.listingId}`;
        if (!unique.has(key)) unique.set(key, chat);
      }
      return Array.from(unique.values());
    },
    enabled: !!user?.id,
  });

  // --- Fetch conversations ---
  const { data: conversations } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('chat_messages')
        .select(`*, from_profile:profiles!fk_chat_from_profile(name, avatar_url), to_profile:profiles!fk_chat_to_profile(name, avatar_url)`)
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) return [];

      const convMap = new Map();
      data?.forEach((msg) => {
        const otherUserId = msg.from_user_id === user.id ? msg.to_user_id : msg.from_user_id;
        if (!otherUserId || !msg.listing_id) return;

        let otherUser = { name: 'Unknown', avatar_url: '' };
        if (msg.from_user_id === user.id && msg.to_profile?.name) otherUser = { name: msg.to_profile.name, avatar_url: msg.to_profile.avatar_url };
        else if (msg.from_user_id !== user.id && msg.from_profile?.name) otherUser = { name: msg.from_profile.name, avatar_url: msg.from_profile.avatar_url };

        const key = `${otherUserId}_${msg.listing_id}`;
        if (!convMap.has(key) || new Date(msg.created_at) > new Date(convMap.get(key).created_at)) {
          convMap.set(key, { ...msg, otherUserId, listingId: msg.listing_id, otherUser });
        }
      });

      return Array.from(convMap.values());
    },
    enabled: !!user?.id,
  });

  // --- Fetch messages for selected conversation ---
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
    enabled: !!selectedConversation && !!user?.id && !!selectedConversation.listingId,
  });

  // --- Fetch order context ---
  const { data: orderContext } = useQuery({
    queryKey: ['order-context', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data } = await supabase
        .from('orders')
        .select('*, listings(title, type)')
        .eq('id', orderId)
        .single();
      return data;
    },
    enabled: !!orderId,
  });

  // --- Send regular message ---
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user?.id) return;

    const payload = {
      from_user_id: user.id,
      to_user_id: selectedConversation.sellerId,
      listing_id: selectedConversation.listingId,
      message_text: newMessage.trim(),
      order_id: orderId || null,
    };

    setNewMessage('');
    setIsSending(true);

    try {
      const { data, error } = await supabase.from('chat_messages').insert([payload]).select().single();
      if (error || !data) throw error || new Error('No data returned');

      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.sellerId, selectedConversation.listingId, user.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
    } catch (e: any) {
      console.error(e);
      setNewMessage(payload.message_text);
      toast({ title: 'Failed to send message', description: e.message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  // --- Send negotiation ---
  const sendNegotiationMutation = useMutation({
    mutationFn: async () => {
      if (!negotiationAmount || !selectedConversation || !user?.id) throw new Error('Missing data');
      if (!orderId) throw new Error('Order ID missing');

      const { data: negotiation, error } = await supabase
        .from('order_negotiations')
        .insert([{
          order_id: orderId,
          from_user_id: user.id,
          action: 'propose',
          amount: parseFloat(negotiationAmount),
          message: negotiationMessage
        }])
        .select()
        .single();
      if (error || !negotiation) throw error || new Error('Failed to create negotiation');

      // Insert system message in chat
      await supabase.from('chat_messages').insert([{
        from_user_id: user.id,
        to_user_id: selectedConversation.sellerId,
        listing_id: selectedConversation.listingId,
        message_text: `Proposed negotiation: $${negotiation.amount}. ${negotiation.message || ''}`,
        is_system_message: true
      }]);

      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.sellerId, selectedConversation.listingId, user.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
      setShowNegotiationDialog(false);
      setNegotiationAmount('');
      setNegotiationMessage('');
      toast({ title: 'Negotiation sent!', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' })
  });

  // --- Auto-select conversation from params ---
  useEffect(() => {
    if (sellerId && listingId && user) {
      if (sellerId !== user.id) setSelectedConversation({ sellerId, listingId });
    }
  }, [sellerId, listingId, user]);

  // --- Real-time subscription ---
  useEffect(() => {
    if (!selectedConversation || !user?.id) return;
    const channel = supabase.channel('chat_messages_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new;
        if ([msg.from_user_id, msg.to_user_id].includes(user.id) &&
            [msg.from_user_id, msg.to_user_id].includes(selectedConversation.sellerId) &&
            msg.listing_id === selectedConversation.listingId) {
          queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.sellerId, selectedConversation.listingId, user.id] });
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        }
      }).subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedConversation, user?.id, queryClient]);

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-200px)] gap-4">
        {/* Conversations List */}
        <Card className="w-full lg:w-80 flex flex-col max-h-[500px]">
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-full">
              {((possibleChats?.length ?? 0) === 0 && (conversations?.length ?? 0) === 0) ? (
                <div className="p-6 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4" />
                  No conversations yet
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {[...possibleChats ?? [], ...conversations ?? []].map(chat => {
                    const otherUserId = chat.otherUserId || chat.other_user_id;
                    const lId = chat.listingId || chat.listing_id;
                    const isActive = selectedConversation?.sellerId === otherUserId && selectedConversation?.listingId === lId;
                    return (
                      <button
                        key={`${otherUserId}_${lId}`}
                        onClick={() => setSelectedConversation({ sellerId: otherUserId, listingId: lId })}
                        className={`w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors ${isActive ? 'bg-accent' : 'hover:bg-accent/50'}`}
                      >
                        <Avatar>
                          <AvatarImage src={chat.otherUser?.avatar_url || ''} />
                          <AvatarFallback>{chat.otherUser?.name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{chat.otherUser?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground truncate">{chat.listingTitle || chat.message_text || ''}</p>
                          {chat.unread_count > 0 && <Badge variant="secondary">{chat.unread_count}</Badge>}
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
              <CardContent className="flex-1 p-4 overflow-y-auto">
                {messages?.map(msg => (
                  <div key={msg.id} className={`flex ${msg.from_user_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-sm px-4 py-2 rounded-lg ${msg.is_system_message ? 'bg-yellow-100 text-yellow-800' : (msg.from_user_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}`}>
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
                  <Send className="w-4 h-4 mr-1" /> Send
                </Button>
                <Button variant="secondary" onClick={() => setShowNegotiationDialog(true)}>
                  <DollarSign className="w-4 h-4 mr-1" /> Negotiate
                </Button>
              </div>

              {/* Negotiation Dialog */}
              <Dialog open={showNegotiationDialog} onOpenChange={setShowNegotiationDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Propose Negotiation</DialogTitle>
                    <DialogDescription>Send a negotiation offer for this order</DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      value={negotiationAmount}
                      onChange={e => setNegotiationAmount(e.target.value)}
                      placeholder="Offer amount"
                    />
                    <Label>Message (optional)</Label>
                    <Textarea
                      value={negotiationMessage}
                      onChange={e => setNegotiationMessage(e.target.value)}
                      placeholder="Optional message"
                    />
                  </div>
                  <DialogFooter className="mt-4 flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setShowNegotiationDialog(false)}>Cancel</Button>
                    <Button onClick={() => sendNegotiationMutation.mutate()}>Send</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a conversation to start chatting
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Messages;
