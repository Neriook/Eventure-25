package beck.backend.service;

import beck.backend.model.ChatRequest;
import beck.backend.model.ChatResponse;
import beck.backend.model.Event;
import beck.backend.repository.EventRepository;
import io.github.bonigarcia.wdm.WebDriverManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final BedrockService bedrockService;

    @PostConstruct
    public void init() {
        eventRepository.createTableIfNotExists();
    }

    public Event addEvent(Event event) {
        Event saved = eventRepository.save(event);
        log.info("Manually added event: {} (ID: {})", saved.getTitle(), saved.getId());
        return saved;
    }
    public Optional<Event> getEventById(String id) {
        return eventRepository.findById(id);  // ✅ FIXED - using instance not static
    }

    public Event updateEvent(String id, Event updatedEvent) {
        Optional<Event> existing = eventRepository.findById(id);
        if (existing.isPresent()) {
            updatedEvent.setId(id);
            updatedEvent.setCreatedAt(existing.get().getCreatedAt());
            return eventRepository.update(updatedEvent);
        }
        throw new RuntimeException("Event not found with ID: " + id);
    }

    public boolean deleteEvent(String id) {
        return eventRepository.deleteById(id);
    }

    private Event createErrorEvent(String errorMessage) {
        Event event = new Event();
        event.setTitle("Error");
        event.setNote(errorMessage);
        event.setTimeSensitive(false);
        return event;
    }
    public List<Event> scrapeFromUrl(String url) {
        log.info("Starting to scrape URL: {}", url);
        
        WebDriverManager.chromedriver().setup();
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless=new");
        options.addArguments("--disable-gpu");
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-dev-shm-usage");
        options.addArguments("--window-size=1920,1080");

        WebDriver driver = new ChromeDriver(options);

        try {
            driver.get(url);

            new WebDriverWait(driver, Duration.ofSeconds(15))
                    .until(ExpectedConditions.presenceOfElementLocated(By.tagName("body")));
            
            log.info("Waiting for JavaScript to load dynamic content...");
            Thread.sleep(8000);
            
            try {
                new WebDriverWait(driver, Duration.ofSeconds(5))
                    .until(d -> d.findElement(By.tagName("body")).getText().length() > 100);
            } catch (Exception e) {
                log.warn("Content didn't load much, continuing anyway...");
            }

            String bodyText = driver.findElement(By.tagName("body")).getText();
            log.info("Extracted body text length: {} characters", bodyText.length());
            driver.quit();

            List<Event> extractedEvents = extractEventsWithBedrock(bodyText, url);
            List<Event> savedEvents = eventRepository.saveAll(extractedEvents);
            log.info("Successfully extracted and saved {} events from URL", savedEvents.size());
            return savedEvents;

        } catch (Exception e) {
            log.error("Error scraping URL: {}", e.getMessage(), e);
            Event errorEvent = createErrorEvent("Failed: " + e.getMessage());
            eventRepository.save(errorEvent);
            return List.of(errorEvent);
        } finally {
            try {
                driver.quit();
            } catch (Exception ignored) {}
        }
    }

    private List<Event> extractEventsWithBedrock(String bodyText, String sourceUrl) {
        try {
            String prompt = buildExtractionPrompt(bodyText);
            
            ChatRequest request = new ChatRequest();
            request.setMessage(prompt);
            request.setMaxTokens(4000);
            request.setTemperature(0.3);

            ChatResponse response = bedrockService.chat(request);
            
            if (!response.isSuccess()) {
                log.error("Bedrock returned error: {}", response.getError());
                return List.of(createErrorEvent("AI extraction failed: " + response.getError()));
            }

            return parseEventsFromJson(response.getResponse(), sourceUrl);

        } catch (Exception e) {
            log.error("Error extracting events with Bedrock: {}", e.getMessage(), e);
            return List.of(createErrorEvent("Extraction failed: " + e.getMessage()));
        }
    }

    private String buildExtractionPrompt(String bodyText) {
        String truncatedText = bodyText;
        if (bodyText.length() > 20000) {
            truncatedText = bodyText.substring(0, 20000) + "\n[... text truncated ...]";
            log.warn("Body text truncated from {} to 20000 characters", bodyText.length());
        }

        return "You are an AI assistant. Extract all events from this txt page. " +
               "Each event should have: title, date, startTime, endTime, address, note. " +
               "If the information is not directly written, leave the slot as empty. " +
               "For example, if it is written as online, TBD, soon, absolutely do not put it. " +
               "For time, put it as military time, but only in minutes, meaning if it is 01:00, it would be 60. " +
               "If it is 13:30, it would be 810 (13*60 + 30). " +
               "For location, if it is too specific, try adding city and country name if relevant information exists. " +
               "In the note, summarize the event in two or 3 sentences. " +
               "For date, use numbers only and if its september, put it as 9, not 09. " +
               "Output ONLY the JSON array, no other text. Output as JSON array like:\n" +
               "[\n" +
               "  {\n" +
               "    \"title\": \"...\",\n" +
               "    \"date\": [month, day, year],\n" +
               "    \"startTime\": 60,\n" +
               "    \"endTime\": 120,\n" +
               "    \"address\": \"...\",\n" +
               "    \"note\": \"...\"\n" +
               "  }\n" +
               "]\n\n" +
               "txt:\n" + truncatedText;
    }

    private List<Event> parseEventsFromJson(String jsonResponse, String sourceUrl) {
        List<Event> extractedEvents = new ArrayList<>();
        
        try {
            String cleanJson = jsonResponse.trim();
            if (cleanJson.startsWith("```json")) {
                cleanJson = cleanJson.substring(7);
            }
            if (cleanJson.startsWith("```")) {
                cleanJson = cleanJson.substring(3);
            }
            if (cleanJson.endsWith("```")) {
                cleanJson = cleanJson.substring(0, cleanJson.length() - 3);
            }
            cleanJson = cleanJson.trim();

            log.debug("Parsing JSON response: {}", cleanJson);

            JSONArray jsonArray = new JSONArray(cleanJson);
            
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject jsonEvent = jsonArray.getJSONObject(i);
                Event event = new Event();
                
                if (jsonEvent.has("title") && !jsonEvent.isNull("title")) {
                    event.setTitle(jsonEvent.getString("title") + "*");
                }
                
                if (jsonEvent.has("date") && !jsonEvent.isNull("date")) {
                    JSONArray dateArray = jsonEvent.getJSONArray("date");
                    List<Integer> dateList = new ArrayList<>();
                    for (int j = 0; j < dateArray.length(); j++) {
                        dateList.add(dateArray.getInt(j));
                    }
                    event.setDate(dateList);
                }
                
                if (jsonEvent.has("startTime") && !jsonEvent.isNull("startTime")) {
                    event.setStartTime(jsonEvent.optInt("startTime", 0));
                }
                
                if (jsonEvent.has("endTime") && !jsonEvent.isNull("endTime")) {
                    event.setEndTime(jsonEvent.optInt("endTime", 0));
                }
                
                if (jsonEvent.has("address") && !jsonEvent.isNull("address")) {
                    event.setAddress(jsonEvent.getString("address"));
                }
                
                if (jsonEvent.has("note") && !jsonEvent.isNull("note")) {
                    event.setNote(jsonEvent.getString("note"));
                }
                
                event.setUrl(sourceUrl);
                event.setTimeSensitive(event.getStartTime() != null && event.getStartTime() > 0);
                
                extractedEvents.add(event);
                log.info("Extracted event: {}", event.getTitle());
            }
            
        } catch (Exception e) {
            log.error("Error parsing JSON response: {}", e.getMessage(), e);
            log.error("JSON content was: {}", jsonResponse);
            extractedEvents.add(createErrorEvent("Failed to parse AI response: " + e.getMessage()));
        }
        
        return extractedEvents;
    }

    public List<Event> getAllEvents() {
        return eventRepository.findAll();
    }

    public void clearEvents() {
        eventRepository.deleteAll();
        log.info("Cleared all events from DynamoDB");
    }

    public long getEventCount() {
        return eventRepository.count();
    }
}