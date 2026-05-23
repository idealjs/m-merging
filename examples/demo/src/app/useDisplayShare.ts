import { useCallback, useEffect, useEffectEvent, useState } from "react";

type DisplayShareConstraints = {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
};

const DEFAULT_DISPLAY_SHARE_CONSTRAINTS: DisplayShareConstraints = {
  video: true,
  audio: false,
};

export function useDisplayShare() {
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSharingDisplay, setIsSharingDisplay] = useState(false);

  const stopDisplayShare = useEffectEvent(() => {
    previewStream?.getTracks().forEach((track) => {
      track.stop();
    });
  });

  useEffect(() => {
    return () => {
      stopDisplayShare();
    };
  }, []);

  useEffect(() => {
    if (!previewStream) return;

    const stopCapture = () => {
      stopDisplayShare();
      setPreviewStream(null);
      setIsSharingDisplay(false);
    };

    previewStream.addEventListener("inactive", stopCapture);
    return () => {
      previewStream.removeEventListener("inactive", stopCapture);
    };
  }, [previewStream]);

  const startDisplayShare = useCallback(
    async (
      constraints: DisplayShareConstraints = DEFAULT_DISPLAY_SHARE_CONSTRAINTS,
    ) => {
      try {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          throw new Error("当前浏览器不支持桌面共享");
        }

        const displayStream =
          await navigator.mediaDevices.getDisplayMedia(constraints);

        setIsSharingDisplay(true);
        setPreviewStream(displayStream);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "桌面共享失败");
      }
    },
    [],
  );

  return {
    previewStream,
    error,
    isSharingDisplay,
    startDisplayShare,
  };
}
