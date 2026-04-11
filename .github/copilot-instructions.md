# Copilot Instructions – salvius-game

## Running commands

**Always use the Docker container** instead of the host environment.

The project has a `docker-compose.yml` at the repo root. Use it for all dev
and build tasks:

```bash
# Start the dev server (Vite on port 5173)
docker compose up -d

# One-off commands (build, lint, etc.)
docker compose exec app npm run build
docker compose exec app npx vite preview

# Install a new package
docker compose exec app npm install <package>
```

The container mounts the workspace at `/app` with a volume, so file edits on
the host are reflected immediately — no rebuild required unless `package.json`
changes.

> **Why:** Node and npm are not guaranteed to be available on 
> the host. The container pins Node 22 and ensures a 
> reproducible environment.
