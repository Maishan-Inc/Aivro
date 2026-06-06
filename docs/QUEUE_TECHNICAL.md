# Generation Task Queue System

## Overview

The generation task queue system provides rate limiting and queuing for AI model requests, preventing overwhelming upstream APIs while maintaining a fair user experience.

## Features

- **Per-model rate limiting**: Each AI model has independent per-minute request limits
- **Queue position tracking**: Users see their position in queue ("Queued, 5 ahead of you")
- **Credits management**: Credits are charged when queued, refunded on cancellation or failure
- **Database compatibility**: SQLite (single instance), PostgreSQL, MySQL
- **Horizontal scaling**: Redis backend support (reserved for phase 2)

## Architecture

### Database Schema

**generation_tasks** table:
- `id` (PK): Task identifier
- `user_id` (indexed): User who submitted the task
- `model` (indexed): AI model name (e.g., "dall-e-3", "grok-beta")
- `path` (indexed): API endpoint (/images/generations, /chat/completions, /videos)
- `status` (indexed): queued | executing | succeeded | failed | canceled
- `queue_position` (indexed): Position in queue for this model (0 = not queued)
- `started_at` (indexed): When execution started (used for rate limit window)
- `finished_at` (indexed): When task completed (used for cleanup)
- `request_body` (BLOB): Original request payload
- `response_body` (BLOB): AI response payload (images, chat, video metadata)
- `credits`: Points charged for this task
- `error`: Error message if failed

### Composite Indexes

Optimized for high-frequency queries:

```sql
-- Queue dispatch (finds next tasks to execute per model)
CREATE INDEX idx_generation_tasks_queue_dispatch 
  ON generation_tasks(model, status, created_at, id);

-- User queue count (prevents single user flooding)
CREATE INDEX idx_generation_tasks_user_queue 
  ON generation_tasks(user_id, status);

-- Cleanup (removes old completed tasks)
CREATE INDEX idx_generation_tasks_cleanup 
  ON generation_tasks(status, finished_at);
```

### State Machine

```
Initial Request
  ↓
Check rate limit for model
  ├─ Within limit → executing (immediate)
  │   ↓
  │  Execute upstream API
  │   ├─ Success → succeeded (save response)
  │   └─ Failure → failed (refund credits)
  │
  └─ Over limit → queued (deferred)
      ↓
     Scheduler picks up task (per-second scan)
      ↓
     executing → succeeded/failed
```

### Rate Limiting Algorithm

**Per-minute sliding window**:
1. Count tasks with `started_at >= current_minute_truncated` for this model
2. If count < configured limit: allow dispatch
3. Otherwise: queue task and calculate position

**Position calculation**:
```sql
SELECT COUNT(*) FROM generation_tasks
WHERE model = ? 
  AND status = 'queued'
  AND (created_at < ? OR (created_at = ? AND id < ?))
```

### Scheduler

**Background goroutine** (started in main.go):
- Runs every 1 second
- For each model with queued tasks:
  1. Calculate remaining capacity this minute
  2. Select earliest `queued` tasks (LIMIT remaining)
  3. Mark as `executing` with optimistic lock (`WHERE status = 'queued'`)
  4. Execute in separate goroutines
  5. Recalculate queue positions for this model

**Concurrency safety**:
- Single process: `sync.Mutex` protects scheduler
- Optimistic locking: `UPDATE ... WHERE status = 'queued'` prevents double-dispatch
- Crash recovery: On startup, mark all `executing` tasks as `failed` and refund credits

### Credits Management

**Charging timing**:
- Queued: Charge immediately when task is created
- Executing: Already charged (no additional charge)
- Succeeded: Keep charge
- Failed: Refund credits
- Canceled: Refund credits

**Idempotency**:
- Refund failures are logged but don't block task completion
- No duplicate charges: credits charged once during task creation

### Special Cases

**Chat completions** (`/chat/completions`):
- Always bypass queue to preserve streaming
- Execute immediately via direct proxy path
- Credits charged/refunded same as other endpoints

**Queue disabled**:
- All requests bypass queue (behaves like pre-queue version)
- No `generation_tasks` records created
- Direct proxy path used

**Video generation**:
- POST `/videos` goes through queue (can be queued)
- GET `/videos/:id` and `/videos/:id/content` bypass queue (polling already queued task)

## API Endpoints

### User Endpoints

**GET /api/v1/generation-tasks**
- List current user's recent tasks (limit 50)
- Returns: `GenerationTaskView[]`

**GET /api/v1/generation-tasks/:id**
- Get task status
- Returns: `GenerationTaskView` with `queuePosition`, `aheadCount`, `status`

**GET /api/v1/generation-tasks/:id/result**
- Retrieve completed task result (only `succeeded` tasks)
- Returns: Original AI response body + headers

