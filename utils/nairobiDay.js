const TIME_ZONE = 'Africa/Nairobi';

function dayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDay(key, amount) {
  const [year, month, date] = key.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + amount));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

function streakTransition(stats, today) {
  if (stats.lastAnswerDay === today) return stats;
  const yesterday = shiftDay(today, -1);
  const currentStreak = stats.lastAnswerDay === yesterday ? stats.currentStreak + 1 : 1;
  return {
    currentStreak,
    longestStreak: Math.max(stats.longestStreak, currentStreak),
    lastAnswerDay: today,
    streakLostDay: '',
    version: stats.version + 1,
  };
}

function streakPopup(stats, today) {
  if (stats.streakLostDay === today && stats.lostPopupSeenDay !== today) return 'lost';
  if (stats.currentStreak === 0 && !stats.lastAnswerDay && (!stats.firstPopupDismissedUntil || today >= stats.firstPopupDismissedUntil)) return 'first';
  if (stats.currentStreak > 0 && stats.lastAnswerDay !== today && stats.reminderDismissedDay !== today) return 'reminder';
  return null;
}

module.exports = { TIME_ZONE, dayKey, shiftDay, streakTransition, streakPopup };