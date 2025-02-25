import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES 모듈에서 __dirname 사용하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 환경 변수 로드
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// 사용자 목록을 저장할 객체
const users = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 사용자가 채팅방에 입장했을 때
  socket.on('join_room', (data) => {
    const { username, room } = data;
    socket.join(room);
    
    // 사용자 정보 저장
    users[socket.id] = { username, room };
    
    // 입장 메시지 브로드캐스트
    socket.to(room).emit('user_joined', {
      message: `${username}님이 입장하셨습니다.`,
      username: 'system',
      time: new Date().toLocaleTimeString(),
    });
    
    console.log(`${username} joined room: ${room}`);
  });

  // 메시지 수신 및 브로드캐스트
  socket.on('send_message', (data) => {
    const userInfo = users[socket.id];
    if (userInfo) {
      socket.to(userInfo.room).emit('receive_message', data);
      console.log(`Message in ${userInfo.room}: ${data.message}`);
    }
  });

  // 사용자 연결 해제
  socket.on('disconnect', () => {
    const userInfo = users[socket.id];
    if (userInfo) {
      socket.to(userInfo.room).emit('user_left', {
        message: `${userInfo.username}님이 퇴장하셨습니다.`,
        username: 'system',
        time: new Date().toLocaleTimeString(),
      });
      
      delete users[socket.id];
      console.log(`User disconnected: ${socket.id}`);
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
}); 