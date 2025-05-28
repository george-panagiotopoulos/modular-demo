# Event Hub Concurrency Improvements

## Overview
This document outlines the improvements made to the headless_v2 and headless_v3 implementations to support concurrent connections from multiple web-based users to Event Hub without crashing.

## Key Issues Addressed

### 1. Consumer Group ID Conflicts
**Problem**: Multiple users connecting simultaneously would create Kafka consumers with similar group IDs, causing conflicts and connection failures.

**Solution**: 
- Implemented session-based unique group IDs using UUID and timestamps
- Format: `headless-{domain}-{session_id}-{timestamp}-{uuid_suffix}`
- Each user session gets a completely unique consumer group

### 2. Resource Management
**Problem**: No proper cleanup of Event Hub connections when users navigated away or refreshed pages.

**Solution**:
- Added session-based consumer tracking with timestamps
- Implemented proper cleanup mechanisms on frontend and backend
- Added automatic cleanup of stale connections (1-hour timeout)
- Background cleanup thread runs every 5 minutes

### 3. Connection State Management
**Problem**: EventSource connections were not properly managed across multiple users.

**Solution**:
- Added session ID management in frontend JavaScript
- Implemented proper disconnect endpoints
- Added cleanup on page unload events
- Thread-safe consumer storage with locks

## Backend Changes (`app/routes/main_routes.py`)

### New Functions Added:
1. `cleanup_consumer_for_session(session_id, domain)` - Clean up specific consumer
2. `cleanup_stale_consumers()` - Remove inactive consumers
3. `start_cleanup_thread()` - Background cleanup worker
4. Updated `create_kafka_consumer()` - Session-based group IDs
5. Updated `stream_kafka_events()` - Session management

### New Endpoints Added:
1. `POST /api/headless-v2/events/{domain}/disconnect` - Disconnect specific domain
2. `POST /api/headless-v2/cleanup` - Clean up all connections for session
3. `GET /api/headless-v2/health` - Monitor active connections

### Enhanced Features:
- Thread-safe consumer storage with locks
- Consumer timestamp tracking
- Automatic stale connection cleanup
- Session ID extraction from headers/query params

## Frontend Changes

### headless_v2_app.js:
1. **Session Management**: Added `getSessionId()` function
2. **Cleanup Functions**: Added `cleanupEventSource()` and `cleanupAllConnections()`
3. **Enhanced EventSource**: Session ID in URL parameters
4. **Page Unload Handlers**: Cleanup on beforeunload/unload events
5. **Updated Connection Logic**: Proper disconnect requests to backend

### headless_v3_app.js:
1. **Session Management**: Same session ID generation as v2
2. **Cleanup Functions**: Consistent cleanup mechanism
3. **Enhanced Connections**: Session-based EventSource URLs
4. **Page Unload Handlers**: Proper cleanup on navigation

## Configuration Improvements

### Kafka Consumer Settings:
- `max.poll.interval.ms`: 300000 (5 minutes)
- `connections.max.idle.ms`: 540000 (9 minutes)
- `request.timeout.ms`: 30000 (30 seconds)
- `retry.backoff.ms`: 100 (100ms)

### Session Management:
- Unique session IDs: `session_{timestamp}_{random}`
- Consumer group format: `headless-{domain}-{session}-{timestamp}-{uuid}`
- Automatic cleanup after 1 hour of inactivity

## Monitoring and Health Checks

### Health Endpoint (`/api/headless-v2/health`):
Returns information about:
- Number of active sessions
- Total consumer count
- Per-session domain connections
- Consumer creation timestamps and ages

### Example Health Response:
```json
{
  "active_sessions": 2,
  "total_consumers": 4,
  "sessions": {
    "session_1234567890_abc123": {
      "domains": ["party", "deposits"],
      "consumer_count": 2,
      "timestamps": {
        "party": {
          "created": 1640995200,
          "age_seconds": 300
        },
        "deposits": {
          "created": 1640995300,
          "age_seconds": 200
        }
      }
    }
  }
}
```

## Benefits

1. **Concurrent User Support**: Multiple users can connect simultaneously without conflicts
2. **Resource Efficiency**: Automatic cleanup prevents resource leaks
3. **Stability**: No more crashes due to consumer group conflicts
4. **Monitoring**: Health endpoint for debugging and monitoring
5. **Graceful Cleanup**: Proper disconnection on page navigation
6. **Fault Tolerance**: Background cleanup handles orphaned connections

## Testing Recommendations

1. **Multi-User Testing**: Open multiple browser tabs/windows to test concurrent connections
2. **Network Interruption**: Test behavior when network connections are lost
3. **Page Navigation**: Verify cleanup when users navigate between tabs
4. **Long-Running Sessions**: Test automatic cleanup of stale connections
5. **Health Monitoring**: Use health endpoint to verify proper resource management

## Future Enhancements

1. **Connection Pooling**: Implement connection pooling for better resource utilization
2. **Rate Limiting**: Add rate limiting per session to prevent abuse
3. **Metrics Collection**: Add detailed metrics for monitoring and alerting
4. **Load Balancing**: Consider load balancing for high-traffic scenarios 