import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function formatSavedDate(dateArray) {
  if (!Array.isArray(dateArray) || dateArray.length !== 3) return 'Date TBD';
  const [month, day, year] = dateArray;
  const paddedMonth = String(month).padStart(2, '0');
  const paddedDay = String(day).padStart(2, '0');
  return `${year}-${paddedMonth}-${paddedDay}`;
}

function formatSavedTime(isTimeSensitive, startTime, endTime) {
  if (!isTimeSensitive) return 'Unlimited Time';
  const formattedStart = minutesToTimeLabel(startTime);
  const formattedEnd = minutesToTimeLabel(endTime);
  if (formattedStart && formattedEnd) return `${formattedStart} ~ ${formattedEnd}`;
  if (formattedStart) return `${formattedStart} starts`;
  if (formattedEnd) return `${formattedEnd} ends`;
  return 'Time TBD';
}

function minutesToTimeLabel(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function EventFormPage() {
  const navigate = useNavigate();

  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventAddress, setEventAddress] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [isTimeSensitive, setIsTimeSensitive] = useState(true);

  const [savedEvents, setSavedEvents] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('info');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timeToMinutes = (timeValue) => {
    if (!timeValue) return null;
    const [hoursPart, minutesPart] = timeValue.split(':').map(Number);
    if (
      !Number.isFinite(hoursPart) ||
      !Number.isFinite(minutesPart) ||
      hoursPart < 0 ||
      minutesPart < 0
    ) {
      return null;
    }
    return hoursPart * 60 + minutesPart;
  };

  const resetForm = () => {
    setEventTitle('');
    setEventDate('');
    setEventStartTime('');
    setEventEndTime('');
    setEventAddress('');
    setEventDescription('');
    setIsTimeSensitive(true);
  };

  const hasFormData = () => {
    if (eventTitle || eventDate || eventAddress || eventDescription) return true;
    if (isTimeSensitive && (eventStartTime || eventEndTime)) return true;
    return false;
  };

  const buildPayload = () => {
    const dateParts = eventDate ? eventDate.split('-') : [];
    const formattedDate =
      dateParts.length === 3
        ? [Number(dateParts[1]), Number(dateParts[2]), Number(dateParts[0])]
        : null;

    const startMinutes = isTimeSensitive ? timeToMinutes(eventStartTime) : null;
    const endMinutes = isTimeSensitive ? timeToMinutes(eventEndTime) : null;

    return {
      title: eventTitle,
      date: formattedDate,
      startTime: startMinutes,
      endTime: endMinutes,
      address: eventAddress,
      description: eventDescription,
      timeSensitive: isTimeSensitive,
    };
  };

  const submitCurrentEvent = async () => {
    const payload = buildPayload();
    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:8080/api/events/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to submit event');
      }

      let responseData = payload;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          responseData = await response.json();
        } catch {
          responseData = payload;
        }
      }

      return { ...payload, ...responseData };
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTimeSensitive = () => {
    setIsTimeSensitive((prev) => {
      const next = !prev;
      if (!next) {
        setEventStartTime('');
        setEventEndTime('');
      }
      return next;
    });
  };

  const handleAddAnother = async () => {
    if (isSubmitting) return;
    if (!hasFormData()) {
      setStatusType('error');
      setStatusMessage('Please fill in the event information before adding another.');
      return;
    }

    setStatusMessage('');

    try {
      const saved = await submitCurrentEvent();
      setSavedEvents((prev) => [...prev, saved]);
      resetForm();
      setStatusType('success');
      setStatusMessage('Event saved. A new form is ready below.');
    } catch (error) {
      console.error('Add event error:', error);
      setStatusType('error');
      setStatusMessage('Save failed. Please try again later.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const formHasData = hasFormData();

    if (!formHasData) {
      navigate('/');
      return;
    }

    try {
      await submitCurrentEvent();
      navigate('/');
    } catch (error) {
      console.error('Submit error:', error);
      setStatusType('error');
      setStatusMessage('Save failed. Please try again later.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-12">
      <div className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center">
        <div className="w-full rounded-3xl bg-white px-6 py-10 shadow-sm sm:px-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
              Tell Us Your Event Info
            </h1>
            <Link
              to="/events/url-workshop"
              className="w-full max-w-xs rounded-full bg-gray-200 px-6 py-3 text-base font-medium text-gray-900 transition-colors duration-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              Use URL
            </Link>
          </div>

          {statusMessage && (
            <div
              className={`mt-6 rounded-xl px-4 py-3 text-sm ${
                statusType === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}
              role="status"
              aria-live="polite"
            >
              {statusMessage}
            </div>
          )}

          {savedEvents.length > 0 && (
            <div className="mt-6 flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-gray-800">Saved Events</h2>
              {savedEvents.map((event, index) => (
                <details
                  key={`saved-event-${index}`}
                  className="overflow-hidden rounded-2xl bg-gray-100 px-4 py-3 text-left shadow-sm"
                >
                  <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900">
                    Event {index + 1}: {event.title || 'Untitled Event'}
                  </summary>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p>Date: {formatSavedDate(event.date)}</p>
                    <p>Time: {formatSavedTime(event.timeSensitive, event.startTime, event.endTime)}</p>
                    <p>Location: {event.address || 'Location TBD'}</p>
                    {event.description && <p>Notes: {event.description}</p>}
                  </div>
                </details>
              ))}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-8 rounded-3xl bg-gray-100 px-5 py-6 sm:px-8"
          >
            <div className="flex flex-col gap-5">
              <label className="flex flex-col gap-2 text-left">
                <span className="text-sm font-semibold text-gray-800">Event Title</span>
                <input
                  type="text"
                  name="eventTitle"
                  placeholder="Enter event title"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </label>

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <span className="text-sm font-semibold text-gray-800">Not Time Sensitive</span>
                  <button
                    type="button"
                    onClick={toggleTimeSensitive}
                    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-200 ${
                      isTimeSensitive ? 'bg-gray-300' : 'bg-gray-900'
                    }`}
                    aria-pressed={!isTimeSensitive}
                    aria-label="Toggle time sensitivity"
                    disabled={isSubmitting}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${
                        isTimeSensitive ? 'translate-x-1' : 'translate-x-6'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-3 md:items-end">
                  <label
                    className={`flex w-full flex-col gap-2 text-left ${
                      isTimeSensitive ? 'md:col-span-1' : 'md:col-span-3'
                    }`}
                  >
                    <span className="text-sm font-semibold text-gray-800">Date</span>
                    <input
                      type="date"
                      name="eventDate"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    />
                  </label>

                  {isTimeSensitive && (
                    <>
                      <label className="flex flex-col gap-2 md:col-span-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-700">
                          Start Time
                        </span>
                        <input
                          type="time"
                          name="eventStartTime"
                          value={eventStartTime}
                          onChange={(e) => setEventStartTime(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300 md:w-32"
                        />
                      </label>

                      <label className="flex flex-col gap-2 md:col-span-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-700">
                          End Time
                        </span>
                        <input
                          type="time"
                          name="eventEndTime"
                          value={eventEndTime}
                          onChange={(e) => setEventEndTime(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300 md:w-32"
                        />
                      </label>
                    </>
                  )}
                </div>
              </div>

              <label className="flex flex-col gap-2 text-left">
                <span className="text-sm font-semibold text-gray-800">Address</span>
                <input
                  type="text"
                  name="eventAddress"
                  placeholder="Enter event address"
                  value={eventAddress}
                  onChange={(e) => setEventAddress(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </label>

              <label className="flex flex-col gap-2 text-left">
                <span className="text-sm font-semibold text-gray-800">
                  Description (optional)
                </span>
                <textarea
                  name="eventDescription"
                  rows="4"
                  placeholder="Share a brief description"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleAddAnother}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-2xl font-semibold text-gray-900 transition-colors duration-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Save current event and add another"
                disabled={isSubmitting}
              >
                +
              </button>
            </div>
            <div className="mt-6 flex justify-start">
              <button
                type="submit"
                className="rounded-full bg-white px-6 py-3 text-base font-semibold text-gray-900 shadow-sm transition-colors duration-200 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Save all events and return to schedule"
                disabled={isSubmitting}
              >
                Save All & Back to Schedule
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EventFormPage;
