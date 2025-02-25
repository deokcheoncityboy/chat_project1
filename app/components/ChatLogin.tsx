import React, { useState, useEffect } from 'react';
import { Form } from '@remix-run/react';

export default function ChatLogin() {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [error, setError] = useState('');

  // 로컬 스토리지에서 선택된 방 정보 불러오기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const selectedRoom = localStorage.getItem('selectedRoom');
      if (selectedRoom) {
        setRoom(selectedRoom);
        // 사용 후 로컬 스토리지에서 제거
        localStorage.removeItem('selectedRoom');
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    // 클라이언트 사이드에서만 입력 검증 수행
    // e.preventDefault()를 제거하여 폼이 제출되도록 함
    
    // 입력 검증
    if (!username.trim()) {
      e.preventDefault(); // 유효하지 않을 때만 기본 동작 방지
      setError('사용자 이름을 입력해주세요.');
      return;
    }
    
    if (!room.trim()) {
      e.preventDefault(); // 유효하지 않을 때만 기본 동작 방지
      setError('채팅방 이름을 입력해주세요.');
      return;
    }
    
    // 입력이 유효하면 폼 제출 허용 (preventDefault 호출 안 함)
    setError('');
  };

  return (
    <div id="login-form" className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden mt-10">
      <div className="bg-blue-600 text-white p-4">
        <h2 className="text-xl font-semibold">채팅 애플리케이션</h2>
        <p className="text-sm opacity-80">사용자 이름과 방 이름을 입력하세요</p>
      </div>
      
      <div className="p-6">
        <Form method="post" onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          
          <div className="mb-4">
            <label htmlFor="username-input" className="block text-sm font-medium text-gray-700 mb-1">
              사용자 이름
            </label>
            <input
              id="username-input"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="사용자 이름 입력"
              required
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="room-input" className="block text-sm font-medium text-gray-700 mb-1">
              채팅방 이름
            </label>
            <input
              id="room-input"
              name="room"
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="채팅방 이름 입력"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
          >
            채팅방 입장
          </button>
        </Form>
        
        <div className="mt-4 text-center text-sm text-gray-500">
          <p>또는 아래의 공개 채팅방에 입장하세요</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {['일반', '게임', '음악', '영화', '프로그래밍'].map((roomName) => (
              <Form key={roomName} method="post" className="inline-block">
                <input type="hidden" name="username" value={username || '게스트'} />
                <input type="hidden" name="room" value={roomName} />
                <button
                  type="submit"
                  disabled={!username.trim()}
                  className="px-3 py-1 text-xs bg-gray-200 rounded-full hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {roomName}
                </button>
              </Form>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 