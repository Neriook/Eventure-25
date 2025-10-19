package beck.backend.repository;
import beck.backend.model.Event;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.model.ScanEnhancedRequest;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Repository
@RequiredArgsConstructor
public class EventRepository {

    private final DynamoDbEnhancedClient enhancedClient;
    private final DynamoDbClient dynamoDbClient;
    private static final String TABLE_NAME = "Events";

    private DynamoDbTable<Event> getTable() {
        return enhancedClient.table(TABLE_NAME, TableSchema.fromBean(Event.class));
    }

    public void createTableIfNotExists() {
        try {
            DescribeTableRequest describeRequest = DescribeTableRequest.builder()
                    .tableName(TABLE_NAME)
                    .build();
            dynamoDbClient.describeTable(describeRequest);
            log.info("Table '{}' already exists", TABLE_NAME);
        } catch (ResourceNotFoundException e) {
            log.info("Table '{}' doesn't exist, creating...", TABLE_NAME);
            createTable();
        }
    }

    private void createTable() {
        CreateTableRequest createTableRequest = CreateTableRequest.builder()
                .tableName(TABLE_NAME)
                .keySchema(
                        KeySchemaElement.builder()
                                .attributeName("id")
                                .keyType(KeyType.HASH)
                                .build()
                )
                .attributeDefinitions(
                        AttributeDefinition.builder()
                                .attributeName("id")
                                .attributeType(ScalarAttributeType.S)
                                .build()
                )
                .billingMode(BillingMode.PAY_PER_REQUEST)
                .build();

        dynamoDbClient.createTable(createTableRequest);
        log.info("Table '{}' created successfully", TABLE_NAME);

        // Wait for table to be active
        try {
            dynamoDbClient.waiter().waitUntilTableExists(
                    DescribeTableRequest.builder().tableName(TABLE_NAME).build()
            );
            log.info("Table '{}' is now active", TABLE_NAME);
        } catch (Exception e) {
            log.error("Error waiting for table creation: {}", e.getMessage());
        }
    }

    public Event save(Event event) {
        try {
            event.ensureIdAndTimestamps();
            DynamoDbTable<Event> table = getTable();
            table.putItem(event);
            log.info("Saved event: {} (ID: {})", event.getTitle(), event.getId());
            return event;
        } catch (Exception e) {
            log.error("Error saving event: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save event", e);
        }
    }

    public List<Event> saveAll(List<Event> events) {
        List<Event> savedEvents = new ArrayList<>();
        for (Event event : events) {
            try {
                savedEvents.add(save(event));
            } catch (Exception e) {
                log.error("Failed to save event: {}", event.getTitle(), e);
            }
        }
        return savedEvents;
    }

    public Optional<Event> findById(String id) {
        try {
            DynamoDbTable<Event> table = getTable();
            Key key = Key.builder().partitionValue(id).build();
            Event event = table.getItem(key);
            return Optional.ofNullable(event);
        } catch (Exception e) {
            log.error("Error finding event by ID {}: {}", id, e.getMessage(), e);
            return Optional.empty();
        }
    }

    public List<Event> findAll() {
        try {
            DynamoDbTable<Event> table = getTable();
            return table.scan(ScanEnhancedRequest.builder().build())
                    .items()
                    .stream()
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Error fetching all events: {}", e.getMessage(), e);
            return new ArrayList<>();
        }
    }

    public boolean deleteById(String id) {
        try {
            DynamoDbTable<Event> table = getTable();
            Key key = Key.builder().partitionValue(id).build();
            table.deleteItem(key);
            log.info("Deleted event with ID: {}", id);
            return true;
        } catch (Exception e) {
            log.error("Error deleting event {}: {}", id, e.getMessage(), e);
            return false;
        }
    }

    public void deleteAll() {
        try {
            List<Event> allEvents = findAll();
            DynamoDbTable<Event> table = getTable();
            
            for (Event event : allEvents) {
                Key key = Key.builder().partitionValue(event.getId()).build();
                table.deleteItem(key);
            }
            log.info("Deleted {} events", allEvents.size());
        } catch (Exception e) {
            log.error("Error deleting all events: {}", e.getMessage(), e);
        }
    }

    public Event update(Event event) {
        event.setUpdatedAt(System.currentTimeMillis());
        return save(event);
    }
    public long count() {
        try {
            return findAll().size();
        } catch (Exception e) {
            log.error("Error counting events: {}", e.getMessage(), e);
            return 0;
        }
    }
}