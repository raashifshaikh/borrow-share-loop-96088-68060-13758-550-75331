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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch all conversations
  const { data: conversations } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      let { data } = await supabase
        .from('chat_messages')
        .select(`*, from_profile:profiles!fk_chat_from_profile(name, avatar_url), to_profile:profiles!fk_chat_to_profile(name, avatar_url)`)
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      const conversationMap = new Map();
      data?.forEach(message => {
        const otherUserId = message.from_user_id === user.id ? message.to_user_id : message.from_user_id;
        if (!otherUserId || !message.listing_id) return;
        let otherUser = { name: 'Unknown', avatar_url: '' };
        if (message.from_user_id === user.id && message.to_profile?.name) {
          otherUser = { name: message.to_profile.name, avatar_url: message.to_profile.avatar_url || '' };
        } else if (message.from_user_id !== user.id && message.from_profile?.name) {
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

  // Auto-create a new chat if it does not exist
  useEffect(() => {
    const createNewChatIfNeeded = async () => {
      if (!selectedConversation || !user?.id || !selectedConversation.listingId) return;
      const key = `${selectedConversation.sellerId}_${selectedConversation.listingId}`;
      const chatExists = conversations?.some(conv => `${conv.otherUserId}_${conv.listingId}` === key);
      if (!chatExists) {
        try {
          await supabase
            .from('chat_messages')
            .insert([{
              from_user_id: user.id,
              to_user_id: selectedConversation.sellerId,
              listing_id: selectedConversation.listingId,
              message_text: 'New chat started'
            }]);
          queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.sellerId, selectedConversation.listingId, user.id] });
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        } catch (error) {
          console.error('Failed to create new chat:', error);
        }
      }
    };
    createNewChatIfNeeded();
  }, [selectedConversation, user?.id, conversations, queryClient]);

  // Auto-select conversation from query params
  useEffect(() => {
    if (sellerId && listingId && user) {
      if (sellerId !== user.id) setSelectedConversation({ sellerId, listingId });
    }
  }, [sellerId, listingId, user]);

  // Scroll to bottom on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user?.id) return;
    const payload = {
      from_user_id: user.id,
      to_user_id: selectedConversation.sellerId,
      listing_id: selectedConversation.listingId,
      message_text: newMessage.trim()
    };
    setIsSending(true);
    setNewMessage('');
    try {
      await supabase.from('chat_messages').insert([payload]);
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.sellerId, selectedConversation.listingId, user.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
    } catch (error: any) {
      console.error(error);
      setNewMessage(payload.message_text);
      toast({ title: 'Failed to send message', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  // Real-time subscription
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
      <div className="flex h-full">
        {/* Conversation List */}
        <div className="w-1/4 border-r border-gray-200 p-2">
          <h2 className="font-bold mb-2">Chats</h2>
          <ScrollArea className="h-[calc(100vh-80px)]">
            {conversations?.map(conv => (
              <div
                key={`${conv.otherUserId}_${conv.listingId}`}
                className={`flex items-center p-2 cursor-pointer hover:bg-gray-100 rounded ${selectedConversation?.sellerId === conv.otherUserId && selectedConversation?.listingId === conv.listingId ? 'bg-gray-200' : ''}`}
                onClick={() => setSelectedConversation({ sellerId: conv.otherUserId, listingId: conv.listingId })}
              >
                <Avatar className="w-10 h-10 mr-2">
                  {conv.otherUser?.avatar_url ? <AvatarImage src={conv.otherUser.avatar_url} /> : <AvatarFallback>{conv.otherUser?.name?.[0]}</AvatarFallback>}
                </Avatar>
                <div>
                  <p className="font-semibold">{conv.otherUser?.name}</p>
                  <p className="text-sm text-gray-500">{conv.listingTitle || 'Listing'}</p>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-auto p-4" ref={scrollRef}>
            {messages?.map(msg => (
              <div key={msg.id} className={`mb-2 flex ${msg.from_user_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-2 rounded ${msg.from_user_id === user?.id ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                  {msg.message_text}
                  <div className="text-xs text-gray-600">{formatDistanceToNow(new Date(msg.created_at))} ago</div>
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-2 border-t border-gray-200 flex items-center gap-2">
            <Input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
            />
            <Button onClick={sendMessage} disabled={isSending}>
              <Send size={16} />
            </Button>
            <Button variant="outline" onClick={() => setShowNegotiationDialog(true)}>
              <DollarSign size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Negotiation Dialog */}
      <Dialog open={showNegotiationDialog} onOpenChange={setShowNegotiationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Negotiate Price</DialogTitle>
            <DialogDescription>Send a negotiation request to the other user</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input type="number" value={negotiationAmount} onChange={e => setNegotiationAmount(e.target.value)} />
            <Label>Message</Label>
            <Textarea value={negotiationMessage} onChange={e => setNegotiationMessage(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              if (!negotiationAmount || !selectedConversation) return;
              try {
                await supabase.from('order_negotiations').insert([{
                  order_id: orderId,
                  from_user_id: user?.id,
                  action: 'propose',
                  amount: parseFloat(negotiationAmount),
                  message: negotiationMessage
                }]);
                toast({ title: 'Negotiation sent', variant: 'success' });
                setShowNegotiationDialog(false);
              } catch (err) {
                toast({ title: 'Failed', variant: 'destructive' });
              }
            }}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Messages;
