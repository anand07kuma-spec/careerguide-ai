"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/**
 * The saved profile picture as an object URL for as long as the caller is open.
 *
 * The bytes are behind the session, so the address in `profile_photo_url` says a
 * picture exists rather than serving it. Every screen that draws the face reads
 * through here: the hero and the sidebar share one answer, and a save changes the
 * key, which fetches the new face and revokes the previous object URL.
 *
 * A fetch that fails leaves `url` null and names the failed key, so the initials
 * show instead of a picture that never arrives.
 */
export function useProfilePhoto(photoKey: string | null) {
  const [photo, setPhoto] = useState<{ key: string; url: string } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    function replace(next: string | null) {
      const previous = urlRef.current;
      urlRef.current = next;
      if (previous && previous !== next) URL.revokeObjectURL(previous);
    }

    if (!photoKey) {
      // Only the previous object URL needs releasing; what the caller sees is
      // derived from the key below, so this path changes no state.
      replace(null);
      return;
    }

    let cancelled = false;
    api
      .profilePhoto()
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        replace(url);
        setPhoto({ key: photoKey, url });
        setFailedKey(null);
      })
      .catch(() => {
        if (cancelled) return;
        replace(null);
        setPhoto(null);
        setFailedKey(photoKey);
      });

    return () => {
      cancelled = true;
    };
  }, [photoKey]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  return {
    url: photo && photo.key === photoKey ? photo.url : null,
    loading: Boolean(photoKey) && photo?.key !== photoKey && failedKey !== photoKey,
  };
}
