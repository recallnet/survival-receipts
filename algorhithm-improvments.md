Yes. The answer is to stop comparing all AI code against all human code as one blob. Bigger changes need a fairer baseline.

I would handle it in layers.

**1. Size buckets**

Split results by change size:

```text
tiny:   1-20 added lines
small:  21-100
medium: 101-500
large:  501+
```

Then report:

```text
AI large changes survived 82%
Human large changes survived 79%

AI small changes survived 94%
Human small changes survived 91%
```

This is the easiest fix and probably the first one to add.

**2. Matched human baseline**

For each AI change, compare it to human changes that look similar:

```text
similar added lines
similar file count
same repo
same directory or package
same file type
same time period
same horizon
```

Then the report becomes:

```text
AI PR #1711 survived 85%.
Matched human baseline for similar changes: 78%.
Adjusted result: +7 points.
```

This is much better than “AI vs all humans.”

**3. Expected survival score**

Train a simple deterministic model from human commits in the same repo:

```text
expected survival =
  function of added lines, file count, file type, directory churn, age
```

Then score AI against expectation:

```text
Expected survival: 76%
Actual survival:   85%
Delta:             +9 points
```

This makes the algorithm ask: “Did this AI change survive better or worse than a similar change normally would?”

That is probably the cleanest long-term metric.

**4. Directory churn adjustment**

Some areas naturally churn more:

```text
frontend experiments
tests
migrations
generated schema
API clients
config
core business logic
```

A 70% survival rate in a high-churn UI folder may be good. A 70% survival rate in a stable core library may be bad.

So each file or directory should have a background churn rate. Survival gets judged against local history, not the whole repo.

**5. Separate change types**

A refactor, migration, feature, test-only change, and bug fix should not share one baseline.

Even a crude deterministic split helps:

```text
test-only
migration
config
feature
bug fix
refactor
generated or excluded
```

Then compare AI feature work to human feature work, AI tests to human tests, and so on.

**6. Better “death” classification**

Right now a line can “die” because it was:

```text
deleted
moved
copied
renamed
formatted
rewritten
replaced by better code
removed because the feature changed
```

Those are not the same. The next useful upgrade is to classify dead lines:

```text
true deletion
moved/refactored
same author cleanup
reviewer rewrite
later bug fix
feature removal
unknown
```

That turns survival from a blunt count into a more useful receipt.

**7. Use semantic units instead of raw lines**

Lines are noisy. Better units:

```text
function survived
class survived
export survived
route survived
test case survived
schema field survived
```

This is harder but much more meaningful. A 20-line function surviving matters more than 20 scattered formatting lines.

**My recommendation**

Do this in order:

1. Add size buckets.
2. Add matched human baseline.
3. Add adjusted survival delta:

```text
actual survival - expected survival
```

Keep the raw survival number in the report because it is auditable. But make the headline the adjusted comparison:

```text
AI survived 86%, versus 79% for similar human changes.
Adjusted survival: +7 points.
```

That keeps the metric understandable while reducing the “large changes get punished” problem.
