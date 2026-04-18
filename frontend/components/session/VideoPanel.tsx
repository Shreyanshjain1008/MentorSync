"use client";

import type { MutableRefObject } from "react";
import { useEffect, useRef, useState } from "react";

import type { AuthUser } from "@/types/auth";
import { env } from "@/lib/env";
import type { SignalingEvent } from "@/types/session";

interface VideoPanelProps {
  currentUser: AuthUser;
  sessionId: string;
  signalingSocket: MutableRefObject<WebSocket | null>;
  latestSignal: SignalingEvent | null;
}

export function VideoPanel({ currentUser, signalingSocket, latestSignal }: VideoPanelProps) {
  const localCameraRef = useRef<HTMLVideoElement | null>(null);
  const localScreenRef = useRef<HTMLVideoElement | null>(null);
  const remoteCameraRef = useRef<HTMLVideoElement | null>(null);
  const remoteScreenRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const localCameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const localCameraPreviewStreamRef = useRef<MediaStream | null>(null);
  const localCameraStreamIdRef = useRef<string | null>(null);
  const localScreenStreamIdRef = useRef<string | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const remoteCameraStreamRef = useRef<MediaStream | null>(null);
  const remoteScreenStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioStreamRef = useRef<MediaStream | null>(null);
  const remoteMediaIdsRef = useRef<{ cameraStreamId: string | null; screenStreamId: string | null }>({
    cameraStreamId: null,
    screenStreamId: null,
  });
  const cameraSenderRef = useRef<RTCRtpSender | null>(null);
  const screenSenderRef = useRef<RTCRtpSender | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const isSettingRemoteAnswerPendingRef = useRef(false);
  const remoteParticipantIdRef = useRef<string | null>(null);
  const presenceSentRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [hasRemoteCamera, setHasRemoteCamera] = useState(false);
  const [hasRemoteScreen, setHasRemoteScreen] = useState(false);
  const [peerReady, setPeerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendSignal = (signalType: string, payload: Record<string, unknown>) => {
    if (signalingSocket.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    signalingSocket.current.send(
      JSON.stringify({
        signal_type: signalType,
        payload,
      }),
    );
  };

  const syncVideoElement = (element: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (element) {
      element.srcObject = stream;
    }
  };

  const syncAudioElement = (element: HTMLAudioElement | null, stream: MediaStream | null) => {
    if (element) {
      element.srcObject = stream;
    }
  };

  const syncLocalCameraPreview = (track: MediaStreamTrack | null) => {
    localCameraPreviewStreamRef.current?.getTracks().forEach((candidate) => candidate.stop());

    if (!track) {
      localCameraPreviewStreamRef.current = null;
      syncVideoElement(localCameraRef.current, null);
      return;
    }

    const previewStream = new MediaStream([track]);
    localCameraPreviewStreamRef.current = previewStream;
    syncVideoElement(localCameraRef.current, previewStream);
  };

  const clearRemoteScreen = () => {
    remoteScreenStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteScreenStreamRef.current = null;
    syncVideoElement(remoteScreenRef.current, null);
    setHasRemoteScreen(false);
  };

  const clearRemoteCamera = () => {
    remoteCameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteCameraStreamRef.current = null;
    syncVideoElement(remoteCameraRef.current, null);
    setHasRemoteCamera(false);
  };

  const clearRemoteAudio = () => {
    remoteAudioStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteAudioStreamRef.current = null;
    syncAudioElement(remoteAudioRef.current, null);
  };

  const syncRemoteVideoTrack = (
    target: "camera" | "screen",
    track: MediaStreamTrack,
    onEnded: () => void,
  ) => {
    const stream = new MediaStream([track]);

    if (target === "camera") {
      remoteCameraStreamRef.current?.getTracks().forEach((candidate) => candidate.stop());
      remoteCameraStreamRef.current = stream;
      syncVideoElement(remoteCameraRef.current, stream);
      setHasRemoteCamera(true);
    } else {
      remoteScreenStreamRef.current?.getTracks().forEach((candidate) => candidate.stop());
      remoteScreenStreamRef.current = stream;
      syncVideoElement(remoteScreenRef.current, stream);
      setHasRemoteScreen(true);
    }

    track.onended = onEnded;
  };

  const syncRemoteAudioTrack = (track: MediaStreamTrack) => {
    remoteAudioStreamRef.current?.getTracks().forEach((candidate) => candidate.stop());

    const stream = new MediaStream([track]);
    remoteAudioStreamRef.current = stream;
    syncAudioElement(remoteAudioRef.current, stream);
    track.onended = () => {
      clearRemoteAudio();
    };
  };

  const broadcastMediaState = () => {
    sendSignal("media-state", {
      cameraStreamId: localCameraStreamIdRef.current,
      screenStreamId: localScreenStreamIdRef.current,
    });
  };

  const resolveIncomingVideoTarget = (event: RTCTrackEvent): "camera" | "screen" => {
    const remoteStream = event.streams[0];
    const remoteStreamId = remoteStream?.id ?? null;

    if (remoteStreamId && remoteStreamId === remoteMediaIdsRef.current.screenStreamId) {
      return "screen";
    }

    if (remoteStreamId && remoteStreamId === remoteMediaIdsRef.current.cameraStreamId) {
      return "camera";
    }

    const label = event.track.label.toLowerCase();
    if (
      label.includes("screen") ||
      label.includes("window") ||
      label.includes("tab") ||
      label.includes("display")
    ) {
      return "screen";
    }

    return "camera";
  };

  const sendPresence = () => {
    if (!peerConnectionRef.current || presenceSentRef.current) {
      return;
    }

    if (signalingSocket.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    presenceSentRef.current = true;
    sendSignal("presence", { userId: currentUser.id });
    broadcastMediaState();
  };

  const renegotiateIfNeeded = async () => {
    const connection = peerConnectionRef.current;
    if (
      !connection ||
      !remoteParticipantIdRef.current ||
      makingOfferRef.current ||
      isSettingRemoteAnswerPendingRef.current ||
      connection.signalingState !== "stable"
    ) {
      return;
    }

    try {
      makingOfferRef.current = true;
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      sendSignal("offer", offer as unknown as Record<string, unknown>);
    } catch (renegotiationError) {
      setError(renegotiationError instanceof Error ? renegotiationError.message : "Unable to update shared media");
    } finally {
      makingOfferRef.current = false;
    }
  };

  const stopScreenShare = async (notifyRemote = true) => {
    const connection = peerConnectionRef.current;
    const sender = screenSenderRef.current;

    if (sender && connection) {
      connection.removeTrack(sender);
      screenSenderRef.current = null;
    }

    localScreenStreamRef.current?.getTracks().forEach((track) => track.stop());
    localScreenStreamRef.current = null;
    localScreenStreamIdRef.current = null;
    syncVideoElement(localScreenRef.current, null);
    setSharingScreen(false);

    if (notifyRemote) {
      sendSignal("screen-share-stopped", {});
      broadcastMediaState();
      await renegotiateIfNeeded();
    }
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrapMedia = async () => {
      try {
        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (mediaError) {
          const isPermissionDenied =
            mediaError instanceof DOMException &&
            (mediaError.name === "NotAllowedError" || mediaError.name === "PermissionDeniedError");

          if (isPermissionDenied) {
            setError(
              "Camera and/or microphone access denied. Please allow camera and microphone permissions in browser settings and refresh the page."
            );
            return;
          }

          // Fallback to video only if audio fails
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (videoError) {
            const isVideoPermissionDenied =
              videoError instanceof DOMException &&
              (videoError.name === "NotAllowedError" || videoError.name === "PermissionDeniedError");

            if (isVideoPermissionDenied) {
              setError(
                "Camera access denied. Please allow camera permission in browser settings and refresh the page."
              );
            } else {
              setError(
                videoError instanceof Error ? videoError.message : "Unable to access camera device"
              );
            }
            return;
          }
        }

        if (!isMounted) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        const [audioTrack] = mediaStream.getAudioTracks();
        const [videoTrack] = mediaStream.getVideoTracks();
        localAudioTrackRef.current = audioTrack ?? null;
        localCameraTrackRef.current = videoTrack ?? null;
        localCameraStreamIdRef.current = videoTrack ? mediaStream.id : null;
        syncLocalCameraPreview(videoTrack ?? null);

        if (!videoTrack && !audioTrack) {
          setError("No media tracks available. Please check your camera and microphone.");
          return;
        }

        const connection = new RTCPeerConnection({
          iceServers: env.iceServers,
        });
        peerConnectionRef.current = connection;
        setPeerReady(true);

        if (audioTrack) {
          connection.addTrack(audioTrack, mediaStream);
        }
        if (videoTrack) {
          cameraSenderRef.current = connection.addTrack(videoTrack, mediaStream);
        }

        connection.ontrack = (event) => {
          console.log(`[WebRTC] Received remote track: ${event.track.kind}`);
          if (event.track.kind === "audio") {
            syncRemoteAudioTrack(event.track);
            return;
          }

          const target = resolveIncomingVideoTarget(event);
          if (target === "screen") {
            syncRemoteVideoTrack("screen", event.track, clearRemoteScreen);
            return;
          }

          syncRemoteVideoTrack("camera", event.track, clearRemoteCamera);
        };

        connection.onicecandidate = ({ candidate }) => {
          if (!candidate) {
            return;
          }

          sendSignal("ice-candidate", candidate.toJSON() as Record<string, unknown>);
        };

        connection.onconnectionstatechange = () => {
          console.log(`[WebRTC] Connection state: ${connection.connectionState}`);
          if (connection.connectionState === "failed") {
            setError(
              "Peer connection failed. Please ensure both participants have a stable internet connection. If you're behind a corporate firewall, contact your administrator."
            );
          }
          if (connection.connectionState === "connected") {
            setError(null);
          }
        };

        connection.oniceconnectionstatechange = () => {
          console.log(`[WebRTC] ICE connection state: ${connection.iceConnectionState}`);
          if (connection.iceConnectionState === "failed") {
            setError(
              "Unable to establish peer connection. This usually means: 1) firewall/NAT blocking, 2) no internet, or 3) incompatible networks. Try: refreshing the page, checking your internet, or ensuring both participants are online."
            );
          }
          if (connection.iceConnectionState === "connected") {
            setError(null);
          }
        };

        connection.onicegatheringstatechange = () => {
          console.log(`[WebRTC] ICE gathering state: ${connection.iceGatheringState}`);
        };

        sendPresence();
      } catch (mediaError) {
        setError(mediaError instanceof Error ? mediaError.message : "Unable to access camera or microphone");
      }
    };

    void bootstrapMedia();

    return () => {
      isMounted = false;
      void stopScreenShare(false);
      setPeerReady(false);
      peerConnectionRef.current?.close();
      localAudioTrackRef.current?.stop();
      localCameraTrackRef.current?.stop();
      localCameraPreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
      localScreenStreamRef.current?.getTracks().forEach((track) => track.stop());
      remoteCameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      remoteScreenStreamRef.current?.getTracks().forEach((track) => track.stop());
      remoteAudioStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [currentUser.id]);

  useEffect(() => {
    sendPresence();
  }, [latestSignal]);

  useEffect(() => {
    if (!latestSignal || latestSignal.sender_id === currentUser.id || !peerReady || !peerConnectionRef.current) {
      return;
    }

    remoteParticipantIdRef.current = latestSignal.sender_id;
    const connection = peerConnectionRef.current;
    const polite = currentUser.id > latestSignal.sender_id;

    const sendOffer = async () => {
      if (makingOfferRef.current || connection.signalingState !== "stable") {
        return;
      }

      try {
        makingOfferRef.current = true;
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        sendSignal("offer", offer as unknown as Record<string, unknown>);
      } finally {
        makingOfferRef.current = false;
      }
    };

    const handleSignal = async () => {
      try {
        switch (latestSignal.signal_type) {
          case "presence": {
            broadcastMediaState();
            await new Promise((resolve) => setTimeout(resolve, 100));
            await sendOffer();
            break;
          }
          case "media-state": {
            remoteMediaIdsRef.current = {
              cameraStreamId: typeof latestSignal.payload.cameraStreamId === "string" ? latestSignal.payload.cameraStreamId : null,
              screenStreamId: typeof latestSignal.payload.screenStreamId === "string" ? latestSignal.payload.screenStreamId : null,
            };

            if (!remoteMediaIdsRef.current.cameraStreamId) {
              clearRemoteCamera();
            }
            if (!remoteMediaIdsRef.current.screenStreamId) {
              clearRemoteScreen();
            }
            break;
          }
          case "screen-share-stopped": {
            clearRemoteScreen();
            break;
          }
          case "camera-stopped": {
            clearRemoteCamera();
            break;
          }
          case "offer": {
            const description = latestSignal.payload as unknown as RTCSessionDescriptionInit;
            const readyForOffer =
              !makingOfferRef.current &&
              (connection.signalingState === "stable" || isSettingRemoteAnswerPendingRef.current);
            const offerCollision = !readyForOffer;
            ignoreOfferRef.current = !polite && offerCollision;
            if (ignoreOfferRef.current) {
              return;
            }

            if (offerCollision) {
              await Promise.all([
                connection.setLocalDescription({ type: "rollback" }),
                connection.setRemoteDescription(new RTCSessionDescription(description)),
              ]);
            } else {
              await connection.setRemoteDescription(new RTCSessionDescription(description));
            }

            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);
            sendSignal("answer", answer as unknown as Record<string, unknown>);

            while (pendingCandidatesRef.current.length > 0) {
              const candidate = pendingCandidatesRef.current.shift();
              if (candidate) {
                await connection.addIceCandidate(new RTCIceCandidate(candidate));
              }
            }
            break;
          }
          case "answer": {
            if (connection.signalingState !== "have-local-offer") {
              return;
            }

            isSettingRemoteAnswerPendingRef.current = true;
            try {
              await connection.setRemoteDescription(
                new RTCSessionDescription(latestSignal.payload as unknown as RTCSessionDescriptionInit),
              );
            } finally {
              isSettingRemoteAnswerPendingRef.current = false;
            }
            break;
          }
          case "ice-candidate": {
            const candidate = latestSignal.payload as RTCIceCandidateInit;
            if (connection.remoteDescription) {
              await connection.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              pendingCandidatesRef.current.push(candidate);
            }
            break;
          }
          default:
            break;
        }
      } catch (signalError) {
        setError(signalError instanceof Error ? signalError.message : "WebRTC negotiation failed");
      }
    };

    void handleSignal();
  }, [currentUser.id, latestSignal, peerReady]);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.enabled = !nextMuted;
    }
  };

  const toggleCamera = async () => {
    try {
      if (cameraEnabled) {
        await cameraSenderRef.current?.replaceTrack(null);
        localCameraTrackRef.current?.stop();
        localCameraTrackRef.current = null;
        localCameraStreamIdRef.current = null;
        syncLocalCameraPreview(null);
        setCameraEnabled(false);
        sendSignal("camera-stopped", {});
        broadcastMediaState();
        await renegotiateIfNeeded();
        return;
      }

      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const [videoTrack] = cameraStream.getVideoTracks();
      if (!videoTrack) {
        return;
      }

      localCameraTrackRef.current = videoTrack;
      localCameraStreamIdRef.current = cameraStream.id;
      syncLocalCameraPreview(videoTrack);

      if (cameraSenderRef.current) {
        await cameraSenderRef.current.replaceTrack(videoTrack);
      } else if (peerConnectionRef.current) {
        cameraSenderRef.current = peerConnectionRef.current.addTrack(videoTrack, cameraStream);
      }

      setCameraEnabled(true);
      broadcastMediaState();
      await renegotiateIfNeeded();
    } catch (cameraError) {
      setError(cameraError instanceof Error ? cameraError.message : "Unable to toggle camera");
    }
  };

  const toggleScreenShare = async () => {
    const connection = peerConnectionRef.current;
    if (!connection) {
      return;
    }

    try {
      if (sharingScreen) {
        await stopScreenShare();
        return;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) {
        return;
      }

      localScreenStreamRef.current = screenStream;
      localScreenStreamIdRef.current = screenStream.id;
      syncVideoElement(localScreenRef.current, screenStream);
      screenSenderRef.current = connection.addTrack(screenTrack, screenStream);
      setSharingScreen(true);

      screenTrack.onended = () => {
        void stopScreenShare();
      };

      broadcastMediaState();
      await renegotiateIfNeeded();
    } catch (screenError) {
      setError(screenError instanceof Error ? screenError.message : "Screen share failed");
    }
  };

  return (
    <div className="flex h-full flex-col rounded-[28px] border border-slate-200 bg-white">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="border-b border-slate-100 px-4 py-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">Video Call</p>
        <h3 className="mt-2 text-xl font-semibold text-ink">Peer session</h3>
      </div>

      {error ? <div className="mx-4 mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}

      <div className="grid flex-1 gap-3 p-4">
        <div className="relative min-h-[220px] overflow-hidden rounded-3xl bg-slate-950">
          <video ref={remoteCameraRef} autoPlay playsInline className="h-full w-full object-cover" />
          {!hasRemoteCamera ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
              Waiting for the other participant&apos;s camera...
            </div>
          ) : null}
          <div className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-white">
            Remote camera
          </div>
        </div>

        <div className="relative min-h-[160px] overflow-hidden rounded-3xl bg-slate-900">
          <video ref={remoteScreenRef} autoPlay playsInline className="h-full w-full object-contain" />
          {!hasRemoteScreen ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
              Remote screen share will appear here.
            </div>
          ) : null}
          <div className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-white">
            Remote screen
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="relative min-h-[160px] overflow-hidden rounded-3xl bg-slate-900">
            <video ref={localCameraRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            {!cameraEnabled ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">Camera is off.</div>
            ) : null}
            <div className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-white">
              Your camera
            </div>
          </div>

          <div className="relative min-h-[160px] overflow-hidden rounded-3xl bg-slate-900">
            <video ref={localScreenRef} autoPlay muted playsInline className="h-full w-full object-contain" />
            {!sharingScreen ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
                Your shared screen preview will appear here.
              </div>
            ) : null}
            <div className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-white">
              Your screen
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-slate-100 p-4">
        <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white" onClick={toggleMute}>
          {isMuted ? "Unmute" : "Mute"}
        </button>
        <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white" onClick={() => void toggleCamera()}>
          {cameraEnabled ? "Camera Off" : "Camera On"}
        </button>
        <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white" onClick={() => void toggleScreenShare()}>
          {sharingScreen ? "Stop Share" : "Share"}
        </button>
      </div>
    </div>
  );
}
