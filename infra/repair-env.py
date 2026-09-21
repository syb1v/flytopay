"""Align generated server-only connection strings without printing secrets."""
from pathlib import Path

path = Path('/opt/flytopay/.env')
values = dict(line.split('=', 1) for line in path.read_text().splitlines() if '=' in line)
values['DATABASE_URL'] = f"postgresql+asyncpg://flytopay:{values['POSTGRES_PASSWORD']}@postgres:5432/flytopay"
values['REDIS_URL'] = f"redis://:{values['REDIS_PASSWORD']}@redis:6379/0"
path.write_text(''.join(f'{key}={value}\n' for key, value in values.items()))
path.chmod(0o600)
