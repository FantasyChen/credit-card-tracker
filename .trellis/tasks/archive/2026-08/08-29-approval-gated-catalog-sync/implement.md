# Implementation plan

1. Add the path-filtered GitHub Actions workflow with dry-run and protected
   apply jobs.
2. Add a static validator/test for workflow structure and exact safety gates.
3. Document environment setup, required reviewers, target verification, and
   post-apply status propagation.
4. Run workflow/config parsing, the validator, catalog template validation,
   public DB invariant, TypeScript/tests where dependencies permit, and
   `git diff --check`.
5. Review the complete diff and confirm no secrets, generated output, or
   production execution occurred.
