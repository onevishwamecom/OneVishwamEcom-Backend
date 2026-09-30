# AI & LLM Operating Instructions

> **IMPORTANT NOTICE FOR ALL AI / LLM CODING ASSISTANTS:**
> Read these rules carefully before executing any commands, creating commits, or modifying code in this workspace.

---

## 1. Strict Git & Version Control Guidelines

- **NO PERMISSION, NO GIT ACTIONS:**
  - **DO NOT** run `git add`, `git commit`, `git push`, or `git merge` without explicit permission from the user.
  - Always request confirmation or wait for direct instruction before touching git index, commits, or remotes.

- **JUST PUSH (NO FULL CYCLE):**
  - When the user instructs to "push" or "push all code", **ONLY push the active branch / target code directly**.
  - **DO NOT** perform a full cycle (do not automatically checkout other branches or perform cascading merges across branches). Just push what was requested.

- **MERGE WORKFLOW CUTOFF (CUT OFF AFTER QA):**
  - If the user explicitly asks to "merge the code", the merge chain **MUST CUT OFF after `qa`**:
    $$\text{feature / fix} \longrightarrow \text{develop} \longrightarrow \text{qa}$$
  - **NEVER merge into `main`** unless the user specifically and explicitly states to merge into `main`.

---

## 2. Deployment & Verification
- **DO NOT** deploy to Firebase Cloud Functions or production without explicit permission.
- Verify node syntax (`node -c <file>`) before running or committing.

