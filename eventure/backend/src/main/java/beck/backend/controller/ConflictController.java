package beck.backend.controller;

import beck.backend.model.Event;
import beck.backend.service.TravelTimeService;
import beck.backend.service.SmartSchedulerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/events")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class ConflictController {

    private final TravelTimeService travelTimeService;
    private final SmartSchedulerService smartSchedulerService;
    @PostMapping("/conflict")
    public ResponseEntity<Map<String, Object>> checkConflict(@RequestBody Map<String, Event> payload) {
        Event first = payload.get("first");
        Event second = payload.get("second");

        if (first == null || second == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "conflict", false,
                "reason", "Missing event data"
            ));
        }

        log.info("Checking conflict between '{}' and '{}'", first.getTitle(), second.getTitle());

        if (!first.timeRangeOverlap(second)) {
            return ResponseEntity.ok(Map.of("conflict", false));
        }

        if (first.getAddress() == null || second.getAddress() == null) {
            log.warn("Missing address for one or both events, assuming conflict");
            return ResponseEntity.ok(Map.of(
                "conflict", true,
                "reason", "Time overlap detected"
            ));
        }

        try {
            int travelMinutes = travelTimeService.getTravelTimeMinutes(
                first.getAddress(), 
                second.getAddress()
            );
            
            int gapMinutes = second.getStartTime() - first.getEndTime();
            boolean hasConflict = gapMinutes < travelMinutes;

            if (hasConflict) {
                log.info("Conflict detected: need {} min travel, only {} min gap", travelMinutes, gapMinutes);
                return ResponseEntity.ok(Map.of(
                    "conflict", true,
                    "reason", String.format("Need %d min travel time, only %d min available", travelMinutes, gapMinutes)
                ));
            } else {
                log.info("No conflict: {} min gap is enough for {} min travel", gapMinutes, travelMinutes);
                return ResponseEntity.ok(Map.of("conflict", false));
            }
        } catch (Exception e) {
            log.error("Error calculating travel time: {}", e.getMessage(), e);
            return ResponseEntity.ok(Map.of(
                "conflict", true,
                "reason", "Could not calculate travel time, assuming conflict"
            ));
        }
    }
    @PostMapping("/optimize")
    public ResponseEntity<Map<String, List<Event>>> optimizeSchedule(@RequestBody List<Event> events) {
        log.info("Optimizing schedule for {} events", events.size());
        Map<String, List<Event>> optimized = smartSchedulerService.buildOptimalSchedule(events);
        return ResponseEntity.ok(optimized);
    }
}