**DELETE /api/v1/generation-tasks/:id**
- Cancel queued task
- Only `queued` status tasks can be canceled
- Refunds credits immediately
- Returns: Success message

### Response Format

**Immediate execution** (no queue):
```json
{
  "data": [{"url": "...", "revised_prompt": "..."}],
  "created": 1234567890
}
```

**Queued execution**:
```json
{
  "code": 0,
  "data": {
    "queued": true,
    "taskId": "task_abc123",
    "status": "queued",
    "queuePosition": 5,
    "aheadCount": 4,
    "model": "dall-e-3"
  },
  "msg": "Queued"
}
```

**Task status polling**:
```json
{
  "code": 0,
  "data": {
    "id": "task_abc123",
    "status": "executing",
    "queuePosition": 0,
    "aheadCount": 0,
    "resultAvailable": false
  }
}
```

## Frontend Integration

### Detection

Check if response has `queued` envelope:

```typescript
if (response.data?.queued) {
  // Enter polling mode
  const taskId = response.data.taskId;
  pollTaskStatus(taskId);
} else {
  // Immediate result
  processResult(response.data);
}
```

### Polling Loop

```typescript
async function pollTaskStatus(taskId: string) {
  while (true) {
    await sleep(2000); // 2 second interval
    const task = await fetchGenerationTask(config, taskId);
    
    if (task.status === "succeeded") {
      const result = await fetchGenerationTaskResult(config, taskId);
      return processResult(result);
    }
    
    if (task.status === "failed" || task.status === "canceled") {
      throw new Error(task.error || "Task failed");
    }
    
    // Update UI: "Queued, X ahead of you"
    updateQueueUI(task.queuePosition, task.aheadCount);
  }
}
```

### Cancel Queue

```typescript
async function cancelQueuedTask(taskId: string) {
  await cancelGenerationTask(config, taskId);
  refreshUserCredits(); // Update credits display
}
```

## Configuration

### Admin Settings (PrivateSetting)

```go
type AIQueueSetting struct {
  Enabled            *bool            // true = queue enabled
  Backend            string           // "database" | "redis"
  RedisURL           string           // redis://host:port/db
  DefaultPerMinute   int              // Default rate limit (50)
  ModelPerMinute     []ModelRateLimit // Per-model overrides
  MaxQueuedPerUser   int              // Max queued tasks per user (20)
  TaskRetentionHours int              // Auto-delete after N hours (24)
}

type ModelRateLimit struct {
  Model     string // e.g. "grok-beta"
  PerMinute int    // e.g. 10
}
```

### Example Configuration

```json
{
  "enabled": true,
  "backend": "database",
  "defaultPerMinute": 50,
  "modelPerMinute": [
    {"model": "grok-beta", "perMinute": 10},
    {"model": "dall-e-3", "perMinute": 30}
  ],
  "maxQueuedPerUser": 20,
  "taskRetentionHours": 24
}
```

## Performance Tuning

### Database Query Optimization

**Hot queries** (called every second by scheduler):
- `ListQueuedModels()`: `SELECT DISTINCT model WHERE status = 'queued'`
- `CountDispatchedGenerationTasks()`: `COUNT(*) WHERE model = ? AND started_at >= ?`
- `ListQueuedGenerationTasks()`: `SELECT * WHERE model = ? AND status = 'queued' ORDER BY created_at, id LIMIT ?`

**Covered by indexes**:
- `idx_generation_tasks_queue_dispatch` on `(model, status, created_at, id)`
- Queries use index-only scans when possible

### Cleanup Strategy

**Automatic cleanup** (runs every second):
```sql
DELETE FROM generation_tasks
WHERE status IN ('succeeded', 'failed', 'canceled')
  AND finished_at < NOW() - INTERVAL '24 hours';
```

**Manual cleanup** (if DB grows large):
```sql
-- Archive old tasks before deleting
INSERT INTO generation_tasks_archive
SELECT * FROM generation_tasks
WHERE finished_at < NOW() - INTERVAL '7 days';

DELETE FROM generation_tasks
WHERE finished_at < NOW() - INTERVAL '7 days';
```

### Scaling Considerations

**Single instance** (current implementation):
- ✅ SQLite: Up to ~1000 req/min aggregate across all models
- ✅ PostgreSQL: Up to ~5000 req/min aggregate

**Multi-instance** (requires Redis backend - phase 2):
- Use Redis for:
  - Distributed rate limit counters (`INCR` + `EXPIRE`)
  - Queue position cache (sorted sets)
  - Task result cache (short TTL)
- Keep PostgreSQL/MySQL for:
  - Authoritative task state
  - Credits ledger
  - Long-term history

## Monitoring

### Key Metrics

**Queue depth** (per model):
```sql
SELECT model, COUNT(*) FROM generation_tasks
WHERE status = 'queued' GROUP BY model;
```

