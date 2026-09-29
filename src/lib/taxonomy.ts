// Nombre científico a partir del común. Gratis y sin claves:
// 1. Wikidata acierta mucho mejor con nombres comunes en español ("olivo" → Olea europaea).
// 2. Con el id de GBIF de cada resultado nos quedamos solo con plantas y sacamos la familia.
// 3. Si Wikidata no encuentra nada, se busca en los nombres vernáculos de GBIF.

export interface TaxonSuggestion {
  scientificName: string
  commonName?: string
  family?: string
  rank?: string
  gbifKey?: number
  source: 'wikidata' | 'gbif'
}

const WIKIDATA = 'https://www.wikidata.org/w/api.php'
const GBIF = 'https://api.gbif.org/v1'
const GBIF_BACKBONE = 'd7dddbf4-2cf0-4f39-9b2a-bb099caae36c'
const PLANTAE_KEY = 6

interface GbifSpecies {
  key: number
  kingdom?: string
  family?: string
  rank?: string
  canonicalName?: string
  scientificName?: string
  vernacularNames?: { vernacularName: string; language?: string }[]
}

type Claim = { mainsnak: { datavalue?: { value: unknown } } }
type Entity = { labels?: Record<string, { value: string }>; claims?: Record<string, Claim[]> }

const claim = (e: Entity, prop: string) => e.claims?.[prop]?.[0]?.mainsnak.datavalue?.value

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

async function fromWikidata(query: string, lang: string, signal?: AbortSignal): Promise<TaxonSuggestion[]> {
  const search = new URLSearchParams({
    action: 'wbsearchentities', search: query, language: lang, uselang: lang, type: 'item', limit: '20', format: 'json', origin: '*',
  })
  const { search: hits } = await getJson<{ search: { id: string }[] }>(`${WIKIDATA}?${search}`, signal)
  if (!hits.length) return []
  const ents = new URLSearchParams({
    action: 'wbgetentities', ids: hits.map((h) => h.id).join('|'), props: 'claims|labels', languages: lang, format: 'json', origin: '*',
  })
  const { entities } = await getJson<{ entities: Record<string, Entity> }>(`${WIKIDATA}?${ents}`, signal)

  const taxa = hits
    .map((h) => entities[h.id])
    .filter((e): e is Entity => Boolean(e && claim(e, 'P225') && claim(e, 'P846')))
    .slice(0, 8)

  const checked = await Promise.all(
    taxa.map(async (e) => {
      const gbifKey = Number(claim(e, 'P846'))
      const sp = await getJson<GbifSpecies>(`${GBIF}/species/${gbifKey}`, signal).catch(() => null)
      if (sp?.kingdom !== 'Plantae') return null
      const s: TaxonSuggestion = {
        scientificName: String(claim(e, 'P225')),
        commonName: e.labels?.[lang]?.value,
        family: sp.family,
        rank: sp.rank?.toLowerCase(),
        gbifKey,
        source: 'wikidata',
      }
      return s
    }),
  )
  return checked.filter((s): s is TaxonSuggestion => s !== null)
}

async function fromGbif(query: string, signal?: AbortSignal): Promise<TaxonSuggestion[]> {
  const params = new URLSearchParams({
    q: query, qField: 'VERNACULAR', datasetKey: GBIF_BACKBONE, highertaxonKey: String(PLANTAE_KEY), limit: '8',
  })
  const { results } = await getJson<{ results: GbifSpecies[] }>(`${GBIF}/species/search?${params}`, signal)
  const needle = query.toLowerCase()
  return results
    .filter((r) => r.canonicalName)
    .map((r) => ({
      scientificName: r.canonicalName!,
      commonName: r.vernacularNames?.find((v) => v.vernacularName.toLowerCase().includes(needle))?.vernacularName,
      family: r.family,
      rank: r.rank?.toLowerCase(),
      gbifKey: r.key,
      source: 'gbif' as const,
    }))
}

const memo = new Map<string, TaxonSuggestion[]>()

export async function searchScientificName(query: string, signal?: AbortSignal, lang = 'es'): Promise<TaxonSuggestion[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const cacheKey = `${lang}:${q.toLowerCase()}`
  const hit = memo.get(cacheKey)
  if (hit) return hit
  let results = await fromWikidata(q, lang, signal).catch((e) => {
    if (signal?.aborted) throw e
    return []
  })
  if (!results.length) results = await fromGbif(q, signal)
  const seen = new Set<string>()
  const unique = results.filter((r) => !seen.has(r.scientificName) && Boolean(seen.add(r.scientificName)))
  memo.set(cacheKey, unique)
  return unique
}

export const gbifUrl = (key: number) => `https://www.gbif.org/species/${key}`
