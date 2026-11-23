<img src="assets/icon.svg" width="64" height="64" alt="">

# Drape

**A robotic composite layup cell, simulated in the browser.**

A six-axis arm on a linear rail picks cut carbon plies from a kitting table using a
conformal vacuum gripper. Each of the gripper's 18 cups extends to the height of the mould
surface below it, so a flat ply can be draped onto a doubly curved tool in one motion.
After each ply is placed, a laser line scanner checks it against a tolerance.

You can edit the ply book, switch vision-guided picking on and off, change the robot's
repeatability, speed override and mould shape, and compare cycle time, deposition rate and
placement accuracy. Finished runs are saved to a shared results table.

## What's inside

| Area          | Where                                           | Notes                                                                                                                                                                              |
| ------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kinematics    | `src/lib/sim/robot.ts`                          | Closed-form IK for a 6R arm with a spherical wrist, plus a rail axis. Elbow-up branch, consistent wrist configuration, joint limits                                                |
| Cell geometry | `src/lib/sim/cell.ts`                           | Mould surfaces (wing skin, saddle, flat), ray-to-surface, conformal gripper profile, planar pose algebra                                                                           |
| Simulation    | `src/lib/sim/engine.svelte.ts`                  | Plans each cycle as joint and Cartesian segments with quintic profiles, timed to joint speed limits. Applies seeded kitting, vision and repeatability errors, then scores each ply |
| 3D            | `src/lib/scene/`                                | Threlte (three.js for Svelte). The renderer pulls hot state each frame, and panels read a 10 Hz readout                                                                            |
| Results       | `src/lib/server/runs.ts`, `src/routes/api/runs` | SQLite via `node:sqlite`, with validated, rate-limited posts                                                                                                                       |

Tests in `src/lib/sim/sim.test.ts` cover IK round trips, reachability of every target on
every mould, and a full headless layup. They also check that vision-guided picking beats
blind picking.

## Running it

```sh
bun install
bun run dev          # http://localhost:5173
bun run test         # unit tests
bun run check        # svelte-check
bun run lint
bun run build && node build
```

Needs Node 22.17 or later, because it uses `node:sqlite`. Bun installs packages; Node
runs the app.

## Deploying on Coolify

1. **New Resource → Private Repository (with GitHub App)**, pick this repo and branch `main`.
2. Build pack: **Docker Compose**; compose file `/docker-compose.yml`.
3. On the `app` service, set the domain with the container port, e.g. `https://drape.example.com:3000`.
4. Optionally adjust the environment variables Coolify lists (see `.env.example`). None are required.
5. Deploy. Pushes to `main` redeploy automatically.

Data lives in the `app-data` volume (`/data`). That holds the SQLite database and its
automatic backups, which are taken before each migration and on each new version (the
newest 10 are kept). Include that volume in your server backups, or turn on Coolify's
volume backups, for an off-site copy.

## Background

Built by Henry Beedham as an independent study of automated composite preforming: kitting,
conformal pick-and-place, tacking and in-process inspection. It isn't affiliated with any
manufacturer, and every figure comes from the simulation.
