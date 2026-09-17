# VIEK Client Management — Debugging Assessment

A simple Client Management System (React + Vite frontend, Node.js + Express backend) built for the Full-Stack Software Development Intern debugging assessment. The application was provided with several intentional bugs; this document records the issues I identified, their root causes, the fixes I applied, and how I tested them.

## Running the Application

**Backend** (terminal in `server/`):

```bash
npm install
npm start
```

Runs on http://localhost:4000

**Frontend** (terminal in `client/`):

```bash
npm install
npm run dev
```

Runs on http://localhost:5173

**Test login details:**

- Email: `admin@viek.test`
- Password: `password123`

## Bugs Identified

### Backend

1. **Deleting a client never worked (always 404 "Client not found").**
2. **Added clients could get duplicate IDs** (`clients.length + 1`).
3. **Project filtering by client always returned an empty list.**
4. **The login response leaked the user's password.**
5. **Unknown routes returned Express's default HTML error page** instead of JSON, and errors were not logged.
6. **No server-side validation beyond "field is present"** (any non-empty string was accepted as an email; duplicate client emails were allowed).

### Frontend

7. **`projects` state was initialized to `undefined`**, so the first render of the Projects list crashed with `Cannot read properties of undefined (reading 'map')`.
8. **The clients list never loaded**: the frontend read `result.clients`, but the API returns the list under `result.data`.
9. **Adding a client always failed with a 500**: the POST request was missing the `Content-Type: application/json` header, so `express.json()` never parsed the body and the backend read `undefined`.
10. **Expired/invalid tokens caused crashes or silent empty lists** — a 401 response was parsed as data (`result.data` → `undefined`) instead of logging the user out.
11. **No handling of network failures** — if the backend was down, every `fetch` threw an unhandled promise rejection with no user feedback.
12. **Deleting a client that was selected in the Projects filter left the UI in an inconsistent state** (filtering by a client that no longer exists).
13. **Missing Vite config** — `@vitejs/plugin-react` was declared as a dependency but never configured; the app relied on Vite's fallback JSX handling (no Fast Refresh). Build tooling was also incorrectly listed under `dependencies` instead of `devDependencies`.

## Root Causes

1. **Delete 404** — `req.params.id` is always a **string**, while `client.id` is a **number**. The strict comparison `client.id !== id` was therefore always `true`, so `filter()` removed nothing and the length check triggered the 404 branch.
2. **Duplicate IDs** — deriving the next ID from `clients.length + 1` breaks once a client is deleted: after deleting client 2, the list has length 1 and the next client also gets ID 2.
3. **Empty project filter** — same type-mismatch class as bug 1: `project.clientId === clientId` compares a number to a query-string, so no project ever matched.
4. **Password leak** — the login handler returned the raw `user` object from the `users` array, which includes the `password` field.
5. **HTML 404s** — no catch-all route was registered before the error handler, and the error handler did not log, making server-side debugging blind.
6. **Weak validation** — the original code only checked truthiness of `name`/`email` and never checked for duplicate emails.

7. **`projects` crash** — `useState()` with no argument yields `undefined`; `.map` on `undefined` throws during the first render, before any data arrives.
8. **Clients never load** — response-shape mismatch: backend sends `{ data: [...] }`, frontend expected `{ clients: [...] }`.
9. **Add client 500** — without `Content-Type: application/json`, `express.json()` skips parsing, leaving `req.body` undefined; destructuring `{ name, email }` from it threw a TypeError → 500.
10. **401 mishandling** — the data-loading functions only checked `response.json()`, never the status, so an unauthorized response was treated as data.
11. **Unhandled rejections** — none of the `fetch` calls were wrapped in `try/catch`.
12. **Stale filter state** — nothing synchronized `selectedClient` with the client list after a delete.
13. **Missing config** — the plugin dependency existed but no `vite.config.js` referenced it, and `vite`/`plugin-react` were in the wrong dependency group.

## Solutions

**Backend (`server/server.js`)**

