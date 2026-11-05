# Recorded sets

Real sets recorded with the web app's **Record a set for tuning** button. The core tests replay every `.json` file here and check the counter matches the reps a person actually counted.

To add one:

1. Record a set in the web app and download the file.
2. Open it and set `expectedReps` to the number of reps you really did. Add a short `note`, like `"side-on, laptop on floor, 2 half reps at the end"`.
3. Save it here and run `npm test`.

Include some sets with mistakes (half reps, sagging hips, stepping out of frame) so the tests cover those too.
