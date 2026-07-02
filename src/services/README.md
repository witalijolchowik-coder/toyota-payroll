# Services boundary

Firebase reads, writes, callable functions, and Storage operations belong here as feature work begins. React components should depend on typed service functions rather than importing Firebase SDK operations directly.

Step 2 exposes only Firebase client boundaries. No business services, Firestore
reads, or Firestore writes are implemented.
