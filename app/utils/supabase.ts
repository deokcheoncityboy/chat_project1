import { createClient } from '@supabase/supabase-js';

// Supabase URL과 익명 키는 환경 변수에서 가져옵니다.
const supabaseUrl = typeof window !== 'undefined' 
  ? window.ENV.SUPABASE_URL 
  : process.env.SUPABASE_URL || '';

const supabaseAnonKey = typeof window !== 'undefined' 
  ? window.ENV.SUPABASE_ANON_KEY 
  : process.env.SUPABASE_ANON_KEY || '';

// Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 채팅 메시지 타입 정의
export type Message = {
  id: string;
  room: string;
  username: string;
  message: string;
  created_at: string;
};

// 메시지 생성 함수
export async function createMessage(roomId: string, username: string, message: string) {
  const { data, error } = await supabase
    .from('messages')
    .insert([
      { room: roomId, username, message }
    ])
    .select();
  
  if (error) {
    console.error('메시지 저장 오류:', error);
    return null;
  }
  
  return data?.[0];
}

// 특정 방의 메시지 가져오기
export async function getMessages(roomId: string, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('메시지 조회 오류:', error);
    return [];
  }
  
  return data.reverse();
}

// 실시간 메시지 구독
export function subscribeToMessages(roomId: string, callback: (message: Message) => void) {
  return supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room=eq.${roomId}`
      },
      (payload) => {
        callback(payload.new as Message);
      }
    )
    .subscribe();
} 