import { useState, useRef, useEffect, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { voiceApi, type VoiceDraftStatus } from '../api/voice';
import { isNetworkError } from '../services/offlineQueue';

const POLL_INTERVAL_FAST_MS = 2000;
const POLL_INTERVAL_SLOW_MS = 4000;
const POLL_FAST_THRESHOLD = 15;
const MAX_POLL_ATTEMPTS = 60;
const MAX_UPLOAD_RETRIES = 2;

type HookStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

export interface UseVoiceDraftResult {
  status: HookStatus;
  draft: VoiceDraftStatus | null;
  errorCode: string | null;
  uploadAttempt: number;
  upload: (uri: string, locale: string) => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
}

function extractErrorCode(error: unknown): string {
  if (isNetworkError(error)) return 'network_error';
  if (!(error instanceof Error)) return 'unknown';
  const msg = error.message;
  // 404 on draft poll = expired
  if (msg.includes('API error 404')) return 'expired';
  // 400 with daily cap
  if (msg.includes('voice_daily_cap_reached')) return 'voice_daily_cap_reached';
  return 'unknown';
}

function isDailyCapError(code: string): boolean {
  return code === 'voice_daily_cap_reached';
}

export function useVoiceDraft(): UseVoiceDraftResult {
  const [status, setStatus] = useState<HookStatus>('idle');
  const [draft, setDraft] = useState<VoiceDraftStatus | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [uploadAttempt, setUploadAttempt] = useState(0);

  const lastUriRef = useRef<string | null>(null);
  const lastLocaleRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptRef = useRef(0);
  const draftIdRef = useRef<string | null>(null);
  const isPausedRef = useRef(false);
  const statusRef = useRef<HookStatus>('idle');

  // Keep statusRef in sync so AppState handler can read current status
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const schedulePoll = useCallback((draftId: string, attempt: number) => {
    if (isPausedRef.current) return;
    if (attempt >= MAX_POLL_ATTEMPTS) {
      setErrorCode('transcription_timeout');
      setStatus('failed');
      return;
    }
    const delay = attempt < POLL_FAST_THRESHOLD ? POLL_INTERVAL_FAST_MS : POLL_INTERVAL_SLOW_MS;
    pollTimerRef.current = setTimeout(() => {
      void pollOnce(draftId, attempt);
    }, delay);
  }, []);

  const pollOnce = useCallback(
    async (draftId: string, attempt: number) => {
      if (isPausedRef.current) return;
      try {
        const res = await voiceApi.getDraft(draftId);
        const d = res.data;
        setDraft(d);

        if (d.status === 'completed') {
          setStatus('completed');
          return;
        }

        if (d.status === 'failed') {
          // Map draft errorMessage to errorCode
          const code = d.errorMessage ?? 'transcription_failed';
          setErrorCode(code);
          setStatus('failed');
          return;
        }

        pollAttemptRef.current = attempt + 1;
        schedulePoll(draftId, attempt + 1);
      } catch (e) {
        const code = extractErrorCode(e);
        if (code === 'network_error') {
          // Don't count network errors against retry cap; keep polling
          pollAttemptRef.current = attempt + 1;
          schedulePoll(draftId, attempt + 1);
          return;
        }
        if (code === 'expired') {
          setErrorCode('expired');
          setStatus('failed');
          return;
        }
        // Other poll errors: surface but don't retry upload
        setErrorCode(code);
        setStatus('failed');
      }
    },
    [schedulePoll],
  );

  const startPolling = useCallback(
    (draftId: string) => {
      draftIdRef.current = draftId;
      pollAttemptRef.current = 0;
      isPausedRef.current = false;
      setStatus('processing');
      schedulePoll(draftId, 0);
    },
    [schedulePoll],
  );

  const doUpload = useCallback(
    async (uri: string, locale: string, attempt: number) => {
      abortControllerRef.current = new AbortController();
      setStatus('uploading');
      setErrorCode(null);
      setDraft(null);

      try {
        const res = await voiceApi.upload(uri, locale, abortControllerRef.current.signal);
        setUploadAttempt(attempt);
        startPolling(res.data.draftId);
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') {
          setStatus('idle');
          return;
        }
        const code = extractErrorCode(e);
        setErrorCode(code);
        setStatus('failed');
        setUploadAttempt(attempt);
      }
    },
    [startPolling],
  );

  const upload = useCallback(
    async (uri: string, locale: string) => {
      lastUriRef.current = uri;
      lastLocaleRef.current = locale;
      clearPollTimer();
      await doUpload(uri, locale, 0);
    },
    [doUpload, clearPollTimer],
  );

  const retry = useCallback(async () => {
    const uri = lastUriRef.current;
    const locale = lastLocaleRef.current;
    if (!uri || !locale) return;

    const nextAttempt = uploadAttempt + 1;
    if (nextAttempt > MAX_UPLOAD_RETRIES || isDailyCapError(errorCode ?? '')) return;

    clearPollTimer();
    await doUpload(uri, locale, nextAttempt);
  }, [uploadAttempt, errorCode, doUpload, clearPollTimer]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    clearPollTimer();
    draftIdRef.current = null;
    pollAttemptRef.current = 0;
    isPausedRef.current = false;
    setStatus('idle');
    setDraft(null);
    setErrorCode(null);
    setUploadAttempt(0);
    lastUriRef.current = null;
    lastLocaleRef.current = null;
  }, [clearPollTimer]);

  // AppState: pause poll on background, resume on active
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        if (statusRef.current === 'processing') {
          isPausedRef.current = true;
          clearPollTimer();
        }
      } else if (nextAppState === 'active') {
        if (statusRef.current === 'processing' && isPausedRef.current) {
          isPausedRef.current = false;
          const draftId = draftIdRef.current;
          if (draftId) {
            void pollOnce(draftId, pollAttemptRef.current);
          }
        }
      }
    });
    return () => {
      subscription.remove();
    };
  }, [clearPollTimer, pollOnce]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      clearPollTimer();
    };
  }, [clearPollTimer]);

  return { status, draft, errorCode, uploadAttempt, upload, retry, reset };
}
