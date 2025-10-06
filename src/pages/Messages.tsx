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
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNegotiationDialog, setShowNegotiationDialog] = useState(false);
  const [negotiationAmount, setNegotiationAmount] = useState('');
  const [negotiationMessage, setNegotiationMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Get all conversations for the user with profile data
  const { data: conversations } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, from_profile:profiles!chat_messages_from_user_id_fkey(name, avatar_url), to_profile:profiles!chat_messages_to_user_id_fkey(name, avatar_url), listings(title)')
        .in('from_user_id', [user.id])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        return [];
      }

      // Get messages where user is receiver
      const { data: receivedData } = await supabase
        .from('chat_messages')
        .select('*, from_profile:profiles!chat_messages_from_user_id_fkey(name, avatar_url), to_profile:profiles!chat_messages_to_user_id_fkey(name, avatar_url), listings(title)')
        .in('to_user_id', [user.id])
        .order('created_at', { ascending: false });

      const allMessages = [...(data || []), ...(receivedData || [])];

      // Group by otherUserId + listing_id
      const conversationMap = new Map();
      allMessages.forEach(message => {
        const otherUserId = message.from_user_id === user.id ? message.to_user_id : message.from_user_id;
        const otherProfile = message.from_user_id === user.id ? message.to_profile : message.from_profile;
        const key = `${otherUserId}_${message.listing_id || 'general'}`;
        
        if (!conversationMap.has(key) || new Date(message.created_at) > new Date(conversationMap.get(key).created_at)) {
          conversationMap.set(key, {
            ...message,
            otherUserId,
            listingId: message.listing_id,
            otherUser: otherProfile || { name: 'Unknown User', avatar_url: '' }
          });
        }
      });
      return Array.from(conversationMap.values());
    },
    enabled: !!user?.id
  });

  // Get messages for selected conversation
  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConversation, selectedListingId, user?.id],
    queryFn: async () => {
      if (!selectedConversation || !user?.id) return [];

      const { data: sentMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('from_user_id', user.id)
        .eq('to_user_id', selectedConversation)
        .eq('listing_id', selectedListingId)
        .order('created_at', { ascending: true });

      const { data: receivedMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('from_user_id', selectedConversation)
        .eq('to_user_id', user.id)
        .eq('listing_id', selectedListingId)
        .order('created_at', { ascending: true });

      const allMessages = [...(sentMessages || []), ...(receivedMessages || [])];
      return allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    },
    enabled: !!selectedConversation && !!user?.id
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

  // Get negotiations for the current context
  const { data: chatNegotiations } = useQuery({
    queryKey: ['chat-negotiations', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data } = await supabase
        .from('order_negotiations')
        .select('*, from_profile:profiles!order_negotiations_from_user_id_fkey(name)')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!orderId
  });

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user?.id || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert([{
          from_user_id: user.id,
          to_user_id: selectedConversation,
          message_text: messageText,
          listing_id: selectedListingId,
          order_id: orderId || null
        }]);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation, selectedListingId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
    } catch (error: any) {
      console.error('Failed to send message:', error);
      setNewMessage(messageText);
      toast({
        title: 'Failed to send message',
        description: error.message || 'Please try again',
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

  // Auto-select conversation from query params
  useEffect(() => {
    if (sellerId && listingId && user) {
      if (sellerId !== user.id) {
        setSelectedConversation(sellerId);
        setSelectedListingId(listingId);
      }
    } else if (orderContext && user) {
      const otherUserId = orderContext.seller_id === user.id ? orderContext.buyer_id : orderContext.seller_id;
      setSelectedConversation(otherUserId);
      setSelectedListingId(orderContext.listing_id);
    }
  }, [sellerId, listingId, user, orderContext]);

  // Setup realtime subscription for new messages
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
          const newMsg = payload.new as any;
          if (
            [newMsg.from_user_id, newMsg.to_user_id].includes(user.id) &&
            [newMsg.from_user_id, newMsg.to_user_id].includes(selectedConversation) &&
            newMsg.listing_id === selectedListingId
          ) {
            queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation, selectedListingId, user.id] });
            queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, selectedListingId, user?.id, queryClient]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages && messages.length > 0) {
      const scrollArea = document.getElementById('messages-scroll-area');
      if (scrollArea) {
        const scrollContainer = scrollArea.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          setTimeout(() => {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          }, 100);
        }
      }
    }
  }, [messages]);

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
              {conversations?.length === 0 ? (
                <div className="p-6 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No conversations yet</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {conversations?.map((conversation) => {
                    const isActive = selectedConversation === conversation.otherUserId && selectedListingId === conversation.listingId;
                    return (
                      <button
                        key={`${conversation.otherUserId}_${conversation.listingId || 'general'}`}
                        onClick={() => {
                          setSelectedConversation(conversation.otherUserId);
                          setSelectedListingId(conversation.listingId);
                        }}
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
                            {conversation.listings?.title && (
                              <p className="text-xs text-muted-foreground truncate">
                                Re: {conversation.listings.title}
                              </p>
                            )}
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
                        {orderContext.status}
                      </Badge>
                      {['pending', 'accepted'].includes(orderContext.status) && (
                        <Button size="sm" variant="outline" onClick={() => setShowNegotiationDialog(true)}>
                          <DollarSign className="h-4 w-4 mr-1" />
                          Make Offer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-full p-4" id="messages-scroll-area">
                  <div className="space-y-4">
                    {messages?.length === 0 && (!chatNegotiations || chatNegotiations.length === 0) ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      <>
                        {/* Display negotiation history as system messages */}
                        {chatNegotiations?.map((neg: any) => (
                          <div key={`neg-${neg.id}`} className="flex justify-center">
                            <div className="max-w-md px-4 py-2 rounded-lg bg-accent text-accent-foreground text-center">
                              <p className="text-sm font-medium">
                                {neg.from_profile?.name || 'User'} {neg.action === 'counter' ? 'offered' : neg.action === 'accept' ? 'accepted' : 'declined'} 
                                {neg.amount ? ` $${neg.amount}` : ''}
                              </p>
                              {neg.message && (
                                <p className="text-xs mt-1 opacity-80">{neg.message}</p>
                              )}
                              <p className="text-xs mt-1 opacity-60">
                                {formatDistanceToNow(new Date(neg.created_at))} ago
                              </p>
                            </div>
                          </div>
                        ))}
                        
                        {/* Display chat messages */}
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
                      </>
                    )}
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
