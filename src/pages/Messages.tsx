import { useState, useEffect, useRef } from 'react';
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
import { Send, MessageSquare, DollarSign, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const Messages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const orderIdParam = searchParams.get('order');

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNegotiationDialog, setShowNegotiationDialog] = useState(false);
  const [negotiationAmount, setNegotiationAmount] = useState('');
  const [negotiationMessage, setNegotiationMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations (grouped by order_id)
  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          buyer_id,
          seller_id,
          listing_id,
          status,
          created_at,
          final_amount,
          listings (
            id,
            title,
            images
          )
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error || !orders) return [];

      const conversationsWithDetails = await Promise.all(
        orders.map(async (order) => {
          const otherUserId = order.buyer_id === user.id ? order.seller_id : order.buyer_id;
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .eq('id', otherUserId)
            .single();

          const { data: lastMessage } = await supabase
            .from('chat_messages')
            .select('message_text, created_at')
            .eq('order_id', order.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count: unreadCount } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', order.id)
            .eq('to_user_id', user.id)
            .is('read_at', null);

          return {
            orderId: order.id,
            listingId: order.listing_id,
            listingTitle: order.listings?.title || 'Unknown Item',
            listingImage: order.listings?.images?.[0],
            otherUser: profile || { id: otherUserId, name: 'Unknown User', avatar_url: null },
            lastMessage: lastMessage?.message_text,
            lastMessageTime: lastMessage?.created_at,
            unreadCount: unreadCount || 0,
            orderStatus: order.status,
            amount: order.final_amount
          };
        })
      );

      return conversationsWithDetails;
    },
    enabled: !!user?.id
  });

  // Auto-select conversation from URL params or first conversation
  useEffect(() => {
    if (!user || !conversations) return;
    if (orderIdParam) {
      setSelectedOrderId(orderIdParam);
    } else if (conversations.length > 0 && !selectedOrderId) {
      setSelectedOrderId(conversations[0].orderId);
    }
  }, [orderIdParam, conversations, user, selectedOrderId]);

  // Fetch messages and negotiations for selected order
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return [];

      const { data: chatMessages } = await supabase
        .from('chat_messages')
        .select(`
          *,
          from_user:profiles!from_user_id(id, name, avatar_url),
          to_user:profiles!to_user_id(id, name, avatar_url)
        `)
        .eq('order_id', selectedOrderId)
        .order('created_at', { ascending: true });

      const { data: negotiations } = await supabase
        .from('order_negotiations')
        .select(`
          *,
          from_user:profiles!from_user_id(id, name, avatar_url)
        `)
        .eq('order_id', selectedOrderId)
        .order('created_at', { ascending: true });

      const allMessages = [
        ...(chatMessages || []).map(msg => ({ ...msg, type: 'message' })),
        ...(negotiations || []).map(neg => ({ ...neg, type: 'negotiation' }))
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      return allMessages;
    },
    enabled: !!selectedOrderId
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read
  useEffect(() => {
    if (!selectedOrderId || !user?.id || !messages) return;

    const unreadMessages = messages.filter(
      m => m.type === 'message' && 'to_user_id' in m && m.to_user_id === user.id && !m.read_at
    );

    if (unreadMessages.length > 0) {
      supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadMessages.map(m => m.id))
        .eq('to_user_id', user.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        });
    }
  }, [selectedOrderId, user?.id, messages, queryClient]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedOrderId || !user?.id) return;

    const currentConv = conversations?.find(c => c.orderId === selectedOrderId);
    if (!currentConv) return;

    const payload = {
      from_user_id: user.id,
      to_user_id: currentConv.otherUser.id,
      order_id: selectedOrderId,
      listing_id: currentConv.listingId,
      message_text: newMessage.trim()
    };

    setIsSending(true);
    const messageText = newMessage;
    setNewMessage('');

    const { error } = await supabase.from('chat_messages').insert([payload]);

    if (error) {
      toast({ title: 'Failed to send message', description: error.message, variant: 'destructive' });
      setNewMessage(messageText);
    }
    setIsSending(false);
  };

  // Accept negotiation
  const acceptNegotiation = useMutation({
    mutationFn: async (negotiationId: string) => {
      const negotiation = messages?.find(m => m.id === negotiationId);
      if (!negotiation || !selectedOrderId || negotiation.type !== 'negotiation') throw new Error('Negotiation not found');
      if (!('amount' in negotiation)) throw new Error('Invalid negotiation');

      const currentConv = conversations?.find(c => c.orderId === selectedOrderId);
      if (!currentConv) throw new Error('Conversation not found');

      await supabase.from('order_negotiations').insert({
        order_id: selectedOrderId,
        from_user_id: user?.id,
        action: 'accept',
        amount: negotiation.amount,
        message: 'Offer accepted'
      });

      await supabase
        .from('orders')
        .update({
          negotiated_price: negotiation.amount,
          final_amount: negotiation.amount,
          status: 'accepted'
        })
        .eq('id', selectedOrderId);
    },
    onSuccess: () => {
      toast({ title: 'Offer accepted!', description: 'The order has been updated.' });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to accept offer', description: error.message, variant: 'destructive' });
    }
  });

  // Decline negotiation
  const declineNegotiation = useMutation({
    mutationFn: async (negotiationId: string) => {
      const negotiation = messages?.find(m => m.id === negotiationId);
      if (!negotiation || !selectedOrderId || negotiation.type !== 'negotiation') throw new Error('Negotiation not found');

      await supabase.from('order_negotiations').insert({
        order_id: selectedOrderId,
        from_user_id: user?.id,
        action: 'decline',
        message: 'Offer declined'
      });
    },
    onSuccess: () => {
      toast({ title: 'Offer declined' });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to decline offer', description: error.message, variant: 'destructive' });
    }
  });

  // Send counter offer
  const sendCounterOffer = useMutation({
    mutationFn: async () => {
      if (!selectedOrderId || !negotiationAmount) throw new Error('Missing data');

      await supabase.from('order_negotiations').insert({
        order_id: selectedOrderId,
        from_user_id: user?.id,
        action: 'counter',
        amount: parseFloat(negotiationAmount),
        message: negotiationMessage || null
      });
    },
    onSuccess: () => {
      toast({ title: 'Counter offer sent!' });
      setShowNegotiationDialog(false);
      setNegotiationAmount('');
      setNegotiationMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to send offer', description: error.message, variant: 'destructive' });
    }
  });

  // Real-time subscription
  useEffect(() => {
    if (!selectedOrderId) return;

    const channel = supabase
      .channel(`order_${selectedOrderId}_chat`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `order_id=eq.${selectedOrderId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', selectedOrderId] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_negotiations',
          filter: `order_id=eq.${selectedOrderId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', selectedOrderId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedOrderId, queryClient]);

  // Render regular message
  const renderRegularMessage = (msg: any, isFromMe: boolean, showAvatar: boolean) => {
    return (
      <div className={`flex gap-2 ${isFromMe ? 'justify-end' : 'justify-start'}`}>
        {!isFromMe && showAvatar && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={msg.from_user?.avatar_url || ''} />
            <AvatarFallback>{msg.from_user?.name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        )}
        
        <div className={`max-w-[70%] ${isFromMe ? 'order-first' : ''}`}>
          <div className={`rounded-lg px-3 py-2 ${
            isFromMe 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted'
          }`}>
            <p className="text-sm">{msg.message_text}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1 px-1">
            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
          </p>
        </div>

        {isFromMe && showAvatar && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={msg.from_user?.avatar_url || ''} />
            <AvatarFallback>{msg.from_user?.name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        )}
      </div>
    );
  };

  // Render negotiation message
  const renderNegotiationMessage = (negotiation: any, isFromMe: boolean) => {
    const isAccepted = negotiation.action === 'accept';
    const isDeclined = negotiation.action === 'decline';
    const isCounter = negotiation.action === 'counter';
    const isNewOffer = !isAccepted && !isDeclined && !isCounter;

    const getStatusColor = () => {
      if (isAccepted) return 'bg-green-100 text-green-800 border-green-200';
      if (isDeclined) return 'bg-red-100 text-red-800 border-red-200';
      if (isCounter) return 'bg-blue-100 text-blue-800 border-blue-200';
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    };

    const getStatusText = () => {
      if (isAccepted) return 'Accepted';
      if (isDeclined) return 'Declined';
      if (isCounter) return 'Counter Offer';
      return 'New Offer';
    };

    return (
      <div className={`flex justify-center my-4`}>
        <div className={`max-w-md w-full p-4 rounded-lg border ${getStatusColor()}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="font-medium">Price Negotiation</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {getStatusText()}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl font-bold">${negotiation.amount?.toFixed(2)}</span>
            {isNewOffer && !isFromMe && (
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => acceptNegotiation.mutate(negotiation.id)}
                  className="h-8 px-2"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Accept
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => declineNegotiation.mutate(negotiation.id)}
                  className="h-8 px-2"
                >
                  <X className="h-3 w-3 mr-1" />
                  Decline
                </Button>
              </div>
            )}
          </div>

          {negotiation.message && (
            <p className="text-sm mb-2">{negotiation.message}</p>
          )}

          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(negotiation.created_at), { addSuffix: true })}
          </p>

          {isNewOffer && isFromMe && (
            <p className="text-xs text-muted-foreground mt-2">
              Waiting for response...
            </p>
          )}
        </div>
      </div>
    );
  };

  const selectedConversation = conversations?.find(c => c.orderId === selectedOrderId);

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-200px)] gap-4">
        {/* Conversations List */}
        <Card className="w-full lg:w-80 flex flex-col">
          <CardHeader>
            <CardTitle>Messages</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              {conversationsLoading ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !conversations?.length ? (
                <div className="p-6 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No conversations yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Start by making an order on a listing
                  </p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {conversations.map(conv => {
                    const isActive = selectedOrderId === conv.orderId;
                    return (
                      <button
                        key={conv.orderId}
                        onClick={() => setSelectedOrderId(conv.orderId)}
                        className={`w-full p-3 rounded-lg text-left transition-colors ${
                          isActive ? 'bg-accent' : 'hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={conv.otherUser.avatar_url || ''} />
                            <AvatarFallback>{conv.otherUser.name?.[0] || 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium truncate">{conv.otherUser.name}</p>
                              {conv.unreadCount > 0 && (
                                <Badge variant="default" className="ml-2 h-5 min-w-5 px-1 text-xs">
                                  {conv.unreadCount}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mb-1">
                              {conv.listingTitle}
                            </p>
                            {conv.lastMessage && (
                              <p className="text-xs text-muted-foreground truncate">
                                {conv.lastMessage}
                              </p>
                            )}
                            {conv.lastMessageTime && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(conv.lastMessageTime), { addSuffix: true })}
                              </p>
                            )}
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

        {/* Messages Area */}
        <Card className="flex-1 flex flex-col">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedConversation 
                  ? `${selectedConversation.otherUser.name} - ${selectedConversation.listingTitle}`
                  : 'Select a conversation'}
              </CardTitle>
              {selectedConversation && (
                <Badge variant="secondary">${parseFloat(String(selectedConversation.amount || '0')).toFixed(2)}</Badge>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 p-4 overflow-hidden flex flex-col">
            {messagesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                    {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full" />}
                    <Skeleton className={`h-16 ${i % 2 === 0 ? 'w-48' : 'w-64'} rounded-lg`} />
                  </div>
                ))}
              </div>
            ) : !selectedOrderId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Select a conversation to start messaging</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1 pr-4">
                {messages?.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {messages?.map((msg, index) => {
                      const isFromMe = msg.from_user_id === user?.id;
                      const prevMsg = index > 0 ? messages[index - 1] : null;
                      const showAvatar = !prevMsg || prevMsg.from_user_id !== msg.from_user_id || prevMsg.type !== msg.type;

                      if (msg.type === 'negotiation') {
                        return (
                          <div key={msg.id}>
                            {renderNegotiationMessage(msg, isFromMe)}
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id}>
                          {renderRegularMessage(msg, isFromMe, showAvatar)}
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>
            )}
          </CardContent>

          {selectedOrderId && (
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  disabled={isSending}
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim() || isSending}>
                  <Send className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowNegotiationDialog(true)}
                  disabled={isSending}
                >
                  <DollarSign className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Negotiation Dialog */}
      <Dialog open={showNegotiationDialog} onOpenChange={setShowNegotiationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Counter Offer</DialogTitle>
            <DialogDescription>
              Propose a new price for this order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={negotiationAmount}
                onChange={e => setNegotiationAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a note about your offer..."
                value={negotiationMessage}
                onChange={e => setNegotiationMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNegotiationDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => sendCounterOffer.mutate()}
              disabled={!negotiationAmount || parseFloat(negotiationAmount) <= 0}
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
