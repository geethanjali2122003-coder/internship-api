# Internship API

A REST API for internship records, built with Node.js, Express and SQLite (better-sqlite3). It supports listing with pagination, viewing one record, creating, updating and deleting internships, with input validation and consistent error responses.

## How to run

1. Install Node.js (LTS version).
2. Install the packages:

        npm install

3. Start the server:

        node server.js

4. Open http://localhost:3000/internships in the browser.

On the first run the server creates `internships.db` and loads the sample data (the same SQL is in `internship-board-sample.sql`). To reset the data, stop the server, delete `internships.db` and start again.

## Data model (table: internships)

| Field | Type | Notes |
|---|---|---|
| id | text | Created by the server, for example INT-005 |
| title | text | Required |
| domain | text | Required |
| mode | text | Remote, Hybrid or Onsite |
| duration_weeks | integer | Whole number from 1 to 52 |
| applications_open | boolean | Optional, default true |

## Endpoints

| Method | URL | What it does |
|---|---|---|
| GET | /internships?page=1&limit=10 | List with pagination |
| GET | /internships/:id | One internship |
| POST | /internships | Create |
| PUT | /internships/:id | Update |
| DELETE | /internships/:id | Delete |

## Response format

Success: `{ "data": ..., "meta": ... }` (`meta` appears on the list: page, limit, total, totalPages)

Error: `{ "error": { "message": "...", "details": [...] } }`

## Status codes

- 200 OK (read, update, delete)
- 201 Created (new internship)
- 400 Bad Request (invalid input, invalid page or limit, invalid JSON)
- 404 Not Found (unknown id or route)
- 409 Conflict (cannot delete an internship that has applications)
- 500 Server error

## Validation rules

- title and domain must be non-empty text.
- mode must be Remote, Hybrid or Onsite.
- duration_weeks must be a whole number from 1 to 52.
- applications_open, if sent, must be true or false.
- page must be 1 or more, limit must be 1 to 50.

## Example requests (Mac, Linux or Git Bash)

    curl "http://localhost:3000/internships?page=1&limit=2"
    curl http://localhost:3000/internships/INT-001
    curl -X POST http://localhost:3000/internships -H "Content-Type: application/json" -d '{"title":"Backend Practice Internship","domain":"Backend","mode":"Remote","duration_weeks":4}'

## Tested

List, pagination, detail, create (201), update (200), delete (200), validation error (400) and not found (404) were all tested manually.