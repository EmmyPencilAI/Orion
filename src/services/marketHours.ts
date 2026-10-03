import { MarketSessionInfo } from '../types/signal';

export function getForexMarketSession(now: Date = new Date()): MarketSessionInfo {
  // Use UTC time
  const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();

  let isOpen = true;
  let message = 'Forex Market Active (Continuous 60s Analysis)';
  let reopenTime = 'Active';
  let hoursToOpen = 0;

  if (day === 6) {
    // Saturday: completely closed
    isOpen = false;
    // Sunday 21:00 UTC is (24 - hour) + 21 hours away
    hoursToOpen = (24 - hour) + 21;
    message = `Weekend Market Pause — Forex closes Friday 21:00 UTC and reopens Sunday 21:00 UTC (5 PM EST).`;
    reopenTime = 'Sunday 21:00 UTC (5:00 PM EST)';
  } else if (day === 0 && hour < 21) {
    // Sunday before 21:00 UTC
    isOpen = false;
    hoursToOpen = 21 - hour;
    message = `Sunday Pre-Market: Reopens today at 21:00 UTC (5:00 PM EST) in ~${hoursToOpen}h.`;
    reopenTime = 'Today 21:00 UTC (5:00 PM EST)';
  } else if (day === 5 && hour >= 21) {
    // Friday after 21:00 UTC
    isOpen = false;
    hoursToOpen = 48 + (21 - hour);
    message = 'Friday Market Close: Closed for the weekend. Reopens Sunday 21:00 UTC.';
    reopenTime = 'Sunday 21:00 UTC (5:00 PM EST)';
  }

  return {
    is_open: isOpen,
    status: isOpen ? 'OPEN' : 'WEEKEND_CLOSED',
    message,
    reopen_time: reopenTime,
    hours_to_open: hoursToOpen > 0 ? hoursToOpen : undefined,
  };
}
