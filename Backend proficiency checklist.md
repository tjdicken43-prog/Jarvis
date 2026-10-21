---
type: list
started: 2026-10-21
---
# Backend proficiency checklist

What Jarvis backend runs on the Gym-security code before and after every [[SecurityAI]] release, with no hardware needed. Read-only: nothing is pushed. See [[Release history]] and [[Ground rules]].

## The checks
1. Fresh copy of main; note the last commit.
2. Every server file parses: `node --check` on each `.js` file.
3. Page checks: `node qa_check.js` on admin, desk, lobby, monitor and activity pages (script syntax, every element the code looks for exists).
4. Server start: `npm install`, then start it with a throwaway `DATA_DIR`; the home page and admin page must answer 200. Missing Stripe key only gives a warning.
5. No keys, passwords or member data in the code (scan the diff).
6. Storage line on the live admin page (Render settings section) reads green: "a separate disk, so gym accounts, history and photos survive a deploy".
7. Write the result in this week's note.

## What can't be checked without hardware
- Camera and AI accuracy (the walk test and nightly self-test run on the Pi).
- Front-desk reader on a real Ashbourne screen. See [[Front-desk reader]].

## Runs
- 2026-10-21: all `.js` files parse, page checks 0 failures on 5 pages, server started and answered 200 on the home and admin pages. The repo has no automated test suite (no test script in package.json); the walk test and self-test need the Pi and cameras.
