// Types shared by the content pipeline and everything that renders it (plan §5). T1 holds only the
// Exhibit identifier, which the World layout names; T3 adds the zod schema, the `Content` type and
// `loadContent` here and points `ExhibitId` at the schema's inference.
declare const exhibitIdBrand: unique symbol

/** The directory name of an Exhibit: its Fallback anchor, Zone id and caption key. Only the schema produces one. */
export type ExhibitId = string & { readonly [exhibitIdBrand]: 'ExhibitId' }
