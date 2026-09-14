import asyncio
from app.database import engine, async_session_factory
from app.models import Sector, DeviceCache
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

async def assign_sectors():
    async with async_session_factory() as session:
        # Ensure Infraestructura exists
        result = await session.execute(select(Sector).where(Sector.name == "Infraestructura"))
        infra = result.scalar_one_or_none()
        if not infra:
            infra = Sector(name="Infraestructura", description="Sector Infraestructura")
            session.add(infra)
            await session.flush()
            print(f"Created sector Infraestructura (id={infra.id})")
        
        # Get all sectors
        result = await session.execute(select(Sector))
        sectors = {s.name: s.id for s in result.scalars().all()}
        print(f"Sectors: {sectors}")
        
        # Get all devices
        result = await session.execute(select(DeviceCache))
        devices = result.scalars().all()
        
        assigned = 0
        for dev in devices:
            name = (dev.device_name or "").lower()
            if "planta externa" in name:
                sector_id = sectors.get("Planta Externa")
            elif "admin" in name or "direccion" in name:
                sector_id = sectors.get("Administracion")
            else:
                sector_id = sectors.get("Infraestructura")
            
            if sector_id:
                dev.sector_id = sector_id
                assigned += 1
        
        await session.commit()
        print(f"Assigned {assigned} of {len(devices)} devices to sectors")
        
        # Show distribution
        for dev in devices[:10]:
            print(f"  {dev.device_name[:40]} -> sector_id={dev.sector_id}")

asyncio.run(assign_sectors())