import React, { useState, useEffect, useRef } from 'react';
import { 
  initializeSocket, 
  joinRoom, 
  sendMessage, 
  onReceiveMessage, 
  onUserJoined, 
  onUserLeft,
  disconnectSocket,
  getRoomUsers,
  onRoomUsers,
  onRoomUsersUpdated,
  reconnectSocket,
  onMessageReadStatus,
  onLastMessage,
  updateUserActivity,
  onReceiveMessageAll,
  onMessageError
} from '~/utils/socket';
import { useNavigate } from '@remix-run/react';
import { getMessages, subscribeToMessages, type Message as SupabaseMessage } from '~/utils/supabase';

type Message = {
  id?: string;
  username: string;
  message: string;
  time: string;
  readBy?: string[];
  sending?: boolean;
  sent?: boolean;
  error?: boolean;
  imageUrl?: string;
};

type UserInfo = {
  username: string;
  online: boolean;
  lastActive: Date | null;
};

type ChatRoomProps = {
  username: string;
  room: string;
};

// 시간 간격을 계산하여 "방금 전", "5분 전" 등의 형식으로 변환하는 함수
const getTimeAgo = (date: Date | null): string => {
  if (!date) return '알 수 없음';
  
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 10) return '방금 전';
  if (diffSec < 60) return `${diffSec}초 전`;
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${diffDay}일 전`;
};

export default function ChatRoom({ username, room }: ChatRoomProps) {
  const [currentMessage, setCurrentMessage] = useState('');
  const [messageList, setMessageList] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<UserInfo[]>([]);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [showParticipants, setShowParticipants] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const navigate = useNavigate();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const socket = useRef(initializeSocket());
  const lastActivityInterval = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 주기적인 활동 업데이트 (2분마다)
  useEffect(() => {
    const activityInterval = setInterval(() => {
      if (isConnected) {
        updateUserActivity();
      }
    }, 120000); // 2분마다
    
    return () => {
      clearInterval(activityInterval);
    };
  }, [isConnected]);

  // 최초 렌더링 시 채팅방 입장 및 이벤트 리스너 설정
  useEffect(() => {
    // 유효한 사용자 이름과 방 이름이 있는지 확인
    if (!username || !room) {
      navigate('/');
      return;
    }

    // 소켓 초기화 및 채팅방 입장
    const currentSocket = initializeSocket();
    socket.current = currentSocket;
    
    // 연결 상태 이벤트 리스너
    const handleConnect = () => {
      console.log('소켓 연결됨 - 채팅방에서 감지');
      setIsConnected(true);
      joinRoom(username, room);
      getRoomUsers();
    };
    
    const handleDisconnect = () => {
      console.log('소켓 연결 끊김 - 채팅방에서 감지');
      setIsConnected(false);
    };
    
    currentSocket.on('connect', handleConnect);
    currentSocket.on('disconnect', handleDisconnect);
    
    // 이미 연결되어 있으면 채팅방 입장
    if (currentSocket.connected) {
      setIsConnected(true);
      joinRoom(username, room);
    }

    // 이전 메시지 로드
    const loadMessages = async () => {
      const messages = await getMessages(room);
      const formattedMessages = messages.map((msg: SupabaseMessage) => ({
        id: `stored_${msg.id}`,
        username: msg.username,
        message: msg.message,
        time: new Date(msg.created_at).toLocaleTimeString(),
        readBy: [username] // 기존 메시지는 현재 사용자가 읽은 것으로 처리
      }));
      
      setMessageList(formattedMessages);
    };
    
    loadMessages();
    
    // Supabase 실시간 구독 설정
    const subscription = subscribeToMessages(room, (newMessage) => {
      if (newMessage.username !== username) {
        const formattedMessage = {
          id: `supabase_${newMessage.id}`,
          username: newMessage.username,
          message: newMessage.message,
          time: new Date(newMessage.created_at).toLocaleTimeString(),
          readBy: [username] // 지금 받은 메시지를 현재 사용자가 읽은 것으로 처리
        };
        
        setMessageList((list) => [...list, formattedMessage]);
      }
    });

    // 소켓 이벤트 리스너 설정
    onReceiveMessage((data) => {
      console.log('메시지 받음:', data);
      // 이미 같은 ID의 메시지가 있는지 확인
      setMessageList((list) => {
        const existingMsgIndex = list.findIndex(msg => msg.id === data.id);
        if (existingMsgIndex >= 0) {
          // 이미 메시지가 있으면 readBy만 업데이트
          const newList = [...list];
          const existingMsg = newList[existingMsgIndex];
          const readBy = existingMsg.readBy || [];
          if (!readBy.includes(username)) {
            readBy.push(username);
          }
          newList[existingMsgIndex] = { ...existingMsg, readBy };
          return newList;
        }
        return [...list, {...data, readBy: [username]}];
      });
    });

    // 모든 메시지 수신 이벤트 리스너 (자신 제외)
    onReceiveMessageAll((data) => {
      console.log('모든 메시지 수신 이벤트:', data);
      // 이미 같은 ID의 메시지가 있는지 확인
      setMessageList((list) => {
        const existingMsgIndex = list.findIndex(msg => msg.id === data.id);
        if (existingMsgIndex >= 0) {
          // 이미 메시지가 있으면 readBy만 업데이트
          const newList = [...list];
          const existingMsg = newList[existingMsgIndex];
          const readBy = existingMsg.readBy || [];
          if (!readBy.includes(username)) {
            readBy.push(username);
          }
          newList[existingMsgIndex] = { ...existingMsg, readBy };
          return newList;
        }
        return [...list, {...data, readBy: [username]}];
      });
    });
    
    // 메시지 오류 이벤트 리스너
    onMessageError((data) => {
      console.error('메시지 전송 오류:', data);
      alert(`메시지 전송 중 오류가 발생했습니다: ${data.error}`);
    });

    onUserJoined((data) => {
      setMessageList((list) => [...list, data]);
    });

    onUserLeft((data) => {
      setMessageList((list) => [...list, data]);
    });

    // 참가자 목록 이벤트 리스너 설정
    onRoomUsers((data) => {
      console.log('룸 유저 업데이트:', data);
      setParticipants(data.users);
      setParticipantCount(data.count);
    });

    onRoomUsersUpdated((data) => {
      console.log('룸 유저 업데이트 이벤트:', data);
      setParticipants(data.users);
      setParticipantCount(data.count);
    });
    
    // 메시지 읽음 상태 이벤트 리스너
    onMessageReadStatus((data) => {
      console.log('메시지 읽음 상태 업데이트:', data);
      const { messageId, readBy } = data;
      
      setMessageList(prevMessages => 
        prevMessages.map(msg => {
          if (msg.id === messageId) {
            console.log(`메시지 ${messageId}의 읽음 상태 업데이트: ${readBy.join(', ')}`);
            return { ...msg, readBy };
          }
          return msg;
        })
      );
    });
    
    // 마지막 메시지 이벤트 리스너
    onLastMessage((data) => {
      console.log('마지막 메시지 수신:', data);
      // 채팅 기록이 없을 경우에만 마지막 메시지 추가
      if (messageList.length === 0) {
        setMessageList([{
          ...data.message,
          readBy: [username] // 현재 사용자가 읽은 것으로 처리
        }]);
      }
    });

    // 참가자 목록 요청
    getRoomUsers();

    // 주기적으로 참가자 목록 새로고침
    const roomUsersInterval = setInterval(() => {
      if (isConnected) {
        getRoomUsers();
      }
    }, 10000);
    
    // 참가자 목록의 마지막 활동 시간 업데이트
    lastActivityInterval.current = setInterval(() => {
      setParticipants(prev => [...prev]); // 강제 리렌더링하여 시간 표시 업데이트
    }, 30000); // 30초마다 업데이트

    // 컴포넌트 언마운트 시 정리
    return () => {
      currentSocket.off('connect', handleConnect);
      currentSocket.off('disconnect', handleDisconnect);
      clearInterval(roomUsersInterval);
      if (lastActivityInterval.current) {
        clearInterval(lastActivityInterval.current);
      }
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

  // 이미지 파일 선택 처리
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 이미지 파일 유형 검사
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드할 수 있습니다.');
        return;
      }
      
      // 파일 크기 제한 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('5MB 이하의 이미지만 업로드할 수 있습니다.');
        return;
      }
      
      setSelectedImage(file);
      
      // 이미지 미리보기 생성
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // 이미지 선택 취소
  const handleCancelImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 메시지 전송 함수 수정
  const handleSendMessage = async () => {
    if ((currentMessage.trim() !== '' || selectedImage) && isConnected) {
      try {
        console.log(`메시지 전송 시작: ${currentMessage}, 사용자: ${username}, 방: ${room}`);
        
        if (!isConnected) {
          console.warn('소켓 연결이 끊어진 상태에서 메시지 전송 시도');
          alert('연결이 끊어졌습니다. 메시지를 보내기 전에 재연결해 주세요.');
          return;
        }
        
        let imageUrl = null;
        
        // 이미지가 선택되었다면 먼저 업로드
        if (selectedImage) {
          // 이미지 업로드를 위한 폼 데이터 생성
          const formData = new FormData();
          formData.append('image', selectedImage);
          formData.append('room', room);
          formData.append('username', username);
          
          // 이미지 업로드 API 호출
          const response = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error('이미지 업로드에 실패했습니다.');
          }
          
          const data = await response.json();
          imageUrl = data.imageUrl;
        }
        
        const messageData = {
          username,
          message: currentMessage,
          time: new Date().toLocaleTimeString(),
          imageUrl
        };
        
        // UI 업데이트 (낙관적 업데이트)
        const tempId = `temp_${Date.now()}`;
        const tempMessage = {...messageData, id: tempId, readBy: [username], sending: true};
        setMessageList((list) => [...list, tempMessage]);
        
        // 메시지 입력창 초기화
        setCurrentMessage('');
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        // 서버로 메시지 전송 (이미지 URL 포함)
        await sendMessage(currentMessage, username, room, imageUrl);
        console.log('sendMessage 함수 호출 완료');
        
        // 성공적으로 전송된 것으로 가정하고 임시 메시지 상태 업데이트
        setTimeout(() => {
          setMessageList(list => 
            list.map(msg => 
              msg.id === tempId 
                ? {...msg, sending: false, sent: true} 
                : msg
            )
          );
        }, 500);
        
        console.log('메시지가 로컬 UI에 추가되었습니다');
      } catch (error) {
        console.error('메시지 전송 중 오류 발생:', error);
        alert('메시지 전송 중 오류가 발생했습니다. 다시 시도해 주세요.');
        
        // 오류 발생한 메시지에 표시
        setMessageList(list => 
          list.map(msg => 
            msg.sending === true 
              ? {...msg, sending: false, error: true} 
              : msg
          )
        );
      }
    }
  };

  // 참가자 목록 토글 함수
  const toggleParticipants = () => {
    setShowParticipants(!showParticipants);
  };
  
  // 소켓 재연결 함수
  const handleReconnect = () => {
    reconnectSocket();
  };

  return (
    <div className="flex flex-col h-[80vh] max-w-2xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-blue-600 text-white p-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">채팅방: {room}</h2>
          <div className="flex items-center space-x-2">
            <div className={`flex items-center ${isConnected ? 'text-green-200' : 'text-red-300'}`}>
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${isConnected ? 'bg-green-400' : 'bg-red-500'}`}></span>
              <span className="text-xs">{isConnected ? '연결됨' : '연결 끊김'}</span>
              {!isConnected && (
                <button 
                  onClick={handleReconnect}
                  className="ml-1 text-xs underline hover:text-white"
                >
                  재연결
                </button>
              )}
            </div>
            <button
              onClick={toggleParticipants}
              className="flex items-center text-sm bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded-lg transition"
            >
              <span className="mr-1">참가자</span>
              <span className="bg-blue-500 text-white rounded-full px-2">{participantCount}</span>
            </button>
          </div>
        </div>
        <p className="text-sm opacity-80">{username}님으로 참여 중</p>
        
        {showParticipants && (
          <div className="mt-2 p-2 bg-blue-700 rounded-lg">
            <h3 className="text-sm font-semibold mb-1">참가자 목록:</h3>
            <ul className="text-sm">
              {participants.map((participant, index) => (
                <li key={index} className="py-1 border-b border-blue-600 last:border-b-0 flex justify-between items-center">
                  <div className="flex items-center">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${participant.online ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                    <span>{participant.username}</span>
                  </div>
                  <span className="text-xs text-blue-200">
                    {participant.online 
                      ? '온라인' 
                      : participant.lastActive 
                        ? `마지막 활동: ${getTimeAgo(participant.lastActive)}` 
                        : '오프라인'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
                
                {/* 이미지 표시 */}
                {messageContent.imageUrl && (
                  <div className="mb-2">
                    <img 
                      src={messageContent.imageUrl} 
                      alt="첨부 이미지" 
                      className="rounded max-w-full max-h-64 cursor-pointer"
                      onClick={() => window.open(messageContent.imageUrl, '_blank')}
                    />
                  </div>
                )}
                
                {/* 메시지 텍스트 */}
                {messageContent.message && <p>{messageContent.message}</p>}
                
                <div className="flex justify-between items-center mt-1">
                  <span
                    className={`text-xs ${
                      messageContent.username === username ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {messageContent.time}
                    {messageContent.sending && ' (보내는 중...)'}
                    {messageContent.error && ' (전송 실패)'}
                  </span>
                  
                  {/* 읽음 확인 표시 */}
                  {messageContent.username === username && messageContent.readBy && !messageContent.sending && !messageContent.error && (
                    <span 
                      className="text-xs text-blue-100 flex items-center"
                      title={`읽은 사람: ${messageContent.readBy?.join(', ') || ''}`}
                    >
                      {messageContent.readBy && messageContent.readBy.length > 1 ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {messageContent.readBy.length - 1}명 읽음
                          <span className="ml-1 text-xs cursor-pointer hover:underline" 
                            onClick={(e) => {
                              e.stopPropagation();
                              const readers = messageContent.readBy?.filter(name => name !== username) || [];
                              alert(`읽은 사람: ${readers.length > 0 ? readers.join(', ') : '아직 없음'}`);
                            }}
                          >
                            (상세)
                          </span>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                          </svg>
                          아직 읽지 않음
                        </>
                      )}
                    </span>
                  )}
                  
                  {/* 오류 발생한 경우 재전송 버튼 */}
                  {messageContent.error && (
                    <button 
                      onClick={() => {
                        // 오류 메시지 삭제하고 재전송
                        setMessageList(list => list.filter(msg => msg.id !== messageContent.id));
                        setCurrentMessage(messageContent.message);
                      }}
                      className="text-xs text-red-300 hover:text-white underline ml-2"
                    >
                      재전송
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 이미지 미리보기 영역 */}
      {imagePreview && (
        <div className="p-2 border-t border-gray-200">
          <div className="relative inline-block">
            <img src={imagePreview} alt="미리보기" className="h-20 rounded" />
            <button 
              onClick={handleCancelImage} 
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
              title="이미지 취소"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="border-t p-4 flex">
        <input
          type="text"
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="메시지 입력..."
          className="flex-1 border rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={!isConnected}
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
          ref={fileInputRef}
          disabled={!isConnected}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
          disabled={!isConnected}
          title="이미지 첨부"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          onClick={handleSendMessage}
          className={`px-4 py-2 rounded-r-lg ${
            isConnected 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
          } transition`}
          disabled={!isConnected || (!currentMessage.trim() && !selectedImage)}
        >
          전송
        </button>
      </div>
    </div>
  );
} 