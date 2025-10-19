package beck.backend.service;

import beck.backend.model.Event;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SmartSchedulerService {

    private final TravelTimeService travelTimeService;

    private static final List<String> WEEKDAYS = List.of("Monday", "Tuesday", "Wednesday", "Thursday", "Friday");

    public Map<String, List<Event>> buildOptimalSchedule(List<Event> allEvents) {
        Map<String, List<Event>> schedule = new HashMap<>();
        WEEKDAYS.forEach(day -> schedule.put(day, new ArrayList<>()));

        List<Event> timeSensitive = allEvents.stream()
            .filter(e -> e.getTimeSensitive() != null && e.getTimeSensitive())
            .filter(e -> e.getStartTime() != null && e.getEndTime() != null)
            .collect(Collectors.toList());

        List<Event> flexible = allEvents.stream()
            .filter(e -> e.getTimeSensitive() == null || !e.getTimeSensitive())
            .collect(Collectors.toList());

        log.info("Scheduling {} time-sensitive events and {} flexible events", 
            timeSensitive.size(), flexible.size());

        for (Event event : timeSensitive) {
            String day = getDayFromDate(event.getDate());
            if (day != null) {
                schedule.get(day).add(event);
            }
        }

        schedule.forEach((day, events) -> 
            events.sort(Comparator.comparingInt(Event::getStartTime))
        );

        for (Event flexEvent : flexible) {
            PlacementOption bestOption = findBestPlacement(schedule, flexEvent);
            if (bestOption != null) {
                schedule.get(bestOption.day).add(bestOption.event);
                schedule.get(bestOption.day).sort(Comparator.comparingInt(Event::getStartTime));
                log.info("Placed flexible event '{}' on {} at {}-{}", 
                    flexEvent.getTitle(), bestOption.day, bestOption.event.getStartTime(), bestOption.event.getEndTime());
            } else {
                log.warn("Could not find placement for flexible event: {}", flexEvent.getTitle());
            }
        }

        return schedule;
    }
    private PlacementOption findBestPlacement(Map<String, List<Event>> schedule, Event flexEvent) {
        List<PlacementOption> options = new ArrayList<>();

        for (String day : WEEKDAYS) {
            List<Event> dayEvents = schedule.get(day);
            
            List<TimeSlot> slots = findAvailableSlots(dayEvents);
            
            for (TimeSlot slot : slots) {
                double distanceScore = calculateDistanceScore(dayEvents, flexEvent, slot);
                
                Event placedEvent = new Event();
                placedEvent.setTitle(flexEvent.getTitle());
                placedEvent.setAddress(flexEvent.getAddress());
                placedEvent.setDescription(flexEvent.getDescription());
                placedEvent.setUrl(flexEvent.getUrl());
                placedEvent.setTimeSensitive(true);
                placedEvent.setStartTime(slot.start);
                placedEvent.setEndTime(slot.end);
                placedEvent.setDate(dateForDay(day));
                
                options.add(new PlacementOption(day, placedEvent, distanceScore));
            }
        }

        if (options.isEmpty()) {
            return null;
        }
        return options.stream()
            .min(Comparator.comparingDouble(o -> o.distanceScore))
            .orElse(null);
    }

    private List<TimeSlot> findAvailableSlots(List<Event> dayEvents) {
        List<TimeSlot> slots = new ArrayList<>();
        
        int dayStart = 8 * 60; 
        int dayEnd = 22 * 60;  
        int minSlotDuration = 60; 
        
        if (dayEvents.isEmpty()) {
            slots.add(new TimeSlot(dayStart, dayEnd));
            return slots;
        }

        if (dayEvents.get(0).getStartTime() - dayStart >= minSlotDuration) {
            slots.add(new TimeSlot(dayStart, dayEvents.get(0).getStartTime()));
        }

        for (int i = 0; i < dayEvents.size() - 1; i++) {
            int gapStart = dayEvents.get(i).getEndTime();
            int gapEnd = dayEvents.get(i + 1).getStartTime();
            if (gapEnd - gapStart >= minSlotDuration) {
                slots.add(new TimeSlot(gapStart, gapEnd));
            }
        }
        Event last = dayEvents.get(dayEvents.size() - 1);
        if (dayEnd - last.getEndTime() >= minSlotDuration) {
            slots.add(new TimeSlot(last.getEndTime(), dayEnd));
        }

        return slots;
    }

    
    private double calculateDistanceScore(List<Event> dayEvents, Event newEvent, TimeSlot slot) {
        if (newEvent.getAddress() == null || newEvent.getAddress().isEmpty()) {
            return 1000; 
        }

        double totalDistance = 0;

        Event before = null;
        Event after = null;

        for (Event event : dayEvents) {
            if (event.getEndTime() <= slot.start && (before == null || event.getEndTime() > before.getEndTime())) {
                before = event;
            }
            if (event.getStartTime() >= slot.end && (after == null || event.getStartTime() < after.getStartTime())) {
                after = event;
            }
        }

        try {
            if (before != null && before.getAddress() != null) {
                int travelTime = travelTimeService.getTravelTimeMinutes(before.getAddress(), newEvent.getAddress());
                totalDistance += travelTime;
            }

            if (after != null && after.getAddress() != null) {
                int travelTime = travelTimeService.getTravelTimeMinutes(newEvent.getAddress(), after.getAddress());
                totalDistance += travelTime;
            }
        } catch (Exception e) {
            log.warn("Could not calculate distance for placement: {}", e.getMessage());
            totalDistance += 15; 
        }

        return totalDistance;
    }
    private String getDayFromDate(List<Integer> dateArray) {
        if (dateArray == null || dateArray.size() != 3) {
            return null;
        }

        try {
            int month = dateArray.get(0);
            int day = dateArray.get(1);
            int year = dateArray.get(2);

            LocalDate date = LocalDate.of(year, month, day);
            DayOfWeek dayOfWeek = date.getDayOfWeek();

            switch (dayOfWeek) {
                case MONDAY: return "Monday";
                case TUESDAY: return "Tuesday";
                case WEDNESDAY: return "Wednesday";
                case THURSDAY: return "Thursday";
                case FRIDAY: return "Friday";
                default: return null; // Weekend
            }
        } catch (Exception e) {
            log.error("Failed to parse date: {}", dateArray, e);
            return null;
        }
    }
    private List<Integer> dateForDay(String day) {
        LocalDate today = LocalDate.now();
        DayOfWeek target = switch (day) {
            case "Monday" -> DayOfWeek.MONDAY;
            case "Tuesday" -> DayOfWeek.TUESDAY;
            case "Wednesday" -> DayOfWeek.WEDNESDAY;
            case "Thursday" -> DayOfWeek.THURSDAY;
            case "Friday" -> DayOfWeek.FRIDAY;
            default -> null;
        };

        if (target == null) return null;

        LocalDate targetDate = today.with(target);
        if (!targetDate.isAfter(today)) {
            targetDate = targetDate.plusWeeks(1);
        }

        return List.of(targetDate.getMonthValue(), targetDate.getDayOfMonth(), targetDate.getYear());
    }

    private static class TimeSlot {
        int start;
        int end;

        TimeSlot(int start, int end) {
            this.start = start;
            this.end = end;
        }
    }

    private static class PlacementOption {
        String day;
        Event event;
        double distanceScore;

        PlacementOption(String day, Event event, double distanceScore) {
            this.day = day;
            this.event = event;
            this.distanceScore = distanceScore;
        }
    }
}