import { useEffect, useRef, useState } from "react";
import {
  ConfigProvider,
  type DemoConfig,
  useConfig,
} from "./app/ConfigProvider";
import formatPublishError from "./app/formatPublishError.ts";
import { useDisplayShare } from "./app/useDisplayShare";
import {
  SrsRtcPublisherAsync,
  type SrsRtcPublisherAsyncInstance,
  type SrsSessionInfo,
} from "./srs.sdk";
import "./App.css";

function App() {
  return (
    <ConfigProvider>
      <DemoShell />
    </ConfigProvider>
  );
}

function DemoShell() {
  const { config, isReady } = useConfig();

  if (!isReady) {
    return (
      <div className="app app--loading">
        <div className="loading-card">
          <h1>加载中</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <main className="workspace">
        <PublishPage config={config} />
      </main>
    </div>
  );
}

function PublishPage({ config }: { config: DemoConfig }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const publisherRef = useRef<SrsRtcPublisherAsyncInstance | null>(null);
  const [publishStatus, setPublishStatus] = useState<"idle" | "publishing">(
    "idle",
  );
  const [publishError, setPublishError] = useState("");
  const [sessionInfo, setSessionInfo] = useState<SrsSessionInfo | null>(null);
  const [audioStats, setAudioStats] = useState("");
  const [videoStats, setVideoStats] = useState("");
  const { previewStream, error, startDisplayShare, isSharingDisplay } =
    useDisplayShare();

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.srcObject = previewStream;
    if (previewStream) {
      void videoRef.current.play().catch(() => undefined);
    }
  }, [previewStream]);

  async function startPublish() {
    if (!previewStream) {
      setPublishError("请先开启窗口共享，再开始推流。");
      return;
    }

    if (previewStream.getTracks().length === 0) {
      setPublishError("当前预览流没有可用于推流的轨道，请先重新开启采集。");
      return;
    }

    setPublishError("");
    setAudioStats("");
    setVideoStats("");
    setPublishStatus("publishing");

    let restoreGetUserMedia: null | (() => void) = null;

    try {
      if (publisherRef.current) {
        try {
          publisherRef.current.close();
        } catch (_) {}
        publisherRef.current = null;
      }

      const sdk = SrsRtcPublisherAsync();
      publisherRef.current = sdk;

      const mediaDevices = navigator.mediaDevices as MediaDevices & {
        getUserMedia: typeof navigator.mediaDevices.getUserMedia;
      };
      const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
      mediaDevices.getUserMedia = (async () =>
        previewStream) as typeof mediaDevices.getUserMedia;
      restoreGetUserMedia = () => {
        mediaDevices.getUserMedia = originalGetUserMedia;
      };

      if (videoRef.current) {
        videoRef.current.srcObject = sdk.stream;
        void videoRef.current.play().catch(() => undefined);
      }

      const pc = sdk.pc;
      if (pc) {
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") {
            const formatSenders = (
              window as Window & {
                SrsRtcFormatSenders?:
                  | ((senders: RTCRtpSender[], kind?: string) => string)
                  | undefined;
              }
            ).SrsRtcFormatSenders as
              | ((senders: RTCRtpSender[], kind?: string) => string)
              | undefined;
            const senders = pc.getSenders() ?? [];
            setAudioStats(formatSenders ? formatSenders(senders, "audio") : "");
            setVideoStats(formatSenders ? formatSenders(senders, "video") : "");
          }
        };
      }

      const session = await sdk.publish(config.pushUrl);
      setSessionInfo(session as unknown as SrsSessionInfo);
    } catch (e) {
      setPublishError(formatPublishError(e));

      try {
        publisherRef.current?.close();
      } catch (_) {}
      publisherRef.current = null;
      console.error(e);
      setPublishStatus("idle");
    } finally {
      restoreGetUserMedia?.();
    }
  }

  useEffect(() => {
    return () => {
      if (publisherRef.current) {
        try {
          publisherRef.current.close();
        } catch (_) {}
        publisherRef.current = null;
      }
    };
  }, []);

  return (
    <section className="page page--publish">
      <div className="page__grid">
        <article className="card card--main">
          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void startDisplayShare({
                  video: true,
                  audio: false,
                })
              }
            >
              分享窗口
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={startPublish}
            >
              开始推流
            </button>
          </div>

          <div className="status-row">
            <StatusCard
              label="共享状态"
              value={isSharingDisplay ? "屏幕共享中" : "未共享"}
            />
            <StatusCard
              label="推流状态"
              value={publishStatus === "publishing" ? "推流中" : "未推流"}
            />
          </div>

          {sessionInfo ? (
            <div className="notice">
              <div>{sessionInfo.sessionid}</div>
              <div>{sessionInfo.simulator}</div>
              <div>{audioStats}</div>
              <div>{videoStats}</div>
            </div>
          ) : null}

          {publishError ? (
            <div className="notice notice--error">{publishError}</div>
          ) : null}
          {error ? <div className="notice notice--error">{error}</div> : null}
        </article>

        <aside className="card card--preview">
          <div className="preview-frame">
            {previewStream ? (
              <video ref={videoRef} autoPlay playsInline muted />
            ) : (
              <div className="preview-placeholder">
                <p>未开始采集</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-card">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

export default App;
