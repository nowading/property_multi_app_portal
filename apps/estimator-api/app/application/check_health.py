"""CheckHealthUseCase — probe downstream ML service health."""

from __future__ import annotations

from app.domain import HealthPort


class CheckHealthUseCase:
    """Return ``True`` if the ML service is reachable and reports healthy."""

    def __init__(self, health: HealthPort) -> None:
        self._health = health

    async def execute(self) -> bool:
        return await self._health.is_healthy()
