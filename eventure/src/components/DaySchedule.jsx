import React from 'react';

import { eventRect } from '../utils/time';

const DEFAULT_HOUR_HEIGHT = 60;
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 19;

function hourLabel(hour) {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

function DaySchedule({
  events = [],
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
  hourHeight = DEFAULT_HOUR_HEIGHT,
}) {
  const totalHours = Math.max(0, endHour - startHour);
  const totalHeight = totalHours * hourHeight;

  return (
    <div className="relative rounded-2xl bg-white p-4 shadow">
      <div className="relative" style={{ height: totalHeight }}>
        {Array.from({ length: totalHours + 1 }).map((_, index) => {
          const hour = startHour + index;
          const top = index * hourHeight;
          return (
            <div key={hour} className="absolute left-0 right-0" style={{ top }}>
              <div className="flex items-center">
                <div className="w-14 -translate-y-2 text-[11px] text-gray-600">{hourLabel(hour)}</div>
                <div className="h-px flex-1 bg-gray-300" />
              </div>
              {index < totalHours && (
                <div
                  className="absolute left-14 right-0 border-t border-dashed border-gray-400"
                  style={{ top: hourHeight / 1.55 }}
                />
              )}
            </div>
          );
        })}

        {events.length === 0 && (
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-sm text-gray-400">
            No scheduled events
          </div>
        )}

        {events.map((event) => {
          if (!event?.start || !event?.end) return null;
          const { top, height } = eventRect(event.start, event.end, startHour, hourHeight, totalHours);
          if (height <= 0) return null;
          const title = event.title || 'Untitled Event';
          const colorClass = event.colorClass || 'bg-blue-100';

          return (
            <div
              key={event.id}
              className={`absolute left-16 right-2 overflow-hidden rounded-xl p-2 text-sm shadow ${colorClass}`}
              style={{ top, height }}
              role="button"
              tabIndex={0}
              aria-label={`${title} from ${event.start} to ${event.end}`}
            >
              <div className="font-medium text-gray-900">{title}</div>
              <div className="text-xs text-gray-600">
                {event.start}–{event.end}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DaySchedule;
