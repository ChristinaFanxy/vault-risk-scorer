'use client'
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type Lang = 'en' | 'zh'

const translations = {
  en: {
    // Home page
    title: 'Morpho Vault Risk Scorer',
    subtitle: 'Assess curator vault risk before you deposit. Three dimensions, one grade.',
    chainNotice: 'Currently supports Ethereum and Base. More chains coming soon.',
    featuredVaults: 'Featured Vaults',
    searchPlaceholder: 'Paste vault address or Morpho URL',
    analyze: 'Analyze',
    detecting: 'Detecting\u2026',
    searchError: 'Could not find a vault address \u2014 paste a 0x address or a Morpho vault URL',
    notFound: 'Vault not found on Ethereum or Base',
    networkError: 'Network error \u2014 please try again',
    noVaults: 'No featured vaults available.',

    // Vault detail
    backToSearch: '\u2190 Back to search',
    overallRisk: 'Overall Risk',
    lowerIsSafer: 'lower = safer',
    ofComposite: 'of composite',
    infoOnly: 'Informational only \u2014 not scored',
    refOnly: 'Reference only \u2014 not included in score',
    viewDetails: 'View details \u2192',
    yield: 'Yield',
    currentApy: 'Current APY',
    avg7d: '7d Avg',
    avg30d: '30d Avg',
    avg90d: '90d Avg',
    stability: 'Stability',
    noData: 'No data',
    estimated: 'estimated',

    // Risk dimensions
    assetRisk: 'Underlying Asset Risk',
    curatorRisk: 'Curator Risk',
    liquidationRisk: 'Liquidation Rules Risk',

    // Curator detail
    curatorBadDebtHistory: 'Curator Bad Debt History',
    realizedBadDebt: 'Realized Bad Debt',
    unrealizedBadDebt: 'Unrealized Bad Debt',
    historicalVaults: 'Historical Vaults',
    none: 'None',
    stuckBorrows: 'Stuck borrows detected on-chain',
    cleanRecord: 'Clean record',
    noBadDebt: 'No bad debt events found across any chain',
    badDebtEvents: 'Bad Debt Events',
    badDebtEventsDesc: 'Sorted by amount (descending). Data from The Graph \u2014 immutable on-chain records.',
    market: 'Market',
    chain: 'Chain',
    badDebtUsd: 'Bad Debt (USD)',
    unrealizedDetected: 'Unrealized Bad Debt Detected',
    unrealizedDesc: (amt: string) => `${amt} in stuck borrows found across historical markets. These are markets with >97% utilization and less than $10K remaining liquidity where this curator's vaults still have supply positions but borrowers have not repaid. The protocol has not formally "realized" this as bad debt yet, but the funds are effectively locked.`,
    dataSource: 'Data source: The Graph Morpho Blue subgraph (immutable on-chain data)',
    sharedMarkets: 'Shared markets may attribute the same bad debt to multiple curators.',

    // Grades
    gradeA: 'Low Risk',
    gradeB: 'Moderate Risk',
    gradeC: 'Elevated Risk',
    gradeD: 'High Risk',
    gradeF: 'Very High Risk',
  },
  zh: {
    // 首页
    title: 'Morpho 金库风险评估',
    subtitle: '\u5b58\u6b3e\u524d\u8bc4\u4f30\u91d1\u5e93\u98ce\u9669\u3002\u4e09\u4e2a\u7ef4\u5ea6\uff0c\u4e00\u4e2a\u7b49\u7ea7\u3002',
    chainNotice: '\u76ee\u524d\u652f\u6301 Ethereum \u548c Base\u3002\u66f4\u591a\u94fe\u5373\u5c06\u4e0a\u7ebf\u3002',
    featuredVaults: '\u7cbe\u9009\u91d1\u5e93',
    searchPlaceholder: '\u7c98\u8d34\u91d1\u5e93\u5730\u5740\u6216 Morpho URL',
    analyze: '\u5206\u6790',
    detecting: '\u68c0\u6d4b\u4e2d\u2026',
    searchError: '\u672a\u627e\u5230\u91d1\u5e93\u5730\u5740 \u2014 \u8bf7\u7c98\u8d34 0x \u5730\u5740\u6216 Morpho \u91d1\u5e93 URL',
    notFound: '\u5728 Ethereum \u548c Base \u4e0a\u672a\u627e\u5230\u8be5\u91d1\u5e93',
    networkError: '\u7f51\u7edc\u9519\u8bef \u2014 \u8bf7\u91cd\u8bd5',
    noVaults: '\u6682\u65e0\u7cbe\u9009\u91d1\u5e93\u3002',

    // 金库详情
    backToSearch: '\u2190 \u8fd4\u56de\u641c\u7d22',
    overallRisk: '\u7efc\u5408\u98ce\u9669',
    lowerIsSafer: '\u8d8a\u4f4e\u8d8a\u5b89\u5168',
    ofComposite: '\u5360\u7efc\u5408\u5206',
    infoOnly: '\u4ec5\u4f9b\u53c2\u8003 \u2014 \u4e0d\u8ba1\u5165\u8bc4\u5206',
    refOnly: '\u4ec5\u4f9b\u53c2\u8003 \u2014 \u4e0d\u8ba1\u5165\u8bc4\u5206',
    viewDetails: '\u67e5\u770b\u8be6\u60c5 \u2192',
    yield: '\u6536\u76ca',
    currentApy: '\u5f53\u524d APY',
    avg7d: '7\u65e5\u5747\u503c',
    avg30d: '30\u65e5\u5747\u503c',
    avg90d: '90\u65e5\u5747\u503c',
    stability: '\u7a33\u5b9a\u6027',
    noData: '\u65e0\u6570\u636e',
    estimated: '\u4f30\u7b97',

    // 风险维度
    assetRisk: '\u5e95\u5c42\u8d44\u4ea7\u98ce\u9669',
    curatorRisk: '\u7ba1\u7406\u4eba\u98ce\u9669',
    liquidationRisk: '\u6e05\u7b97\u89c4\u5219\u98ce\u9669',

    // Curator 详情
    curatorBadDebtHistory: '\u7ba1\u7406\u4eba\u574f\u8d26\u5386\u53f2',
    realizedBadDebt: '\u5df2\u6838\u9500\u574f\u8d26',
    unrealizedBadDebt: '\u672a\u6838\u9500\u574f\u8d26',
    historicalVaults: '\u5386\u53f2\u91d1\u5e93',
    none: '\u65e0',
    stuckBorrows: '\u94fe\u4e0a\u68c0\u6d4b\u5230\u7684\u6ede\u7559\u501f\u6b3e',
    cleanRecord: '\u8bb0\u5f55\u826f\u597d',
    noBadDebt: '\u6240\u6709\u94fe\u4e0a\u5747\u672a\u53d1\u73b0\u574f\u8d26\u4e8b\u4ef6',
    badDebtEvents: '\u574f\u8d26\u4e8b\u4ef6',
    badDebtEventsDesc: '\u6309\u91d1\u989d\u964d\u5e8f\u6392\u5217\u3002\u6570\u636e\u6765\u6e90\uff1aThe Graph \u2014 \u4e0d\u53ef\u7be1\u6539\u7684\u94fe\u4e0a\u8bb0\u5f55\u3002',
    market: '\u5e02\u573a',
    chain: '\u94fe',
    badDebtUsd: '\u574f\u8d26 (USD)',
    unrealizedDetected: '\u68c0\u6d4b\u5230\u672a\u6838\u9500\u574f\u8d26',
    unrealizedDesc: (amt: string) => `\u5728\u5386\u53f2\u5e02\u573a\u4e2d\u53d1\u73b0 ${amt} \u6ede\u7559\u501f\u6b3e\u3002\u8fd9\u4e9b\u5e02\u573a\u5229\u7528\u7387\u8d85\u8fc7 97% \u4e14\u5269\u4f59\u6d41\u52a8\u6027\u4f4e\u4e8e $10K\uff0c\u8be5\u7ba1\u7406\u4eba\u7684\u91d1\u5e93\u4ecd\u6709\u4f9b\u5e94\u5934\u5bf8\uff0c\u4f46\u501f\u6b3e\u4eba\u672a\u8fd8\u6b3e\u3002\u534f\u8bae\u5c1a\u672a\u6b63\u5f0f\u201c\u6838\u9500\u201d\u8fd9\u4e9b\u574f\u8d26\uff0c\u4f46\u8d44\u91d1\u5b9e\u9645\u4e0a\u5df2\u88ab\u9501\u5b9a\u3002`,
    dataSource: '\u6570\u636e\u6765\u6e90\uff1aThe Graph Morpho Blue \u5b50\u56fe\uff08\u4e0d\u53ef\u7be1\u6539\u7684\u94fe\u4e0a\u6570\u636e\uff09',
    sharedMarkets: '\u5171\u4eab\u5e02\u573a\u53ef\u80fd\u5c06\u540c\u4e00\u574f\u8d26\u5f52\u56e0\u4e8e\u591a\u4e2a\u7ba1\u7406\u4eba\u3002',

    // 等级
    gradeA: '\u4f4e\u98ce\u9669',
    gradeB: '\u4e2d\u7b49\u98ce\u9669',
    gradeC: '\u8f83\u9ad8\u98ce\u9669',
    gradeD: '\u9ad8\u98ce\u9669',
    gradeF: '\u6781\u9ad8\u98ce\u9669',
  },
}

export type Translations = typeof translations.en

const LanguageContext = createContext<{
  lang: Lang
  t: Translations
  setLang: (lang: Lang) => void
}>({
  lang: 'en',
  t: translations.en,
  setLang: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')
  const setLang = useCallback((l: Lang) => setLangState(l), [])
  const t = translations[lang]

  return (
    <LanguageContext.Provider value={{ lang, t, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

export function LanguageToggle() {
  const { lang, setLang } = useLanguage()
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
      className="flex items-center gap-1.5 px-3 py-1 rounded border border-brand-border text-brand-light hover:text-brand-cream hover:border-brand-light transition-colors text-sm"
    >
      <span>Language</span>
      <span className="text-brand-cream font-medium">{lang === 'en' ? 'EN' : '中文'}</span>
    </button>
  )
}
