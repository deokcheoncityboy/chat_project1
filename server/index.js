import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import multer from 'multer';
import fs from 'fs';

// ES 모듈에서 __dirname 사용하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 환경 변수 로드
dotenv.config();

const app = express();
app.use(cors({
  origin: ['https://chat-project1-deokcheoncityboy.vercel.app', process.env.CLIENT_URL, 'http://localhost:5173'],
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// 이미지 업로드를 위한 디렉토리 생성
const uploadsDir = join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 이미지 저장을 위한 Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const roomDir = join(uploadsDir, req.body.room || 'default');
    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir, { recursive: true });
    }
    cb(null, roomDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const fileExt = file.originalname.split('.').pop();
    cb(null, `${req.body.username || 'unknown'}-${uniqueSuffix}.${fileExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 제한
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
    }
    cb(null, true);
  }
});

// 이미지 업로드 API 엔드포인트
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '파일이 없습니다.' });
  }
  
  // 클라이언트에 이미지 URL 반환
  const imageUrl = `/uploads/${req.body.room}/${req.file.filename}`;
  res.json({ imageUrl });
});

// 업로드 파일 제공을 위한 정적 파일 서빙
app.use('/uploads', express.static(uploadsDir));

// CORS 디버깅 미들웨어
app.use((req, res, next) => {
  console.log(`요청 받음: ${req.method} ${req.url}, Origin: ${req.headers.origin || '없음'}`);
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// CORS 설정 로그
console.log('Socket.io CORS 설정:', JSON.stringify({
  origin: "*",
  methods: ["GET", "POST"]
}));
console.log('Express CORS 설정:', JSON.stringify({
  origin: ['https://chat-project1-deokcheoncityboy.vercel.app', process.env.CLIENT_URL, 'http://localhost:5173'],
  methods: ['GET', 'POST'],
  credentials: true
}));

// 사용자 목록을 저장할 객체
const users = {};
// 각 방별 사용자 목록
const rooms = {};
// 사용자 상태 정보
const userStatus = {};
// 방별 최근 메시지
const roomLastMessages = {};
// 메시지 읽음 상태 (방ID -> 메시지ID -> 읽은 사용자 목록)
const messageReadStatus = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id} from ${socket.handshake.headers.origin || '알 수 없음'}`);
  console.log(`현재 연결된 클라이언트 수: ${io.engine.clientsCount}`);

  // 활성화된 채팅방 목록 요청
  socket.on('get_active_rooms', () => {
    const activeRooms = Object.keys(rooms).map(room => ({
      room,
      count: Object.keys(rooms[room]).length,
      lastMessage: roomLastMessages[room] || null,
      lastActivity: roomLastMessages[room] ? roomLastMessages[room].time : null
    }));
    
    console.log(`활성 채팅방 정보 요청 - 응답: ${JSON.stringify(activeRooms)}`);
    socket.emit('active_rooms', { rooms: activeRooms });
  });

  // 사용자가 채팅방에 입장했을 때
  socket.on('join_room', (data) => {
    const { username, room } = data;
    console.log(`join_room 이벤트 수신: 사용자=${username}, 방=${room}, 소켓ID=${socket.id}`);
    
    socket.join(room);
    
    // 사용자 정보 저장
    users[socket.id] = { username, room };
    
    // 방별 사용자 목록 업데이트
    if (!rooms[room]) {
      rooms[room] = {};
      // 새 방을 위한 메시지 읽음 상태 초기화
      messageReadStatus[room] = {};
    }
    rooms[room][socket.id] = username;
    
    // 사용자 상태 업데이트
    userStatus[username] = {
      online: true,
      lastActive: new Date(),
      socketId: socket.id
    };
    
    // 입장 메시지 브로드캐스트
    console.log(`${username}님 입장 메시지 브로드캐스트 to ${room}`);
    socket.to(room).emit('user_joined', {
      message: `${username}님이 입장하셨습니다.`,
      username: 'system',
      time: new Date().toLocaleTimeString(),
    });
    
    // 방 참가자 목록 업데이트 이벤트 발송
    const roomUsers = {
      users: Object.entries(rooms[room]).map(([socketId, name]) => ({
        username: name,
        online: true,
        lastActive: userStatus[name] ? userStatus[name].lastActive : new Date()
      })),
      count: Object.keys(rooms[room]).length
    };
    console.log(`방 참가자 목록 업데이트: ${JSON.stringify(roomUsers)}`);
    io.to(room).emit('room_users_updated', roomUsers);
    
    // 마지막 메시지 정보 전송
    if (roomLastMessages[room]) {
      socket.emit('last_message', {
        room,
        message: roomLastMessages[room]
      });
    }
    
    // 활성 채팅방 목록 업데이트 이벤트 발송
    const activeRooms = Object.keys(rooms).map(roomName => ({
      room: roomName,
      count: Object.keys(rooms[roomName]).length,
      lastMessage: roomLastMessages[roomName] || null,
      lastActivity: roomLastMessages[roomName] ? roomLastMessages[roomName].time : null
    }));
    io.emit('active_rooms', { rooms: activeRooms });
    
    console.log(`${username} (${socket.id}) joined room: ${room}`);
    // 방에 있는 모든 소켓 ID 로깅
    const socketsInRoom = Array.from(io.sockets.adapter.rooms.get(room) || []);
    console.log(`방 ${room}의 현재 소켓 IDs:`, socketsInRoom);
  });

  // 채팅방 참가자 목록 요청
  socket.on('get_room_users', () => {
    const userInfo = users[socket.id];
    console.log(`get_room_users 이벤트 수신, 소켓ID=${socket.id}, userInfo=`, userInfo);
    
    if (userInfo && userInfo.room) {
      const roomUsers = rooms[userInfo.room] || {};
      const response = {
        users: Object.entries(roomUsers).map(([socketId, name]) => ({
          username: name,
          online: userStatus[name] ? userStatus[name].online : false,
          lastActive: userStatus[name] ? userStatus[name].lastActive : null
        })),
        count: Object.keys(roomUsers).length
      };
      console.log(`방 참가자 목록 응답: ${JSON.stringify(response)}`);
      socket.emit('room_users', response);
    } else {
      console.log(`userInfo가 없거나 방 정보가 없음: ${socket.id}`);
    }
  });

  // 사용자 활동 업데이트
  socket.on('user_activity', () => {
    const userInfo = users[socket.id];
    if (userInfo) {
      const { username } = userInfo;
      if (userStatus[username]) {
        userStatus[username].lastActive = new Date();
      }
    }
  });

  // 메시지 수신 및 브로드캐스트
  socket.on('send_message', (data) => {
    console.log(`send_message 이벤트 수신: ${JSON.stringify(data)}, 소켓ID=${socket.id}`);
    
    const userInfo = users[socket.id];
    if (userInfo) {
      const { room } = userInfo;
      console.log(`메시지 브로드캐스트 to ${room}, from=${userInfo.username}`);
      
      // 메시지에 고유 ID 추가
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const messageWithId = {
        ...data,
        id: messageId
      };
      
      // 메시지 읽음 상태 초기화 - 자신은 이미 읽음
      if (!messageReadStatus[room]) {
        messageReadStatus[room] = {};
      }
      messageReadStatus[room][messageId] = [userInfo.username];
      
      // 최근 메시지 업데이트
      roomLastMessages[room] = {
        ...messageWithId,
        time: new Date().toLocaleTimeString(),
        timestamp: Date.now()
      };
      
      // 사용자 활동 시간 업데이트
      if (userStatus[userInfo.username]) {
        userStatus[userInfo.username].lastActive = new Date();
      }
      
      // 전송 확인 응답
      socket.emit('message_sent_confirmation', { 
        status: 'success', 
        messageId 
      });
      
      try {
        // 이 방법으로 먼저 시도 (socket.to)
        console.log(`socket.to(${room}) 방식으로 메시지 브로드캐스트 시도`);
        socket.to(room).emit('receive_message', messageWithId);
        
        // 소켓이 방에 제대로 조인되어 있는지 확인
        const socketsInRoom = Array.from(io.sockets.adapter.rooms.get(room) || []);
        console.log(`방 ${room}의 현재 소켓 IDs:`, socketsInRoom);
        
        // 백업 방법: 모든 소켓에게 직접 메시지 전송 (현재 소켓 제외)
        if (socketsInRoom.length > 0) {
          socketsInRoom.forEach(socketId => {
            if (socketId !== socket.id) { // 자기 자신에게는 보내지 않음
              console.log(`직접 메시지 전송 to ${socketId}`);
              io.to(socketId).emit('receive_message', messageWithId);
            }
          });
        } else {
          console.warn(`경고: 방 ${room}에 다른 소켓이 없습니다.`);
        }
        
        // 세 번째 방법: 방 전체에 메시지 브로드캐스트 (자신 포함)
        console.log(`io.to(${room}) 방식으로 브로드캐스트 시도 (자신 제외하도록 클라이언트에서 처리)`);
        io.in(room).emit('receive_message_all', {
          ...messageWithId,
          senderId: socket.id // 클라이언트에서 자신의 메시지를 필터링할 수 있도록 발신자 ID 추가
        });
        
        // 활성 채팅방 목록 업데이트 이벤트 발송 (최근 메시지 포함)
        const activeRooms = Object.keys(rooms).map(roomName => ({
          room: roomName,
          count: Object.keys(rooms[roomName]).length,
          lastMessage: roomLastMessages[roomName] || null,
          lastActivity: roomLastMessages[roomName] ? roomLastMessages[roomName].timestamp : null
        }));
        io.emit('active_rooms', { rooms: activeRooms });
        
        console.log(`Message in ${room} from ${socket.id}: ${data.message}`);
        
      } catch (error) {
        console.error(`메시지 브로드캐스트 중 오류 발생:`, error);
        socket.emit('message_error', { error: '메시지 전송 중 오류가 발생했습니다.' });
      }
    } else {
      console.error(`오류: userInfo가 없음, 소켓ID=${socket.id}`);
      // 소켓 재연결 시도
      socket.emit('reconnect_required');
    }
  });

  // 메시지 읽음 상태 업데이트
  socket.on('message_read', ({ messageId }) => {
    const userInfo = users[socket.id];
    if (userInfo && userInfo.room) {
      const { username, room } = userInfo;
      
      console.log(`메시지 읽음 이벤트 수신: 사용자=${username}, 메시지ID=${messageId}, 방=${room}`);
      
      // 메시지 읽음 상태 초기화가 안 되었으면 처리
      if (!messageReadStatus[room]) {
        messageReadStatus[room] = {};
        console.log(`메시지 읽음 상태 초기화 - 방 ${room}에 대한 상태 생성`);
      }
      
      if (!messageReadStatus[room][messageId]) {
        console.log(`메시지 읽음 상태 초기화 - 메시지 ${messageId}에 대한 상태 생성`);
        messageReadStatus[room][messageId] = [];
      }
      
      // 메시지 읽음 상태 업데이트
      if (!messageReadStatus[room][messageId].includes(username)) {
        messageReadStatus[room][messageId].push(username);
        console.log(`메시지 읽음 상태 업데이트: 메시지=${messageId}, 사용자=${username}, 읽은 사용자=${messageReadStatus[room][messageId].join(',')}`);
        
        // 해당 메시지 읽음 상태 브로드캐스트
        io.to(room).emit('message_read_status', {
          messageId,
          readBy: messageReadStatus[room][messageId]
        });
      }
    }
  });

  // 사용자 연결 해제
  socket.on('disconnect', () => {
    const userInfo = users[socket.id];
    console.log(`사용자 연결 해제: ${socket.id}, userInfo=`, userInfo);
    
    if (userInfo) {
      const { username, room } = userInfo;
      
      // 사용자 상태 업데이트
      if (userStatus[username]) {
        userStatus[username].online = false;
        userStatus[username].lastActive = new Date();
      }
      
      socket.to(room).emit('user_left', {
        message: `${username}님이 퇴장하셨습니다.`,
        username: 'system',
        time: new Date().toLocaleTimeString(),
      });
      
      // 방 참가자 목록에서 제거
      if (rooms[room] && rooms[room][socket.id]) {
        delete rooms[room][socket.id];
        
        // 방 참가자 목록 업데이트 이벤트 발송
        const updatedUsers = Object.entries(rooms[room]).map(([socketId, name]) => ({
          username: name,
          online: userStatus[name] ? userStatus[name].online : false,
          lastActive: userStatus[name] ? userStatus[name].lastActive : null
        }));
        
        io.to(room).emit('room_users_updated', {
          users: updatedUsers,
          count: Object.keys(rooms[room]).length
        });
        
        // 활성 채팅방 목록 업데이트 이벤트 발송
        const activeRooms = Object.keys(rooms).map(roomName => ({
          room: roomName,
          count: Object.keys(rooms[roomName]).length,
          lastMessage: roomLastMessages[roomName] || null,
          lastActivity: roomLastMessages[roomName] ? roomLastMessages[roomName].timestamp : null
        }));
        io.emit('active_rooms', { rooms: activeRooms });
        
        // 방에 사용자가 없으면 방 삭제
        if (Object.keys(rooms[room]).length === 0) {
          delete rooms[room];
          delete messageReadStatus[room];
          console.log(`방 삭제됨: ${room} (사용자 없음)`);
        }
      }
      
      delete users[socket.id];
      console.log(`User disconnected: ${socket.id}`);
    }
  });
});

// 루트 경로 핸들러 추가
app.get('/', (req, res) => {
  res.send('채팅 서버가 실행 중입니다.');
});

// 서버 상태 확인 엔드포인트 추가
app.get('/status', (req, res) => {
  const status = {
    uptime: process.uptime(),
    connections: io.engine.clientsCount,
    rooms: Object.keys(rooms).length,
    users: Object.keys(users).length,
    userStatus,
    activeRooms: Object.keys(rooms).map(room => ({
      room,
      users: Object.values(rooms[room]),
      count: Object.keys(rooms[room]).length,
      lastMessage: roomLastMessages[room] || null
    }))
  };
  res.json(status);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
}); 