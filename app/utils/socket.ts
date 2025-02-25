import { io, Socket } from 'socket.io-client';

// 클라이언트 측에서만 실행되도록 설정
let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export const initializeSocket = (): Socket => {
  if (typeof window === 'undefined') return {} as Socket;
  
  if (!socket) {
    const serverUrl = process.env.NODE_ENV === 'production'
      ? 'https://chat-project1-backend.onrender.com'
      : 'http://localhost:8080';
      
    console.log('소켓 연결 시도:', serverUrl, '환경:', process.env.NODE_ENV);
      
    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      timeout: 10000
    });
    
    // 기본 이벤트 리스너 설정
    socket.on('connect', () => {
      console.log('소켓 서버에 연결되었습니다. 소켓 ID:', socket?.id);
      reconnectAttempts = 0; // 연결 성공 시 카운터 초기화
    });
    
    socket.on('disconnect', () => {
      console.log('소켓 서버와의 연결이 끊어졌습니다.');
      
      // 연결 끊김 시 재연결 시도
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`재연결 시도 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(() => {
          if (socket) {
            socket.connect();
          }
        }, 2000);
      }
    });
    
    // 연결 오류 시 로그 추가
    socket.on('connect_error', (err) => {
      console.error('소켓 연결 오류:', err, '서버 URL:', serverUrl);
      
      // 연결 오류 시 재연결 시도
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`연결 오류 후 재연결 시도 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      }
    });

    // 디버깅을 위한 이벤트 리스너 추가
    socket.on('connect', () => {
      console.log('Socket.io 연결 성공:', socket?.id);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.io 연결 오류 세부사항:', error.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.io 연결 끊김:', reason);
    });
    
    // 재연결 필요 이벤트
    socket.on('reconnect_required', () => {
      console.log('서버에서 재연결 요청 받음');
      if (socket) {
        socket.disconnect();
        socket.connect();
      }
    });
    
    // 재연결 성공 이벤트
    socket.on('reconnect', (attemptNumber) => {
      console.log(`재연결 성공 (시도 ${attemptNumber})`);
    });
    
    // 재연결 실패 이벤트
    socket.on('reconnect_failed', () => {
      console.error('모든 재연결 시도 실패');
      alert('서버와의 연결이 끊어졌습니다. 페이지를 새로고침해 주세요.');
    });
  }
  
  return socket;
};

// 소켓 재연결 함수
export const reconnectSocket = (): void => {
  if (socket) {
    console.log('소켓 재연결 시도...');
    socket.disconnect();
    socket.connect();
  } else {
    initializeSocket();
  }
};

// 채팅방 입장
export const joinRoom = (username: string, room: string): void => {
  const socket = initializeSocket();
  console.log(`joinRoom 호출: 사용자=${username}, 방=${room}, 소켓ID=${socket?.id}`);
  socket.emit('join_room', { username, room });
};

// 메시지 전송
export const sendMessage = (message: string, username: string, room: string, imageUrl?: string | null): void => {
  const socket = initializeSocket();
  const messageData = {
    room,
    username,
    message,
    time: new Date().toLocaleTimeString(),
    imageUrl: imageUrl || undefined
  };
  
  console.log(`메시지 전송 시도: 방=${room}, 사용자=${username}, 메시지=${message}, 이미지=${imageUrl ? '있음' : '없음'}, 소켓ID=${socket?.id}`);
  console.log(`소켓 연결 상태: ${socket.connected ? '연결됨' : '연결 안됨'}`);
  console.log('메시지 데이터:', JSON.stringify(messageData));
  
  // 소켓이 연결되어 있는지 확인
  if (!socket.connected) {
    console.warn('소켓이 연결되어 있지 않습니다. 재연결 시도...');
    socket.connect();
    
    // 연결이 완료된 후 메시지 전송
    socket.once('connect', () => {
      console.log('재연결 후 메시지 전송');
      socket.emit('send_message', messageData);
    });
    return;
  }
  
  try {
    socket.emit('send_message', messageData);
    console.log('메시지 전송 성공적으로 요청됨');
    
    // 전송 확인을 위한 이벤트 리스너 (일회성)
    socket.once('message_sent_confirmation', (data) => {
      console.log('서버에서 메시지 전송 확인됨:', data);
    });
  } catch (error) {
    console.error('메시지 전송 중 오류 발생:', error);
  }
};

// 메시지 수신 이벤트 리스너 등록
export const onReceiveMessage = (callback: (data: any) => void): void => {
  const socket = initializeSocket();
  socket.on('receive_message', (data) => {
    console.log('메시지 수신:', data);
    callback(data);
    
    // 메시지 읽음 상태 업데이트
    if (data && data.id) {
      console.log(`message_read 이벤트 발송: messageId=${data.id}`);
      socket.emit('message_read', { messageId: data.id });
    } else {
      console.warn('메시지 ID가 없어서 읽음 처리할 수 없음:', data);
    }
  });
};

// 메시지 읽음 상태 이벤트 리스너 등록
export const onMessageReadStatus = (callback: (data: { messageId: string, readBy: string[] }) => void): void => {
  const socket = initializeSocket();
  socket.on('message_read_status', callback);
};

// 마지막 메시지 이벤트 리스너 등록
export const onLastMessage = (callback: (data: { room: string, message: any }) => void): void => {
  const socket = initializeSocket();
  socket.on('last_message', callback);
};

// 사용자 활동 갱신
export const updateUserActivity = (): void => {
  const socket = initializeSocket();
  socket.emit('user_activity');
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
    console.log('소켓 연결 해제 시도');
    socket.disconnect();
    socket = null;
  }
};

// 채팅방 참가자 목록 조회
export const getRoomUsers = (): void => {
  const socket = initializeSocket();
  socket.emit('get_room_users');
};

// 채팅방 참가자 목록 수신 이벤트 리스너 등록
export const onRoomUsers = (callback: (data: { users: Array<{ username: string, online: boolean, lastActive: Date }>, count: number }) => void): void => {
  const socket = initializeSocket();
  socket.on('room_users', callback);
};

// 채팅방 참가자 목록 업데이트 이벤트 리스너 등록
export const onRoomUsersUpdated = (callback: (data: { users: Array<{ username: string, online: boolean, lastActive: Date }>, count: number }) => void): void => {
  const socket = initializeSocket();
  socket.on('room_users_updated', callback);
};

// 모든 메시지 수신 이벤트 리스너 등록 (자신의 메시지 포함)
export const onReceiveMessageAll = (callback: (data: any) => void): void => {
  const socket = initializeSocket();
  socket.on('receive_message_all', (data) => {
    console.log('모든 메시지 수신 (자신 포함):', data);
    // 자신이 보낸 메시지는 이미 UI에 표시되어 있으므로 다른 사용자가 보낸 메시지만 처리
    if (data.senderId !== socket.id) {
      // 메시지 읽음 상태 업데이트
      if (data && data.id) {
        console.log(`message_read 이벤트 발송 (receive_message_all): messageId=${data.id}`);
        socket.emit('message_read', { messageId: data.id });
      } else {
        console.warn('메시지 ID가 없어서 읽음 처리할 수 없음 (receive_message_all):', data);
      }
      // 콜백 호출
      callback(data);
    } else {
      console.log('자신이 보낸 메시지라 콜백 호출하지 않음');
    }
  });
};

// 메시지 오류 이벤트 리스너
export const onMessageError = (callback: (data: any) => void): void => {
  const socket = initializeSocket();
  socket.on('message_error', callback);
}; 