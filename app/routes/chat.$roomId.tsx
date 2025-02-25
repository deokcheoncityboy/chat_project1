import { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import ChatRoom from "~/components/ChatRoom";

export const meta: MetaFunction = ({ params }) => {
  let roomName = "";
  try {
    roomName = decodeURIComponent(params.roomId || "");
  } catch (e) {
    roomName = params.roomId || "";
  }
  
  return [
    { title: `채팅방 - ${roomName}` },
    { name: "description", content: "실시간 채팅방" },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const username = url.searchParams.get("username");
  let roomId = params.roomId || "";
  
  try {
    roomId = decodeURIComponent(roomId);
  } catch (e) {
    console.error("roomId 디코딩 오류:", e);
  }

  if (!username || !roomId) {
    return { redirect: "/", username: null, roomId: null };
  }

  let decodedUsername = username;
  try {
    decodedUsername = decodeURIComponent(username);
  } catch (e) {
    console.error("username 디코딩 오류:", e);
  }

  return { 
    username: decodedUsername,
    roomId
  };
}

export default function ChatRoomPage() {
  const { username, roomId, redirect } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    if (redirect) {
      navigate(redirect);
    }
  }, [redirect, navigate]);

  if (!isClient || !username || !roomId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <ChatRoom username={username} room={roomId} />
        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:underline"
          >
            다른 채팅방으로 이동
          </button>
        </div>
      </div>
    </div>
  );
} 