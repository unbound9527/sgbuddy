interface SearchResult {
  title: string
  snippet: string
  url: string
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.BING_SEARCH_KEY || ''
  if (!apiKey) {
    console.log('[web_search] 未配置 BING_SEARCH_KEY，返回空结果')
    return []
  }

  try {
    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query + ' QQ三国')}&count=5&mkt=zh-CN`
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.webPages?.value || []).map((r: any) => ({
      title: r.name || '',
      snippet: r.snippet || '',
      url: r.url || '',
    }))
  } catch {
    return []
  }
}
