import React, { useState, useEffect, useRef } from 'react';
import { 
  initializeSocket, 
  joinRoom, 
  sendMessage, 
  onReceiveMessage, 
  onUserJoined, 
  onUserLeft,
  disconnectSocket
} from '~/utils/socket';
import { useNavigate } from '@remix-run/react';
import { getMessages, subscribeToMessages, type Message as SupabaseMessage } from '~/utils/supabase';

type Message = {
  username: string;
  message: string;
  time: string;
};

type ChatRoomProps = {
  username: string;
  room: string;
};

export default function ChatRoom({ username, room }: ChatRoomProps) {
  const [currentMessage, setCurrentMessage] = useState('');
  const [messageList, setMessageList] = useState<Message[]>([]);
  const navigate = useNavigate();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 최초 렌더링 시 채팅방 입장 및 이벤트 리스너 설정
  useEffect(() => {
    // 유효한 사용자 이름과 방 이름이 있는지 확인
    if (!username || !room) {
      navigate('/');
      return;
    }

    // 소켓 초기화 및 채팅방 입장
    initializeSocket();
    joinRoom(username, room);

    // 이전 메시지 로드
    const loadMessages = async () => {
      const messages = await getMessages(room);
      const formattedMessages = messages.map((msg: SupabaseMessage) => ({
        username: msg.username,
        message: msg.message,
        time: new Date(msg.created_at).toLocaleTimeString(),
      }));
      
      setMessageList(formattedMessages);
    };
    
    loadMessages();
    
    // Supabase 실시간 구독 설정
    const subscription = subscribeToMessages(room, (newMessage) => {
      if (newMessage.username !== username) {
        const formattedMessage = {
          username: newMessage.username,
          message: newMessage.message,
          time: new Date(newMessage.created_at).toLocaleTimeString(),
        };
        
        setMessageList((list) => [...list, formattedMessage]);
      }
    });

    // 소켓 이벤트 리스너 설정
    onReceiveMessage((data) => {
      setMessageList((list) => [...list, data]);
    });

    onUserJoined((data) => {
      setMessageList((list) => [...list, data]);
    });

    onUserLeft((data) => {
      setMessageList((list) => [...list, data]);
    });

    // 컴포넌트 언마운트 시 정리
    return () => {
      disconnectSocket();
      subscription.unsubscribe();
    };
  }, [username, room, navigate]);

  // 메시지 리스트가 업데이트될 때 스크롤을 아래로 이동
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messageList]);

  // 메시지 전송 함수
  const handleSendMessage = async () => {
    if (currentMessage.trim() !== '') {
      const messageData = {
        username,
        message: currentMessage,
        time: new Date().toLocaleTimeString(),
      };

      await sendMessage(currentMessage, username, room);
      setMessageList((list) => [...list, messageData]);
      setCurrentMessage('');
    }
  };

  return (
    <div className="flex flex-col h-[80vh] max-w-2xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-blue-600 text-white p-4">
        <h2 className="text-xl font-semibold">채팅방: {room}</h2>
        <p className="text-sm opacity-80">{username}님으로 참여 중</p>
      </div>

      <div
        ref={chatContainerRef}
        className="flex-1 p-4 overflow-y-auto"
      >
        {messageList.map((messageContent, index) => (
          <div
            key={index}
            className={`mb-4 ${
              messageContent.username === username
                ? 'flex justify-end'
                : messageContent.username === 'system'
                ? 'flex justify-center'
                : 'flex justify-start'
            }`}
          >
            {messageContent.username === 'system' ? (
              <div className="bg-gray-200 px-4 py-2 rounded-lg max-w-xs">
                <p className="text-gray-700">{messageContent.message}</p>
                <span className="text-xs text-gray-500">{messageContent.time}</span>
              </div>
            ) : (
              <div
                className={`px-4 py-2 rounded-lg max-w-xs ${
                  messageContent.username === username
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {messageContent.username !== username && (
                  <p className="text-xs font-semibold mb-1">{messageContent.username}</p>
                )}
                <p>{messageContent.message}</p>
                <span
                  className={`text-xs ${
                    messageContent.username === username ? 'text-blue-100' : 'text-gray-500'
                  } block text-right`}
                >
                  {messageContent.time}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t p-4 flex">
        <input
          type="text"
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="메시지 입력..."
          className="flex-1 border rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSendMessage}
          className="bg-blue-600 text-white px-4 py-2 rounded-r-lg hover:bg-blue-700 transition"
        >
          전송
        </button>
      </div>
    </div>
  );
} 