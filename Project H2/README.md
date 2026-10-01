# Project H2

**Hospitality Operations Intelligence**

H2 covers initiatives whose primary objective is operational rather than a direct cash figure: staffing, guest flow, housekeeping, facilities and reporting. Each one ultimately affects revenue and cost, but what it optimizes is time, coverage, capacity or quality. Initiatives measured directly in revenue or expense belong to [Project HARLTON](../Project%20HARLTON/README.md).

The foundation for all H2 modules is the [unified operational BI and automated reporting proposal](./proposal.md): one trusted data layer feeding self-contained dashboards. Each module below is a self-contained proposal covering what the module is, why it matters (with sourced references) and how it will be solved.

## Modules

| ID | Module | Area | Objective |
| :-- | :-- | :-- | :-- |
| 00 | [Unified Executive BI and Automated Reporting](./proposal.md) | Reporting | One data layer and automated packs instead of manual compilation |
| 01 | [Cross-Property Shift Exchange](./01-cross-property-shift-exchange/proposal.md) | Workforce | Fill open shifts with qualified, legally rested staff across properties before overtime or agency |
| 02 | [Departure Flow Balancing](./02-departure-flow-balancing/proposal.md) | Guest flow | Flatten the morning check-out peak at elevators, front desk and housekeeping |
| 03 | [Room-Ready Notifications and Housekeeping Sequencing](./03-room-ready-guest-notifications/proposal.md) | Housekeeping | Clean rooms in the order guests need them and tell guests when they are ready |
| 04 | [Review-to-Maintenance Intelligence](./04-review-to-maintenance-intelligence/proposal.md) | Facilities | Turn guest review text into maintenance work orders and recurring-issue trends |

## Shared Principles

- **Fit around existing systems.** H2 modules sit on top of the current scheduling, PMS and maintenance tools; they do not replace them.
- **People keep the decision.** Supervisors and managers approve every change the system proposes.
- **Rules are built in.** Employment standards, collective agreements and brand standards are encoded as hard constraints.
- **Proprietary coordination engine.** Modules that balance many independent units against a shared limit use a multi-agent coordination engine developed by the author. Its internal design is not published in this repository.
