/**
 * lib/hooks/fetcher.ts — SWR fetcher for API routes.
 *
 * A thin wrapper around fetch that throws on non-OK responses and
 * returns the parsed JSON body. SWR uses this as its default fetcher.
 */

// Generic <T> is TypeScript's equivalent of Java generics. The caller writes
// useSWR<StoriesApiResponse>(...) to tell the compiler what shape to expect back.
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)

  // res.ok is true when the HTTP status is 200–299, equivalent to
  // httpResponse.getStatusCode() / 100 == 2 in Java's HttpClient.
  if (!res.ok) {
    const body = await res.text()
    // SWR's contract: throw (don't return) errors. SWR catches thrown values
    // and exposes them via the `error` field returned by useSWR(). If we
    // returned an error object instead, SWR would treat it as valid data.
    throw new Error(`API error ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
}
