# SQA Test Plan and Validation Report - Music Learning and Adaptive Radio

## 1. Objective
Validate adaptive radio behavior with user learning per guild/user, including seed updates from play behavior and defect control.

## 2. Scope
- `music/MusicManager.js`
- `commands/music.js`
- `index.js` (slash play)
- `db.js` (user music preferences)
- `tests/music-seed-learning.test.js`

## 3. Test Environment Configuration
- Runtime: Docker (release stack)
- Services: bot + lavalink + panel
- Node: 20.x inside container
- Database: SQLite (`bot_data.sqlite`)

## 4. Test Plan Definition
### 4.1 Types of testing
- Black box: command behavior (`!play`, `!radio status`)
- White box: helper logic (`isDirectUrlQuery`, `looksLikeSpecificSongQuery`, seed extraction)
- Gray box: persistence effects in DB + runtime adaptation

### 4.2 Techniques
- Equivalence partitioning (URL vs plain query)
- Boundary-inspired query length rule (short intent vs specific song query)
- Risk-based focus (seed drift, stale style rollback)

## 5. Test Cases
1. Plain genre query updates seed (`!play regueton`)  
2. Specific song query infers seed by author  
3. URL query does not overwrite seed by raw URL  
4. User preference record stored by guild/user/seed  
5. New `.play` style replaces previous style for next radio continuation

## 6. Test Script Execution
Automated script included in runner:
- `tests/music-seed-learning.test.js`
- `tests/run-tests.js` updated to include new suite

Execution command (container):
- `docker compose -f docker-compose.release.yml exec -T bot npm test`

## 7. Defect Types Tracked
- Functional defects
- Data persistence defects
- Integration defects (command -> manager -> DB)
- Regression defects

## 8. Defect Reporting/Validation/Confirmation
- Report fields: title, steps, expected, actual, severity, evidence
- Validation: reproducible and traceable to test case
- Confirmation: retest after fix and closure criteria met

## 9. Results Analysis
- Adaptive seed behavior implemented
- User-level learning persisted
- Cross-guild data isolation maintained via `(guild_id, user_id, seed)` PK
- Runtime restart in release validated (healthy containers)

## 10. SQA Metrics
- Test pass rate
- Defect density per modified file
- Defect reopen rate
- Mean time to detect (MTTD)
- Mean time to resolve (MTTR)

## 11. Key Terms
- Coverage, severity, priority, traceability, regression, baseline, risk

## 12. Importance of Metrics
Metrics provide objective release decisions, prevent subjective quality claims, and support continuous improvement.

## 13. Metrics System
- Source: automated tests + runtime logs + defect tracker
- Frequency: per change set and per release cycle
- Thresholds: no blocker defects, pass-rate target >= agreed baseline

## 14. Relationship Between Artifacts
Requirement -> Test Plan -> Test Case -> Script -> Evidence -> Defect -> Retest -> Final Report

## 15. Validation Checklist
- [x] Test environment configured
- [x] Test script implemented
- [x] Defect flow defined
- [x] Metrics framework defined
- [x] Runtime release deployment validated

## 16. Flow: Requirements to Operational Service
Requirements -> Design -> Unit/Module tests -> Subsystem integration -> System integration -> Acceptance -> Deploy -> Monitor

## 17. Acceptance, Integration, and Unit Perspective
- Unit/module: helper logic and seed extraction
- Subsystem integration: command-to-manager update path
- System integration: runtime bot + lavalink + DB
- Acceptance: behavior aligns with user expectation (style continuity until explicit change)
