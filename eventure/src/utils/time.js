// Convert minutes (e.g., 810 for 13:30) to HH:MM format
export function minutesToHHMM(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Convert HH:MM time to minutes from midnight
export function minutesFromStart(timeStr, startHour) {
  if (!timeStr) return NaN;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return NaN;
  return (hours - startHour) * 60 + minutes;
}

// Calculate position and height for an event in the schedule
export function eventRect(startTime, endTime, startHour, hourHeight, totalHours) {
  const startMins = minutesFromStart(startTime, startHour);
  const endMins = minutesFromStart(endTime, startHour);
  
  if (Number.isNaN(startMins) || Number.isNaN(endMins)) {
    return { top: 0, height: 0 };
  }

  const top = Math.max(0, (startMins / 60) * hourHeight);
  const height = Math.max(0, ((endMins - startMins) / 60) * hourHeight);
  
  return { top, height };
}