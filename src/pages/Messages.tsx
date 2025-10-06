
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
  // New: support seller and listing params for unique chat
  const sellerId = searchParams.get('seller');
  const listingId = searchParams.get('listing');
  // Use a composite key for unique chat per seller+listing
  const [selectedConversation, setSelectedConversation] = useState<{ sellerId: string, listingId: string } | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNegotiationDialog, setShowNegotiationDialog] = useState(false);
  const [negotiationAmount, setNegotiationAmount] = useState('');
  const [negotiationMessage, setNegotiationMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Query all listings the user is involved in (as buyer or seller)
  const { data: possibleChats } = useQuery({
    queryKey: ['possible-chats', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Get listings where user is seller
      const { data: selling } = await supabase
        .from('listings')
        .select('id, title, seller_id, profiles(name, avatar_url)')
        .eq('seller_id', user.id);

      // Get orders where user is buyer
      const { data: buying } = await supabase
        .from('orders')
        .select('id, listing_id, seller_id, buyer_id, listings(title, seller_id, profiles(name, avatar_url))')
        .eq('buyer_id', user.id);

      // Build possible chat objects
      const chats = [];
      // As seller: show all buyers for each listing (from orders)
      if (selling) {
        for (const listing of selling) {
          // Find all buyers for this listing
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
                  otherUser: buyer.profiles || { name: 'Unknown User', avatar_url: '' },
                  listingTitle: listing.title
                });
              }
            }
          }
        }
      }
      // As buyer: show all listings purchased from other sellers
      if (buying) {
        for (const order of buying) {
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
      // Remove duplicates (by otherUserId+listingId)
      const unique = new Map();
      for (const chat of chats) {
        const key = `${chat.otherUserId}_${chat.listingId}`;
        if (!unique.has(key)) unique.set(key, chat);
      }
      return Array.from(unique.values());
    },
    enabled: !!user?.id
  });

  // Get all conversations for the user, grouped by seller+listing for uniqueness
  const { data: conversations } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Try with profile join for avatars/names
      let { data, error } = await supabase
        .from('chat_messages')
        .select(`*, from_profile:profiles!fk_chat_from_profile(name, avatar_url), to_profile:profiles!fk_chat_to_profile(name, avatar_url)`)
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      // If join fails, fallback to just '*'
      if (error) {
        const fallback = await supabase
          .from('chat_messages')
          .select('*')
          .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
          .order('created_at', { ascending: false });
        data = fallback.data?.map(msg => ({
          ...msg,
          from_profile: { name: 'Unknown User', avatar_url: '' },
          to_profile: { name: 'Unknown User', avatar_url: '' }
        }));
      }

      // Group by otherUserId + listing_id for unique chat per item/service
      const conversationMap = new Map();
      data?.forEach(message => {
        const otherUserId = message.from_user_id === user.id 
          ? message.to_user_id 
          : message.from_user_id;
        // Skip if missing otherUserId or listingId
        if (!otherUserId || !message.listing_id) return;
        // Prefer profile info from join if available, fallback to default
        let otherUser = { name: 'Unknown User', avatar_url: '' };
        if (message.from_user_id === user.id && message.to_profile && message.to_profile.name) {
          otherUser = {
            name: message.to_profile.name || 'Unknown User',
            avatar_url: message.to_profile.avatar_url || ''
          };
        } else if (message.from_user_id !== user.id && message.from_profile && message.from_profile.name) {
          otherUser = {
            name: message.from_profile.name || 'Unknown User',
            avatar_url: message.from_profile.avatar_url || ''
          };
        }
        // Fallback for missing/empty name
        if (!otherUser.name) otherUser.name = 'Unknown User';
        const key = `${otherUserId}_${message.listing_id}`;
        if (!conversationMap.has(key) || 
            new Date(message.created_at) > new Date(conversationMap.get(key).created_at)) {
          conversationMap.set(key, {
            ...message,
            otherUserId,
            listingId: message.listing_id,
            otherUser
          });
        }
      });
      return Array.from(conversationMap.values());
    },
    enabled: !!user?.id
  });

  // Get messages for selected conversation (by seller+listing)
  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConversation?.sellerId, selectedConversation?.listingId, user?.id],
    queryFn: async () => {
      if (!selectedConversation || !user?.id) return [];

      // Only fetch messages for this seller+listing, with optional profile join
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`*, from_profile:profiles!fk_chat_from_profile(name, avatar_url), to_profile:profiles!fk_chat_to_profile(name, avatar_url)`)
        .or(
          `and(from_user_id.eq.${user.id},to_user_id.eq.${selectedConversation.sellerId}),and(from_user_id.eq.${selectedConversation.sellerId},to_user_id.eq.${user.id})`
        )
        .eq('listing_id', selectedConversation.listingId)
        .order('created_at', { ascending: true });

      // If you get a 400 error, change the select to just '*' above
      return data || [];
    },
    enabled: !!selectedConversation && !!user?.id && !!selectedConversation.listingId
  });

  // Get order context if linked
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
    enabled: !!orderId
  });

  const sendMessage = async () => {
    if (!newMessage.trim()) {
      toast({ title: 'Cannot send empty message', variant: 'destructive' });
      return;
    }
    if (!selectedConversation || !user?.id) {
      toast({ title: 'No conversation selected or user not found', variant: 'destructive' });
      return;
    }
    if (!selectedConversation.sellerId || !selectedConversation.listingId) {
      toast({ title: 'Missing chat recipient or listing', variant: 'destructive' });
      return;
    }

    const messageText = newMessage.trim();
    const tempId = `temp-${Date.now()}`;

    // Log payload for debugging
    const payload = {
      from_user_id: user.id,
      to_user_id: selectedConversation.sellerId,
      listing_id: selectedConversation.listingId,
      message_text: messageText,
      order_id: orderId || null
    };
    console.log('Sending message payload:', payload);

    // Optimistic update
    setNewMessage('');
    setIsSending(true);

    try {
      const { error, data } = await supabase
        .from('chat_messages')
        .insert([payload]);

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }
      if (!data) {
        console.error('No data returned from insert');
        throw new Error('No data returned from insert');
      }

      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.sellerId, selectedConversation.listingId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });

      toast({ 
        title: 'Message sent',
        description: 'Your message was delivered successfully' 
      });
    } catch (error: any) {
      console.error('Failed to send message:', error);
      setNewMessage(messageText); // Restore message on error

      toast({
        title: 'Failed to send message',
        description: error.message || 'Please check your connection and try again',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  const sendNegotiationMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error('No order context');
      
      const { error } = await supabase
        .from('order_negotiations')
        .insert([{
          order_id: orderId,
          from_user_id: user?.id,
          action: 'counter',
          amount: parseFloat(negotiationAmount),
          message: negotiationMessage
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Counter offer sent!', description: 'The other party will review your offer' });
      setShowNegotiationDialog(false);
      setNegotiationAmount('');
      setNegotiationMessage('');
      queryClient.invalidateQueries({ queryKey: ['negotiations', orderId] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to send offer', description: error.message, variant: 'destructive' });
    }
  });

  // Auto-select conversation from query params (seller+listing)
  useEffect(() => {
    if (sellerId && listingId && user) {
      // Don't allow chatting with yourself
      if (sellerId !== user.id) {
        setSelectedConversation({ sellerId, listingId });
      }
    } else if (orderContext && user) {
      // fallback: order context
      const otherUserId = orderContext.seller_id === user.id 
        ? orderContext.buyer_id 
        : orderContext.seller_id;
      setSelectedConversation({ sellerId: otherUserId, listingId: orderContext.listing_id });
    }
  }, [sellerId, listingId, user, orderContext]);

  // Setup realtime subscription for new messages (fix: listen to all inserts, filter in callback)
  useEffect(() => {
    if (!selectedConversation || !user?.id) return;

    const channel = supabase
      .channel('chat_messages_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const newMsg = payload.new;
          // Only update if the message is between these two users and for the same listing
          if (
            [newMsg.from_user_id, newMsg.to_user_id].includes(user.id) &&
            [newMsg.from_user_id, newMsg.to_user_id].includes(selectedConversation.sellerId) &&
            newMsg.listing_id === selectedConversation.listingId
          ) {
            queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.sellerId, selectedConversation.listingId, user.id] });
            queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, user?.id, queryClient]);

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-200px)] gap-4">
        {/* Conversations List */}
        <Card className="w-full lg:w-80 flex flex-col max-h-[400px] lg:max-h-none">
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-full">
              {/* Show all possible chats, even if no messages exist yet */}
              {((possibleChats?.length ?? 0) === 0 && (conversations?.length ?? 0) === 0) ? (
                <div className="p-6 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No conversations yet</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {/* Show all possible chats first */}
                  {possibleChats?.map((chat) => {
                    const isActive =
                      selectedConversation?.sellerId === chat.otherUserId &&
                      selectedConversation?.listingId === chat.listingId;
                    return (
                      <button
                        key={`possible_${chat.otherUserId}_${chat.listingId}`}
                        onClick={() => setSelectedConversation({ sellerId: chat.otherUserId, listingId: chat.listingId })}
                        className={`w-full p-3 rounded-lg text-left transition-colors ${
                          isActive ? 'bg-accent' : 'hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={chat.otherUser?.avatar_url || ''} />
                            <AvatarFallback>
                              {chat.otherUser?.name?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {chat.otherUser?.name || 'Unknown User'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {chat.listingTitle || ''}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {/* Then show conversations with messages (skip if already in possibleChats) */}
                  {conversations?.filter(conversation => {
                    const key = `${conversation.otherUserId}_${conversation.listingId}`;
                    return !possibleChats?.some(chat => `${chat.otherUserId}_${chat.listingId}` === key);
                  }).map((conversation) => {
                    const isActive =
                      selectedConversation?.sellerId === conversation.otherUserId &&
                      selectedConversation?.listingId === conversation.listingId;
                    return (
                      <button
                        key={`${conversation.otherUserId}_${conversation.listingId}`}
                        onClick={() => setSelectedConversation({ sellerId: conversation.otherUserId, listingId: conversation.listingId })}
                        className={`w-full p-3 rounded-lg text-left transition-colors ${
                          isActive ? 'bg-accent' : 'hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={conversation.otherUser?.avatar_url || ''} />
                            <AvatarFallback>
                              {conversation.otherUser?.name?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {conversation.otherUser?.name || 'Unknown User'}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {conversation.message_text}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(conversation.created_at))} ago
                            </p>
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
              {/* Order Context Banner */}
              {orderContext && (
                <div className="bg-muted p-4 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{orderContext.listings?.title || 'Listing'}</p>
                        <p className="text-sm text-muted-foreground">
                          Order #{orderContext.id.slice(0, 8)} • ${orderContext.final_amount}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={orderContext.status === 'accepted' ? 'default' : 'secondary'}>
                        {String(orderContext.status)}
                      </Badge>
                      {orderContext.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => setShowNegotiationDialog(true)}>
                          <DollarSign className="h-4 w-4 mr-1" />
                          Negotiate
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-4">
                    {messages?.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.from_user_id === user?.id ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-sm px-4 py-2 rounded-lg ${
                            message.from_user_id === user?.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p>{message.message_text}</p>
                          <p className={`text-xs mt-1 ${
                            message.from_user_id === user?.id
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground'
                          }`}>
                            {formatDistanceToNow(new Date(message.created_at))} ago
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={!newMessage.trim() || isSending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a conversation to start chatting</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Negotiation Dialog */}
      <Dialog open={showNegotiationDialog} onOpenChange={setShowNegotiationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make a Counter Offer</DialogTitle>
            <DialogDescription>
              Current order amount: ${orderContext?.final_amount}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your Offer Amount</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Enter amount"
                value={negotiationAmount}
                onChange={(e) => setNegotiationAmount(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Message (Optional)</Label>
              <Textarea
                placeholder="Explain your offer..."
                value={negotiationMessage}
                onChange={(e) => setNegotiationMessage(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNegotiationDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => sendNegotiationMutation.mutate()}
              disabled={!negotiationAmount || sendNegotiationMutation.isPending}
            >
              Send Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Messages;