1. Delete: convert the parameter with `Number(req.params.id)` before comparing (and return 400 if it isn't a number).
2. Add: generate the next ID as `Math.max(...clients.map(c => c.id)) + 1` (or 1 for an empty list), so IDs are unique even after deletions.
3. Projects: compare against `Number(clientId)`.
4. Login: destructure the password out of the user object and return only safe fields (`const { password, ...safeUser } = user`).
5. Added a JSON 404 catch-all route and `console.error` logging in the error handler.
6. Added server-side email-format validation and a duplicate-email check (409).

**Frontend (`client/src/App.jsx`)**

7. `projects` is now initialized with `useState([])`, and an empty list renders a "No projects found" message.
8. `loadClients` now reads `result.data` to match the API's response shape.
9. `addClient` now sends `Content-Type: application/json`.
10. All authenticated requests check for a 401 and log the user out with a "Session expired" message instead of parsing the error as data.
11. All `fetch` calls are wrapped in `try/catch` and surface a friendly message if the backend is unreachable.
12. Deleting the currently selected client resets the filter to "All Clients" and reloads both lists.
13. Added `client/vite.config.js` with the React plugin, moved `vite` and `@vitejs/plugin-react` into `devDependencies`, and added `build`/`preview` scripts.

I did not remove or disable any feature to make an error go away — every fix preserves the original intended behaviour.

## Testing

The full user journey was tested against a running backend and frontend:

1. **Login** — correct credentials return a token and enter the dashboard; wrong credentials show "Invalid email or password" (401 path).
2. **List clients** — the two seeded clients (Acme Limited, Bright Solutions) render correctly (verifies the `result.data` fix).
3. **Add client** — adding "Test Corp / test@corp.test" returns 201 and the list updates immediately; submitting an empty/invalid form is rejected by both HTML5 and server-side validation; adding a duplicate email returns the 409 message.
4. **ID uniqueness** — deleted a client, added a new one, and confirmed the new client received a unique ID and appears correctly.
5. **Delete client** — deleting an existing client removes it from the list and shows the success message; deleting works after prior deletions (verifies the string/number fix).
6. **Project filtering** — with no filter, all 3 projects show; filtering by each client returns only that client's projects (verifies the `Number(clientId)` fix); after deleting the selected client, the filter resets and projects reload.
7. **Auth / error handling** — cleared `localStorage` token requests return 401 and the UI logs out gracefully; with the backend stopped, the UI shows a "cannot reach server" message instead of crashing.
8. **Build** — `npm run build` completes without errors, confirming the Vite config and JSX compile cleanly.

## Security

Issues noticed and how they were addressed (or should be addressed in production):

- **Plaintext password in the response** — fixed by never returning the `password` field from `/api/login`.
- **Hardcoded demo token (`demo-token`) with no expiry** — fine for this demo, but in production this should be a signed JWT (or server-side session) with an expiry, issued over HTTPS and verified by middleware on every request.
- **Plaintext password stored in source** — passwords should be hashed with bcrypt/argon2 and compared with a timing-safe comparison; credentials must never live in client-side code.
- **Credentials pre-filled in the login form** — convenient for the demo, but should be removed for any real deployment.
- **No rate limiting / brute-force protection on the login endpoint** — in production, add rate limiting (e.g. `express-rate-limit`) and account lockout/backoff.
- **No HTTPS enforcement or security headers** — production should terminate TLS and set headers via `helmet`.
- **No persistence** — data lives in memory and resets on restart; a database with parameterized queries would be the production replacement (this also prevents any future SQL-injection class of bugs).

## Reflection

**Issue requiring the most investigation:** the "always 404 on delete / always empty project filter" pair. On the surface these looked like routing or state problems, but stepping through with `console.log`/`curl` showed the routes were reached and the arrays were populated — the real cause was JavaScript's strict comparison between a numeric `client.id` and the string values that arrive from `req.params` and `req.query`. It's a subtle class of bug because each piece works in isolation and only the type coercion assumption silently fails.

**General debugging approach:** reproduce first, then narrow. I exercised each endpoint directly with `curl` to separate backend behaviour from frontend behaviour, read the actual response payloads against what the frontend expected (which exposed both the `data`/`clients` shape mismatch and the missing `Content-Type` header), read the browser console for the render crash, and applied one fix at a time — re-testing the full flow after each change to confirm I hadn't broken existing functionality.

**Unresolved issues:** none functionally. The remaining items are the production-hardening concerns listed under Security (real JWT auth, hashed passwords, persistence, rate limiting), which are explicitly out of scope for this demo application but documented above.
