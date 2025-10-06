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

  // Fetch possible chats
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
                  otherUser: buyer.profiles || { name: 'Unknown User', avatar_url: '' },
                  listingTitle: listing.title
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
              otherUser: order.listings?.profiles || { name: 'Unknown User', avatar_url: '' },
              listingTitle: order.listings?.title || ''
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
    enabled: !!user?.id
  });

  // Fetch conversations
  const { data: conversations } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      let { data, error } = await supabase
        .from('chat_messages')
        .select(`*, from_profile:profiles!fk_chat_from_profile(name, avatar_url), to_profile:profiles!fk_chat_to_profile(name, avatar_url)`)
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

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

      const conversationMap = new Map();
      data?.forEach(message => {
        const otherUserId = message.from_user_id === user.id ? message.to_user_id : message.from_user_id;
        if (!otherUserId || !message.listing_id) return;

        let otherUser = { name: 'Unknown User', avatar_url: '' };
        if (message.from_user_id === user.id && message.to_profile && message.to_profile.name) {
          otherUser = { name: message.to_profile.name, avatar_url: message.to_profile.avatar_url || '' };
        } else if (message.from_user_id !== user.id && message.from_profile && message.from_profile.name) {
          otherUser = { name: message.from_profile.name, avatar_url: message.from_profile.avatar_url || '' };
        }

        const key = `${otherUserId}_${message.listing_id}`;
        if (!conversationMap.has(key) || new Date(message.created_at) > new Date(conversationMap.get(key).created_at)) {
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

  // Fetch messages for selected conversation
  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConversation?.sellerId, selectedConversation?.listingId, user?.id],
    queryFn: async () => {
      if (!selectedConversation || !user?.id) return [];
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`*, from_profile:profiles!fk_chat_from_profile(name, avatar_url), to_profile:profiles!fk_chat_to_profile(name, avatar_url)`)
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${selectedConversation.sellerId}),and(from_user_id.eq.${selectedConversation.sellerId},to_user_id.eq.${user.id})`)
        .eq('listing_id', selectedConversation.listingId)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!selectedConversation && !!user?.id && !!selectedConversation.listingId
  });

  // Fetch order context
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

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim()) return toast({ title: 'Cannot send empty message', variant: 'destructive' });
    if (!selectedConversation || !user?.id) return toast({ title: 'No conversation selected or user not found', variant: 'destructive' });
    if (!selectedConversation.sellerId || !selectedConversation.listingId) return toast({ title: 'Missing chat recipient or listing', variant: 'destructive' });

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    const payload = {
      from_user_id: user.id,
      to_user_id: selectedConversation.sellerId,
      listing_id: selectedConversation.listingId,
      message_text: messageText,
      order_id: orderId || null
    };
    console.log('Sending message payload:', payload);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([payload])
        .select(); // ✅ return inserted row

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Insert succeeded but no data returned (check RLS)');

      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.sellerId, selectedConversation.listingId, user.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });

      toast({ title: 'Message sent', description: 'Your message was delivered successfully' });
    } catch (error: any) {
      console.error('Failed to send message:', error);
      setNewMessage(messageText);
      toast({ title: 'Failed to send message', description: error.message || 'Please check your connection and try again', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  // Auto-select conversation from params
  useEffect(() => {
    if (sellerId && listingId && user && sellerId !== user.id) {
      setSelectedConversation({ sellerId, listingId });
    } else if (orderContext && user) {
      const otherUserId = orderContext.seller_id === user.id ? orderContext.buyer_id : orderContext.seller_id;
      setSelectedConversation({ sellerId: otherUserId, listingId: orderContext.listing_id });
    }
  }, [sellerId, listingId, user, orderContext]);

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
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedConversation, user?.id, queryClient]);

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-200px)] gap-4">
        {/* Conversations List */}
        <Card className="w-full lg:w-80 flex flex-col max-h-[400px] lg:max-h-none">
          <CardHeader><CardTitle>Conversations</CardTitle></CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-full">
              {((possibleChats?.length ?? 0) === 0 && (conversations?.length ?? 0) === 0) ? (
                <div className="p-6 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No conversations yet</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {possibleChats?.map(chat => {
                    const isActive = selectedConversation?.sellerId === chat.otherUserId && selectedConversation?.listingId === chat.listingId;
                    return (
                      <button
                        key={`possible_${chat.otherUserId}_${chat.listingId}`}
                        onClick={() => setSelectedConversation({ sellerId: chat.otherUserId, listingId: chat.listingId })}
                        className={`w-full p-3 rounded-lg text-left transition-colors ${isActive ? 'bg-accent' : 'hover:bg-accent/50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={chat.otherUser?.avatar_url || ''} />
                            <AvatarFallback>{chat.otherUser?.name?.[0] || 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{chat.otherUser?.name || 'Unknown User'}</p>
                            <p className="text-xs text-muted-foreground truncate">{chat.listingTitle || ''}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {conversations?.filter(conv => !possibleChats?.some(chat => `${chat.otherUserId}_${chat.listingId}` === `${conv.otherUserId}_${conv.listingId}`))
                    .map(conv => {
                      const isActive = selectedConversation?.sellerId === conv.otherUserId && selectedConversation?.listingId === conv.listingId;
                      return (
                        <button
                          key={`${conv.otherUserId}_${conv.listingId}`}
                          onClick={() => setSelectedConversation({ sellerId: conv.otherUserId, listingId: conv.listingId })}
                          className={`w-full p-3 rounded-lg text-left transition-colors ${isActive ? 'bg-accent' : 'hover:bg-accent/50'}`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={conv.otherUser?.avatar_url || ''} />
                              <AvatarFallback>{conv.otherUser?.name?.[0] || 'U'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{conv.otherUser?.name || 'Unknown User'}</p>
                              <p className="text-sm text-muted-foreground truncate">{conv.message_text}</p>
                              <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(conv.created_at))} ago</p>
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
              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-4">
                    {messages?.map(message => (
                      <div key={message.id} className={`flex ${message.from_user_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-sm px-4 py-2 rounded-lg ${message.from_user_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <p>{message.message_text}</p>
                          <p className={`text-xs mt-1 ${message.from_user_id === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {formatDistanceToNow(new Date(message.created_at))} ago
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
              <div className="p-4 border-t flex gap-2">
                <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." onKeyPress={(e) => e.key === 'Enter' && sendMessage()} />
                <Button onClick={sendMessage} disabled={!newMessage.trim() || isSending}><Send className="h-4 w-4" /></Button>
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
    </DashboardLayout>
  );
};

export default Messages;
