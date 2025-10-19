package beck.backend.controller;

import beck.backend.service.WeatherService;
import beck.backend.service.WeatherService.WeatherData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
@Slf4j
@RestController
@RequestMapping("/api/weather")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class WeatherController {

    private final WeatherService weatherService;
    @GetMapping
    public ResponseEntity<Map<String, WeatherData>> getWeekWeather(
        @RequestParam(defaultValue = "Seattle, WA") String location
    ) {
        log.info("Getting week weather for: {}", location);
        
        Map<String, WeatherData> weekWeather = new HashMap<>();
        LocalDate today = LocalDate.now();
        String[] days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"};
        
        for (int i = 0; i < 5; i++) {
            LocalDate date = today.plusDays(i);
            WeatherData weather = weatherService.getWeather(location, date);
            weekWeather.put(days[i], weather);
        }

        return ResponseEntity.ok(weekWeather);
    }
    @GetMapping("/{day}")
    public ResponseEntity<WeatherData> getDayWeather(
        @PathVariable String day,
        @RequestParam(defaultValue = "Seattle, WA") String location
    ) {
        log.info("Getting weather for {} in {}", day, location);
        
        LocalDate date = LocalDate.now(); 
        WeatherData weather = weatherService.getWeather(location, date);
        
        return ResponseEntity.ok(weather);
    }
}