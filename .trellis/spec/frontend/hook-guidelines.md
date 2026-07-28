# Hook Guidelines

The repository has a deliberately small custom-hook surface. Do not create a hook merely to move code out of a component.

## Established Pattern

`src/lib/hooks/useDebounce.ts` defines the reusable `useDebounce<T>(value, delay)` hook, consumed by `src/components/SearchInput.tsx`.

Custom hooks should:

- use the `use*` prefix and obey React hook rules;
- be generic only when the implementation is genuinely independent of one feature;
- expose values and callbacks rather than becoming an application-wide data store;
- declare complete effect dependencies;
- clean up timers, listeners, subscriptions, and other external resources;
- remain client-only through their consumer or an explicit client boundary.

```ts
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
```

## Extraction Decision

Keep logic in the component when it owns route-specific state or coordinates several related UI transitions. Extract a hook when the lifecycle behavior is independently meaningful and has more than one plausible consumer.

`useDebouncedCallback` currently has no repository consumer. Treat it as an available helper, not evidence that callback-wrapping hooks are the default design.

## Common Mistakes

- Storing timer IDs in state when a ref would avoid rerenders.
- Returning a callback whose identity changes every render without documenting that behavior.
- Omitting cleanup for document listeners or timers.
- Hiding authenticated fetch/write behavior in a generic hook without explicit loading and error contracts.

When changing timer or effect behavior, use fake timers or cleanup assertions where practical and confirm no update fires after unmount.
