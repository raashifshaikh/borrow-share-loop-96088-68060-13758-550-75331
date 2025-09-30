import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { Send, MessageSquare } from 'lucide-react';

const Messages = () => {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

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

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user?.id) return;

    const { error } = await supabase
      .from('chat_messages')
      .insert([{
        from_user_id: user.id,
        to_user_id: selectedConversation,
        message_text: newMessage.trim()
      }]);

    if (!error) {
      setNewMessage('');
      // Refetch messages
    }
  };

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
    </DashboardLayout>
  );
};

export default Messages;