package beck.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class WeatherService {

    @Value("${GOOGLE_MAPS_API_KEY:}")
    private String apiKey;

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final Map<String, WeatherData> cache = new HashMap<>();

    public WeatherData getWeather(String location, LocalDate date) {
        String cacheKey = location + "-" + date.toString();
        
        if (cache.containsKey(cacheKey)) {
            return cache.get(cacheKey);
        }

        if (apiKey == null || apiKey.isEmpty()) {
            log.warn("Google Maps API key not configured, using default weather");
            return new WeatherData("sunny", 72, "Clear");
        }

        try {
            String geocodeUrl = String.format(
                "https://maps.googleapis.com/maps/api/geocode/json?address=%s&key=%s",
                URLEncoder.encode(location, StandardCharsets.UTF_8),
                apiKey
            );

            HttpRequest geocodeReq = HttpRequest.newBuilder()
                .uri(URI.create(geocodeUrl))
                .GET()
                .build();

            HttpResponse<String> geocodeResp = httpClient.send(geocodeReq, HttpResponse.BodyHandlers.ofString());
            JsonObject geocodeJson = JsonParser.parseString(geocodeResp.body()).getAsJsonObject();

            if (!"OK".equals(geocodeJson.get("status").getAsString())) {
                throw new Exception("Geocoding failed");
            }

            JsonObject location_data = geocodeJson
                .getAsJsonArray("results")
                .get(0).getAsJsonObject()
                .getAsJsonObject("geometry")
                .getAsJsonObject("location");

            double lat = location_data.get("lat").getAsDouble();
            double lng = location_data.get("lng").getAsDouble();

            String weatherUrl = String.format(
                "https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&daily=temperature_2m_max,weathercode&timezone=auto",
                lat, lng
            );

            HttpRequest weatherReq = HttpRequest.newBuilder()
                .uri(URI.create(weatherUrl))
                .GET()
                .build();

            HttpResponse<String> weatherResp = httpClient.send(weatherReq, HttpResponse.BodyHandlers.ofString());
            JsonObject weatherJson = JsonParser.parseString(weatherResp.body()).getAsJsonObject();

            JsonObject daily = weatherJson.getAsJsonObject("daily");
            JsonArray temps = daily.getAsJsonArray("temperature_2m_max");
            JsonArray codes = daily.getAsJsonArray("weathercode");
            int temp = temps.get(0).getAsInt();
            int weatherCode = codes.get(0).getAsInt();

            String condition = mapWeatherCode(weatherCode);
            String description = getWeatherDescription(weatherCode);

            WeatherData weatherData = new WeatherData(condition, temp, description);
            cache.put(cacheKey, weatherData);

            log.info("Weather for {} on {}: {} ({}°F)", location, date, description, temp);
            return weatherData;

        } catch (Exception e) {
            log.error("Failed to get weather: {}", e.getMessage(), e);
            return new WeatherData("sunny", 72, "Clear");
        }
    }

    private String mapWeatherCode(int code) {
        if (code == 0 || code == 1) return "sunny";
        if (code == 2 || code == 3) return "cloudy";
        if (code >= 51 && code <= 67) return "rainy";
        if (code >= 71 && code <= 77) return "snowy";
        if (code >= 80 && code <= 99) return "stormy";
        return "cloudy";
    }

    private String getWeatherDescription(int code) {
        return switch (code) {
            case 0 -> "Clear sky";
            case 1 -> "Mainly clear";
            case 2 -> "Partly cloudy";
            case 3 -> "Overcast";
            case 45, 48 -> "Foggy";
            case 51, 53, 55 -> "Drizzle";
            case 61, 63, 65 -> "Rain";
            case 71, 73, 75 -> "Snow";
            case 80, 81, 82 -> "Rain showers";
            case 95 -> "Thunderstorm";
            case 96, 99 -> "Thunderstorm with hail";
            default -> "Partly cloudy";
        };
    }

    public static class WeatherData {
        public String condition; 
        public int temperature;
        public String description;

        public WeatherData(String condition, int temperature, String description) {
            this.condition = condition;
            this.temperature = temperature;
            this.description = description;
        }
    }
}