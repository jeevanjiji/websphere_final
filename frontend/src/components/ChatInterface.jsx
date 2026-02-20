import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { motion } from 'framer-motion';
import { 
  PaperAirplaneIcon,
  PaperClipIcon,
  XMarkIcon,
  UserIcon,
  CurrencyDollarIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import { toast } from 'react-hot-toast';
import { formatMessageTime } from '../utils/dateUtils';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api.js';

const MAX_MESSAGE_LENGTH = 10000;

const ChatInterface = ({ chatId, isOpen, onClose, user, isWorkspaceChat = false }) => {
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chat, setChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerDetails, setOfferDetails] = useState({
    proposedRate: '',
    timeline: '',
    description: ''
  });
  const [respondingToOffer, setRespondingToOffer] = useState(null);
  const [priceLocked, setPriceLocked] = useState(false);
  const [agreedPrice, setAgreedPrice] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (chatId && isOpen) {
      fetchChatDetails();
    }
  }, [chatId, isOpen]);

  // Listen for real-time messages and join chat room
  useEffect(() => {
    if (!socket || !chatId) return;
    
    // Join the chat room
    socket.emit('join-chat', chatId);
    console.log('🔗 Joined chat room:', chatId);
    
    const handleMessageReceived = (data) => {
      console.log('📨 Received message in chat:', data);
      if (data.chatId === chatId) {
        setMessages(prev => [...prev, data.message]);
        scrollToBottom();
      }
    };

    const handleOfferResponse = (data) => {
      console.log('📩 Offer response received:', data);
      // Update the offer message status
      setMessages(prev => prev.map(msg =>
        msg._id === data.messageId
          ? { ...msg, offerStatus: data.offerStatus }
          : msg
      ));
    };
    
    socket.on('message-received', handleMessageReceived);
    socket.on('offer-response', handleOfferResponse);
    
    return () => {
      socket.off('message-received', handleMessageReceived);
      socket.off('offer-response', handleOfferResponse);
      socket.emit('leave-chat', chatId);
      console.log('🚪 Left chat room:', chatId);
    };
  }, [socket, chatId]);
  useEffect(() => {
    scrollToBottom();
  }, [messages]);



  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChatDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CHATS.BY_ID(chatId)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setChat(data.chat);
        setMessages(data.messages);
        // Track price lock state - locked if agreed price exists OR project is already awarded
        if (data.chat?.project?.agreedPrice || data.chat?.project?.status === 'awarded' || data.chat?.project?.status === 'in_progress') {
          setPriceLocked(true);
          setAgreedPrice(data.chat.project.agreedPrice || data.chat.project.finalRate || data.chat.project.budgetAmount);
        }
      } else {
        toast.error(data.message || 'Failed to load chat');
      }
    } catch (error) {
      console.error('Error fetching chat:', error);
      toast.error('Failed to load chat');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (messageData) => {
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CHATS.MESSAGES(chatId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(messageData)
      });

      const data = await response.json();
      if (data.success) {
        // Don't add message here - let socket handle it to avoid duplicates
        setNewMessage('');
        setShowOfferForm(false);
        setOfferDetails({ proposedRate: '', timeline: '', description: '' });
      } else {
        toast.error(data.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (newMessage.trim().length > MAX_MESSAGE_LENGTH) {
      toast.error(`Message is too long (${newMessage.trim().length} chars). Maximum is ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`);
      return;
    }

    sendMessage({
      content: newMessage.trim(),
      messageType: 'text'
    });
  };

  const handleSendOffer = (e) => {
    e.preventDefault();
    if (!offerDetails.proposedRate || !offerDetails.timeline) {
      toast.error('Please fill in rate and completion date');
      return;
    }

    if (priceLocked) {
      toast.error(`Price is already locked at \u20b9${agreedPrice?.toLocaleString()}`);
      return;
    }

    const rate = parseFloat(offerDetails.proposedRate);
    const userRole = user?.role || user?.userType;
    const clientBudget = chat?.project?.budgetAmount;

    // Enforce freelancer cap: 20% above client's budget
    if (userRole === 'freelancer' && clientBudget) {
      const maxAllowed = clientBudget * 1.20;
      if (rate > maxAllowed) {
        toast.error(`Your offer can't exceed \u20b9${maxAllowed.toLocaleString()} (20% above the project budget of \u20b9${clientBudget.toLocaleString()})`);
        return;
      }
    }

    // Validate timeline date is not past project deadline
    if (chat?.project?.deadline && offerDetails.timeline) {
      const proposedDate = new Date(offerDetails.timeline);
      const deadline = new Date(chat.project.deadline);
      if (proposedDate > deadline) {
        toast.error(`Completion date cannot exceed project deadline (${deadline.toLocaleDateString()})`);
        return;
      }
    }

    const timelineDisplay = new Date(offerDetails.timeline).toLocaleDateString();
    sendMessage({
      content: `New offer: Rs.${offerDetails.proposedRate} - by ${timelineDisplay}`,
      messageType: 'offer',
      offerDetails: {
        proposedRate: rate,
        timeline: offerDetails.timeline,
        description: offerDetails.description
      }
    });
  };

  const isCurrentUser = (senderId) => {
    const currentUserId = user?.id || user?._id || user?.userId;
    return senderId === currentUserId;
  };

  const getOtherParticipant = () => {
    if (!chat?.participants) return null;
    const currentUserId = user?.id || user?._id || user?.userId;
    return chat.participants.find(p => p.user._id !== currentUserId)?.user;
  };

  const handleRespondToOffer = async (messageId, action) => {
    if (respondingToOffer === messageId) return;
    
    setRespondingToOffer(messageId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/chats/messages/${messageId}/respond-to-offer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Offer ${action}ed successfully!`);
        // Update the message in local state AND auto-decline all other pending offers
        setMessages(prev => prev.map(msg => {
          if (msg._id === messageId) {
            return { ...msg, offerStatus: action === 'accept' ? 'accepted' : 'declined' };
          }
          // If this offer was accepted, auto-decline all other pending offers
          if (action === 'accept' && msg.messageType === 'offer' && msg.offerStatus === 'pending') {
            return { ...msg, offerStatus: 'declined' };
          }
          return msg;
        }));
        // Add the system message
        if (data.data.responseMessage) {
          setMessages(prev => [...prev, data.data.responseMessage]);
        }
        // If accepted, lock the price locally
        if (action === 'accept' && data.data.message?.offerDetails?.proposedRate) {
          setPriceLocked(true);
          setAgreedPrice(data.data.message.offerDetails.proposedRate);
        }
      } else {
        toast.error(data.message || `Failed to ${action} offer`);
      }
    } catch (error) {
      console.error('Error responding to offer:', error);
      toast.error(`Failed to ${action} offer`);
    } finally {
      setRespondingToOffer(null);
    }
  };



  if (!isOpen) return null;

  // Render embedded version for workspace
  if (isWorkspaceChat) {
    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {getOtherParticipant()?.profilePicture ? (
                <img
                  src={getOtherParticipant().profilePicture}
                  alt={getOtherParticipant().fullName}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <UserIcon className="h-4 w-4 text-gray-600" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-900">
                  {getOtherParticipant()?.fullName}
                </h3>
                <div className="text-sm text-gray-500">
                  Project: {chat?.project?.title}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">💬</div>
              <p className="text-gray-500">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isMine = message.sender._id === user.id;
              return (
                <div
                  key={message._id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] rounded-lg p-3 ${
                    isMine 
                      ? 'bg-green-600 text-white' 
                      : 'bg-white border border-gray-200'
                  }`}>
                    {/* AI Summary for freelancers viewing long client messages */}
                    {!isMine && message.aiSummary && (user?.role === 'freelancer' || user?.userType === 'freelancer') && (
                      <div className="mb-2 p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center gap-1 text-xs font-semibold text-purple-700 mb-1">
                          <span>🤖</span> AI Summary
                        </div>
                        <p className="text-xs text-purple-800 leading-relaxed">{message.aiSummary}</p>
                        {message.aiActionItems?.length > 0 && (
                          <div className="mt-1.5">
                            <div className="text-xs font-semibold text-purple-700 mb-0.5">Action Items:</div>
                            <ul className="list-disc list-inside text-xs text-purple-800 space-y-0.5">
                              {message.aiActionItems.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-sm">{message.content}</p>
                    
                    {/* Sentiment Indicator */}
                    {message.sentiment && message.messageType === 'text' && (
                      <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${
                        isMine ? 'text-green-100' : 'text-gray-400'
                      }`}>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          message.sentiment.label === 'very_positive' ? 'bg-green-500/30 text-green-100' :
                          message.sentiment.label === 'positive' ? 'bg-green-400/30 text-green-100' :
                          message.sentiment.label === 'neutral' ? 'bg-gray-400/30 text-gray-100' :
                          message.sentiment.label === 'negative' ? 'bg-orange-400/30 text-orange-100' :
                          message.sentiment.label === 'very_negative' ? 'bg-red-500/30 text-red-100' :
                          'bg-gray-400/30 text-gray-100'
                        }`}>
                          {message.sentiment.label === 'very_positive' ? '++ Positive' :
                           message.sentiment.label === 'positive' ? '+ Positive' :
                           message.sentiment.label === 'neutral' ? 'Neutral' :
                           message.sentiment.label === 'negative' ? '- Negative' :
                           message.sentiment.label === 'very_negative' ? '-- Negative' : 'Neutral'}
                        </span>
                        {message.sentiment.tones?.length > 0 && (
                          <span className="opacity-75 capitalize">
                            • {message.sentiment.tones.slice(0, 2).join(', ')}
                          </span>
                        )}
                        {message.sentiment.isFlagged && (
                          <span className="text-red-400 font-medium flex items-center gap-0.5">
                            ⚠ Flagged
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className={`text-xs mt-1 ${
                      isMine ? 'text-green-100' : 'text-gray-500'
                    }`}>
                      {formatMessageTime(message.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-200">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                placeholder="Type your message..."
                rows={1}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 resize-none overflow-hidden"
                disabled={sending}
                style={{ minHeight: '40px', maxHeight: '120px' }}
                onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                <PaperClipIcon className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={!newMessage.trim() || sending || newMessage.trim().length > MAX_MESSAGE_LENGTH}
              className="flex items-center gap-2"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </form>
          {newMessage.length > MAX_MESSAGE_LENGTH * 0.9 && (
            <p className={`text-xs mt-1 text-right ${newMessage.length > MAX_MESSAGE_LENGTH ? 'text-red-500 font-semibold' : 'text-yellow-600'}`}>
              {newMessage.length.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()} characters
            </p>
          )}
        </div>
      </div>
    );
  }

  // Render modal version for regular chat
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {getOtherParticipant()?.profilePicture ? (
                <img
                  src={getOtherParticipant().profilePicture}
                  alt={getOtherParticipant().fullName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <UserIcon className="h-6 w-6 text-white" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-900">
                  {getOtherParticipant()?.fullName || 'Chat'}
                </h3>
                <p className="text-sm text-gray-600">
                  {chat?.project?.title}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!priceLocked && chat?.project?.status !== 'awarded' && chat?.project?.status !== 'in_progress' && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => setShowOfferForm(!showOfferForm)}
              >
                Make Offer
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-6 w-6 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Project Info & Price Status */}
        {chat?.project && (
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            {/* Agreed Price Banner */}
            {priceLocked && agreedPrice && (
              <div className="mb-3 p-3 bg-green-50 border border-green-300 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 font-semibold text-sm">
                  <span>🔒</span>
                  <span>Price Agreed: ₹{agreedPrice.toLocaleString()}</span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Both parties have agreed on this price. It has been applied to the project, milestones, and payments.
                </p>
              </div>
            )}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
                <span>Budget: ₹{(chat.project.agreedPrice || chat.project.budgetAmount)?.toLocaleString()} ({chat.project.budgetType})</span>
              </div>
              {chat.project.deadline && (
                <div className="flex items-center gap-1">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <span>Due: {new Date(chat.project.deadline).toLocaleDateString()}</span>
                </div>
              )}
              <div className="ml-auto">
                <span className="text-gray-600">
                  Application Rate: Rs.{chat.application?.proposedRate}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Offer Form */}
        {showOfferForm && (
          <div className="p-4 bg-blue-50 border-b border-gray-200">
            <form onSubmit={handleSendOffer} className="space-y-3">
              <h4 className="font-medium text-gray-900">Make an Offer</h4>
              {/* Budget context */}
              {chat?.project?.budgetAmount && (
                <div className="text-xs text-gray-600 bg-white rounded p-2 border border-blue-200">
                  <span className="font-medium">Client Budget:</span> ₹{chat.project.budgetAmount.toLocaleString()}
                  {user?.role === 'freelancer' && (
                    <span className="ml-2 text-orange-600">
                      • Max you can offer: ₹{Math.round(chat.project.budgetAmount * 1.2).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Proposed Rate (Rs.)
                  </label>
                  <input
                    type="number"
                    value={offerDetails.proposedRate}
                    onChange={(e) => setOfferDetails(prev => ({ ...prev, proposedRate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Completion Date
                  </label>
                  <input
                    type="date"
                    value={offerDetails.timeline}
                    onChange={(e) => setOfferDetails(prev => ({ ...prev, timeline: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    max={chat?.project?.deadline ? new Date(chat.project.deadline).toISOString().split('T')[0] : undefined}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      offerDetails.timeline && chat?.project?.deadline && new Date(offerDetails.timeline) > new Date(chat.project.deadline)
                        ? 'border-red-400 bg-red-50'
                        : 'border-gray-300'
                    }`}
                  />
                  {chat?.project?.deadline && (
                    <p className="text-xs text-gray-500 mt-1">
                      Deadline: {new Date(chat.project.deadline).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Details
                </label>
                <textarea
                  value={offerDetails.description}
                  onChange={(e) => setOfferDetails(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Any additional terms or conditions..."
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" size="small">
                  Send Offer
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => setShowOfferForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isMine = isCurrentUser(message.sender._id);
              return (
                <div
                  key={message._id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      isMine
                        ? 'bg-green-500 text-white rounded-bl-lg rounded-tl-lg rounded-tr-sm rounded-br-lg shadow-md'
                        : message.messageType === 'system'
                        ? 'bg-gray-100 text-gray-700 text-center'
                        : 'bg-white text-gray-900 rounded-br-lg rounded-tr-lg rounded-tl-sm rounded-bl-lg shadow-md border border-gray-200'
                    }`}
                  >
                    {message.messageType === 'offer' && (
                      <div className={`mb-2 p-3 rounded ${
                        message.offerStatus === 'accepted' ? 'bg-green-100 border border-green-300' :
                        message.offerStatus === 'declined' ? 'bg-red-100 border border-red-300' :
                        'bg-blue-50 border border-blue-200'
                      }`}>
                        <div className="font-semibold text-sm mb-1 flex items-center justify-between">
                          <span className={
                            message.offerStatus === 'accepted' ? 'text-green-800' :
                            message.offerStatus === 'declined' ? 'text-red-800' :
                            'text-blue-800'
                          }>
                            💼 {message.offerStatus === 'accepted' ? '✅ Offer Accepted' :
                               message.offerStatus === 'declined' ? '❌ Offer Declined' :
                               'Offer Details'}
                          </span>
                        </div>
                        <div className={`text-sm space-y-1 ${
                          message.offerStatus === 'accepted' ? 'text-green-700' :
                          message.offerStatus === 'declined' ? 'text-red-700' :
                          'text-blue-700'
                        }`}>
                          <div><strong>Rate:</strong> ₹{message.offerDetails?.proposedRate?.toLocaleString()}</div>
                          <div><strong>Completion:</strong> {message.offerDetails?.timeline ? (() => { const d = new Date(message.offerDetails.timeline); return isNaN(d.getTime()) ? message.offerDetails.timeline : d.toLocaleDateString(); })() : 'N/A'}</div>
                          {message.offerDetails?.description && (
                            <div><strong>Terms:</strong> {message.offerDetails.description}</div>
                          )}
                        </div>
                        
                        {/* Accept/Decline Buttons - Only show if pending and not sender */}
                        {message.offerStatus === 'pending' && !isMine && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleRespondToOffer(message._id, 'accept')}
                              disabled={respondingToOffer === message._id}
                              className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              {respondingToOffer === message._id ? 'Processing...' : '✓ Accept Offer'}
                            </button>
                            <button
                              onClick={() => handleRespondToOffer(message._id, 'decline')}
                              disabled={respondingToOffer === message._id}
                              className="flex-1 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {respondingToOffer === message._id ? 'Processing...' : '✗ Decline'}
                            </button>
                          </div>
                        )}
                        
                        {/* Pending indicator for sender */}
                        {message.offerStatus === 'pending' && isMine && (
                          <div className="text-xs text-blue-600 mt-2 italic">
                            ⏳ Awaiting response...
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* AI Summary for freelancers viewing long client messages */}
                    {!isMine && message.aiSummary && (user?.role === 'freelancer' || user?.userType === 'freelancer') && (
                      <div className="mb-2 p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center gap-1 text-xs font-semibold text-purple-700 mb-1">
                          <span>🤖</span> AI Summary
                        </div>
                        <p className="text-xs text-purple-800 leading-relaxed">{message.aiSummary}</p>
                        {message.aiActionItems?.length > 0 && (
                          <div className="mt-1.5">
                            <div className="text-xs font-semibold text-purple-700 mb-0.5">Action Items:</div>
                            <ul className="list-disc list-inside text-xs text-purple-800 space-y-0.5">
                              {message.aiActionItems.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-sm">{message.content}</p>
                    
                    {/* Sentiment Indicator */}
                    {message.sentiment && message.messageType === 'text' && (
                      <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${
                        isMine ? 'text-green-100' : 'text-gray-400'
                      }`}>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          message.sentiment.label === 'very_positive' ? 'bg-green-500/30 text-green-100' :
                          message.sentiment.label === 'positive' ? 'bg-green-400/30 text-green-100' :
                          message.sentiment.label === 'neutral' ? 'bg-gray-400/30 text-gray-100' :
                          message.sentiment.label === 'negative' ? 'bg-orange-400/30 text-orange-100' :
                          message.sentiment.label === 'very_negative' ? 'bg-red-500/30 text-red-100' :
                          'bg-gray-400/30 text-gray-100'
                        }`}>
                          {message.sentiment.label === 'very_positive' ? '++ Positive' :
                           message.sentiment.label === 'positive' ? '+ Positive' :
                           message.sentiment.label === 'neutral' ? 'Neutral' :
                           message.sentiment.label === 'negative' ? '- Negative' :
                           message.sentiment.label === 'very_negative' ? '-- Negative' : 'Neutral'}
                        </span>
                        {message.sentiment.tones?.length > 0 && (
                          <span className="opacity-75 capitalize">
                            • {message.sentiment.tones.slice(0, 2).join(', ')}
                          </span>
                        )}
                        {message.sentiment.isFlagged && (
                          <span className="text-red-400 font-medium flex items-center gap-0.5">
                            ⚠ Flagged
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className={`text-xs mt-1 ${
                      isMine ? 'text-green-100' : 'text-gray-500'
                    }`}>
                      {formatMessageTime(message.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-200">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                placeholder="Type your message..."
                rows={1}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 resize-none overflow-hidden"
                disabled={sending}
                style={{ minHeight: '40px', maxHeight: '120px' }}
                onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                <PaperClipIcon className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={!newMessage.trim() || sending || newMessage.trim().length > MAX_MESSAGE_LENGTH}
              className="flex items-center gap-2"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </form>
          {newMessage.length > MAX_MESSAGE_LENGTH * 0.9 && (
            <p className={`text-xs mt-1 text-right ${newMessage.length > MAX_MESSAGE_LENGTH ? 'text-red-500 font-semibold' : 'text-yellow-600'}`}>
              {newMessage.length.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()} characters
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ChatInterface;
