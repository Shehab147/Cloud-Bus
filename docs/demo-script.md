# Demonstration script

1. Open the home page and state clearly that the product shows scheduled estimates, not live GPS positions.
2. Browse Routes, search `Demo`, open `Demo Indigo Loop`, and show ordered stops plus the straight stop-order polyline and OpenStreetMap attribution.
3. Open a stop and show serving routes, next scheduled departures, and notices.
4. Register a student with a 12+ character password, log in, save the stop, refresh, and show that the favorite persists.
5. Log in as a securely bootstrapped administrator. Create an inactive route, add two ordered active stops, then activate it.
6. Create a weekday timetable with departure rows and show the new schedule in the public timetable filter.
7. Publish a scoped delay, show it in public announcements and the student's favorite card, then publish/expire a cancellation.
8. Open audit logs and filter `resource=announcement` to show safe administrative evidence.
9. Demonstrate dark mode, keyboard focus/skip link, mobile navigation, empty search, validation failure, and a cancelled departure label.
10. End with `/api/health`, the automated test output, and the deployment/backup checklist; do not claim infrastructure tests that remain marked `Not run`.