**Execution latency** (avg time from queued → finished):
```sql
SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, finished_at)) 
FROM generation_tasks
WHERE status = 'succeeded' AND created_at > NOW() - INTERVAL 1 HOUR;
```

**Rate limit headroom**:
```sql
SELECT model, 
       COUNT(*) as dispatched,
       ? - COUNT(*) as remaining
FROM generation_tasks
WHERE started_at >= ? 
GROUP BY model;
```

### Health Checks

**Stuck executing tasks**:
```sql
SELECT COUNT(*) FROM generation_tasks
WHERE status = 'executing' 
  AND started_at < NOW() - INTERVAL 10 MINUTE;
```

If count > 0: Likely scheduler died or hung tasks. Restart service to trigger recovery.

**Growing queue without dispatch**:
```sql
SELECT model, COUNT(*), MIN(created_at) as oldest
FROM generation_tasks
WHERE status = 'queued' GROUP BY model;
```

If `oldest` is old but queue not shrinking: Check scheduler logs for errors.

## Testing

### Unit Tests

```go
func TestCanDispatchModel(t *testing.T) {
  // Mock: 5 tasks dispatched this minute, limit = 10
  // Expect: canDispatch = true, remaining = 5
}

func TestQueuePositionCalculation(t *testing.T) {
  // Mock: 3 tasks queued for model before current task
  // Expect: position = 4, aheadCount = 3
}
```

### Integration Tests

```bash
# Setup: Configure model limit = 2/min
curl -X POST /api/v1/admin/settings -d '{"private":{"aiQueue":{"modelPerMinute":[{"model":"test-model","perMinute":2}]}}}'

# Submit 5 requests
for i in {1..5}; do
  curl -X POST /api/v1/images/generations -d '{"model":"test-model","prompt":"test"}'
done

# Verify: First 2 execute immediately, next 3 queued
# Check queue positions: 1, 2, 3
```

### Load Tests

```bash
# Simulate 100 concurrent users
wrk -t10 -c100 -d30s --timeout 60s \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"dall-e-3","prompt":"test","n":1}' \
  http://localhost:3982/api/v1/images/generations
```

Expected behavior:
- Requests within rate limit: immediate response (< 2s)
- Requests over limit: queued response (< 200ms)
- No 500 errors
- All tasks eventually execute

## Troubleshooting

### Issue: Tasks stuck in `queued` status

**Cause**: Scheduler not running or crashed

**Solution**:
1. Check logs: `docker compose logs app | grep "generation queue"`
2. Restart service: `docker compose restart app`
3. Verify scheduler started: Look for "StartGenerationQueueScheduler" log

### Issue: Credits not refunded on cancellation

**Cause**: Refund transaction failed

**Solution**:
1. Check logs: `grep "refund failed" logs`
2. Manual refund via admin panel
3. Check DB constraints on `users` table

### Issue: Double-charging on retry

**Cause**: User retried after network timeout but task succeeded

**Solution**:
- Not a bug: Each new request creates new task and charges separately
- Frontend should prevent double-submit (disable button while pending)

### Issue: Queue positions not updating

**Cause**: `RecalculateGenerationTaskPositions` failing

**Solution**:
1. Check logs for DB errors
2. Verify `generation_tasks` table not locked
3. Manually recalculate:
   ```sql
   SET @pos := 0;
   UPDATE generation_tasks 
   SET queue_position = (@pos := @pos + 1)
   WHERE model = 'model-name' AND status = 'queued'
   ORDER BY created_at, id;
   ```

## Future Enhancements

### Phase 2: Redis Backend

**Goals**:
- Multi-instance support
- Sub-second queue position updates
- Distributed rate limiting

**Implementation**:
- Redis sorted sets for queue: `ZADD queue:{model} {timestamp} {taskId}`
- Redis counters for rate limit: `INCR ratelimit:{model}:{minute}` + `EXPIRE`
- PostgreSQL/MySQL for authoritative state

### Phase 3: Priority Queue

**Goals**:
- Premium users jump queue
- Critical tasks (e.g., admin) skip queue

**Implementation**:
- Add `priority` field to `generation_tasks` (default 0, admin 100)
- Modify scheduler: `ORDER BY priority DESC, created_at, id`

### Phase 4: Predictive Queueing

**Goals**:
- Estimate wait time: "~2 minutes"
- Pre-warm models before dispatch

**Implementation**:
- Track historical execution times per model
- Calculate ETA: `(queuePosition - 1) * avgExecutionTime / perMinuteLimit`

## References

- [Deployment Guide](./AI_QUEUE_DEPLOYMENT.md) - Operator-focused setup instructions
- [Implementation Plan](../.claude/plans/glimmering-floating-treasure.md) - Original design document
- [GORM Documentation](https://gorm.io/docs/) - Database ORM reference
