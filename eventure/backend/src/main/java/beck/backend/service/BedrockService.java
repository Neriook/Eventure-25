package beck.backend.service;
import beck.backend.model.ChatRequest;
import beck.backend.model.ChatResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;
//helllo!!
@Slf4j
@Service
@RequiredArgsConstructor
public class BedrockService {

    private final BedrockRuntimeClient bedrockClient;

    public ChatResponse chat(ChatRequest request) {
        try {
            log.info("Invoking Bedrock with model: {}", request.getModelId());
            
            // Claude 3.5
            JSONObject message = new JSONObject();
            message.put("role", "user");
            message.put("content", request.getMessage());

            JSONArray messages = new JSONArray();
            messages.put(message);

            JSONObject requestBody = new JSONObject();
            requestBody.put("anthropic_version", "bedrock-2023-05-31");
            requestBody.put("max_tokens", request.getMaxTokens());
            requestBody.put("messages", messages);
            requestBody.put("temperature", request.getTemperature());

            log.debug("Request body: {}", requestBody.toString());
            InvokeModelRequest invokeRequest = InvokeModelRequest.builder()
                    .modelId(request.getModelId())
                    .contentType("application/json")
                    .accept("application/json")
                    .body(SdkBytes.fromUtf8String(requestBody.toString()))
                    .build();

            InvokeModelResponse response = bedrockClient.invokeModel(invokeRequest);
            
            String responseBody = response.body().asUtf8String();
            log.debug("Response body: {}", responseBody);
            
            JSONObject jsonResponse = new JSONObject(responseBody);
            String text = jsonResponse.getJSONArray("content")
                    .getJSONObject(0)
                    .getString("text");

            return new ChatResponse(text, request.getModelId());
            
        } catch (Exception e) {
            log.error("Error invoking Bedrock: {}", e.getMessage(), e);
            return ChatResponse.error("Failed to get response from AI: " + e.getMessage());
        }
    }
}