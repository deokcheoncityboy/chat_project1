import { io, Socket } from 'socket.io-client';

// 클라이언트 측에서만 실행되도록 설정
let socket: Socket | null = null;

export const initializeSocket = (): Socket => {
  if (typeof window === 'undefined') return {} as Socket;
  
  if (!socket) {
    const serverUrl = process.env.NODE_ENV === 'production'
      ? process.env.SERVER_URL || ''
      : 'http://localhost:8080';
      
    socket = io(serverUrl);
    
    // 기본 이벤트 리스너 설정
    socket.on('connect', () => {
      console.log('소켓 서버에 연결되었습니다.');
    });
    
    socket.on('disconnect', () => {
      console.log('소켓 서버와의 연결이 끊어졌습니다.');
    });
    
    // 연결 오류 시 로그 추가
    socket.on('connect_error', (err) => {
      console.error('소켓 연결 오류:', err);
    });
  }
  
  return socket;
};

// 채팅방 입장
export const joinRoom = (username: string, room: string): void => {
  const socket = initializeSocket();
  socket.emit('join_room', { username, room });
};

// 메시지 전송
export const sendMessage = (message: string, username: string, room: string): void => {
  const socket = initializeSocket();
  const messageData = {
    room,
    username,
    message,
    time: new Date().toLocaleTimeString(),
  };
  
  socket.emit('send_message', messageData);
};

// 메시지 수신 이벤트 리스너 등록
export const onReceiveMessage = (callback: (data: any) => void): void => {
  const socket = initializeSocket();
  socket.on('receive_message', callback);
};

// 사용자 입장 이벤트 리스너 등록
export const onUserJoined = (callback: (data: any) => void): void => {
  const socket = initializeSocket();
  socket.on('user_joined', callback);
};

// 사용자 퇴장 이벤트 리스너 등록
export const onUserLeft = (callback: (data: any) => void): void => {
  const socket = initializeSocket();
  socket.on('user_left', callback);
};

// 소켓 연결 해제
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}; 