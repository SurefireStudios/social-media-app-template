import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, AlertCircle, ArrowLeft, User as UserIcon, Smile, MoreVertical, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { User as UserType } from "@/lib/types";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EmojiPicker, { EmojiClickData, Theme, Categories } from 'emoji-picker-react';
import { formatTime, getCurrentTimestamp, timeAgo } from "@/lib/date-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Conversation {
  id: number;
  username: string;
  displayName?: string;
  profileImage?: string;
  lastMessage: string;
  timestamp: number; // Unix epoch timestamp in milliseconds
  unread: boolean;
  isVerified?: boolean;
}

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  createdAt: number; // Unix epoch timestamp in milliseconds
  read: boolean;
}

const Messages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [messagesList, setMessagesList] = useState<Message[]>([]);
  const [followedUserConversations, setFollowedUserConversations] = useState<Conversation[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showClearChatDialog, setShowClearChatDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const quickEmojis = ["👍", "❤️", "😂", "🔥", "👏", "😭", "🙏", "🥰", "😍", "😊"];
  const queryClient = useQueryClient();
  
  // Fetch selected user from localStorage if any
  useEffect(() => {
    const chatWithUserId = localStorage.getItem('chatWithUserId');
    if (chatWithUserId) {
      const userId = parseInt(chatWithUserId);
      
      // Clear from localStorage
      localStorage.removeItem('chatWithUserId');

      console.log('Opening 1-on-1 chat with user ID:', userId);
      
      // Fetch the user from API
      const fetchUserById = async () => {
        try {
          console.log('Fetching user data for chat with userId:', userId);
          const response = await apiRequest('GET', `/api/users/${userId}`);
          const userData = await response.json();
          if (userData) {
            const newConversation: Conversation = {
              id: userData.id,
              username: userData.username,
              displayName: userData.displayName,
              profileImage: userData.profileImageUrl,
              lastMessage: "Click to start chatting",
              timestamp: Date.now(), // Current time in epoch format
              unread: false,
              isVerified: userData.isVerified
            };
            
            // Set as active conversation
            setActiveConversation(newConversation);
            
            // Add to conversations if not already there
            if (!followedUserConversations.some(c => c.id === userData.id)) {
              setFollowedUserConversations(prev => [newConversation, ...prev]);
            }
          }
        } catch (error) {
          console.error('Error fetching user for chat:', error);
          toast({
            title: 'Error',
            description: 'Could not load user data for chat',
            variant: 'destructive'
          });
        }
      };
      
      fetchUserById();
    }
  }, [toast, followedUserConversations]);
  
  // When conversation changes, mark as read but don't clear messages
  useEffect(() => {
    if (activeConversation) {
      // Just mark as read when opened
      if (activeConversation.unread) {
        activeConversation.unread = false;
      }
    }
  }, [activeConversation]);
  
  // Get conversations from API
  const { data: conversationsData, isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await apiRequest('GET', `/api/messages/conversations`);
      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }
      return response.json();
    },
    enabled: !!user?.id
  });

  // Set conversations when data is available
  useEffect(() => {
    if (conversationsData && conversationsData.length > 0) {
      // Directly set the conversations - server now sends correct timestamp format
      setFollowedUserConversations(conversationsData);
    }
  }, [conversationsData]);
  
  // Get messages for active conversation
  const { data: messageData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', user?.id, activeConversation?.id],
    queryFn: async () => {
      if (!user?.id || !activeConversation?.id) return [];
      const response = await apiRequest('GET', `/api/messages/${user.id}/${activeConversation.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      return response.json();
    },
    enabled: !!user?.id && !!activeConversation?.id
  });
  
  // Update messages list when message data changes
  useEffect(() => {
    if (messageData) {
      setMessagesList(messageData);
      
      // Scroll to bottom when messages are loaded
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messageData]);
  
  // Mark messages as read when conversation changes
  useEffect(() => {
    if (user?.id && activeConversation?.id) {
      // Call API to mark messages as read
      const markMessagesAsRead = async () => {
        try {
          await apiRequest('PATCH', `/api/messages/read/${activeConversation.id}/${user.id}`);
          // We don't need to do anything with the response
          // The next time we fetch conversations, they will show as read
        } catch (error) {
          console.error("Error marking messages as read:", error);
        }
      };
      
      markMessagesAsRead();
    }
  }, [user?.id, activeConversation?.id]);
  
  // Use only real followed user conversations, no sample data
  const conversations: Conversation[] = followedUserConversations;
  
  // Create a mutation for sending messages
  const sendMessageMutation = useMutation({
    mutationFn: async (messageContent: string) => {
      if (!user?.id || !activeConversation?.id) {
        throw new Error('Cannot send message: missing user or conversation');
      }
      
      const response = await apiRequest('POST', '/api/messages', {
        senderId: user.id,
        receiverId: activeConversation.id,
        content: messageContent,
        timestamp: getCurrentTimestamp() // Use the utility function
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      return response.json();
    },
    onSuccess: (newMessage) => {
      // Update local messages list immediately
      setMessagesList(prev => [...prev, newMessage]);
      
      // Invalidate conversation and message queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['messages', user?.id, activeConversation?.id] });
      
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive'
      });
      console.error('Error sending message:', error);
    }
  });
  
  const handleSendMessage = () => {
    if (!messageText.trim() || !user?.id || !activeConversation?.id) return;
    
    // Send message via mutation
    sendMessageMutation.mutate(messageText);
    
    // Clear input
    setMessageText("");
  };
  
  // Custom hook for window size
  const useWindowSize = () => {
    const [windowSize, setWindowSize] = useState({
      width: typeof window !== 'undefined' ? window.innerWidth : 0,
      height: typeof window !== 'undefined' ? window.innerHeight : 0,
    });
  
    useLayoutEffect(() => {
      // Handler to call on window resize
      function handleResize() {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }
      
      // Add event listener
      window.addEventListener("resize", handleResize);
      
      // Call handler right away so state gets updated with initial window size
      handleResize();
      
      // Remove event listener on cleanup
      return () => window.removeEventListener("resize", handleResize);
    }, []); // Empty array ensures that effect is only run on mount
    
    return windowSize;
  };

  // Get current window size
  const { width } = useWindowSize();
  const isMobile = width < 768;
  
  // State to control mobile view
  const [showMobileConversationList, setShowMobileConversationList] = useState(true);

  // Handle selecting a conversation on mobile
  const handleSelectConversation = (convo: Conversation) => {
    setActiveConversation(convo);
    // On mobile, hide the conversation list when a conversation is selected
    if (isMobile) {
      setShowMobileConversationList(false);
    }
  };

  // Go back to conversation list (mobile only)
  const handleBackToList = () => {
    setShowMobileConversationList(true);
  };

  // Handle emoji selection
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessageText(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };
  
  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add quick emoji to message
  const addQuickEmoji = (emoji: string) => {
    setMessageText(prev => prev + emoji);
  };

  // Create a mutation for clearing chat messages
  const clearChatMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !activeConversation?.id) {
        throw new Error('Cannot clear chat: missing user or conversation');
      }
      
      const response = await apiRequest('DELETE', `/api/messages/${user.id}/${activeConversation.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to clear chat history');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Clear local messages list immediately
      setMessagesList([]);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['messages', user?.id, activeConversation?.id] });
      
      toast({
        title: 'Chat cleared',
        description: 'All messages in this conversation have been deleted.',
      });
      
      setShowClearChatDialog(false);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to clear chat history. Please try again.',
        variant: 'destructive'
      });
      console.error('Error clearing chat:', error);
    }
  });

  const handleClearChat = () => {
    clearChatMutation.mutate();
  };

  return (
    <div className="h-full bg-dark flex flex-col">
      <div className="p-4 border-b border-dark-lighter mb-2">
        <h2 className="text-xl font-semibold text-light">Messages</h2>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Conversations sidebar - hidden on mobile when conversation is active */}
        <div className={`md:w-1/3 w-full border-r border-dark-lighter overflow-y-auto custom-scrollbar
          ${(!showMobileConversationList && activeConversation) ? 'hidden md:block' : 'block'}`}>
          <div className="p-1">
            {conversations.map(convo => (
              <div 
                key={convo.id}
                onClick={() => handleSelectConversation(convo)}
                className={`p-3 border-b border-dark-lighter flex items-center cursor-pointer hover:bg-dark-light transition-colors ${
                  activeConversation?.id === convo.id ? 'bg-dark-light' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-dark-lighter flex-shrink-0 mr-3 overflow-hidden">
                  {convo.profileImage ? (
                    <img src={convo.profileImage} alt={convo.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      {convo.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className={`font-medium truncate flex items-center ${convo.unread ? 'text-light' : 'text-gray-300'}`}>
                      {convo.displayName || convo.username}
                      {convo.isVerified && (
                        <span className="ml-1 text-blue-500 flex-shrink-0" title="Verified User">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                            <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </p>
                    <span className="text-xs text-gray-400">
                      {timeAgo(convo.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <p className="text-sm text-gray-400 truncate flex-1">
                      {convo.lastMessage}
                    </p>
                    {convo.unread && (
                      <Badge variant="default" className="bg-primary ml-1 h-2 w-2 rounded-full p-0 flex-shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {conversations.length === 0 && (
              <div className="p-6 text-center text-gray-400">
                <AlertCircle className="mx-auto mb-2 w-10 h-10 opacity-50" />
                <p>No conversations yet</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Message area - full width on mobile when conversation is active */}
        <div className={`md:flex-1 w-full flex flex-col 
          ${(showMobileConversationList && isMobile) ? 'hidden' : 'block'}`}>
          {activeConversation ? (
            <>
              {/* Conversation header with back button on mobile */}
              <div className="p-3 border-b border-dark-lighter flex items-center justify-between">
                <div className="flex items-center">
                  {/* Back button - only visible on mobile */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden mr-2 text-gray-400 hover:text-white"
                    onClick={handleBackToList}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  
                  <div className="w-8 h-8 rounded-full bg-dark-lighter mr-3 overflow-hidden">
                    {activeConversation.profileImage ? (
                      <img 
                        src={activeConversation.profileImage} 
                        alt={activeConversation.username} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        {activeConversation.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <p className="font-medium text-light flex items-center">
                    {activeConversation.displayName || activeConversation.username}
                    {activeConversation.isVerified && (
                      <span className="ml-1 text-blue-500" title="Verified User">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </p>
                </div>
                
                {/* Chat options menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-white"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-dark-light border-dark-lighter">
                    <DropdownMenuItem 
                      onClick={() => setShowClearChatDialog(true)}
                      className="text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-dark"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear Chat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Message list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar message-container">
                {messagesLoading ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div className="p-4">
                      <div className="w-8 h-8 border-t-2 border-primary rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-gray-400">Loading messages...</p>
                    </div>
                  </div>
                ) : messagesList.length > 0 ? (
                  messagesList.map(message => {
                    const isOwnMessage = message.senderId === user?.id;
                    
                    return (
                      <div 
                        key={message.id} 
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                          className={`max-w-[80%] rounded-lg px-3 py-2 ${
                            isOwnMessage 
                              ? 'bg-primary text-white rounded-tr-none' 
                              : 'bg-dark-light text-gray-200 rounded-tl-none'
                          }`}
                        >
                          <p className={`${message.content.length <= 4 && /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])+$/.test(message.content) ? 'text-2xl emoji-pulse' : ''}`}>
                            {message.content}
                          </p>
                          <p className={`text-xs mt-1 ${isOwnMessage ? 'text-primary-light' : 'text-gray-400'}`}>
                            {timeAgo(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex items-center justify-center text-center">
                    <div className="p-4">
                      <p className="text-gray-400 mb-2">No messages yet</p>
                      <p className="text-sm text-gray-500">Send a message to start the conversation</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Message input */}
              <div className="p-3 border-t border-dark-lighter flex flex-col">
                <div className="flex mb-2 overflow-x-auto pb-1 hide-scrollbar">
                  {quickEmojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => addQuickEmoji(emoji)}
                      className="min-w-[32px] h-8 text-xl flex items-center justify-center hover:bg-dark-light rounded-md mx-1 transition-colors first:ml-0"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="flex">
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-dark-light border-dark-light text-light"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSendMessage();
                      }
                    }}
                  />
                  <div className="relative">
                    <Button 
                      className="ml-2 bg-dark-light text-gray-300 hover:text-white"
                      size="icon"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    >
                      <Smile className="h-4 w-4" />
                    </Button>
                    
                    {showEmojiPicker && (
                      <div 
                        ref={emojiPickerRef}
                        className="absolute bottom-full right-0 mb-2 z-10"
                      >
                        <EmojiPicker
                          onEmojiClick={handleEmojiClick}
                          lazyLoadEmojis
                          theme={Theme.DARK}
                          skinTonesDisabled
                          searchDisabled={false}
                          width={280}
                          height={350}
                          previewConfig={{ showPreview: false }}
                          categories={[
                            { name: 'Smileys & People', category: Categories.SMILEYS_PEOPLE },
                            { name: 'Animals & Nature', category: Categories.ANIMALS_NATURE },
                            { name: 'Food & Drink', category: Categories.FOOD_DRINK },
                            { name: 'Travel & Places', category: Categories.TRAVEL_PLACES },
                            { name: 'Activities', category: Categories.ACTIVITIES },
                            { name: 'Objects', category: Categories.OBJECTS },
                            { name: 'Symbols', category: Categories.SYMBOLS },
                            { name: 'Flags', category: Categories.FLAGS }
                          ]}
                        />
                      </div>
                    )}
                  </div>
                  <Button 
                    className="ml-2 bg-primary" 
                    size="icon"
                    onClick={handleSendMessage}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <div className="w-16 h-16 rounded-full bg-dark-light flex items-center justify-center mb-4">
                <UserIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-light mb-2">Your Messages</h3>
              {followedUserConversations.length === 0 ? (
                <>
                  <p className="text-gray-400 max-w-xs mb-4">
                    You're not following any miners yet. Follow some miners to start chatting with them!
                  </p>
                  <Button 
                    className="bg-primary hover:bg-primary/90"
                    onClick={() => setLocation("/leaderboard")}
                  >
                    Go to Leaderboard
                  </Button>
                </>
              ) : (
                <p className="text-gray-400 max-w-xs">
                  Select a conversation from the list to start chatting.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Clear Chat Confirmation Dialog */}
      <AlertDialog open={showClearChatDialog} onOpenChange={setShowClearChatDialog}>
        <AlertDialogContent className="bg-dark border-dark-lighter">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-light">Clear Chat History</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to clear all messages in this conversation with{" "}
              <span className="font-semibold text-light">
                {activeConversation?.displayName || activeConversation?.username}
              </span>? 
              This action cannot be undone and will delete the entire chat history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-dark-light border-dark-lighter text-light hover:bg-dark">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearChat}
              disabled={clearChatMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {clearChatMutation.isPending ? "Clearing..." : "Clear Chat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Messages;