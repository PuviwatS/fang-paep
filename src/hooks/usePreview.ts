"use client";

import { useEffect, useState } from "react";
import { fetchPreview } from "@/lib/itunes";
import type { Preview } from "@/lib/types";

interface PreviewState {
  preview: Preview | null;
  isLoading: boolean;
  error: string | null;
}

/** Look up a track's preview audio on iTunes (practice mode). Pass null to skip the lookup. */
export function usePreview(trackId: number | null): PreviewState {
  const [state, setState] = useState<PreviewState>({
    preview: null,
    isLoading: trackId !== null,
    error: null,
  });

  useEffect(() => {
    if (trackId === null) {
      setState({ preview: null, isLoading: false, error: null });
      return;
    }
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
