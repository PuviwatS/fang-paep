"use client";

import { useEffect, useState } from "react";
import { fetchPreview } from "@/lib/itunes";
import type { Preview } from "@/lib/types";

interface PreviewState {
  preview: Preview | null;
  isLoading: boolean;
  error: string | null;
}

/** Look up the preview audio for a track whenever the track changes. */
export function usePreview(trackId: number): PreviewState {
  const [state, setState] = useState<PreviewState>({ preview: null, isLoading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ preview: null, isLoading: true, error: null });

    fetchPreview(trackId)
      .then((preview) => {
        if (!cancelled) setState({ preview, isLoading: false, error: null });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            preview: null,
            isLoading: false,
            error: "โหลดเสียงจาก iTunes ไม่สำเร็จ ลองเปลี่ยนเพลงหรือรีเฟรชหน้า",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [trackId]);

  return state;
}
