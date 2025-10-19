package beck.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.*;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@DynamoDbBean
public class Event {
    
    private String id;
    private String title;
    private List<Integer> date;
    private Integer startTime;
    private Integer endTime;
    private String address;
    private String description;
    private Boolean timeSensitive;
    private String url;
    private Long createdAt;
    private Long updatedAt;
    @DynamoDbPartitionKey
    @DynamoDbAttribute("id")
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    @DynamoDbAttribute("title")
    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    @DynamoDbAttribute("date")
    public List<Integer> getDate() {
        return date;
    }

    public void setDate(List<Integer> date) {
        this.date = date;
    }

    @DynamoDbAttribute("startTime")
    public Integer getStartTime() {
        return startTime;
    }

    public void setStartTime(Integer startTime) {
        this.startTime = startTime;
    }

    @DynamoDbAttribute("endTime")
    public Integer getEndTime() {
        return endTime;
    }

    public void setEndTime(Integer endTime) {
        this.endTime = endTime;
    }

    @DynamoDbAttribute("address")
    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    @DynamoDbAttribute("description")
    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getNote() {
        return description;
    }

    public void setNote(String note) {
        this.description = note;
    }

    @DynamoDbAttribute("timeSensitive")
    public Boolean getTimeSensitive() {
        return timeSensitive;
    }

    public void setTimeSensitive(Boolean timeSensitive) {
        this.timeSensitive = timeSensitive;
    }

    public Boolean getIsTimeSensitive() {
        return timeSensitive;
    }

    @DynamoDbAttribute("url")
    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    @DynamoDbAttribute("createdAt")
    public Long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Long createdAt) {
        this.createdAt = createdAt;
    }

    @DynamoDbAttribute("updatedAt")
    public Long getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Long updatedAt) {
        this.updatedAt = updatedAt;
    }

    public boolean timeRangeOverlap(Event other) {
        if (this.startTime == null || this.endTime == null || 
            other.getStartTime() == null || other.getEndTime() == null) {
            return false;
        }
        return this.startTime < other.getEndTime() && other.getStartTime() < this.endTime;
    }
    public void ensureIdAndTimestamps() {
        if (this.id == null || this.id.isEmpty()) {
            this.id = UUID.randomUUID().toString();
        }
        long now = System.currentTimeMillis();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.updatedAt = now;
    }
}

