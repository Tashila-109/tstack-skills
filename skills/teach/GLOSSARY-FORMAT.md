# GLOSSARY.md format

`GLOSSARY.md` holds the workspace's words.
Lessons, reference documents, and learning records all use its terms.
Compressing a concept into a tight definition is itself evidence the human understands it.

```md
# {Topic} glossary

{One or two sentences on what the glossary covers.}

## Terms

**Ownership**:
The rule that each value has exactly one owning variable, and the value is dropped when that owner goes out of scope.
_Avoid_: Possession, holding

**Borrow**:
A reference to a value that does not take ownership of it.
_Avoid_: Pointer, alias
```

## Rules

- Add a term only once the human uses it correctly; the glossary records what they know, not what they have seen.
- Pick one word per concept and list the rejected synonyms under `_Avoid_`.
- Define what the term is, not what it does, in one or two sentences.
- Use the glossary's own terms inside other definitions.
- Group terms under subheadings when clusters appear; a flat list is fine otherwise.
- Where the wider field uses a term loosely, say how this workspace uses it.
- When understanding deepens, rewrite the definition in place.
