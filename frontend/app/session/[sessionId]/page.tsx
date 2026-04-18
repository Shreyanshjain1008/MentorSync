import { SessionRoomClient } from "@/components/session/SessionRoomClient";

export default async function SessionRoomPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return <SessionRoomClient sessionId={sessionId} />;
}
