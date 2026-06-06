"""
Platform audit service.

Persists every Platform Owner action to an append-only collection. The
application never exposes update or delete operations on this collection.
"""
from typing import Optional, Any
from beanie import PydanticObjectId
from app.models.platform_audit_log import PlatformAuditLog
from app.models.user import User


class PlatformAuditService:
    @staticmethod
    async def log(
        actor: Optional[User],
        action: str,
        entity_type: str,
        entity_id: Optional[PydanticObjectId] = None,
        tenant_id: Optional[PydanticObjectId] = None,
        description: Optional[str] = None,
        before_state: Optional[dict[str, Any]] = None,
        after_state: Optional[dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> PlatformAuditLog:
        entry = PlatformAuditLog(
            actor_id=actor.id if actor else None,
            actor_email=actor.email if actor else None,
            actor_name=actor.name if actor else "System",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            tenant_id=tenant_id,
            description=description,
            before_state=before_state,
            after_state=after_state,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        await entry.insert()
        return entry
