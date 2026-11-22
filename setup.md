# Local setup (Windows)

Follow these steps to run SkillBridge locally with Docker, Supabase, and Next.js.

## 1. Install Node.js

Install an active LTS release of Node.js from [nodejs.org](https://nodejs.org/en/download/). This project requires Node.js 20.9 or newer; the project has been tested with Node 22.

Open a new PowerShell window and confirm Node.js and npm are available:

```powershell
node --version
npm --version
```

## 2. Install and start Docker Desktop

Supabase runs its local database and Auth services in containers. On Windows, install [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) and use the **WSL 2** backend.

1. If WSL is not installed, open PowerShell as Administrator and run:

   ```powershell
   wsl --install
   ```

   Restart Windows if prompted. If WSL is already installed, update it with `wsl --update`.

2. Download and install Docker Desktop for Windows. Select the WSL 2 backend when the installer asks.
3. Launch Docker Desktop and wait for it to show that the engine is running. Supabase needs the **Linux** engine; if Docker is set to Windows containers, switch it to Linux containers from Docker Desktop's tray menu.
4. Open a new PowerShell window and verify the Docker client can reach the engine:

   ```powershell
   docker version
   docker info
   ```

   `docker version` should show both **Client** and **Server** information. If it only shows the client or reports that it cannot connect, Docker Desktop's engine is not ready yet.

## 3. Open the project and install dependencies

In PowerShell, change to the project root (the directory containing `package.json` and `supabase\config.toml`):

```powershell
cd C:\Users\NITISH\coding\idt
npm install
```

The repository already includes the Supabase CLI as an npm dependency, so you do not need to install it globally.

## 4. Start local Supabase

Keep Docker Desktop running. From the project root, start the local Supabase services:

```powershell
npx supabase start
```

The first start downloads the service images and may take several minutes. The CLI starts the local database and Auth services, applies the project's migrations and seed data, and prints local URLs and keys when it is ready. The local development stack requires a Docker-compatible container runtime; see the [Supabase local development guide](https://supabase.com/docs/guides/local-development).

If startup succeeds, you can inspect the connection values again with:

```powershell
npx supabase status -o env
```

## 5. Create the local environment file

Copy the example file to `.env.local`:

```powershell
if (-not (Test-Path .env.local)) {
  Copy-Item .env.example .env.local
} else {
  Write-Host ".env.local already exists; keeping it."
}
notepad .env.local
```

Fill in the Supabase values printed by `npx supabase status -o env`:

| `.env.local` name | Value from Supabase CLI |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY` (or `ANON_KEY` on older CLI output) |
| `SUPABASE_SECRET_KEY` | `SECRET_KEY` (or `SERVICE_ROLE_KEY` on older CLI output) |
| `NEXT_PUBLIC_SITE_URL` | Keep `http://localhost:3000` for local development |

Leave `GROQ_API_KEY` blank if you do not need the AI mentor; the rest of the app can run without it. Do not put the Supabase secret key in a `NEXT_PUBLIC_` variable or commit `.env.local`.

Save `.env.local` before starting Next.js. If you change it later, stop and restart the dev server so it reloads the environment.

> **Using a Git worktree?** Each worktree needs its own `.env.local`. This file is gitignored and is not copied when a worktree is created.

## 6. Run the app

With Docker Desktop and Supabase still running, start Next.js from the project root:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Leave this terminal open while using the app.

Local email confirmation is disabled in this project's Supabase configuration, so a local signup should sign you in immediately. Password reset emails are captured by the local email viewer; its URL is printed by `npx supabase status`.

## Troubleshooting

- **`failed to connect to the Docker API` or `dockerDesktopLinuxEngine` not found:** Start Docker Desktop, wait for the Linux engine to become ready, then retry `docker version` and `npx supabase start`.
- **“Database not connected” on the login or signup page:** Check that `.env.local` exists in the directory where `npm run dev` is running and that its Supabase URL and publishable key are filled in.
- **`fetch failed` during signup or login:** Confirm Supabase is running with `npx supabase status`, and that `NEXT_PUBLIC_SUPABASE_URL` points to the running local API. The project uses port `54321` for the local API by default.
- **The browser still shows old environment settings:** Stop `npm run dev`, save `.env.local`, and run `npm run dev` again.

## Official installation references

- [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
- [Docker Desktop WSL 2 backend](https://docs.docker.com/desktop/features/wsl/)
- [Supabase local development](https://supabase.com/docs/guides/local-development)
- [Node.js downloads](https://nodejs.org/en/download/)
