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
  
  useEffect(() => {
    // 서버 URL 설정
    const serverUrl = process.env.NODE_ENV === 'production'
      ? 'https://chat-project1-backend.onrender.com'
      : 'http://localhost:8080';
    
    // 소켓 연결 (임시)
    const tempSocket = io(serverUrl, {
      transports: ['websocket', 'polling']
    });
    
    // 활성 채팅방 정보 요청
    tempSocket.emit('get_active_rooms');
    
    // 활성 채팅방 정보 수신
    tempSocket.on('active_rooms', (data: { rooms: RoomInfo[] }) => {
      console.log('활성 채팅방 정보 수신:', data);
      setActiveRooms(data.rooms);
    });
    
    // 컴포넌트 언마운트시 소켓 연결 해제
    return () => {
      tempSocket.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-8">
          실시간 채팅 애플리케이션
        </h1>
        
        {activeRooms.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <h2 className="text-lg font-semibold mb-3 text-blue-600">현재 활성화된 채팅방</h2>
            <div className="divide-y">
              {activeRooms.map((roomInfo, index) => (
                <div key={index} className="py-3">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-gray-800">{roomInfo.room}</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                      참가자 {roomInfo.count}명
                    </span>
                  </div>
                  
                  {roomInfo.lastMessage && (
                    <div className="mt-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          <span className="font-medium">{roomInfo.lastMessage.username}: </span>
                          {truncateMessage(roomInfo.lastMessage.message)}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {formatLastActive(roomInfo.lastActivity)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <ChatLogin />
      </div>
    </div>
  );
}
