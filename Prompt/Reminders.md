# Reminders & Open Risks

Running list of decisions, risks, and follow-ups that don't fit inside a
specific prompt or feature brief. Add new entries at the top with a
date. Strike through or remove once resolved.

---

## 2026-05-12

### 1. `Spacio` rebrand still sitting on `ben_test_v1`

The branch `ben_test_v1` contains a commit titled *"Spacio rebrand,
dark theme, responsive layout, Teams reminders, admin desk editor"* by
Ben Huson. It changes the product name across the UI to **Spacio**.
That name is **not safe to ship**:

- An existing US proptech tool called **Spacio** is well-known in
  real-estate open-house workflows — direct adjacency to our space.
- Several international brands (interior design, co-working) also use
  *Spacio* / *Spacio Living* / *Spacio Group*.

If `ben_test_v1` is merged as-is, the Spacio name will reappear in the
running app (Find My Desk → Spacio header, etc.). The narration assets
on `feat/sentient-and-fast-followers` have been re-worded to use the
neutral descriptor *"the sentient workplace"* instead.

**Action:** before merging Ben's branch, either pick a clean product
name (see #2) or rename Spacio out of the UI as part of the merge.

### 2. Trademark search required before any external naming

Whatever product name we land on (Find My Desk, the sentient
workplace, or a new codename), it needs to clear a real trademark
search before any external-facing demo, pitch, or website goes live.
Workplace-platform branding is a crowded category — informal Google
checks aren't enough.

**Minimum checks before external use:**

- WIPO Global Brand Database (multi-jurisdiction)
- UK IPO trademark search
- US PTO TESS (if any US audience is in scope)
- Companies House for existing UK companies using the name
- Domain availability (`.com`, `.co.uk`, `.ai`) as a signal of how
  contested the name is

**Action:** assign an owner before the next external demo.

---

## Template for new entries

```markdown
## YYYY-MM-DD

### N. Short title

Context paragraph: what the reminder is about and why it matters.

**Action:** what needs to happen, ideally with an owner.
```
