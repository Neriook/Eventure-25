import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

const MOCK_EVENTS = [
  {
    id: 'mock-1',
    title: 'Community Hack Night',
    start: '2025-03-20 18:00',
    end: '2025-03-20 21:00',
    location: 'Innovation Hub, Seattle',
  },
  {
    id: 'mock-2',
    title: 'Design Sprint Workshop',
    start: '2025-03-22 10:00',
    end: '2025-03-22 16:00',
    location: 'Downtown Co-working Loft',
  },
  {
    id: 'mock-3',
    title: 'AI for Good Meetup',
    start: '2025-03-24 17:30',
    end: '2025-03-24 19:00',
    location: 'Tech Collective, Bellevue',
  },
  {
    id: 'mock-4',
    title: 'Nonprofit Fundraising Webinar',
    start: '2025-03-26 12:00',
    end: '2025-03-26 13:30',
    location: 'Virtual',
  },
];

function getMockEvents() {
  return MOCK_EVENTS.map((event) => ({ ...event }));
}

async function extractFromUrl(url) {
  const response = await fetch(`${API_BASE_URL}/api/events/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`Extraction failed with status ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Invalid response format');
  }
  return data.map((event, index) => mapScrapedEvent(event, index));
}

function mapScrapedEvent(event, index) {
  const id = event.url || `scraped-${index}`;
  const dateLabel = formatDateParts(event.date);
  const startLabel = minutesToTimeString(event.startTime);
  const endLabel = minutesToTimeString(event.endTime);

  return {
    id,
    title: event.title || 'Untitled Event',
    start: combineDateTime(dateLabel, startLabel),
    end: combineDateTime(dateLabel, endLabel),
    location: event.address || 'Location TBD',
    note: event.description || event.note || '',
    raw: event,
  };
}

function combineDateTime(date, time) {
  if (date && time) return `${date} ${time}`;
  return date || time || 'Time TBD';
}

function minutesToTimeString(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function formatDateParts(parts) {
  if (!Array.isArray(parts) || parts.length !== 3) return '';
  const [month, day, year] = parts;
  if (![month, day, year].every((value) => Number.isFinite(value))) return '';
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function formatTimeRange(start, end) {
  if (!start && !end) return 'Time TBD';
  if (!start) return `Ends ${end}`;
  if (!end) return `Starts ${start}`;
  return `${start} - ${end}`;
}

function URLWorkshopPage() {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const toggleSelect = (id) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleFinish = () => {
    const chosen = events.filter((event) => selectedIds.has(event.id));
    console.log('Selected events:', chosen);
    // TODO: Navigate back to schedule page or submit selected events to the backend.
    setUrl('');
    setEvents([]);
    setSelectedIds(new Set());
    setError('');
    setInfo('Selection complete! Paste a new URL to extract more events.');
  };

  const loadEvents = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Please enter a URL before extracting.');
      setEvents([]);
      setSelectedIds(new Set());
      setInfo('');
      return;
    }

    setLoading(true);
    setError('');
    setInfo('');
    try {
      const extracted = await extractFromUrl(trimmedUrl);
      setEvents(extracted);
      setSelectedIds(new Set());
      if (extracted.length === 0) {
        setError('No events found for this URL.');
      }
    } catch (err) {
      console.error(err);
      const fallbackEvents = getMockEvents();
      setEvents(fallbackEvents);
      setSelectedIds(new Set());
      setError('Could not reach extraction service. Showing sample events instead.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    loadEvents();
  };

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6">
        <div className="flex w-full justify-start">
          <Link
            to="/"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition-colors duration-200 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Back to My Schedule
          </Link>
        </div>

        <h1 className="rounded-full bg-gray-200 px-6 py-2 text-center text-3xl font-semibold text-gray-900">
          URL Workshop
        </h1>

        <form
          onSubmit={onSubmit}
          className="flex w-full flex-col items-stretch gap-4 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-end"
        >
          <div className="flex-1">
            <label htmlFor="event-url" className="block text-sm font-semibold text-gray-800">
              Event URL:
            </label>
            <input
              id="event-url"
              name="event-url"
              type="url"
              placeholder="https://example.com/events"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <button
            type="submit"
            aria-label="Extract events from URL"
            disabled={loading}
            className="rounded-full bg-gray-200 px-6 py-3 text-base font-semibold text-gray-900 transition-colors duration-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Extracting…' : 'Extract / Parse'}
          </button>
        </form>

        {error && (
          <p className="w-full max-w-5xl text-sm font-medium text-red-600">{error}</p>
        )}
        {info && !error && (
          <p className="w-full max-w-5xl text-sm font-medium text-gray-700">{info}</p>
        )}

        <section className="w-full max-w-5xl rounded-2xl bg-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Events Found:</h2>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {loading && (
              <div className="col-span-full flex justify-center">
                <span className="text-sm font-medium text-gray-700">Loading events…</span>
              </div>
            )}

            {!loading && events.length === 0 && (
              <div className="col-span-full flex justify-center">
                <p className="text-sm text-gray-600">
                  Paste an event URL and extract to see matching events.
                </p>
              </div>
            )}

            {events.map((event) => {
              const isSelected = selectedIds.has(event.id);
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => toggleSelect(event.id)}
                  aria-pressed={isSelected}
                  className={`relative flex h-full w-full flex-col rounded-xl bg-white p-4 text-left shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-400 ${
                    isSelected ? 'ring-2 ring-gray-800' : ''
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute left-4 top-4 flex h-5 w-5 items-center justify-center rounded-sm border border-gray-400 ${
                      isSelected ? 'bg-gray-800 text-white' : 'bg-gray-200 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  <div className="pl-8">
                    <h3 className="text-base font-semibold text-gray-900">{event.title}</h3>
                    <p className="mt-2 text-sm text-gray-700">
                      {formatTimeRange(event.start, event.end)}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">{event.location}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleFinish}
              aria-label="Finish selecting events"
              aria-disabled={selectedIds.size === 0}
              disabled={selectedIds.size === 0}
              className="rounded-md bg-white px-5 py-2 text-sm font-medium text-gray-900 transition-colors duration-200 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Finish
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

const ScheduleWorkshopPage = URLWorkshopPage;
export default ScheduleWorkshopPage;
