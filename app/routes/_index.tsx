import type { MetaFunction, ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import ChatLogin from "~/components/ChatLogin";

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

export default function Index() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-8">
          실시간 채팅 애플리케이션
        </h1>
        <ChatLogin />
      </div>
    </div>
  );
}
