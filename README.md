# 실시간 채팅 애플리케이션

Remix와 Socket.io, Supabase를 사용한 실시간 채팅 애플리케이션입니다.

## 기능

- 사용자 이름과 채팅방 이름으로 채팅방 참가
- 실시간 메시지 송수신
- 사용자 입장/퇴장 알림
- 메시지 저장 및 이전 메시지 로드
- 다중 채팅방 지원

## 기술 스택

- **프론트엔드**: React, Remix, TailwindCSS
- **백엔드**: Node.js, Express
- **실시간 통신**: Socket.io
- **데이터베이스**: Supabase (PostgreSQL)

## 시작하기

### 사전 요구사항

- Node.js v20 이상
- npm 또는 yarn
- Supabase 계정 및 프로젝트

### 설치

1. 저장소 클론

```bash
git clone <repository-url>
cd chat-application
```

2. 의존성 설치

```bash
npm install
```

3. 환경 변수 설정

`.env` 파일을 루트 디렉토리에 생성하고 다음 내용을 추가합니다:

```
PORT=4000
CLIENT_URL=http://localhost:3000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

4. Supabase 설정

Supabase에서 다음 테이블을 생성합니다:

```sql
CREATE TABLE messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room TEXT NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 실행

개발 모드에서 프론트엔드와 백엔드를 동시에 실행:

```bash
npm run dev:all
```

프론트엔드만 실행:

```bash
npm run dev
```

백엔드 서버만 실행:

```bash
npm run server
```

## 배포

1. 프론트엔드 빌드:

```bash
npm run build
```

2. 배포를 위한 시작:

```bash
npm run start
```

## 라이센스

MIT
