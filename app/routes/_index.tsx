import type { MetaFunction, ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useEffect, useState } from "react";
import ChatLogin from "~/components/ChatLogin";
import { io } from "socket.io-client";

type RoomInfo = {
  room: string;
  count: number;
  lastMessage?: {
    username: string;
    message: string;
    time: string;
    timestamp: number;
  } | null;
  lastActivity?: number | null;
};

export const meta: MetaFunction = () => {
  return [
    { title: "채팅 애플리케이션" },
    { name: "description", content: "React와 Remix로 만든 실시간 채팅 애플리케이션" },
  ];
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const username = formData.get("username") as string;
  const room = formData.get("room") as string;

  if (!username || !room) {
    return { error: "사용자 이름과 채팅방 이름이 필요합니다." };
  }

  // 채팅방으로 리다이렉트 (room 값도 인코딩)
  const encodedRoom = encodeURIComponent(room);
  const encodedUsername = encodeURIComponent(username);
  return redirect(`/chat/${encodedRoom}?username=${encodedUsername}`);
}

// 시간 형식을 변환하는 함수
const formatLastActive = (timestamp: number | null | undefined): string => {
  if (!timestamp) return '활동 없음';
  
  const now = new Date();
  const lastActive = new Date(timestamp);
  const diffMs = now.getTime() - lastActive.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  
  return lastActive.toLocaleDateString();
};

// 메시지 내용 줄이는 함수
const truncateMessage = (message: string, maxLength: number = 30): string => {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength) + '...';
};

export default function Index() {
  const [activeRooms, setActiveRooms] = useState<RoomInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshTime, setRefreshTime] = useState<Date>(new Date());
  
  useEffect(() => {
    // 서버 URL 설정
    const serverUrl = process.env.NODE_ENV === 'production'
      ? 'https://chat-project1-backend.onrender.com'
      : 'http://localhost:8080';
    
    console.log(`소켓 연결 시도: ${serverUrl}`);
    setIsLoading(true);
    
    // 소켓 연결 (임시)
    const tempSocket = io(serverUrl, {
      transports: ['websocket', 'polling']
    });
    
    // 소켓 연결 이벤트 리스너
    tempSocket.on('connect', () => {
      console.log('소켓 연결 성공, 활성 채팅방 정보 요청');
      // 활성 채팅방 정보 요청
      tempSocket.emit('get_active_rooms');
    });
    
    // 연결 오류 처리
    tempSocket.on('connect_error', (error) => {
      console.error('소켓 연결 오류:', error);
      setIsLoading(false);
    });
    
    // 활성 채팅방 정보 수신
    tempSocket.on('active_rooms', (data: { rooms: RoomInfo[] }) => {
      console.log('활성 채팅방 정보 수신:', data);
      // 사용자 수 기준으로 정렬 (활발한 방이 상위에 노출)
      const sortedRooms = [...data.rooms].sort((a, b) => b.count - a.count);
      setActiveRooms(sortedRooms);
      setIsLoading(false);
      setRefreshTime(new Date());
    });
    
    // 주기적으로 활성 채팅방 정보 업데이트 (30초마다)
    const interval = setInterval(() => {
      if (tempSocket.connected) {
        console.log('활성 채팅방 정보 주기적 업데이트 요청');
        tempSocket.emit('get_active_rooms');
      }
    }, 30000);
    
    // 컴포넌트 언마운트시 소켓 연결 해제 및 인터벌 정리
    return () => {
      clearInterval(interval);
      tempSocket.disconnect();
    };
  }, []);

  // 수동으로 채팅방 정보 새로고침
  const handleRefresh = () => {
    // 서버 URL 설정
    const serverUrl = process.env.NODE_ENV === 'production'
      ? 'https://chat-project1-backend.onrender.com'
      : 'http://localhost:8080';
    
    setIsLoading(true);
    
    // 임시 소켓 연결하여 정보 요청
    const refreshSocket = io(serverUrl, {
      transports: ['websocket', 'polling']
    });
    
    refreshSocket.on('connect', () => {
      refreshSocket.emit('get_active_rooms');
    });
    
    refreshSocket.on('active_rooms', (data: { rooms: RoomInfo[] }) => {
      // 사용자 수 기준으로 정렬
      const sortedRooms = [...data.rooms].sort((a, b) => b.count - a.count);
      setActiveRooms(sortedRooms);
      setIsLoading(false);
      setRefreshTime(new Date());
      refreshSocket.disconnect();
    });
    
    // 5초 후에도 응답이 없으면 로딩 상태 해제
    setTimeout(() => {
      setIsLoading(false);
      refreshSocket.disconnect();
    }, 5000);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-8">
          실시간 채팅 애플리케이션
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-blue-600">현재 활성화된 채팅방</h2>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">
                마지막 업데이트: {refreshTime.toLocaleTimeString()}
              </span>
              <button 
                onClick={handleRefresh} 
                className={`text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? '로딩 중...' : '새로고침'}
              </button>
            </div>
          </div>
          
          {isLoading && activeRooms.length === 0 ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
              <p className="text-gray-500">채팅방 정보를 불러오는 중...</p>
            </div>
          ) : activeRooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeRooms.map((roomInfo, index) => (
                <div 
                  key={index} 
                  className="border rounded-lg p-4 hover:shadow-md transition bg-white"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-lg text-gray-800">{roomInfo.room}</h3>
                    <div className="flex items-center">
                      <span className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {roomInfo.count}명
                      </span>
                    </div>
                  </div>
                  
                  {roomInfo.lastMessage ? (
                    <div className="mt-2 bg-gray-50 p-3 rounded-md">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-blue-600">{roomInfo.lastMessage.username}</span>
                        <span className="text-gray-500 text-xs">
                          {formatLastActive(roomInfo.lastActivity)}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm">
                        {truncateMessage(roomInfo.lastMessage.message)}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-gray-500 italic">
                      아직 메시지가 없습니다
                    </div>
                  )}
                  
                  <div className="mt-3 text-right">
                    <a 
                      href={`/chat/${encodeURIComponent(roomInfo.room)}`}
                      className="inline-block text-sm text-blue-600 hover:text-blue-800 transition"
                    >
                      이 방으로 입장하기 →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>현재 활성화된 채팅방이 없습니다.</p>
              <p className="mt-2 text-sm">아래에서 새 채팅방을 만들어보세요!</p>
            </div>
          )}
        </div>
        
        <ChatLogin />
      </div>
    </div>
  );
}
