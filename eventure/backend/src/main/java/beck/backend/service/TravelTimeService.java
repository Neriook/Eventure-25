package beck.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentHashMap;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

@Slf4j
@Service
public class TravelTimeService {

    @Value("${GOOGLE_MAPS_API_KEY:}")
    private String apiKey;

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ConcurrentHashMap<String, Integer> cache = new ConcurrentHashMap<>();

    public int getTravelTimeMinutes(String address1, String address2) throws Exception {
        if (address1 == null || address2 == null || address1.isEmpty() || address2.isEmpty()) {
            throw new IllegalArgumentException("Addresses cannot be null or empty");
        }

        String cacheKey = address1 + "|" + address2;
        if (cache.containsKey(cacheKey)) {
            log.debug("Cache hit for travel time: {} -> {}", address1, address2);
            return cache.get(cacheKey);
        }

        if (apiKey == null || apiKey.isEmpty()) {
            log.warn("Google Maps API key not configured, using default estimate");
            return 15; 
        }

        try {
            String url = String.format(
                "https://maps.googleapis.com/maps/api/distancematrix/json?origins=%s&destinations=%s&mode=walking&key=%s",
                URLEncoder.encode(address1, StandardCharsets.UTF_8),
                URLEncoder.encode(address2, StandardCharsets.UTF_8),
                apiKey
            );

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() != 200) {
                throw new Exception("Google Maps API returned status: " + response.statusCode());
            }

            JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
            
            String status = json.get("status").getAsString();
            if (!"OK".equals(status)) {
                throw new Exception("Google Maps API status: " + status);
            }

            JsonObject element = json
                .getAsJsonArray("rows")
                .get(0).getAsJsonObject()
                .getAsJsonArray("elements")
                .get(0).getAsJsonObject();

            String elementStatus = element.get("status").getAsString();
            if (!"OK".equals(elementStatus)) {
                throw new Exception("Route not found: " + elementStatus);
            }

            int durationSeconds = element
                .getAsJsonObject("duration")
                .get("value")
                .getAsInt();

            int minutes = (int) Math.ceil(durationSeconds / 60.0);
            cache.put(cacheKey, minutes);
            
            log.info("Travel time from '{}' to '{}': {} minutes", address1, address2, minutes);
            return minutes;

        } catch (Exception e) {
            log.error("Failed to get travel time: {}", e.getMessage(), e);
            throw e;
        }
    }
    public void clearCache() {
        cache.clear();
        log.info("Travel time cache cleared");
    }
}