import { useEffect, useRef, useState } from "react";
import type { DemoConfig } from "./ConfigProvider";
import formatPublishError from "./formatPublishError";
import { Modal } from "./Modal";
import { useDisplayShare } from "./useDisplayShare";
import {
  SrsRtcPublisherAsync,
  type SrsRtcPublisherAsyncInstance,
  type SrsSessionInfo,
} from "../srs.sdk";

interface PublishConfigModalProps {
  open: boolean;
  config: DemoConfig;
  onClose: () => void;
}

export function PublishConfigModal({ open, config, onClose }: PublishConfigModalProps) {
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [publisher, setPublisher] = useState<SrsRtcPublisherAsyncInstance | null>(() => null);
  const [publishStatus, setPublishStatus] = useState<"idle" | "publishing">("idle");
  const [publishError, setPublishError] = useState("");
  const [sessionInfo, setSessionInfo] = useState<SrsSessionInfo | null>(null);
  const [audioStats, setAudioStats] = useState("");
  const [videoStats, setVideoStats] = useState("");
  const { previewStream, error: shareError, startDisplayShare, isSharingDisplay } = useDisplayShare();

  const activePreviewStream = publisher?.stream ?? previewStream;

  useEffect(() => {
    if (!previewVideoRef.current) {
      return;
    }

    previewVideoRef.current.srcObject = activePreviewStream;
    if (activePreviewStream) {
      void previewVideoRef.current.play().catch(() => undefined);
    }
  }, [activePreviewStream]);

  useEffect(() => {
    return () => {
      if (publisher) {
        try {
          publisher.close();
        } catch (error) {
          console.error(error);
        }
      }
    };
  }, [publisher]);

  async function startPublish() {
    if (!previewStream) {
      setPublishError("请先选择要共享的屏幕，再开始推流。");
      return;
    }

    if (previewStream.getTracks().length === 0) {
      setPublishError("当前预览流没有可用于推流的轨道，请先重新选择共享屏幕。");
      return;
    }

    setPublishError("");
    setAudioStats("");
    setVideoStats("");
    setSessionInfo(null);
    setPublishStatus("publishing");

    let restoreGetUserMedia: null | (() => void) = null;

    try {
      const sdk = SrsRtcPublisherAsync();
      setPublisher(sdk);

      const mediaDevices = navigator.mediaDevices as MediaDevices & {
        getUserMedia: typeof navigator.mediaDevices.getUserMedia;
      };
      const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
      mediaDevices.getUserMedia = (async () => previewStream) as typeof mediaDevices.getUserMedia;
      restoreGetUserMedia = () => {
        mediaDevices.getUserMedia = originalGetUserMedia;
      };

      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = sdk.stream;
        void previewVideoRef.current.play().catch(() => undefined);
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
    } catch (error) {
      setPublishError(formatPublishError(error));
      setPublisher(null);
      console.error(error);
      setPublishStatus("idle");
    } finally {
      restoreGetUserMedia?.();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="推流配置"
      description="先选择要共享的屏幕，再开始推流；下方会保留预览区，方便确认推流结果。"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="flex flex-col gap-4">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-slate-950/20 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  屏幕共享
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">选择要共享的屏幕</h3>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                {isSharingDisplay ? "共享中" : "未共享"}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-300"
                onClick={() =>
                  void startDisplayShare({
                    video: true,
                    audio: false,
                  })
                }
              >
                选择屏幕
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-slate-100 transition hover:bg-white/10"
                onClick={startPublish}
              >
                开始推流
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              推流地址：<span className="break-all text-slate-200">{config.pushUrl}</span>
            </p>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-slate-950/20 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatusCard label="共享状态" value={isSharingDisplay ? "屏幕共享中" : "未共享"} />
              <StatusCard label="推流状态" value={publishStatus === "publishing" ? "推流中" : "未推流"} />
            </div>

            {sessionInfo ? (
              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm leading-6 text-slate-200">
                <div className="break-all">{sessionInfo.sessionid}</div>
                <div className="mt-1 break-all text-slate-400">{sessionInfo.simulator}</div>
                <div className="mt-2 break-all">{audioStats}</div>
                <div className="break-all">{videoStats}</div>
              </div>
            ) : null}

            {publishError ? (
              <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm leading-6 text-rose-100">
                {publishError}
              </div>
            ) : null}

            {shareError ? (
              <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm leading-6 text-rose-100">
                {shareError}
              </div>
            ) : null}
          </section>
        </div>

        <aside className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-slate-950/20 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                预览
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">推流结果预览</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {activePreviewStream ? "可预览" : "等待共享"}
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70">
            {activePreviewStream ? (
              <video
                ref={previewVideoRef}
                autoPlay
                muted
                playsInline
                className="aspect-video w-full bg-black object-cover"
              />
            ) : (
              <div className="flex min-h-[18rem] items-center justify-center px-6 py-10 text-center">
                <div className="max-w-sm">
                  <p className="text-lg font-medium text-white">尚未开始预览</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    先点击“选择屏幕”，再开始推流；这里会展示当前共享内容和推流画面。
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </Modal>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <span className="block text-xs uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <strong className="mt-2 block break-words text-sm font-medium text-white">{value}</strong>
    </div>
  );
}
