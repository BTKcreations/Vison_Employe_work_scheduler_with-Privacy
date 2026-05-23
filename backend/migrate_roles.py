"""
Migration script to seed default system roles and migrate existing users.
"""
import asyncio
import sys
import os

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import init_db
from app.models.role import CompanyRole, seed_default_roles, BaseArchetype
from app.models.user import User, UserRole


async def run_migration():
    print("Starting SaaS Roles and Permissions Migration...")
    
    # Initialize Beanie database connection
    await init_db()
    
    # 1. Seed default system role templates
    print("Seeding global role templates...")
    await seed_default_roles()
    print("Global role templates seeded successfully.")
    
    # Fetch all system templates to map them quickly in memory
    templates = await CompanyRole.find(CompanyRole.company_id == None).to_list()
    template_map = {t.base_archetype: t for t in templates}
    
    # 2. Migrate existing users
    print("Migrating users...")
    users = await User.find_all().to_list()
    migrated_count = 0
    
    for user in users:
        # Determine archetype from current user.role
        role_str = user.role.value if isinstance(user.role, UserRole) else str(user.role)
        try:
            archetype = BaseArchetype(role_str)
        except ValueError:
            archetype = BaseArchetype.EMPLOYEE
            
        template = template_map.get(archetype)
        if not template:
            print(f"Warning: No system template found for archetype: {archetype}")
            continue
            
        # Update user fields
        user.role_archetype = archetype
        user.role_display_name = template.display_name
        user.role_id = template.id
        
        # Save user
        await user.save()
        migrated_count += 1
        print(f"Migrated user: {user.name} ({user.email}) -> Role: {user.role_display_name}")
        
    print(f"Migration completed. Total users migrated: {migrated_count}")


if __name__ == "__main__":
    asyncio.run(run_migration())
