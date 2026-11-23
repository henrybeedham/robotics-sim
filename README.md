<img src="assets/icon.svg" width="64" height="64" alt="">

# Cellwork

**Four industrial robot cells, simulated in the browser.**

| Cell   | Route     | What it shows                                                                                                                                                                            |
| ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drape  | `/drape`  | A rail-mounted 6-axis arm with a conformal vacuum gripper drapes carbon plies onto a curved mould, with vision-guided picking and laser inspection                                       |
| Reach  | `/reach`  | A 38-link snake arm threads rib holes inside a wing box. Its path is planned by minimising bending energy through each hole's clearance, and every joint is checked against a bend limit |
| Stack  | `/stack`  | An arm palletises hot billets from a conveyor, either stopping each billet or intercepting and tracking moving ones, in column, brick or cross patterns                                  |
| Tandem | `/tandem` | Two gantries share one runway over a long mould, reserve rail to avoid collisions, and are compared against one gantry and fixed zones                                                   |

The landing page (`/`) shows each cell running live. Finished runs are saved to SQLite and shown on each page.

## What's inside

| Area                                           | Where                                                 |
| ---------------------------------------------- | ----------------------------------------------------- |
| Arm kinematics (closed-form IK, 6R + rail)     | `src/lib/sim/robot.ts`                                |
| Drape cell and engine                          | `src/lib/sim/cell.ts`, `src/lib/sim/engine.svelte.ts` |
| Snake-arm planner and follow-the-leader motion | `src/lib/sim/reach.svelte.ts`                         |
| Conveyor intercept planning and stacking       | `src/lib/sim/stack.svelte.ts`                         |
| Gantry scheduler with rail reservations        | `src/lib/sim/tandem.svelte.ts`                        |
| 3D scenes (Threlte / three.js)                 | `src/lib/scene/`                                      |
| Run storage                                    | `src/lib/server/runs.ts`, `src/lib/server/results.ts` |

Tests (`src/lib/sim/*.test.ts`) cover IK round trips and reachability, snake-arm planning in every structure (never through a wall), re-routing and manual driving, filling a pallet in both picking modes, collision-free gantry schedules, and two gantries beating one.

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
3. On the `app` service, set the domain with the container port, e.g. `https://cellwork.example.com:3000`.
4. Optionally adjust the environment variables Coolify lists (see `.env.example`). None are required.
5. Deploy. Pushes to `main` redeploy automatically.

Data lives in the `app-data` volume (`/data`). That holds the SQLite database and its
automatic backups, which are taken before each migration and on each new version (the
newest 10 are kept). Include that volume in your server backups, or turn on Coolify's
volume backups, for an off-site copy.

## Background

Built by Henry Beedham as independent studies of industrial robotic cells. It isn't affiliated with any
manufacturer, and every figure comes from the simulation.
