"""Kafka event hub producer (KRaft single-broker deployment).

Publishes surveillance events to topic `malaria.events`. Delivery is strictly
best-effort: a Kafka outage never blocks or fails an API write — events are
queued in-process and drained by a background asyncio task that reconnects on
its own. Enable with KAFKA_ENABLED=true and point KAFKA_BOOTSTRAP_SERVERS at
the broker (docker-compose sets kafka:29092 for the in-network broker).

The aiokafka import happens lazily inside the drain task so environments
processing (pip install aiokafka) but not running Kafka (unit tests, local dev
without docker) are completely unaffected.
"""
import asyncio
import json
import logging
import os
import queue
import time

logger = logging.getLogger("m3.kafka")

TOPIC = os.getenv("KAFKA_TOPIC", "malaria.events")

_events: "queue.Queue[dict]" = queue.Queue()
_drain_started = False


def kafka_enabled() -> bool:
    return os.getenv("KAFKA_ENABLED", "false").strip().lower() == "true"


def emit_event(event_type: str, payload: dict):
    """Fire-and-forget producer. Never raises, never blocks the request path."""
    if not kafka_enabled():
        return
    event = {
        "event_id": f"evt_{time.time_ns()}",
        "type": event_type,
        "payload": payload,
        "occurred_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    try:
        _events.put_nowait(event)
    except Exception:  # pragma: no cover — bounded queue full is impossible here
        logger.warning("Kafka event dropped (queue unavailable): %s", event_type)


async def start_event_producer():
    """Idempotent startup hook: spawns the background drain task on the
    application's event loop when Kafka is enabled."""
    global _drain_started
    if not kafka_enabled() or _drain_started:
        _drain_started = True
        return
    _drain_started = True
    asyncio.get_running_loop().create_task(_drain_forever())


async def _drain_forever():
    """Single background task: keeps one AIOKafkaProducer alive, drains the
    in-process event queue to topic `malaria.events`, and reconnects on failure."""
    import aiokafka

    while True:
        producer = None
        try:
            producer = aiokafka.AIOKafkaProducer(
                bootstrap_servers=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092"),
                value_serializer=lambda value: json.dumps(value, default=str).encode("utf-8"),
                linger_ms=100,
            )
            await producer.start()
            logger.info("Kafka producer connected; topic=%s", TOPIC)
            try:
                while True:
                    sent_any = False
                    while not _events.empty():
                        event = _events.get_nowait()
                        await producer.send_and_wait(TOPIC, event)
                        logger.info("Kafka event published: %s", event["type"])
                        sent_any = True
                    if not sent_any:
                        await asyncio.sleep(1.0)
            finally:
                await producer.stop()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # connection refused during startup is normal
            logger.warning("Kafka producer unavailable (will retry): %s", exc)
            if producer is not None:
                try:
                    await producer.stop()
                except Exception:
                    pass
            await asyncio.sleep(10.0)
