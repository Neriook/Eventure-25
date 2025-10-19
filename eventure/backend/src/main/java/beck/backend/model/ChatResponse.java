package beck.backend.model;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatResponse {
    private String response;
    private String modelId;
    private boolean success;
    private String error;

    public ChatResponse(String response, String modelId) {
        this.response = response;
        this.modelId = modelId;
        this.success = true;
    }
    public static ChatResponse error(String error) {
        ChatResponse response = new ChatResponse();
        response.setSuccess(false);
        response.setError(error);
        return response;
    }
}