import { useEffect, useRef, useState } from 'react';

// Demo-compressed timers (real-world: 90/20/10 minutes).
const IDLE_MS       = 30_000; // first prompt after this much "away"
const FIRST_WAIT_MS = 15_000; // wait after first prompt before second
const FINAL_MS      = 10_000; // countdown shown in second prompt

export default function AutoReleaseManager({ booking, onRelease }) {
  const [stage, setStage] = useState('idle'); // idle | prompt1 | prompt2 | released
  const [secondsLeft, setSecondsLeft] = useState(FINAL_MS / 1000);
  const idleTimer = useRef(null);
  const waitTimer = useRef(null);
  const countdownTimer = useRef(null);

  const bookingId = booking?.id || null;

  // Reset everything when the booking changes (e.g. user releases / checks in elsewhere)
  useEffect(() => {
    clearAll();
    if (!bookingId) {
      setStage('idle');
      return;
    }
    setStage('idle');
    scheduleIdle();
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  function clearAll() {
    clearTimeout(idleTimer.current);
    clearTimeout(waitTimer.current);
    clearInterval(countdownTimer.current);
  }

  function scheduleIdle() {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setStage('prompt1'), IDLE_MS);
  }

  function onStillHere() {
    setStage('idle');
    clearAll();
    scheduleIdle();
  }

  // Stage transitions for the prompts
  useEffect(() => {
    if (stage === 'prompt1') {
      waitTimer.current = setTimeout(() => setStage('prompt2'), FIRST_WAIT_MS);
    } else if (stage === 'prompt2') {
      setSecondsLeft(FINAL_MS / 1000);
      countdownTimer.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(countdownTimer.current);
            doRelease();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      clearTimeout(waitTimer.current);
      clearInterval(countdownTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  async function doRelease() {
    if (!bookingId) return;
    setStage('released');
    await onRelease(bookingId);
  }

  if (!booking) return null;
  if (stage === 'idle' || stage === 'released') return null;

  return (
    <div className="release-prompt">
      <h4>{stage === 'prompt1' ? 'Still at your desk?' : 'About to release your desk'}</h4>
      <p>
        {stage === 'prompt1'
          ? `We haven't seen activity at desk ${booking.deskId}. Are you still there?`
          : <>Desk releases in <span className="countdown">{secondsLeft}s</span>. Confirm you're still using it.</>}
      </p>
      <div className="actions">
        <button onClick={doRelease}>Release now</button>
        <button className="primary" onClick={onStillHere}>I'm still here</button>
      </div>
    </div>
  );
}
