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
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNegotiationDialog, setShowNegotiationDialog] = useState(false);
  const [negotiationAmount, setNegotiationAmount] = useState('');
  const [negotiationMessage, setNegotiationMessage] = useState('');

  // Get all conversations for the user
  const { data: conversations } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data } = await supabase
        .from('chat_messages')
        .select(`
          *,
          from_profile:profiles!chat_messages_from_user_id_fkey(name, avatar_url),
          to_profile:profiles!chat_messages_to_user_id_fkey(name, avatar_url),
          listings(title)
        `)
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      // Group messages by conversation (unique combination of users)
      const conversationMap = new Map();
      data?.forEach(message => {
        const otherUserId = message.from_user_id === user.id 
          ? message.to_user_id 
          : message.from_user_id;
        
        if (!conversationMap.has(otherUserId) || 
            new Date(message.created_at) > new Date(conversationMap.get(otherUserId).created_at)) {
          conversationMap.set(otherUserId, {
            ...message,
            otherUserId,
            otherUser: message.from_user_id === user.id 
              ? message.to_profile 
              : message.from_profile
          });
        }
      });

      return Array.from(conversationMap.values());
    },
    enabled: !!user?.id
  });

  // Get messages for selected conversation
  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConversation, user?.id],
    queryFn: async () => {
      if (!selectedConversation || !user?.id) return [];

      const { data } = await supabase
        .from('chat_messages')
        .select(`
          *,
          from_profile:profiles!chat_messages_from_user_id_fkey(name, avatar_url)
        `)
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${selectedConversation}),and(from_user_id.eq.${selectedConversation},to_user_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      return data || [];
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

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user?.id) return;

    const { error } = await supabase
      .from('chat_messages')
      .insert([{
        from_user_id: user.id,
        to_user_id: selectedConversation,
        message_text: newMessage.trim(),
        order_id: orderId || null
      }]);

    if (!error) {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
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

  // Auto-select conversation from order context
  useEffect(() => {
    if (orderContext && user) {
      const otherUserId = orderContext.seller_id === user.id 
        ? orderContext.buyer_id 
        : orderContext.seller_id;
      setSelectedConversation(otherUserId);
    }
  }, [orderContext, user]);

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-200px)] flex gap-4">
        {/* Conversations List */}
        <Card className="w-80 flex flex-col">
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
                  {conversations?.map((conversation) => (
                    <button
                      key={conversation.otherUserId}
                      onClick={() => setSelectedConversation(conversation.otherUserId)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedConversation === conversation.otherUserId
                          ? 'bg-accent'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={conversation.otherUser?.avatar_url} />
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
                  ))}
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
                        <p className="font-medium">{orderContext.listings?.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Order #{orderContext.id.slice(0, 8)} • ${orderContext.final_amount}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={orderContext.status === 'accepted' ? 'default' : 'secondary'}>
                        {orderContext.status}
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
                  <Button onClick={sendMessage} disabled={!newMessage.trim()}>
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