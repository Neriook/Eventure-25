package beck.backend.model;
import lombok.Data;
@Data
public class ChatRequest {
    private String message;
    private String modelId = "us.anthropic.claude-3-5-sonnet-20241022-v2:0";
    private Integer maxTokens = 2000;
    private Double temperature = 0.7;
}