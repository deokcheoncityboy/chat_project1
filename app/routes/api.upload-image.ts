import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';

export async function action({ request }: ActionFunctionArgs) {
  try {
    // 클라이언트 요청에서 FormData 가져오기
    const formData = await request.formData();
    
    // 서버 URL 설정
    const serverUrl = process.env.NODE_ENV === 'production'
      ? 'https://chat-project1-backend.onrender.com/api/upload-image'
      : 'http://localhost:8080/api/upload-image';
    
    // 새 FormData 객체 생성
    const newFormData = new FormData();
    
    // 모든 필드 복사
    for (const [key, value] of formData.entries()) {
      newFormData.append(key, value);
    }
    
    // 서버로 요청 전송
    const response = await fetch(serverUrl, {
      method: 'POST',
      body: newFormData,
    });
    
    if (!response.ok) {
      throw new Error(`서버 응답 오류: ${response.status}`);
    }
    
    // 서버 응답 반환
    const data = await response.json();
    return json(data);
  } catch (error) {
    console.error('이미지 업로드 중 오류 발생:', error);
    return json(
      { error: '이미지 업로드에 실패했습니다.' }, 
      { status: 500 }
    );
  }
} 