package beck.backend.controller;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import beck.backend.model.Event;
import beck.backend.model.ChatRequest;
import beck.backend.model.ChatResponse;
import beck.backend.service.EventService;
import beck.backend.service.BedrockService;
import lombok.extern.slf4j.Slf4j;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class EventController {

    @Autowired
    private EventService eventService;
    
    @Autowired
    private BedrockService bedrockService;

    @GetMapping("/events")
    public List<Event> getAllEvents() {
        return eventService.getAllEvents();
    }

    @GetMapping("/events/scrape")
    public List<Event> scrapeFromUrl(@RequestParam String url) {
        log.info("Received scrape request for URL: {}", url);
        return eventService.scrapeFromUrl(url);
    }

    @PostMapping(
        value = "/events/scrape",
        consumes = MediaType.APPLICATION_JSON_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<List<Event>> scrapeFromUrl(@RequestBody Map<String, String> payload) {
        String url = payload.getOrDefault("url", "").trim();
        if (url.isEmpty()) {
            log.warn("Received scrape request without a URL");
            return ResponseEntity.badRequest().body(Collections.emptyList());
        }
        log.info("Received scrape request for URL (POST): {}", url);
        return ResponseEntity.ok(eventService.scrapeFromUrl(url));
    }

    @PostMapping(
        value = "/events/manual",
        consumes = MediaType.APPLICATION_JSON_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<Event> addEvent(@RequestBody Event event) {
        log.info("Manually adding event: {}", event.getTitle());
        Event saved = eventService.addEvent(event);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/events")
    public Map<String, String> clearEvents() {
        eventService.clearEvents();
        return Map.of("message", "All events cleared successfully");
    }

    @GetMapping("/events/health")
    public Map<String, String> eventsHealth() {
        return Map.of(
            "status", "ok",
            "eventsCount", String.valueOf(eventService.getAllEvents().size())
        );
    }

    @PostMapping("/ai/chat")
    public ChatResponse chat(@RequestBody ChatRequest request) {
        log.info("Received chat request: {}", request.getMessage());
        return bedrockService.chat(request);
    }
    @GetMapping("/ai/health")
    public String aiHealth() {
        return "Bedrock AI API is running!";
    }
}
