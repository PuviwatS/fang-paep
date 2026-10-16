"use client";

import { useEffect, useState } from "react";
import { hasSeenHelp, markHelpSeen } from "@/lib/storage";

/** Returns [isOpen, setOpen] for the help dialog, opened automatically on a player's first visit. */
export function useFirstVisitHelp(): [boolean, (open: boolean) => void] {
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    if (!hasSeenHelp()) {
      setOpen(true);
      markHelpSeen();
    }
  }, []);

  return [isOpen, setOpen];
}
