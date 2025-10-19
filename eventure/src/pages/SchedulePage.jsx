import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DaySchedule from '../components/DaySchedule';
import { minutesFromStart, minutesToHHMM } from '../utils/time';

function formatEventDate(dateArray) {
  if (!Array.isArray(dateArray) || dateArray.length !== 3) return 'Date TBD';
  const [month, day, year] = dateArray;
  const paddedMonth = String(month).padStart(2, '0');
  const paddedDay = String(day).padStart(2, '0');
  return `${year}-${paddedMonth}-${paddedDay}`;
}

function formatTimeRange(startTime, endTime) {
  if (!startTime && !endTime) return 'No set time';
  if (startTime && endTime) return `${startTime} ~ ${endTime}`;
  return startTime ? `${startTime} starts` : `${endTime} ends`;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const START_HOUR = 8;
const END_HOUR = 22;
const HOUR_HEIGHT = 60;
const SCHEDULE_STORAGE_KEY = 'schedule-state';
const WAITLIST_STORAGE_KEY = 'waitlist-state';

function createEmptySchedule() {
  return DAYS.reduce((acc, day) => {
    acc[day] = [];
    return acc;
  }, {});
}

const SchedulePage = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [waitlistEvents, setWaitlistEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [schedule, setSchedule] = useState(() => createEmptySchedule());
  const [scheduleError, setScheduleError] = useState(null);
  const [conflictState, setConflictState] = useState(null);
  const [selectedConflictIndex, setSelectedConflictIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const hasStoredWaitlistRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedSchedule = window.localStorage.getItem(SCHEDULE_STORAGE_KEY);
      if (storedSchedule) {
        const parsed = JSON.parse(storedSchedule);
        if (parsed && typeof parsed === 'object') {
          const restored = createEmptySchedule();
          DAYS.forEach((day) => {
            if (Array.isArray(parsed[day])) {
              restored[day] = parsed[day];
            }
          });
          setSchedule(restored);
        }
      }
    } catch (err) {
      console.warn('Failed to hydrate schedule from storage', err);
    }

    try {
      const storedWaitlist = window.localStorage.getItem(WAITLIST_STORAGE_KEY);
      if (storedWaitlist) {
        const parsed = JSON.parse(storedWaitlist);
        if (Array.isArray(parsed)) {
          setWaitlistEvents(parsed);
          hasStoredWaitlistRef.current = parsed.length > 0;
        }
      }
    } catch (err) {
      console.warn('Failed to hydrate waitlist from storage', err);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    async function fetchEvents() {
      setLoadingEvents(true);
      setLoadError(null);
      try {
        const response = await fetch('http://localhost:8080/api/events');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const normalized = Array.isArray(data)
          ? data.map((event) => {
              const normalizeTime = (value) => {
                if (typeof value === 'number') return minutesToHHMM(value);
                if (typeof value === 'string') return value;
                return null;
              };
              return {
                ...event,
                startTime: normalizeTime(event.startTime),
                endTime: normalizeTime(event.endTime),
              };
            })
          : [];

        if (!hasStoredWaitlistRef.current) {
          setWaitlistEvents(normalized);
          hasStoredWaitlistRef.current = normalized.length > 0;
        } else if (normalized.length > 0) {
          const createSignature = (event) =>
            JSON.stringify([
              event.title ?? '',
              event.startTime ?? '',
              event.endTime ?? '',
              Array.isArray(event.date) ? event.date.join('-') : '',
            ]);
          setWaitlistEvents((prev) => {
            const existing = new Set(prev.map(createSignature));
            const additions = normalized.filter((event) => !existing.has(createSignature(event)));
            if (additions.length === 0) return prev;
            return [...prev, ...additions];
          });
        }
      } catch (err) {
        console.error('Failed to load events', err);
        setLoadError('Unable to load events. Please try again later.');
      } finally {
        setLoadingEvents(false);
      }
    }

    fetchEvents();
  }, [hydrated]);

  const toAbsoluteMinutes = (timeStr) => {
    if (!timeStr) return NaN;
    const mins = minutesFromStart(timeStr, 0);
    return Number.isNaN(mins) ? NaN : mins;
  };

  function getDayLabelFromDate(dateArray) {
    if (!Array.isArray(dateArray) || dateArray.length !== 3) return null;
    let month;
    let day;
    let year;
    const [first, second, third] = dateArray;
    if (first > 1900) {
      year = first;
      month = second;
      day = third;
    } else {
      month = first;
      day = second;
      year = third;
    }
    const jsDate = new Date(year, month - 1, day);
    const dayIndex = jsDate.getDay();
    const weekdayMap = {
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
    };
    return weekdayMap[dayIndex] ?? null;
  }

  async function verifyConflictWithTravel(eventA, eventB) {
    try {
      const response = await fetch('http://localhost:8080/api/events/conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first: eventA, second: eventB }),
      });
      if (!response.ok) {
        console.warn('Conflict verification request failed', response.status);
        return true;
      }
      const data = await response.json();
      return Boolean(data?.conflict);
    } catch (err) {
      console.error('Failed to verify conflict with travel time', err);
      return true;
    }
  }

  const handleFillSchedule = async () => {
    const provisionalSchedule = DAYS.reduce((acc, day) => {
      const existing = Array.isArray(schedule[day]) ? schedule[day] : [];
      acc[day] = [...existing];
      return acc;
    }, {});
    const scheduledCandidates = new Set();

    waitlistEvents.forEach((event) => {
      const timeSensitive = Boolean(event?.startTime && event?.endTime);
      if (!timeSensitive) return;
      const dayLabel = getDayLabelFromDate(event.date);
      if (!dayLabel) return;
      provisionalSchedule[dayLabel].push(event);
      scheduledCandidates.add(event);
    });

    let confirmedConflict = null;

    for (const day of DAYS) {
      const eventsForDay = provisionalSchedule[day];
      eventsForDay.sort((a, b) => toAbsoluteMinutes(a.startTime) - toAbsoluteMinutes(b.startTime));

      for (let i = 1; i < eventsForDay.length; i += 1) {
        const prev = eventsForDay[i - 1];
        const current = eventsForDay[i];
        const conflict = await verifyConflictWithTravel(prev, current);
        if (conflict) {
          confirmedConflict = { day, options: [prev, current] };
          break;
        }
      }

      if (confirmedConflict) {
        break;
      }
    }

    if (confirmedConflict) {
      const { day, options } = confirmedConflict;
      const cleanedSchedule = DAYS.reduce((acc, weekday) => {
        const eventsForDay = provisionalSchedule[weekday];
        acc[weekday] =
          weekday === day
            ? eventsForDay.filter(
                (event) => !(options.includes(event) && scheduledCandidates.has(event))
              )
            : [...eventsForDay];
        return acc;
      }, {});

      const scheduledWithoutConflict = new Set();
      DAYS.forEach((weekday) => {
        cleanedSchedule[weekday].forEach((event) => {
          scheduledWithoutConflict.add(event);
        });
      });

      setSchedule(cleanedSchedule);
      setSchedule(cleanedSchedule);
      setConflictState({
        open: true,
        day,
        options,
        scheduleSnapshot: cleanedSchedule,
      });
      setSelectedConflictIndex(0);
      setScheduleError(null);

      setWaitlistEvents((prev) =>
        prev.filter((event) => {
          if (options.includes(event)) return true;
          if (scheduledWithoutConflict.has(event)) return false;
          return true;
        })
      );
      return;
    }

    setSchedule(provisionalSchedule);
    setWaitlistEvents((prev) => prev.filter((event) => !scheduledCandidates.has(event)));
    setScheduleError(null);
    setConflictState(null);
  }

  function handleCancelConflict() {
    setConflictState(null);
  }

  function handleResolveConflict() {
  if (!conflictState) return;
  const { day, options, scheduleSnapshot } = conflictState;
  const selectedOption = options[selectedConflictIndex];
  if (!selectedOption) return;

  const updatedDayEvents = [...scheduleSnapshot[day], selectedOption].sort(
    (a, b) => toAbsoluteMinutes(a.startTime) - toAbsoluteMinutes(b.startTime)
  );

  const updatedSchedule = {
    ...scheduleSnapshot,
    [day]: updatedDayEvents,
  };

  setSchedule(updatedSchedule);
  
  // Remove BOTH conflicting events from waitlist (selected goes to schedule, rejected is discarded)
  setWaitlistEvents((prev) => prev.filter((event) => !options.includes(event)));
  
  setConflictState(null);
  setScheduleError(null);
}

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
    } catch (err) {
      console.warn('Failed to persist schedule', err);
    }
  }, [schedule, hydrated]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(WAITLIST_STORAGE_KEY, JSON.stringify(waitlistEvents));
      hasStoredWaitlistRef.current = waitlistEvents.length > 0;
    } catch (err) {
      console.warn('Failed to persist waitlist', err);
    }
  }, [waitlistEvents, hydrated]);

  return (
    <>
      <div className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="flex flex-col gap-6 lg:flex-row">
          <div
            className={`relative flex flex-shrink-0 items-start transition-all duration-300 ${
              isCollapsed ? 'w-16 self-start' : 'w-full lg:w-80'
            }`}
          >
            <div className="relative flex-1 overflow-hidden">
              <aside
                id="event-waitlist-panel"
                className={`flex w-full flex-col rounded-2xl bg-gray-200 p-6 transition-all duration-300 max-h-[70vh] overflow-hidden lg:h-[680px] lg:max-h-none ${
                  isCollapsed ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'
                }`}
                aria-hidden={isCollapsed}
              >
                <h2 className="text-lg font-semibold text-gray-800">Events Waitlist:</h2>

                <div className="mt-6 flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
                  {loadingEvents && <span className="text-sm text-gray-600">Loading…</span>}
                  {loadError && <span className="text-sm text-red-600">{loadError}</span>}

                  {!loadingEvents && !loadError && waitlistEvents.length === 0 && (
                    <span className="text-sm text-gray-500">No events yet. Add one to get started!</span>
                  )}

                  {waitlistEvents.map((event, index) => (
                    <article
                      key={index}
                      className="rounded-xl bg-white p-4 shadow-sm"
                      aria-label={`Waitlist event ${event.title ?? index + 1}`}
                    >
                      <h3 className="text-base font-semibold text-gray-900">{event.title || 'Untitled Event'}</h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {formatEventDate(event.date)} · {formatTimeRange(event.startTime, event.endTime)}
                      </p>
                    </article>
                  ))}
                </div>

                <button
                  type="button"
                  className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-100"
                  onClick={handleFillSchedule}
                >
                  Fill Schedule
                </button>
                {scheduleError && <p className="mt-3 text-sm text-red-600">{scheduleError}</p>}
              </aside>
            </div>

            <button
              type="button"
              aria-controls="event-waitlist-panel"
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? 'Expand event waitlist' : 'Collapse event waitlist'}
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="ml-3 mt-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-300 text-lg font-semibold text-gray-800 shadow transition hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              {isCollapsed ? '>' : '<'}
            </button>
          </div>

          <main className="flex flex-1 flex-col gap-6">
            <header className="text-center">
              <h1 className="text-4xl font-bold text-gray-900">Schedule</h1>
            </header>

            <div className="flex flex-1 flex-col rounded-3xl bg-gray-200 p-6">
              <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {DAYS.map((day) => (
                  <section
                    key={day}
                    className="flex flex-col rounded-2xl bg-white p-4 shadow-sm"
                    aria-labelledby={`${day.toLowerCase()}-label`}
                  >
                    <h2
                      id={`${day.toLowerCase()}-label`}
                      className="text-sm font-semibold uppercase tracking-wide text-gray-700"
                    >
                      {day}
                    </h2>

                    <DaySchedule
                      events={schedule[day].map((event, index) => ({
                        id: `${day}-${index}`,
                        title: event.title || 'Untitled Event',
                        start: event.startTime,
                        end: event.endTime,
                      }))}
                      startHour={START_HOUR}
                      endHour={END_HOUR}
                      hourHeight={HOUR_HEIGHT}
                    />
                  </section>
                ))}
              </div>
            </div>
          </main>
        </section>

        <div className="flex justify-center">
          <Link to="/events/new">
            <button
              type="button"
              className="w-full max-w-md rounded-full bg-gray-300 px-6 py-4 text-base font-semibold text-gray-900 transition hover:bg-gray-400"
            >
              Add Your New Events!
            </button>
          </Link>
        </div>
      </div>
    </div>
    {conflictState?.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-gray-900">Oops!</h2>
          <p className="mt-2 text-sm text-gray-700">
            Following events have a time conflict. Choose which one you prefer to attend.
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-800">
            Day: {conflictState.day}
          </p>

          <div className="mt-5 space-y-4">
            {conflictState.options.map((event, index) => (
              <label
                key={`${event.title ?? 'event'}-${event.startTime ?? index}-${event.endTime ?? index}`}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                  selectedConflictIndex === index ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="conflict-choice"
                  className="mt-1 h-4 w-4"
                  checked={selectedConflictIndex === index}
                  onChange={() => setSelectedConflictIndex(index)}
                />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {event.title || 'Untitled Event'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {formatEventDate(event.date)} · {formatTimeRange(event.startTime, event.endTime)}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
              onClick={handleCancelConflict}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              onClick={handleResolveConflict}
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default SchedulePage;
